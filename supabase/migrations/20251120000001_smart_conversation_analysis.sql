-- Migration: Smart AI-Powered Conversation Analysis
-- Date: 2025-11-20
-- Purpose: Enhanced conversation insights with AI-powered analysis

-- =====================================================
-- 1. Smart Conversation Analysis Function
-- =====================================================
CREATE OR REPLACE FUNCTION public.generate_smart_conversation_insights(
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
  v_context JSONB;
  v_lead_info JSONB;
  v_edge_function_url TEXT;
  v_analysis_response JSONB;
  v_analysis_result JSONB;
  v_insights_id UUID;
  v_summary_id UUID;
BEGIN
  -- Get lead info
  SELECT jsonb_build_object(
    'parent_name', parent_name,
    'student_name', student_name,
    'class', class,
    'current_sentiment', current_sentiment,
    'language_pref', language_pref
  ) INTO v_lead_info
  FROM leads
  WHERE id = p_lead_id;

  -- Get profile and context from ai_memory
  SELECT profile, context INTO v_profile, v_context
  FROM ai_memory
  WHERE lead_id = p_lead_id;

  -- Get recent messages for analysis (last 30 messages)
  SELECT jsonb_agg(
    jsonb_build_object(
      'sender', sender,
      'message', message,
      'role', role,
      'timestamp', timestamp
    )
    ORDER BY timestamp ASC
  ) INTO v_messages
  FROM (
    SELECT sender, message, role, timestamp
    FROM messages
    WHERE lead_id = p_lead_id
      AND (p_session_id IS NULL OR session_id = p_session_id)
    ORDER BY timestamp DESC
    LIMIT 30
  ) recent_messages;

  -- If no messages, return early
  IF v_messages IS NULL OR jsonb_array_length(v_messages) = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'No messages found for analysis'
    );
  END IF;

  -- Call Edge Function for AI analysis
  -- Note: This uses the Supabase Edge Functions URL
  v_edge_function_url := current_setting('app.settings.supabase_url', true) || '/functions/v1/analyze-conversation';

  -- Prepare request body
  v_analysis_response := extensions.http((
    'POST',
    v_edge_function_url,
    ARRAY[
      extensions.http_header('Content-Type', 'application/json'),
      extensions.http_header('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true))
    ],
    'application/json',
    jsonb_build_object(
      'lead_id', p_lead_id,
      'session_id', p_session_id,
      'messages', v_messages,
      'profile', v_profile,
      'context', v_context,
      'lead_info', v_lead_info
    )::text
  )::jsonb);

  -- Extract analysis from response
  v_analysis_result := v_analysis_response->'analysis';

  IF v_analysis_result IS NULL THEN
    RAISE EXCEPTION 'Failed to get analysis from Edge Function';
  END IF;

  -- Insert/Update conversation_insights with AI analysis
  INSERT INTO conversation_insights (
    lead_id,
    session_id,
    academic_weaknesses,
    subjects_of_interest,
    exam_preparation_status,
    study_habits,
    academic_readiness_score,
    long_term_goals,
    parent_concerns,
    budget_hints,
    timeline_references,
    location_constraints,
    child_performance_patterns,
    exam_stress_markers,
    extracted_at,
    confidence_score
  )
  VALUES (
    p_lead_id,
    p_session_id,
    COALESCE(v_analysis_result->'academic_weaknesses', '[]'::jsonb),
    COALESCE(v_analysis_result->'subjects_of_interest', '[]'::jsonb),
    v_analysis_result->>'exam_preparation_status',
    COALESCE(v_analysis_result->'study_habits', '{}'::jsonb),
    COALESCE((v_analysis_result->>'academic_readiness_score')::numeric, 0),
    COALESCE(v_analysis_result->'long_term_goals', '[]'::jsonb),
    COALESCE(v_analysis_result->'parent_concerns', '[]'::jsonb),
    v_analysis_result->>'budget_hints',
    v_analysis_result->>'timeline_references',
    v_analysis_result->>'location_constraints',
    COALESCE(v_analysis_result->'child_performance_patterns', '{}'::jsonb),
    COALESCE(v_analysis_result->'exam_stress_markers', '[]'::jsonb),
    NOW(),
    COALESCE((v_analysis_result->>'confidence_score')::numeric, 50)
  )
  ON CONFLICT (lead_id, session_id)
  DO UPDATE SET
    academic_weaknesses = EXCLUDED.academic_weaknesses,
    subjects_of_interest = EXCLUDED.subjects_of_interest,
    exam_preparation_status = EXCLUDED.exam_preparation_status,
    study_habits = EXCLUDED.study_habits,
    academic_readiness_score = EXCLUDED.academic_readiness_score,
    long_term_goals = EXCLUDED.long_term_goals,
    parent_concerns = EXCLUDED.parent_concerns,
    budget_hints = EXCLUDED.budget_hints,
    timeline_references = EXCLUDED.timeline_references,
    location_constraints = EXCLUDED.location_constraints,
    child_performance_patterns = EXCLUDED.child_performance_patterns,
    exam_stress_markers = EXCLUDED.exam_stress_markers,
    extracted_at = NOW(),
    confidence_score = EXCLUDED.confidence_score
  RETURNING id INTO v_insights_id;

  -- Insert/Update summaries table with AI-generated summary
  INSERT INTO summaries (
    lead_id,
    ai_summary,
    next_action,
    updated_at
  )
  VALUES (
    p_lead_id,
    v_analysis_result->>'conversation_summary',
    v_analysis_result->>'next_action_type',
    NOW()
  )
  ON CONFLICT (lead_id)
  DO UPDATE SET
    ai_summary = EXCLUDED.ai_summary,
    next_action = EXCLUDED.next_action,
    updated_at = NOW()
  RETURNING id INTO v_summary_id;

  -- Update conversation_reports if session exists
  IF p_session_id IS NOT NULL THEN
    INSERT INTO conversation_reports (
      lead_id,
      session_id,
      report_date,
      emotional_summary,
      academic_summary,
      key_insights,
      message_count,
      sentiment_breakdown,
      next_action_type,
      next_action_deadline,
      conversation_quality_score,
      topics_discussed
    )
    VALUES (
      p_lead_id,
      p_session_id,
      CURRENT_DATE,
      v_analysis_result->>'emotional_journey',
      jsonb_array_to_text_array(v_analysis_result->'key_takeaways'),
      v_analysis_result->>'conversation_summary',
      jsonb_array_length(v_messages),
      jsonb_build_object('analyzed_by', 'ai', 'confidence', v_analysis_result->'confidence_score'),
      v_analysis_result->>'next_action_type',
      CASE
        WHEN v_analysis_result->>'next_action_deadline' IS NOT NULL
        THEN (v_analysis_result->>'next_action_deadline')::timestamptz
        ELSE NULL
      END,
      COALESCE((v_analysis_result->>'conversation_quality_score')::numeric, 50),
      COALESCE(v_analysis_result->'topics_discussed', '[]'::jsonb)
    )
    ON CONFLICT (lead_id, session_id) DO UPDATE SET
      emotional_summary = EXCLUDED.emotional_summary,
      academic_summary = EXCLUDED.academic_summary,
      key_insights = EXCLUDED.key_insights,
      message_count = EXCLUDED.message_count,
      sentiment_breakdown = EXCLUDED.sentiment_breakdown,
      next_action_type = EXCLUDED.next_action_type,
      next_action_deadline = EXCLUDED.next_action_deadline,
      conversation_quality_score = EXCLUDED.conversation_quality_score,
      topics_discussed = EXCLUDED.topics_discussed;
  END IF;

  -- Return success with all generated IDs
  RETURN jsonb_build_object(
    'success', true,
    'insights_id', v_insights_id,
    'summary_id', v_summary_id,
    'analysis', v_analysis_result,
    'message', 'Smart conversation analysis completed successfully'
  );
EXCEPTION WHEN OTHERS THEN
  -- Log error and return gracefully
  RAISE WARNING 'Error in generate_smart_conversation_insights: %', SQLERRM;
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'message', 'Failed to generate smart insights'
  );
