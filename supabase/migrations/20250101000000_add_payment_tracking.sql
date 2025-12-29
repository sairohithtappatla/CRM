-- Migration: Add Payment Tracking for Assessment Payments with Razorpay Integration
-- Date: 2025-01-01
-- Description: Adds tables and functions for tracking payment links, follow-ups, and assessment delivery

-- ============================================================================
-- 1. UPDATE PAYMENTS TABLE WITH RAZORPAY FIELDS
-- ============================================================================

-- Add new columns to existing payments table
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS assessment_type TEXT,
  ADD COLUMN IF NOT EXISTS razorpay_order_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS razorpay_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_link TEXT,
  ADD COLUMN IF NOT EXISTS follow_up_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_follow_up_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS assessment_link_sent BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS assessment_link_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notes JSONB DEFAULT '{}'::jsonb;

-- Add check constraint for assessment types
ALTER TABLE payments
  ADD CONSTRAINT valid_assessment_type
  CHECK (assessment_type IS NULL OR assessment_type IN ('iLMH', 'test_anxiety', 'iTMPA', 'iPMA'));

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_payments_razorpay_order_id ON payments(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status_created ON payments(status, created_at);
CREATE INDEX IF NOT EXISTS idx_payments_lead_status ON payments(lead_id, status);

-- ============================================================================
-- 2. CREATE SESSIONS TABLE FOR FOLLOW-UP TRACKING
-- ============================================================================

-- Add follow-up tracking to sessions if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sessions' AND column_name = 'follow_up_sent'
  ) THEN
    ALTER TABLE sessions ADD COLUMN follow_up_sent BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sessions' AND column_name = 'last_follow_up_at'
  ) THEN
    ALTER TABLE sessions ADD COLUMN last_follow_up_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sessions' AND column_name = 'last_message_at'
  ) THEN
    ALTER TABLE sessions ADD COLUMN last_message_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- ============================================================================
-- 3. CREATE ASSESSMENT LINKS MAPPING TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS assessment_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_type TEXT NOT NULL UNIQUE,
  google_form_link TEXT NOT NULL,
  display_name TEXT NOT NULL,
  price_inr INTEGER NOT NULL DEFAULT 9900, -- Price in paise (₹99)
  description TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert assessment mappings
INSERT INTO assessment_links (assessment_type, google_form_link, display_name, price_inr, description)
VALUES
  ('iLMH', 'https://docs.google.com/forms/d/e/1FAIpQLScO7koC_vkswF0y6kh7bC535-oPFetDJeNUBUpomN78Uv17TA/viewform', 'iLMH Assessment', 9900, 'Integrated Learning and Mental Health Assessment'),
  ('test_anxiety', 'https://docs.google.com/forms/d/e/1FAIpQLSe3CtxGvT0xL-zXEXmLIzHYf728gNJliMJClv7McAeLOhg4GA/viewform', 'Test Anxiety Assessment', 9900, 'Test Anxiety Evaluation'),
  ('iTMPA', 'https://docs.google.com/forms/d/e/1FAIpQLSfczWS8B3OBig8OWXQHtIOZr2jKpzzseCY-fwy9Ez7K0Ds8-g/viewform', 'iTMPA Assessment', 9900, 'Integrated Test and Mental Performance Assessment'),
  ('iPMA', 'https://docs.google.com/forms/d/e/1FAIpQLSdBUzs6Z1PBRr4DPoeN1b0Prp70cZyu3-enKnFdo9KYYUGsuA/viewform', 'iPMA Assessment', 9900, 'Integrated Performance and Mindset Assessment')
ON CONFLICT (assessment_type) DO NOTHING;

-- ============================================================================
-- 4. CREATE FUNCTION: CREATE PAYMENT RECORD WITH RAZORPAY
-- ============================================================================

