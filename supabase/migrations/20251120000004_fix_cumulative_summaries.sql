-- Migration: Fix Cumulative Summaries - Don't Lose History
-- Date: 2025-11-20
-- Purpose: Make summaries cumulative across multiple sessions, not overwrite

-- =====================================================
-- 1. ADD SESSION HISTORY TO SUMMARIES TABLE
-- =====================================================
ALTER TABLE summaries
ADD COLUMN IF NOT EXISTS session_history JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS last_session_id UUID,
ADD COLUMN IF NOT EXISTS total_sessions INTEGER DEFAULT 1;

COMMENT ON COLUMN summaries.session_history IS 'Array of session summaries: [{session_id, date, summary, message_count}]';
COMMENT ON COLUMN summaries.last_session_id IS 'Most recent session that updated this summary';
COMMENT ON COLUMN summaries.total_sessions IS 'Total number of sessions included in this summary';

-- =====================================================
-- 2. CREATE FUNCTION TO GET ALL LEAD MESSAGES
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_all_lead_conversation_data(
  p_lead_id UUID,
  p_current_session_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_all_messages JSONB;
  v_current_session_messages JSONB;
  v_ai_memory JSONB;
  v_lead_info JSONB;
  v_previous_summary TEXT;
  v_session_count INT;
  v_total_message_count INT;
BEGIN
  -- Get ALL messages for this lead (across all sessions)
  SELECT
    jsonb_agg(
      jsonb_build_object(
        'sender', m.sender,
        'role', m.role,
        'message', m.message,
        'timestamp', m.timestamp,
        'language', m.language,
        'session_id', m.session_id
      ) ORDER BY m.timestamp ASC
    ),
    COUNT(*)
  INTO v_all_messages, v_total_message_count
  FROM messages m
  WHERE m.lead_id = p_lead_id;

  -- Get messages from CURRENT session only (for highlighting recent conversation)
  SELECT jsonb_agg(
    jsonb_build_object(
      'sender', m.sender,
      'role', m.role,
      'message', m.message,
      'timestamp', m.timestamp
    ) ORDER BY m.timestamp ASC
  )
  INTO v_current_session_messages
  FROM messages m
  WHERE m.session_id = p_current_session_id;

  -- Get AI memory
  SELECT jsonb_build_object(
    'profile', COALESCE(profile, '{}'::jsonb),
    'context', COALESCE(context, '{}'::jsonb),
    'emotional_state', COALESCE(emotional_state, '{}'::jsonb)
  )
  INTO v_ai_memory
  FROM ai_memory
  WHERE lead_id = p_lead_id;

  -- Get lead info
  SELECT jsonb_build_object(
    'parent_name', parent_name,
    'student_name', student_name,
    'class', class,
    'phone', phone,
    'language_pref', language_pref,
    'current_sentiment', current_sentiment,
    'engagement_score', engagement_score
  )
  INTO v_lead_info
  FROM leads
  WHERE id = p_lead_id;

  -- Get previous summary (if exists)
  SELECT ai_summary
  INTO v_previous_summary
  FROM summaries
  WHERE lead_id = p_lead_id;

  -- Count completed sessions
  SELECT COUNT(*)
  INTO v_session_count
  FROM conversation_sessions
  WHERE lead_id = p_lead_id
  AND session_end IS NOT NULL;

  -- Return comprehensive data
  RETURN jsonb_build_object(
    'all_messages', COALESCE(v_all_messages, '[]'::jsonb),
    'current_session_messages', COALESCE(v_current_session_messages, '[]'::jsonb),
    'ai_memory', v_ai_memory,
    'lead_info', v_lead_info,
    'previous_summary', v_previous_summary,
    'session_count', v_session_count,
    'total_message_count', v_total_message_count,
    'current_session_id', p_current_session_id,
    'generated_at', NOW()
  );
END;
$$;

COMMENT ON FUNCTION get_all_lead_conversation_data IS 'Get complete conversation history for cumulative summary generation';

-- =====================================================
-- 3. UPDATE SUMMARY SAVE FUNCTION TO BE CUMULATIVE
-- =====================================================
CREATE OR REPLACE FUNCTION public.save_cumulative_summary(
  p_lead_id UUID,
  p_session_id UUID,
  p_new_summary TEXT,
  p_next_action TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_existing_summary TEXT;
  v_session_history JSONB;
  v_session_count INT;
  v_message_count INT;
  v_cumulative_summary TEXT;
BEGIN
  -- Get current session message count
  SELECT COUNT(*) INTO v_message_count
  FROM messages
  WHERE session_id = p_session_id;

  -- Get existing summary and history
  SELECT
    ai_summary,
    COALESCE(session_history, '[]'::jsonb),
    COALESCE(total_sessions, 0)
  INTO
    v_existing_summary,
    v_session_history,
    v_session_count
  FROM summaries
  WHERE lead_id = p_lead_id;

  -- Build cumulative summary
  IF v_existing_summary IS NOT NULL AND v_session_count > 0 THEN
    -- Append new session to existing summary
    v_cumulative_summary :=
      '📚 CUMULATIVE SUMMARY (Session ' || (v_session_count + 1)::text || ')' || E'\n\n' ||
      '🔹 Previous Interactions: ' || v_existing_summary || E'\n\n' ||
      '🔹 Latest Session: ' || p_new_summary;
  ELSE
    -- First session
    v_cumulative_summary := p_new_summary;
  END IF;

  -- Add current session to history
  v_session_history := v_session_history || jsonb_build_array(
    jsonb_build_object(
      'session_id', p_session_id,
      'date', NOW(),
      'summary', p_new_summary,
      'message_count', v_message_count
    )
  );

  -- Insert or update summary
  INSERT INTO summaries (
    lead_id,
    ai_summary,
    next_action,
    updated_at,
    session_history,
    last_session_id,
    total_sessions
  )
  VALUES (
    p_lead_id,
    v_cumulative_summary,
    p_next_action,
    NOW(),
    v_session_history,
    p_session_id,
    v_session_count + 1
  )
  ON CONFLICT (lead_id) DO UPDATE
  SET
    ai_summary = EXCLUDED.ai_summary,
    next_action = EXCLUDED.next_action,
    updated_at = EXCLUDED.updated_at,
    session_history = EXCLUDED.session_history,
    last_session_id = EXCLUDED.last_session_id,
    total_sessions = EXCLUDED.total_sessions;

  RETURN jsonb_build_object(
    'success', true,
    'total_sessions', v_session_count + 1,
    'message', 'Cumulative summary updated successfully'
  );
END;
$$;

COMMENT ON FUNCTION save_cumulative_summary IS 'Save summary cumulatively, preserving history from all sessions';

-- =====================================================
-- 4. GRANT PERMISSIONS
-- =====================================================
GRANT EXECUTE ON FUNCTION get_all_lead_conversation_data(UUID, UUID) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION save_cumulative_summary(UUID, UUID, TEXT, TEXT) TO authenticated, anon, service_role;

-- =====================================================
-- 5. UPDATE EXISTING SUMMARY TO SHOW IT'S SESSION 1
-- =====================================================
-- Mark existing summaries as Session 1
UPDATE summaries
SET
  total_sessions = 1,
  session_history = jsonb_build_array(
    jsonb_build_object(
      'session_id', last_session_id,
      'date', updated_at,
      'summary', ai_summary,
      'message_count', (SELECT COUNT(*) FROM messages WHERE lead_id = summaries.lead_id)
    )
  )
WHERE session_history IS NULL OR session_history = '[]'::jsonb;