END;
$$;

COMMENT ON FUNCTION generate_smart_conversation_insights IS 'AI-powered conversation analysis using OpenAI via Edge Function';

-- Helper function to convert jsonb array to text array
CREATE OR REPLACE FUNCTION jsonb_array_to_text_array(p_jsonb JSONB)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_result TEXT;
BEGIN
  SELECT string_agg(value::text, ', ')
  INTO v_result
  FROM jsonb_array_elements_text(p_jsonb);

  RETURN COALESCE(v_result, '');
END;
$$;

-- =====================================================
-- 2. Update complete_session_end_processing to use smart analysis
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
  v_smart_analysis_result JSONB;
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

  -- Generate smart AI-powered insights (only if enough messages)
  IF v_message_count >= 3 THEN
    BEGIN
      v_smart_analysis_result := public.generate_smart_conversation_insights(p_lead_id, p_session_id);
    EXCEPTION WHEN OTHERS THEN
      -- If AI analysis fails, log but don't crash
      RAISE WARNING 'Smart analysis failed: %', SQLERRM;
      v_smart_analysis_result := jsonb_build_object('success', false, 'error', SQLERRM);
    END;
  ELSE
    v_smart_analysis_result := jsonb_build_object('success', false, 'message', 'Not enough messages for analysis');
  END IF;

  -- Build result
  v_result := jsonb_build_object(
    'success', true,
    'session_id', p_session_id,
    'ended_at', NOW(),
    'message_count', v_message_count,
    'smart_analysis', v_smart_analysis_result,
    'message', 'Session ended and analyzed successfully'
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION complete_session_end_processing IS 'Ends session with smart AI-powered analysis';

-- =====================================================
-- 3. Update process_session_timeout to use smart analysis
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
  v_result JSONB;
  v_smart_analysis_result JSONB;
BEGIN
  -- Count messages
  SELECT COUNT(*) INTO v_message_count
  FROM messages
  WHERE session_id = p_session_id;

  -- End the session
  UPDATE conversation_sessions
  SET
    session_end = NOW(),
    emotional_tone = 'timeout',
    summary_generated = true
  WHERE id = p_session_id;

  -- Update lead
  UPDATE leads
  SET
    last_contact_at = NOW(),
    current_session_id = NULL,
    session_start_at = NULL
  WHERE id = p_lead_id;

  -- Generate smart insights if enough messages
  IF v_message_count >= 3 THEN
    BEGIN
      v_smart_analysis_result := public.generate_smart_conversation_insights(p_lead_id, p_session_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Smart analysis failed in timeout: %', SQLERRM;
      v_smart_analysis_result := jsonb_build_object('success', false, 'error', SQLERRM);
    END;
  END IF;

  -- Build result
  v_result := jsonb_build_object(
    'success', true,
    'session_id', p_session_id,
    'lead_id', p_lead_id,
    'message_count', v_message_count,
    'smart_analysis', v_smart_analysis_result,
    'ended_at', NOW(),
    'reason', 'Session timed out after 15 minutes of inactivity'
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION process_session_timeout IS 'Processes timed-out session with smart AI analysis';

-- =====================================================
-- 4. Add unique constraint to summaries for lead_id
-- =====================================================
-- Drop existing unique constraint if any
ALTER TABLE summaries DROP CONSTRAINT IF EXISTS summaries_lead_id_key;

-- Add unique constraint (one summary per lead - latest overwrites)
ALTER TABLE summaries ADD CONSTRAINT summaries_lead_id_key UNIQUE (lead_id);

-- =====================================================
-- 5. Add unique constraint to conversation_reports
-- =====================================================
-- Drop existing if any
ALTER TABLE conversation_reports DROP CONSTRAINT IF EXISTS conversation_reports_lead_session_key;

-- Add unique constraint (one report per session)
ALTER TABLE conversation_reports ADD CONSTRAINT conversation_reports_lead_session_key UNIQUE (lead_id, session_id);

-- =====================================================
-- 6. Fix conversation_insights unique constraint
-- =====================================================
-- Drop existing if any
ALTER TABLE conversation_insights DROP CONSTRAINT IF EXISTS conversation_insights_lead_session_key;

-- Add proper unique constraint
ALTER TABLE conversation_insights ADD CONSTRAINT conversation_insights_lead_session_key UNIQUE (lead_id, session_id);

-- =====================================================
-- Grant Permissions
-- =====================================================
GRANT EXECUTE ON FUNCTION generate_smart_conversation_insights(UUID, UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION jsonb_array_to_text_array(JSONB) TO authenticated, anon;

-- Grant http extension permissions if not already granted
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO postgres, anon, authenticated;

-- =====================================================
-- 7. Create settings table for Edge Function URLs
-- =====================================================
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default settings (update these with your actual values)
INSERT INTO app_settings (key, value, description) VALUES
  ('supabase_url', 'https://fcsdmvxtootizmndmrli.supabase.co', 'Supabase project URL'),
  ('service_role_key', current_setting('app.settings.service_role_key', true), 'Service role key for Edge Functions')
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE app_settings IS 'Application configuration settings';
