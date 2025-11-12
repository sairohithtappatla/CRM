-- Migration: Multi-Tenant Improvements
-- Description: Enhances multi-tenancy with organization-level isolation and features
-- Date: 2025-11-10

-- Add additional columns to organizations table
ALTER TABLE public.organizations
ADD COLUMN subscription_plan text DEFAULT 'free' CHECK (subscription_plan = ANY (ARRAY['free'::text, 'basic'::text, 'pro'::text, 'enterprise'::text])),
ADD COLUMN subscription_status text DEFAULT 'active' CHECK (subscription_status = ANY (ARRAY['active'::text, 'trial'::text, 'suspended'::text, 'cancelled'::text])),
ADD COLUMN trial_ends_at timestamp with time zone,
ADD COLUMN max_leads int DEFAULT 100,
ADD COLUMN max_admins int DEFAULT 5,
ADD COLUMN features jsonb DEFAULT '{"ai_insights": false, "vector_search": false, "advanced_analytics": false}'::jsonb,
ADD COLUMN settings jsonb DEFAULT '{}'::jsonb,
ADD COLUMN phone text,
ADD COLUMN address text,
ADD COLUMN is_active boolean DEFAULT true,
ADD COLUMN updated_at timestamp with time zone DEFAULT now();

-- Create index for organization queries
CREATE INDEX idx_organizations_subscription_status ON public.organizations(subscription_status);
CREATE INDEX idx_organizations_is_active ON public.organizations(is_active);

COMMENT ON COLUMN public.organizations.subscription_plan IS 'Subscription tier: free, basic, pro, enterprise';
COMMENT ON COLUMN public.organizations.max_leads IS 'Maximum number of leads allowed for this organization';
COMMENT ON COLUMN public.organizations.max_admins IS 'Maximum number of admin users allowed';
COMMENT ON COLUMN public.organizations.features IS 'Feature flags for this organization';

-- Create organization usage tracking table
CREATE TABLE public.organization_usage (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL,
  metric_name text NOT NULL,
  metric_value bigint NOT NULL DEFAULT 0,
  recorded_at timestamp with time zone DEFAULT now(),
  period_start timestamp with time zone NOT NULL,
  period_end timestamp with time zone NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT organization_usage_pkey PRIMARY KEY (id),
  CONSTRAINT organization_usage_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE
);

CREATE INDEX idx_organization_usage_org_id ON public.organization_usage(organization_id);
CREATE INDEX idx_organization_usage_metric ON public.organization_usage(metric_name);
CREATE INDEX idx_organization_usage_period ON public.organization_usage(period_start, period_end);

-- Enable RLS
ALTER TABLE public.organization_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_usage_all ON public.organization_usage
FOR ALL
TO public
USING (true)
WITH CHECK (true);

COMMENT ON TABLE public.organization_usage IS 'Tracks usage metrics for each organization (leads, messages, storage, etc.)';

-- Create organization invitations table
CREATE TABLE public.organization_invitations (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'admin' CHECK (role = ANY (ARRAY['admin'::text, 'manager'::text, 'viewer'::text])),
  invited_by uuid NOT NULL,
  token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'expired'::text, 'cancelled'::text])),
  expires_at timestamp with time zone NOT NULL,
  accepted_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT organization_invitations_pkey PRIMARY KEY (id),
  CONSTRAINT organization_invitations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT organization_invitations_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES public.admins(id) ON DELETE CASCADE
);

CREATE INDEX idx_org_invitations_token ON public.organization_invitations(token);
CREATE INDEX idx_org_invitations_email ON public.organization_invitations(email);

-- Enable RLS
ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_invites_all ON public.organization_invitations
FOR ALL
TO public
USING (true)
WITH CHECK (true);

COMMENT ON TABLE public.organization_invitations IS 'Invitation tokens for adding new admins to organizations';

-- Add role to admins table
ALTER TABLE public.admins
ADD COLUMN role text DEFAULT 'admin' CHECK (role = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text, 'viewer'::text])),
ADD COLUMN is_active boolean DEFAULT true,
ADD COLUMN last_login_at timestamp with time zone,
ADD COLUMN updated_at timestamp with time zone DEFAULT now();

CREATE INDEX idx_admins_role ON public.admins(role);
CREATE INDEX idx_admins_is_active ON public.admins(is_active);

COMMENT ON COLUMN public.admins.role IS 'User role: owner (full access), admin (full access), manager (limited), viewer (read-only)';

