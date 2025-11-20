-- Migration: Fix Session Processing and Summary Functions
-- Date: 2025-11-19
-- Purpose: Fix database functions to work with actual schema (conversation_sessions, not sessions)

-- =====================================================
-- 1. FIX: complete_session_end_processing
-- =====================================================
CREATE OR REPLACE FUNCTION public.complete_session_end_processing(
  p_session_id UUID,
  p_lead_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result JSONB;
  v_message_count INT;
  v_summary_generated BOOLEAN := false;
  v_insights_generated BOOLEAN := false;
BEGIN
  -- End the conversation session
  UPDATE conversation_sessions
  SET
    session_end = NOW(),
    summary_generated = true
  WHERE id = p_session_id;

  -- Update lead's last_contact_at
  UPDATE leads
  SET
    last_contact_at = NOW(),
    current_session_id = NULL,
    session_start_at = NULL
  WHERE id = p_lead_id;

  -- Count messages in this session
  SELECT COUNT(*) INTO v_message_count
  FROM messages
  WHERE session_id = p_session_id;

  -- Mark that summary is needed (>5 messages)
  v_summary_generated := v_message_count > 5;

  -- Try to generate insights
  BEGIN
    PERFORM public.generate_conversation_insights(p_lead_id, p_session_id);
    v_insights_generated := true;
  EXCEPTION WHEN OTHERS THEN
    v_insights_generated := false;
  END;

  -- Build result
  v_result := jsonb_build_object(
    'success', true,
    'session_id', p_session_id,
    'ended_at', NOW(),
    'message_count', v_message_count,
    'needs_summary', v_message_count > 5,
    'summary_generated', v_summary_generated,
    'insights_generated', v_insights_generated,
    'message', 'Session ended successfully'
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION complete_session_end_processing IS 'Ends session and marks summary/insights as needed';

-- =====================================================
-- 2. FIX: detect_timed_out_sessions
-- =====================================================
CREATE OR REPLACE FUNCTION public.detect_timed_out_sessions()
RETURNS TABLE(
  session_id UUID,
  lead_id UUID,
  last_message_time TIMESTAMPTZ,
  minutes_inactive INTEGER,
  message_count INTEGER,
  needs_summary BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cs.id as session_id,
    cs.lead_id,
    MAX(m.timestamp) as last_message_time,
    EXTRACT(EPOCH FROM (NOW() - MAX(m.timestamp)))::INT / 60 as minutes_inactive,
    COUNT(m.id)::INT as message_count,
    COUNT(m.id) > 5 as needs_summary
  FROM conversation_sessions cs
  JOIN messages m ON m.session_id = cs.id
  WHERE cs.session_end IS NULL
  GROUP BY cs.id, cs.lead_id
  HAVING MAX(m.timestamp) < NOW() - INTERVAL '15 minutes';
END;
$$;

COMMENT ON FUNCTION detect_timed_out_sessions IS 'Finds conversation sessions that timed out (>15 min inactive)';

-- =====================================================
-- 3. FIX: process_session_timeout
-- =====================================================
CREATE OR REPLACE FUNCTION public.process_session_timeout(
  p_session_id UUID,
  p_lead_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_message_count INT;
  v_summary_needed BOOLEAN;
  v_result JSONB;
BEGIN
  -- Count messages
  SELECT COUNT(*) INTO v_message_count
  FROM messages
  WHERE session_id = p_session_id;

  v_summary_needed := v_message_count > 5;

  -- End the session
  UPDATE conversation_sessions
  SET
    session_end = NOW(),
    emotional_tone = 'timeout',
    summary_generated = v_summary_needed
  WHERE id = p_session_id;

  -- Update lead
  UPDATE leads
  SET
    last_contact_at = NOW(),
    current_session_id = NULL,
    session_start_at = NULL
  WHERE id = p_lead_id;

  -- Generate insights if enough messages
  IF v_message_count > 3 THEN
    PERFORM public.generate_conversation_insights(p_lead_id, p_session_id);
  END IF;

  -- Build result
  v_result := jsonb_build_object(
    'success', true,
    'session_id', p_session_id,
    'lead_id', p_lead_id,
    'message_count', v_message_count,
    'needs_summary', v_summary_needed,
    'ended_at', NOW(),
    'reason', 'Session timed out after 15 minutes of inactivity'
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION process_session_timeout IS 'Processes a timed-out session and generates insights';

-- =====================================================
-- 4. FIX: generate_conversation_summary
-- =====================================================
CREATE OR REPLACE FUNCTION public.generate_conversation_summary(
  p_lead_id UUID,
  p_session_id UUID DEFAULT NULL,
  p_max_messages INT DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_messages TEXT;
  v_existing_context JSONB;
  v_lead_info JSONB;
  v_result JSONB;
  v_message_count INT;
BEGIN
  -- Get lead info
  SELECT jsonb_build_object(
    'name', parent_name,
    'student_name', student_name,
    'phone', phone,
    'class', class,
    'language', language_pref,
    'sentiment', current_sentiment
  ) INTO v_lead_info
  FROM leads
  WHERE id = p_lead_id;

  -- Get existing context from ai_memory
  SELECT context INTO v_existing_context
  FROM ai_memory
  WHERE lead_id = p_lead_id;

  -- Get recent messages (formatted)
  SELECT
    string_agg(
      sender || ': ' || message,
      E'\n'
      ORDER BY timestamp ASC
    ),
    COUNT(*)::INT
  INTO v_messages, v_message_count
  FROM (
    SELECT sender, message, timestamp
    FROM messages
    WHERE lead_id = p_lead_id
      AND (p_session_id IS NULL OR session_id = p_session_id)
    ORDER BY timestamp DESC
    LIMIT p_max_messages
  ) recent;

  -- Return data for AI to summarize
  v_result := jsonb_build_object(
    'lead_info', v_lead_info,
    'existing_context', COALESCE(v_existing_context, '{}'::jsonb),
    'conversation', COALESCE(v_messages, ''),
    'message_count', v_message_count,
    'needs_summary', v_message_count > 5,
    'session_id', p_session_id
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION generate_conversation_summary IS 'Prepares conversation data for AI summarization';

-- =====================================================
-- 5. FIX: save_conversation_summary (store in context)
-- =====================================================
CREATE OR REPLACE FUNCTION public.save_conversation_summary(
  p_lead_id UUID,
  p_summary TEXT,
  p_key_points JSONB DEFAULT '[]'::jsonb,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_updated_context JSONB;
BEGIN
  -- Update ai_memory context with summary
  UPDATE ai_memory
  SET
    context = jsonb_set(
      COALESCE(context, '{}'::jsonb),
      '{summary}',
      jsonb_build_object(
        'text', p_summary,
        'key_points', p_key_points,
        'generated_at', NOW(),
        'metadata', p_metadata
      )
    ),
    last_updated = NOW()
  WHERE lead_id = p_lead_id
  RETURNING context INTO v_updated_context;

  -- If no existing record, insert
  IF NOT FOUND THEN
    INSERT INTO ai_memory (lead_id, context, last_updated)
    VALUES (
      p_lead_id,
      jsonb_build_object(
        'summary', jsonb_build_object(
          'text', p_summary,
          'key_points', p_key_points,
          'generated_at', NOW(),
          'metadata', p_metadata
        )
      ),
      NOW()
    )
    RETURNING context INTO v_updated_context;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Summary saved successfully',
    'context', v_updated_context
  );
END;
$$;

COMMENT ON FUNCTION save_conversation_summary IS 'Saves AI-generated summary to ai_memory.context';

-- =====================================================
-- 6. NEW: generate_conversation_insights (fixed)
-- =====================================================
CREATE OR REPLACE FUNCTION public.generate_conversation_insights(
  p_lead_id UUID,
  p_session_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_messages JSONB;
  v_profile JSONB;
  v_insights_id UUID;
BEGIN
  -- Get profile from ai_memory
  SELECT profile INTO v_profile
  FROM ai_memory
  WHERE lead_id = p_lead_id;

  -- Get recent messages for analysis
  SELECT jsonb_agg(
    jsonb_build_object(
      'sender', sender,
      'message', message,
      'role', role,
      'timestamp', timestamp
    )
    ORDER BY timestamp DESC
  ) INTO v_messages
  FROM messages
  WHERE lead_id = p_lead_id
    AND (p_session_id IS NULL OR session_id = p_session_id)
  LIMIT 30;

  -- Insert or update conversation_insights
  INSERT INTO conversation_insights (
    lead_id,
    session_id,
    academic_weaknesses,
    subjects_of_interest,
    exam_preparation_status,
    long_term_goals,
    parent_concerns,
    extracted_at,
    confidence_score
  )
  VALUES (
    p_lead_id,
    p_session_id,
    COALESCE(v_profile->'weak_subjects', '[]'::jsonb),
    COALESCE(v_profile->'subjects_of_interest', '[]'::jsonb),
    v_profile->>'exam_goal',
    COALESCE(v_profile->'career_interest', '[]'::jsonb),
    COALESCE(v_profile->'parent_concerns', '[]'::jsonb),
    NOW(),
    50.0
  )
  ON CONFLICT (lead_id, session_id)
  DO UPDATE SET
    academic_weaknesses = EXCLUDED.academic_weaknesses,
    subjects_of_interest = EXCLUDED.subjects_of_interest,
    exam_preparation_status = EXCLUDED.exam_preparation_status,
    long_term_goals = EXCLUDED.long_term_goals,
    parent_concerns = EXCLUDED.parent_concerns,
    extracted_at = NOW()
  RETURNING id INTO v_insights_id;

  RETURN jsonb_build_object(
    'success', true,
    'insights_id', v_insights_id,
    'message', 'Insights generated successfully'
  );
END;
$$;

COMMENT ON FUNCTION generate_conversation_insights IS 'Generates conversation insights from ai_memory profile';

-- =====================================================
-- 7. NEW: get_leads_needing_followup (for Edge Function)
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_leads_needing_followup(
  p_hours_since_last_message INT DEFAULT 24
)
RETURNS TABLE(
  lead_id UUID,
  phone TEXT,
  parent_name TEXT,
  hours_since_last_message NUMERIC,
  last_message_time TIMESTAMPTZ,
  total_messages INT,
  engagement_score NUMERIC,
  should_follow_up BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH lead_last_message AS (
    SELECT
      m.lead_id,
      MAX(m.timestamp) as last_msg_time,
      COUNT(m.id)::INT as msg_count
    FROM messages m
    WHERE m.sender = 'user'
    GROUP BY m.lead_id
  )
  SELECT
    l.id as lead_id,
    l.phone,
    l.parent_name,
    EXTRACT(EPOCH FROM (NOW() - llm.last_msg_time))::NUMERIC / 3600 as hours_since_last_message,
    llm.last_msg_time as last_message_time,
    llm.msg_count as total_messages,
    COALESCE(l.engagement_score, 0) as engagement_score,
    -- Should follow up if: engaged (>3 messages), not COLD, and within reasonable timeframe
    (llm.msg_count >= 3 AND l.status != 'COLD' AND
     llm.last_msg_time > NOW() - INTERVAL '7 days') as should_follow_up
  FROM leads l
  JOIN lead_last_message llm ON llm.lead_id = l.id
  WHERE llm.last_msg_time < NOW() - (p_hours_since_last_message || ' hours')::INTERVAL
    AND l.status != 'ADMITTED'
  ORDER BY l.engagement_score DESC, llm.last_msg_time DESC
  LIMIT 50;
END;
$$;

COMMENT ON FUNCTION get_leads_needing_followup IS 'Finds leads that need follow-up messages';

-- =====================================================
-- 8. NEW: generate_followup_message
-- =====================================================
CREATE OR REPLACE FUNCTION public.generate_followup_message(
  p_lead_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_lead RECORD;
  v_profile JSONB;
  v_last_messages TEXT;
  v_result JSONB;
BEGIN
  -- Get lead info
  SELECT
    phone,
    parent_name,
    student_name,
    language_pref,
    current_sentiment
  INTO v_lead
  FROM leads
  WHERE id = p_lead_id;

  -- Get profile
  SELECT profile INTO v_profile
  FROM ai_memory
  WHERE lead_id = p_lead_id;

  -- Get last 3 messages
  SELECT string_agg(sender || ': ' || message, E'\n' ORDER BY timestamp DESC)
  INTO v_last_messages
  FROM (
    SELECT sender, message, timestamp
    FROM messages
    WHERE lead_id = p_lead_id
    ORDER BY timestamp DESC
    LIMIT 3
  ) recent;

  -- Return data for AI to generate follow-up
  v_result := jsonb_build_object(
    'phone', v_lead.phone,
    'parent_name', COALESCE(v_lead.parent_name, 'Parent'),
    'student_name', v_lead.student_name,
    'language', COALESCE(v_lead.language_pref, 'en'),
    'sentiment', COALESCE(v_lead.current_sentiment, 'neutral'),
    'profile', COALESCE(v_profile, '{}'::jsonb),
    'last_messages', COALESCE(v_last_messages, ''),
    'message', 'Data prepared for follow-up generation'
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION generate_followup_message IS 'Prepares data for AI to generate follow-up message';

-- =====================================================
-- Grant Permissions
-- =====================================================
GRANT EXECUTE ON FUNCTION complete_session_end_processing(UUID, UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION detect_timed_out_sessions() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION process_session_timeout(UUID, UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION generate_conversation_summary(UUID, UUID, INT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION save_conversation_summary(UUID, TEXT, JSONB, JSONB) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION generate_conversation_insights(UUID, UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_leads_needing_followup(INT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION generate_followup_message(UUID) TO authenticated, anon;
