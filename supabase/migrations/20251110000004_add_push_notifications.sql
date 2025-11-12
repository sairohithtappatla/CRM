-- Migration: Add Push Notifications System
-- Description: Creates infrastructure for PWA push notifications and email digests
-- Date: 2025-11-10

-- Create push notification subscriptions table (for PWA)
CREATE TABLE public.push_subscriptions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  admin_id uuid NOT NULL,
  endpoint text NOT NULL,
  keys jsonb NOT NULL, -- Contains p256dh and auth keys
  user_agent text,
  device_name text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  last_used_at timestamp with time zone DEFAULT now(),
  CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT push_subscriptions_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.admins(id) ON DELETE CASCADE,
  CONSTRAINT push_subscriptions_endpoint_unique UNIQUE (endpoint)
);

CREATE INDEX idx_push_subscriptions_admin_id ON public.push_subscriptions(admin_id);
CREATE INDEX idx_push_subscriptions_is_active ON public.push_subscriptions(is_active);

-- Enable RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY push_subs_own_data ON public.push_subscriptions
FOR ALL
TO public
USING (true)
WITH CHECK (true);

COMMENT ON TABLE public.push_subscriptions IS 'PWA push notification subscriptions for admin users';
COMMENT ON COLUMN public.push_subscriptions.keys IS 'Web Push API keys: {p256dh, auth}';

-- Create notification preferences table
CREATE TABLE public.notification_preferences (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  admin_id uuid NOT NULL,
  channel text NOT NULL CHECK (channel = ANY (ARRAY['push'::text, 'email'::text, 'sms'::text])),
  notification_type text NOT NULL CHECK (notification_type = ANY (ARRAY[
    'hot_lead'::text,
    'high_stress'::text,
    'payment_dispute'::text,
    'complaint'::text,
    'spam'::text,
    'urgent'::text,
    'new_message'::text,
    'payment_received'::text,
    'daily_digest'::text,
    'weekly_report'::text
  ])),
  enabled boolean DEFAULT true,
  quiet_hours_start time,
  quiet_hours_end time,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT notification_preferences_pkey PRIMARY KEY (id),
  CONSTRAINT notification_preferences_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.admins(id) ON DELETE CASCADE,
  CONSTRAINT notification_preferences_unique UNIQUE (admin_id, channel, notification_type)
);

CREATE INDEX idx_notification_preferences_admin_id ON public.notification_preferences(admin_id);

-- Enable RLS
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY notif_prefs_own_data ON public.notification_preferences
FOR ALL
TO public
USING (true)
WITH CHECK (true);

COMMENT ON TABLE public.notification_preferences IS 'User preferences for different notification channels and types';

-- Create notification queue table (for tracking delivery)
CREATE TABLE public.notification_queue (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  admin_id uuid NOT NULL,
  notification_id uuid, -- References admin_notifications
  channel text NOT NULL CHECK (channel = ANY (ARRAY['push'::text, 'email'::text, 'sms'::text])),
  status text NOT NULL DEFAULT 'pending' CHECK (status = ANY (ARRAY[
    'pending'::text,
    'sent'::text,
    'delivered'::text,
    'failed'::text,
    'skipped'::text
  ])),
  payload jsonb NOT NULL,
  error_message text,
  attempts int DEFAULT 0,
  max_attempts int DEFAULT 3,
  scheduled_at timestamp with time zone DEFAULT now(),
  sent_at timestamp with time zone,
  delivered_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT notification_queue_pkey PRIMARY KEY (id),
  CONSTRAINT notification_queue_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.admins(id) ON DELETE CASCADE,
  CONSTRAINT notification_queue_notification_id_fkey FOREIGN KEY (notification_id) REFERENCES public.admin_notifications(id) ON DELETE SET NULL
);

CREATE INDEX idx_notification_queue_status ON public.notification_queue(status);
CREATE INDEX idx_notification_queue_scheduled_at ON public.notification_queue(scheduled_at);
CREATE INDEX idx_notification_queue_admin_id ON public.notification_queue(admin_id);

-- Enable RLS
ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY notif_queue_all ON public.notification_queue
FOR ALL
TO public
USING (true)
WITH CHECK (true);

COMMENT ON TABLE public.notification_queue IS 'Queue for managing notification delivery across different channels';

-- Create email digest settings table
CREATE TABLE public.email_digest_settings (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  admin_id uuid NOT NULL,
  frequency text NOT NULL CHECK (frequency = ANY (ARRAY['daily'::text, 'weekly'::text, 'disabled'::text])),
  preferred_time time DEFAULT '09:00:00',
  preferred_day_of_week int CHECK (preferred_day_of_week >= 0 AND preferred_day_of_week <= 6), -- 0 = Sunday
  include_lead_summary boolean DEFAULT true,
  include_payment_summary boolean DEFAULT true,
  include_top_messages boolean DEFAULT true,
  include_alerts boolean DEFAULT true,
  last_sent_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT email_digest_settings_pkey PRIMARY KEY (id),
  CONSTRAINT email_digest_settings_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.admins(id) ON DELETE CASCADE,
  CONSTRAINT email_digest_settings_admin_id_unique UNIQUE (admin_id)
);

