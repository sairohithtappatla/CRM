-- Migration: Add frontend helper functions for secure data access
-- Created: 2025-11-18
-- Purpose: Provide SECURITY DEFINER functions to bypass RLS for frontend access

-- Function to get AI memory profile for a lead
CREATE OR REPLACE FUNCTION get_lead_ai_memory(lead_id_input UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT profile
  INTO result
  FROM ai_memory
  WHERE lead_id = lead_id_input;

  RETURN COALESCE(result, '{}'::JSONB);
END;
$$;

COMMENT ON FUNCTION get_lead_ai_memory IS 'Securely fetch AI memory profile for a lead (bypasses RLS)';

-- Function to get first user message for name extraction
CREATE OR REPLACE FUNCTION get_first_user_message(lead_id_input UUID)
RETURNS TABLE (
  message TEXT,
  timestamp TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT m.message, m.timestamp
  FROM messages m
  WHERE m.lead_id = lead_id_input
    AND m.sender = 'user'
  ORDER BY m.timestamp ASC
  LIMIT 1;
END;
$$;

COMMENT ON FUNCTION get_first_user_message IS 'Get first user message for name extraction (bypasses RLS)';

-- Function to get recent messages for a lead (last 20)
CREATE OR REPLACE FUNCTION get_lead_messages(lead_id_input UUID, message_limit INT DEFAULT 20)
RETURNS TABLE (
  id BIGINT,
  lead_id UUID,
  sender TEXT,
  message TEXT,
  timestamp TIMESTAMPTZ,
  role TEXT,
  session_id UUID,
  language TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.lead_id,
    m.sender,
    m.message,
    m.timestamp,
    m.role,
    m.session_id,
    m.language
  FROM messages m
  WHERE m.lead_id = lead_id_input
  ORDER BY m.timestamp DESC
  LIMIT message_limit;
END;
$$;

COMMENT ON FUNCTION get_lead_messages IS 'Get recent messages for a lead (bypasses RLS)';

-- Grant execute permissions to authenticated and anon users
GRANT EXECUTE ON FUNCTION get_lead_ai_memory(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_first_user_message(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_lead_messages(UUID, INT) TO authenticated, anon;
