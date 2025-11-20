-- Migration: Save Smart Analysis Results
-- Date: 2025-11-20
-- Purpose: Functions to save AI analysis results from Edge Function

-- =====================================================
-- 1. Save Complete Analysis Results
-- =====================================================
CREATE OR REPLACE FUNCTION public.save_smart_analysis_results(
  p_lead_id UUID,
  p_session_id UUID,
  p_analysis JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_insights_id UUID;
  v_summary_id UUID;
  v_report_id UUID;
  v_message_count INT;
BEGIN
  -- Count messages for the session
  SELECT COUNT(*) INTO v_message_count
  FROM messages
  WHERE session_id = p_session_id;

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
    COALESCE(p_analysis->'academic_weaknesses', '[]'::jsonb),
    COALESCE(p_analysis->'subjects_of_interest', '[]'::jsonb),
    p_analysis->>'exam_preparation_status',
    COALESCE(p_analysis->'study_habits', '{}'::jsonb),
    COALESCE((p_analysis->>'academic_readiness_score')::numeric, 0),
    COALESCE(p_analysis->'long_term_goals', '[]'::jsonb),
    COALESCE(p_analysis->'parent_concerns', '[]'::jsonb),
    p_analysis->>'budget_hints',
    p_analysis->>'timeline_references',
    p_analysis->>'location_constraints',
    COALESCE(p_analysis->'child_performance_patterns', '{}'::jsonb),
    COALESCE(p_analysis->'exam_stress_markers', '[]'::jsonb),
    NOW(),
    COALESCE((p_analysis->>'confidence_score')::numeric, 50)
  )
  ON CONFLICT (lead_id, session_id)
  WHERE session_id IS NOT NULL
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
    p_analysis->>'conversation_summary',
    p_analysis->>'next_action_type',
    NOW()
  )
  ON CONFLICT (lead_id)
  DO UPDATE SET
    ai_summary = EXCLUDED.ai_summary,
    next_action = EXCLUDED.next_action,
    updated_at = NOW()
  RETURNING id INTO v_summary_id;

  -- Insert/Update conversation_reports
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
    p_analysis->>'emotional_journey',
    jsonb_array_to_csv(COALESCE(p_analysis->'key_takeaways', '[]'::jsonb)),
    p_analysis->>'conversation_summary',
    v_message_count,
    jsonb_build_object(
      'analyzed_by', 'ai_gpt4',
      'confidence', p_analysis->'confidence_score',
      'timestamp', NOW()
    ),
    p_analysis->>'next_action_type',
    CASE
      WHEN p_analysis->>'next_action_deadline' IS NOT NULL
        AND p_analysis->>'next_action_deadline' != 'null'
      THEN (p_analysis->>'next_action_deadline')::timestamptz
      ELSE NULL
    END,
    COALESCE((p_analysis->>'conversation_quality_score')::numeric, 50),
    COALESCE(p_analysis->'topics_discussed', '[]'::jsonb)
  )
  ON CONFLICT (lead_id, session_id)
  WHERE session_id IS NOT NULL
  DO UPDATE SET
    emotional_summary = EXCLUDED.emotional_summary,
    academic_summary = EXCLUDED.academic_summary,
    key_insights = EXCLUDED.key_insights,
    message_count = EXCLUDED.message_count,
    sentiment_breakdown = EXCLUDED.sentiment_breakdown,
    next_action_type = EXCLUDED.next_action_type,
    next_action_deadline = EXCLUDED.next_action_deadline,
    conversation_quality_score = EXCLUDED.conversation_quality_score,
    topics_discussed = EXCLUDED.topics_discussed
  RETURNING id INTO v_report_id;

  -- Update session as analyzed
  UPDATE conversation_sessions
  SET summary_generated = true
  WHERE id = p_session_id;

  -- Return success with all generated IDs
  RETURN jsonb_build_object(
    'success', true,
    'insights_id', v_insights_id,
    'summary_id', v_summary_id,
    'report_id', v_report_id,
    'message', 'Smart analysis results saved successfully'
  );
END;
$$;

COMMENT ON FUNCTION save_smart_analysis_results IS 'Saves AI analysis results to conversation_insights, summaries, and conversation_reports tables';

-- Helper function to convert jsonb array to CSV string
CREATE OR REPLACE FUNCTION jsonb_array_to_csv(p_jsonb JSONB)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_result TEXT;
BEGIN
  IF p_jsonb IS NULL OR jsonb_typeof(p_jsonb) != 'array' THEN
    RETURN '';
  END IF;

  SELECT string_agg(
    CASE
      WHEN jsonb_typeof(value) = 'string' THEN value#>>'{}'
      ELSE value::text
    END,
    ', '
    ORDER BY ordinality
  )
  INTO v_result
  FROM jsonb_array_elements(p_jsonb) WITH ORDINALITY;

  RETURN COALESCE(v_result, '');
END;
$$;

-- =====================================================
-- 2. Add unique constraints with proper handling
-- =====================================================
-- Summaries: one per lead
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'summaries_lead_id_key'
  ) THEN
    ALTER TABLE summaries ADD CONSTRAINT summaries_lead_id_key UNIQUE (lead_id);
  END IF;
END$$;

-- Conversation reports: one per lead+session
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'conversation_reports_lead_session_key'
  ) THEN
    ALTER TABLE conversation_reports ADD CONSTRAINT conversation_reports_lead_session_key UNIQUE (lead_id, session_id) WHERE session_id IS NOT NULL;
  END IF;
END$$;

-- Conversation insights: one per lead+session
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'conversation_insights_lead_session_key'
  ) THEN
    ALTER TABLE conversation_insights ADD CONSTRAINT conversation_insights_lead_session_key UNIQUE (lead_id, session_id) WHERE session_id IS NOT NULL;
  END IF;
END$$;

-- =====================================================
-- Grant Permissions
-- =====================================================
GRANT EXECUTE ON FUNCTION save_smart_analysis_results(UUID, UUID, JSONB) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION jsonb_array_to_csv(JSONB) TO authenticated, anon;