-- Enable RLS
ALTER TABLE public.email_digest_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY email_digest_own_data ON public.email_digest_settings
FOR ALL
TO public
USING (true)
WITH CHECK (true);

COMMENT ON TABLE public.email_digest_settings IS 'Email digest preferences for admin users';

-- Function to check if notification should be sent (respects quiet hours)
CREATE OR REPLACE FUNCTION public.should_send_notification(
  p_admin_id uuid,
  p_channel text,
  p_notification_type text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  pref_record RECORD;
  current_time_only time;
BEGIN
  current_time_only := CURRENT_TIME;

  -- Check if preference exists and is enabled
  SELECT * INTO pref_record
  FROM public.notification_preferences
  WHERE admin_id = p_admin_id
    AND channel = p_channel
    AND notification_type = p_notification_type;

  -- If no preference exists, default to enabled (except during quiet hours)
  IF NOT FOUND THEN
    RETURN true;
  END IF;

  -- If disabled, return false
  IF NOT pref_record.enabled THEN
    RETURN false;
  END IF;

  -- Check quiet hours
  IF pref_record.quiet_hours_start IS NOT NULL AND pref_record.quiet_hours_end IS NOT NULL THEN
    IF pref_record.quiet_hours_start < pref_record.quiet_hours_end THEN
      -- Normal case: quiet hours within same day (e.g., 22:00 - 08:00)
      IF current_time_only >= pref_record.quiet_hours_start
         AND current_time_only < pref_record.quiet_hours_end THEN
        RETURN false;
      END IF;
    ELSE
      -- Crosses midnight (e.g., 22:00 - 08:00)
      IF current_time_only >= pref_record.quiet_hours_start
         OR current_time_only < pref_record.quiet_hours_end THEN
        RETURN false;
      END IF;
    END IF;
  END IF;

  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.should_send_notification IS 'Checks if a notification should be sent based on user preferences and quiet hours';

-- Function to queue a notification
CREATE OR REPLACE FUNCTION public.queue_notification(
  p_admin_id uuid,
  p_notification_id uuid,
  p_channel text,
  p_payload jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  queue_id uuid;
BEGIN
  INSERT INTO public.notification_queue (
    admin_id,
    notification_id,
    channel,
    payload,
    status
  )
  VALUES (
    p_admin_id,
    p_notification_id,
    p_channel,
    p_payload,
    'pending'
  )
  RETURNING id INTO queue_id;

  RETURN queue_id;
END;
$$;

COMMENT ON FUNCTION public.queue_notification IS 'Adds a notification to the delivery queue';

-- Function to send push notification (to be called by Edge Function)
CREATE OR REPLACE FUNCTION public.get_push_subscriptions_for_admin(
  p_admin_id uuid
)
RETURNS TABLE (
  subscription_id uuid,
  endpoint text,
  keys jsonb,
  device_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ps.id,
    ps.endpoint,
    ps.keys,
    ps.device_name
  FROM public.push_subscriptions ps
  WHERE ps.admin_id = p_admin_id
    AND ps.is_active = true;
END;
$$;

COMMENT ON FUNCTION public.get_push_subscriptions_for_admin IS 'Gets active push subscriptions for an admin';

-- Function to mark notification as sent
CREATE OR REPLACE FUNCTION public.mark_notification_sent(
  p_queue_id uuid,
  p_status text DEFAULT 'sent',
  p_error_message text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.notification_queue
  SET
    status = p_status,
    sent_at = CASE WHEN p_status = 'sent' THEN now() ELSE sent_at END,
    delivered_at = CASE WHEN p_status = 'delivered' THEN now() ELSE delivered_at END,
    error_message = p_error_message,
    attempts = attempts + 1
  WHERE id = p_queue_id;
END;
$$;

COMMENT ON FUNCTION public.mark_notification_sent IS 'Updates notification queue status after delivery attempt';

-- Function to get pending notifications
CREATE OR REPLACE FUNCTION public.get_pending_notifications(
  p_channel text DEFAULT NULL,
  p_limit int DEFAULT 50
)
RETURNS TABLE (
  queue_id uuid,
  admin_id uuid,
  admin_email text,
  channel text,
  payload jsonb,
  attempts int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    nq.id,
    nq.admin_id,
    a.email,
    nq.channel,
    nq.payload,
    nq.attempts
  FROM public.notification_queue nq
  JOIN public.admins a ON nq.admin_id = a.id
  WHERE
    nq.status = 'pending'
    AND nq.scheduled_at <= now()
    AND nq.attempts < nq.max_attempts
    AND (p_channel IS NULL OR nq.channel = p_channel)
  ORDER BY nq.scheduled_at ASC
  LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION public.get_pending_notifications IS 'Gets pending notifications from the queue';

-- Function to generate email digest data
CREATE OR REPLACE FUNCTION public.get_email_digest_data(
  p_admin_id uuid,
  p_since timestamp with time zone DEFAULT now() - interval '24 hours'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  digest_data jsonb;
  settings RECORD;
BEGIN
  -- Get digest settings
  SELECT * INTO settings
  FROM public.email_digest_settings
  WHERE admin_id = p_admin_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Build digest data
  digest_data := jsonb_build_object(
    'admin_id', p_admin_id,
    'period_start', p_since,
    'period_end', now()
  );

  -- Add lead summary if enabled
  IF settings.include_lead_summary THEN
    digest_data := digest_data || jsonb_build_object(
      'leads', jsonb_build_object(
        'new_leads', (SELECT COUNT(*) FROM public.leads WHERE created_at > p_since),
        'hot_leads', (SELECT COUNT(*) FROM public.leads WHERE status = 'HOT'),
        'converted', (SELECT COUNT(*) FROM public.leads WHERE status = 'ADMITTED' AND created_at > p_since)
      )
    );
  END IF;

  -- Add payment summary if enabled
  IF settings.include_payment_summary THEN
    digest_data := digest_data || jsonb_build_object(
      'payments', jsonb_build_object(
        'total_amount', (SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE created_at > p_since AND status = 'paid'),
        'count', (SELECT COUNT(*) FROM public.payments WHERE created_at > p_since),
        'pending', (SELECT COUNT(*) FROM public.payments WHERE status = 'pending')
      )
    );
  END IF;

  -- Add unread alerts if enabled
  IF settings.include_alerts THEN
    digest_data := digest_data || jsonb_build_object(
      'alerts', (
        SELECT jsonb_agg(
          jsonb_build_object(
            'type', type,
            'message', message,
            'created_at', created_at
          )
        )
        FROM public.admin_notifications
        WHERE is_read = false
          AND created_at > p_since
        ORDER BY created_at DESC
        LIMIT 10
      )
    );
  END IF;

  RETURN digest_data;
END;
$$;

COMMENT ON FUNCTION public.get_email_digest_data IS 'Generates email digest data for an admin user';

-- Trigger: Auto-queue notifications when admin_notification is created
CREATE OR REPLACE FUNCTION public.auto_queue_admin_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  admin_record RECORD;
  pref_record RECORD;
BEGIN
  -- Get all admins in the organization
  FOR admin_record IN
    SELECT a.id, a.email
    FROM public.admins a
    WHERE a.organization_id = (
      SELECT organization_id FROM public.leads WHERE id = NEW.lead_id
    )
  LOOP
    -- Check each channel
    FOR pref_record IN
      SELECT channel
      FROM public.notification_preferences
      WHERE admin_id = admin_record.id
        AND notification_type = NEW.type
        AND enabled = true
    LOOP
      -- Queue notification if should be sent
      IF public.should_send_notification(admin_record.id, pref_record.channel, NEW.type) THEN
        PERFORM public.queue_notification(
          admin_record.id,
          NEW.id,
          pref_record.channel,
          jsonb_build_object(
            'title', CASE NEW.type
              WHEN 'hot_lead' THEN '🔥 Hot Lead Alert'
              WHEN 'high_stress' THEN '😰 High Stress Detected'
              WHEN 'payment_dispute' THEN '💳 Payment Issue'
              WHEN 'complaint' THEN '⚠️ Complaint Received'
              WHEN 'spam' THEN '🚫 Spam Detected'
              WHEN 'urgent' THEN '🚨 Urgent Action Required'
              ELSE 'Notification'
            END,
            'body', NEW.message,
            'type', NEW.type,
            'lead_id', NEW.lead_id,
            'notification_id', NEW.id
          )
        );
      END IF;
    END LOOP;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_auto_queue_notification
AFTER INSERT ON public.admin_notifications
FOR EACH ROW
EXECUTE FUNCTION public.auto_queue_admin_notification();

COMMENT ON FUNCTION public.auto_queue_admin_notification IS 'Automatically queues notifications when admin_notification is created';

-- Create default notification preferences for existing admins
INSERT INTO public.notification_preferences (admin_id, channel, notification_type, enabled)
SELECT
  a.id,
  'email',
  type_val,
  true
FROM public.admins a
CROSS JOIN (
  VALUES
    ('hot_lead'),
    ('high_stress'),
    ('payment_dispute'),
    ('complaint'),
    ('urgent'),
    ('payment_received')
) AS t(type_val)
ON CONFLICT (admin_id, channel, notification_type) DO NOTHING;

-- Create default email digest settings for existing admins
INSERT INTO public.email_digest_settings (admin_id, frequency, preferred_time)
SELECT id, 'daily', '09:00:00'
FROM public.admins
ON CONFLICT (admin_id) DO NOTHING;