-- Function to check organization limits
CREATE OR REPLACE FUNCTION public.check_organization_limit(
  p_organization_id uuid,
  p_limit_type text -- 'leads' or 'admins'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  org_record RECORD;
  current_count int;
BEGIN
  -- Get organization limits
  SELECT * INTO org_record
  FROM public.organizations
  WHERE id = p_organization_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Check if organization is active
  IF NOT org_record.is_active THEN
    RETURN false;
  END IF;

  -- Check specific limit
  IF p_limit_type = 'leads' THEN
    SELECT COUNT(*) INTO current_count
    FROM public.leads
    WHERE organization_id = p_organization_id;

    RETURN current_count < org_record.max_leads;

  ELSIF p_limit_type = 'admins' THEN
    SELECT COUNT(*) INTO current_count
    FROM public.admins
    WHERE organization_id = p_organization_id
      AND is_active = true;

    RETURN current_count < org_record.max_admins;

  ELSE
    RETURN false;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.check_organization_limit IS 'Checks if organization has reached its limit for leads or admins';

-- Function to get organization usage stats
CREATE OR REPLACE FUNCTION public.get_organization_stats(
  p_organization_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  stats jsonb;
BEGIN
  SELECT jsonb_build_object(
    'organization_id', p_organization_id,
    'leads', jsonb_build_object(
      'total', (SELECT COUNT(*) FROM public.leads WHERE organization_id = p_organization_id),
      'hot', (SELECT COUNT(*) FROM public.leads WHERE organization_id = p_organization_id AND status = 'HOT'),
      'warm', (SELECT COUNT(*) FROM public.leads WHERE organization_id = p_organization_id AND status = 'WARM'),
      'cold', (SELECT COUNT(*) FROM public.leads WHERE organization_id = p_organization_id AND status = 'COLD'),
      'admitted', (SELECT COUNT(*) FROM public.leads WHERE organization_id = p_organization_id AND status = 'ADMITTED'),
      'this_month', (SELECT COUNT(*) FROM public.leads WHERE organization_id = p_organization_id AND created_at > date_trunc('month', now()))
    ),
    'admins', jsonb_build_object(
      'total', (SELECT COUNT(*) FROM public.admins WHERE organization_id = p_organization_id),
      'active', (SELECT COUNT(*) FROM public.admins WHERE organization_id = p_organization_id AND is_active = true)
    ),
    'messages', jsonb_build_object(
      'total', (
        SELECT COUNT(*)
        FROM public.messages m
        JOIN public.leads l ON m.lead_id = l.id
        WHERE l.organization_id = p_organization_id
      ),
      'today', (
        SELECT COUNT(*)
        FROM public.messages m
        JOIN public.leads l ON m.lead_id = l.id
        WHERE l.organization_id = p_organization_id
          AND m.timestamp > CURRENT_DATE
      )
    ),
    'payments', jsonb_build_object(
      'total_amount', (
        SELECT COALESCE(SUM(p.amount), 0)
        FROM public.payments p
        JOIN public.leads l ON p.lead_id = l.id
        WHERE l.organization_id = p_organization_id
          AND p.status = 'paid'
      ),
      'count', (
        SELECT COUNT(*)
        FROM public.payments p
        JOIN public.leads l ON p.lead_id = l.id
        WHERE l.organization_id = p_organization_id
      ),
      'this_month', (
        SELECT COALESCE(SUM(p.amount), 0)
        FROM public.payments p
        JOIN public.leads l ON p.lead_id = l.id
        WHERE l.organization_id = p_organization_id
          AND p.status = 'paid'
          AND p.created_at > date_trunc('month', now())
      )
    )
  ) INTO stats;

  RETURN stats;
END;
$$;

COMMENT ON FUNCTION public.get_organization_stats IS 'Gets comprehensive statistics for an organization';

-- Function to check organization feature access
CREATE OR REPLACE FUNCTION public.has_organization_feature(
  p_organization_id uuid,
  p_feature_name text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  org_features jsonb;
BEGIN
  SELECT features INTO org_features
  FROM public.organizations
  WHERE id = p_organization_id;

  IF org_features IS NULL THEN
    RETURN false;
  END IF;

  RETURN COALESCE((org_features ->> p_feature_name)::boolean, false);
END;
$$;

COMMENT ON FUNCTION public.has_organization_feature IS 'Checks if an organization has access to a specific feature';

-- Trigger: Prevent creating leads beyond organization limit
CREATE OR REPLACE FUNCTION public.enforce_lead_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT public.check_organization_limit(NEW.organization_id, 'leads') THEN
    RAISE EXCEPTION 'Organization has reached its lead limit. Please upgrade your plan.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_enforce_lead_limit
BEFORE INSERT ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.enforce_lead_limit();

COMMENT ON FUNCTION public.enforce_lead_limit IS 'Enforces organization lead limit before insert';

-- Trigger: Prevent creating admins beyond organization limit
CREATE OR REPLACE FUNCTION public.enforce_admin_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT public.check_organization_limit(NEW.organization_id, 'admins') THEN
    RAISE EXCEPTION 'Organization has reached its admin limit. Please upgrade your plan.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_enforce_admin_limit
BEFORE INSERT ON public.admins
FOR EACH ROW
EXECUTE FUNCTION public.enforce_admin_limit();

COMMENT ON FUNCTION public.enforce_admin_limit IS 'Enforces organization admin limit before insert';

-- Update RLS policies to enforce organization-level isolation

-- RLS for leads: Only see leads from own organization
DROP POLICY IF EXISTS leads_all ON public.leads;
CREATE POLICY leads_org_isolation ON public.leads
FOR ALL
TO public
USING (
  organization_id IN (
    SELECT organization_id FROM public.admins WHERE email = current_setting('request.jwt.claims', true)::json->>'email'
  )
)
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.admins WHERE email = current_setting('request.jwt.claims', true)::json->>'email'
  )
);

-- RLS for messages: Only see messages from own organization's leads
DROP POLICY IF EXISTS msgs_all ON public.messages;
CREATE POLICY msgs_org_isolation ON public.messages
FOR ALL
TO public
USING (
  lead_id IN (
    SELECT l.id FROM public.leads l
    JOIN public.admins a ON l.organization_id = a.organization_id
    WHERE a.email = current_setting('request.jwt.claims', true)::json->>'email'
  )
)
WITH CHECK (
  lead_id IN (
    SELECT l.id FROM public.leads l
    JOIN public.admins a ON l.organization_id = a.organization_id
    WHERE a.email = current_setting('request.jwt.claims', true)::json->>'email'
  )
);

-- Create organization analytics view
CREATE OR REPLACE VIEW public.organization_analytics AS
SELECT
  o.id as organization_id,
  o.name as organization_name,
  o.subscription_plan,
  o.subscription_status,
  COUNT(DISTINCT l.id) as total_leads,
  COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'HOT') as hot_leads,
  COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'ADMITTED') as converted_leads,
  COUNT(DISTINCT a.id) as total_admins,
  COUNT(DISTINCT a.id) FILTER (WHERE a.is_active = true) as active_admins,
  COUNT(DISTINCT m.id) as total_messages,
  COUNT(DISTINCT p.id) as total_payments,
  COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'paid'), 0) as total_revenue,
  o.max_leads,
  o.max_admins,
  ROUND((COUNT(DISTINCT l.id)::numeric / NULLIF(o.max_leads, 0)) * 100, 2) as lead_usage_percent,
  ROUND((COUNT(DISTINCT a.id)::numeric / NULLIF(o.max_admins, 0)) * 100, 2) as admin_usage_percent