CREATE OR REPLACE FUNCTION create_payment_record(
  p_lead_id UUID,
  p_assessment_type TEXT,
  p_razorpay_order_id TEXT,
  p_payment_link TEXT,
  p_amount INTEGER DEFAULT 9900,
  p_expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '48 hours'
)
RETURNS TABLE(
  payment_id UUID,
  lead_id UUID,
  assessment_type TEXT,
  razorpay_order_id TEXT,
  payment_link TEXT,
  status TEXT,
  expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payment_id UUID;
  v_lead_phone TEXT;
  v_parent_name TEXT;
BEGIN
  -- Get lead details for notes
  SELECT phone, parent_name INTO v_lead_phone, v_parent_name
  FROM leads WHERE id = p_lead_id;

  -- Insert payment record
  INSERT INTO payments (
    lead_id,
    assessment_type,
    amount,
    razorpay_order_id,
    payment_link,
    status,
    expires_at,
    purpose,
    payer_phone,
    notes
  )
  VALUES (
    p_lead_id,
    p_assessment_type,
    p_amount,
    p_razorpay_order_id,
    p_payment_link,
    'pending',
    p_expires_at,
    'Assessment: ' || p_assessment_type,
    v_lead_phone,
    jsonb_build_object(
      'lead_id', p_lead_id,
      'assessment_type', p_assessment_type,
      'parent_name', v_parent_name,
      'phone', v_lead_phone
    )
  )
  RETURNING id INTO v_payment_id;

  -- Return the created payment
  RETURN QUERY
  SELECT
    v_payment_id,
    p_lead_id,
    p_assessment_type,
    p_razorpay_order_id,
    p_payment_link,
    'pending'::TEXT,
    p_expires_at;
END;
$$;

-- ============================================================================
-- 5. CREATE FUNCTION: GET PENDING PAYMENT FOR LEAD
-- ============================================================================

CREATE OR REPLACE FUNCTION get_pending_payment_for_lead(
  p_lead_id UUID,
  p_assessment_type TEXT
)
RETURNS TABLE(
  payment_id UUID,
  razorpay_order_id TEXT,
  payment_link TEXT,
  created_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    id,
    payments.razorpay_order_id,
    payments.payment_link,
    payments.created_at,
    payments.expires_at
  FROM payments
  WHERE
    lead_id = p_lead_id
    AND assessment_type = p_assessment_type
    AND status = 'pending'
    AND (expires_at IS NULL OR expires_at > NOW())
  ORDER BY created_at DESC
  LIMIT 1;
END;
$$;

-- ============================================================================
-- 6. CREATE FUNCTION: UPDATE PAYMENT STATUS (WEBHOOK)
-- ============================================================================

CREATE OR REPLACE FUNCTION update_payment_status_from_webhook(
  p_razorpay_order_id TEXT,
  p_razorpay_payment_id TEXT,
  p_status TEXT
)
RETURNS TABLE(
  payment_id UUID,
  lead_id UUID,
  assessment_type TEXT,
  assessment_link TEXT,
  parent_name TEXT,
  phone TEXT,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payment_id UUID;
  v_lead_id UUID;
  v_assessment_type TEXT;
  v_google_form_link TEXT;
  v_parent_name TEXT;
  v_phone TEXT;
BEGIN
  -- Update payment status
  UPDATE payments
  SET
    status = p_status,
    razorpay_payment_id = p_razorpay_payment_id,
    updated_at = NOW()
  WHERE razorpay_order_id = p_razorpay_order_id
  RETURNING id, payments.lead_id, payments.assessment_type
  INTO v_payment_id, v_lead_id, v_assessment_type;

  IF v_payment_id IS NULL THEN
    RAISE EXCEPTION 'Payment not found for razorpay_order_id: %', p_razorpay_order_id;
  END IF;

  -- If payment is successful, update lead status to HOT
  IF p_status = 'paid' THEN
    UPDATE leads
    SET
      status = 'HOT',
      updated_at = NOW()
    WHERE id = v_lead_id;

    -- Get assessment link
    SELECT google_form_link INTO v_google_form_link
    FROM assessment_links
    WHERE assessment_type = v_assessment_type;

    -- Get lead details
    SELECT parent_name, phone INTO v_parent_name, v_phone
    FROM leads
    WHERE id = v_lead_id;

    -- Mark assessment link as sent
    UPDATE payments
    SET
      assessment_link_sent = true,
      assessment_link_sent_at = NOW()
    WHERE id = v_payment_id;
  END IF;

  -- Return payment details
  RETURN QUERY
  SELECT
    v_payment_id,
    v_lead_id,
    v_assessment_type,
    v_google_form_link,
    v_parent_name,
    v_phone,
    p_status;
END;
$$;

-- ============================================================================
-- 7. CREATE FUNCTION: GET PAYMENTS NEEDING FOLLOW-UP
-- ============================================================================

CREATE OR REPLACE FUNCTION get_payments_needing_followup()
RETURNS TABLE(
  payment_id UUID,
  lead_id UUID,
  lead_phone TEXT,
  parent_name TEXT,
  assessment_type TEXT,
  payment_link TEXT,
  follow_up_count INTEGER,
  hours_since_creation NUMERIC,
  follow_up_type TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH payment_analysis AS (
    SELECT
      p.id,
      p.lead_id,
      l.phone,
      l.parent_name,
      p.assessment_type,
      p.payment_link,
      p.follow_up_count,
      EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 3600 AS hours_since_creation,
      CASE
        WHEN EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 3600 >= 24
          AND p.follow_up_count = 1 THEN 'second_followup'
        WHEN EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 3600 >= 3
          AND p.follow_up_count = 0 THEN 'first_followup'
        ELSE NULL
      END AS followup_type
    FROM payments p
    JOIN leads l ON p.lead_id = l.id
    WHERE
      p.status = 'pending'
      AND (p.expires_at IS NULL OR p.expires_at > NOW())
      AND p.follow_up_count < 2
      AND (
        (p.follow_up_count = 0 AND EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 3600 >= 3)
        OR (p.follow_up_count = 1 AND EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 3600 >= 24)
      )
  )
  SELECT * FROM payment_analysis WHERE followup_type IS NOT NULL;
END;
$$;

-- ============================================================================
-- 8. CREATE FUNCTION: UPDATE FOLLOW-UP COUNT
-- ============================================================================

CREATE OR REPLACE FUNCTION mark_payment_followup_sent(
  p_payment_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE payments
  SET
    follow_up_count = follow_up_count + 1,
    last_follow_up_at = NOW(),
    updated_at = NOW()
  WHERE id = p_payment_id;

  RETURN FOUND;
END;
$$;

-- ============================================================================
-- 9. CREATE FUNCTION: GET INACTIVE SESSIONS NEEDING FOLLOW-UP
-- ============================================================================

CREATE OR REPLACE FUNCTION get_inactive_sessions_needing_followup()
RETURNS TABLE(
  session_id UUID,
  lead_id UUID,
  lead_phone TEXT,
  parent_name TEXT,
  last_message_at TIMESTAMPTZ,
  hours_inactive NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.session_id,
    s.lead_id,
    l.phone,
    l.parent_name,
    s.last_message_at,
    EXTRACT(EPOCH FROM (NOW() - s.last_message_at)) / 3600 AS hours_inactive
  FROM sessions s
  JOIN leads l ON s.lead_id = l.id
  WHERE
    s.is_active = true
    AND s.follow_up_sent = false
    AND EXTRACT(EPOCH FROM (NOW() - s.last_message_at)) / 3600 >= 24
    AND s.last_message_at IS NOT NULL;
END;
$$;

-- ============================================================================
-- 10. CREATE FUNCTION: MARK SESSION FOLLOW-UP SENT
-- ============================================================================

CREATE OR REPLACE FUNCTION mark_session_followup_sent(
  p_session_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE sessions
  SET
    follow_up_sent = true,
    last_follow_up_at = NOW(),
    updated_at = NOW()
  WHERE session_id = p_session_id;

  RETURN FOUND;
END;
$$;

-- ============================================================================
-- 11. CREATE FUNCTION: GET ASSESSMENT LINK BY TYPE
-- ============================================================================

CREATE OR REPLACE FUNCTION get_assessment_link(
  p_assessment_type TEXT
)
RETURNS TABLE(
  assessment_type TEXT,
  google_form_link TEXT,
  display_name TEXT,
  price_inr INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    al.assessment_type,
    al.google_form_link,
    al.display_name,
    al.price_inr
  FROM assessment_links al
  WHERE
    al.assessment_type = p_assessment_type
    AND al.active = true;
END;
$$;

-- ============================================================================
-- 12. CREATE TRIGGER: UPDATE last_message_at ON NEW MESSAGE
-- ============================================================================

CREATE OR REPLACE FUNCTION update_session_last_message()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE sessions
  SET last_message_at = NEW.timestamp
  WHERE lead_id = NEW.lead_id
    AND is_active = true;

  RETURN NEW;
END;
$$;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS trigger_update_session_last_message ON messages;

-- Create trigger
CREATE TRIGGER trigger_update_session_last_message
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_session_last_message();

-- ============================================================================
-- 13. ADD RLS POLICIES (IF USING RLS)
-- ============================================================================

-- Enable RLS on assessment_links if not already enabled
ALTER TABLE assessment_links ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access to assessment links
DROP POLICY IF EXISTS "Allow public read access to active assessment links" ON assessment_links;
CREATE POLICY "Allow public read access to active assessment links"
  ON assessment_links FOR SELECT
  USING (active = true);

-- ============================================================================
-- 14. ADD COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON COLUMN payments.assessment_type IS 'Type of assessment: iLMH, test_anxiety, iTMPA, or iPMA';
COMMENT ON COLUMN payments.razorpay_order_id IS 'Unique Razorpay order ID for tracking';
COMMENT ON COLUMN payments.razorpay_payment_id IS 'Razorpay payment ID after successful payment';
COMMENT ON COLUMN payments.payment_link IS 'Generated Razorpay payment link sent to customer';
COMMENT ON COLUMN payments.follow_up_count IS 'Number of follow-up messages sent for pending payment';
COMMENT ON COLUMN payments.assessment_link_sent IS 'Whether assessment Google Form link has been sent';
COMMENT ON COLUMN payments.expires_at IS 'Payment link expiry time (48 hours from creation)';
COMMENT ON COLUMN payments.notes IS 'JSON field containing lead_id, assessment_type, parent_name, phone for cross-reference';

COMMENT ON FUNCTION create_payment_record IS 'Creates a new payment record with Razorpay order details';
COMMENT ON FUNCTION get_pending_payment_for_lead IS 'Gets existing pending payment for a lead to avoid duplicates';
COMMENT ON FUNCTION update_payment_status_from_webhook IS 'Updates payment status from Razorpay webhook and triggers post-payment actions';
COMMENT ON FUNCTION get_payments_needing_followup IS 'Returns payments that need follow-up (3 hours and 24 hours)';
COMMENT ON FUNCTION get_inactive_sessions_needing_followup IS 'Returns inactive sessions (24 hours no message) needing follow-up';