FROM public.organizations o
LEFT JOIN public.leads l ON o.id = l.organization_id
LEFT JOIN public.admins a ON o.id = a.organization_id
LEFT JOIN public.messages m ON l.id = m.lead_id
LEFT JOIN public.payments p ON l.id = p.lead_id
WHERE o.is_active = true
GROUP BY o.id, o.name, o.subscription_plan, o.subscription_status, o.max_leads, o.max_admins;

COMMENT ON VIEW public.organization_analytics IS 'Analytics dashboard for all organizations';

-- Function to record organization usage
CREATE OR REPLACE FUNCTION public.record_organization_usage()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  org_record RECORD;
  period_start timestamp with time zone;
  period_end timestamp with time zone;
BEGIN
  period_start := date_trunc('day', now() - interval '1 day');
  period_end := date_trunc('day', now());

  FOR org_record IN SELECT id FROM public.organizations WHERE is_active = true
  LOOP
    -- Record lead count
    INSERT INTO public.organization_usage (organization_id, metric_name, metric_value, period_start, period_end)
    VALUES (
      org_record.id,
      'leads_count',
      (SELECT COUNT(*) FROM public.leads WHERE organization_id = org_record.id),
      period_start,
      period_end
    );

    -- Record message count
    INSERT INTO public.organization_usage (organization_id, metric_name, metric_value, period_start, period_end)
    VALUES (
      org_record.id,
      'messages_count',
      (
        SELECT COUNT(*)
        FROM public.messages m
        JOIN public.leads l ON m.lead_id = l.id
        WHERE l.organization_id = org_record.id
          AND m.timestamp >= period_start
          AND m.timestamp < period_end
      ),
      period_start,
      period_end
    );

    -- Record payment volume
    INSERT INTO public.organization_usage (organization_id, metric_name, metric_value, period_start, period_end)
    VALUES (
      org_record.id,
      'payments_volume',
      (
        SELECT COALESCE(SUM(p.amount), 0)::bigint
        FROM public.payments p
        JOIN public.leads l ON p.lead_id = l.id
        WHERE l.organization_id = org_record.id
          AND p.status = 'paid'
          AND p.created_at >= period_start
          AND p.created_at < period_end
      ),
      period_start,
      period_end
    );
  END LOOP;

  RAISE NOTICE 'Organization usage recorded for %', period_start::date;
END;
$$;

COMMENT ON FUNCTION public.record_organization_usage IS 'Records daily usage metrics for all organizations';

-- Schedule usage recording with pg_cron (daily at midnight)
SELECT cron.schedule(
  'record-org-usage',
  '0 0 * * *', -- Every day at midnight
  $$SELECT public.record_organization_usage();$$
);

-- Set first organization as owner for existing admins
UPDATE public.admins
SET role = 'owner'
WHERE id IN (
  SELECT DISTINCT ON (organization_id) id
  FROM public.admins
  ORDER BY organization_id, created_at
);

-- Set all other admins as 'admin' role
UPDATE public.admins
SET role = 'admin'
WHERE role IS NULL;
