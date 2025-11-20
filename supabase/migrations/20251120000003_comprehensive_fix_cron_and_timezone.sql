-- Migration: Comprehensive Fix - Cron Jobs + Timezone + Auto-Session Processing
-- Date: 2025-11-20
-- Purpose: Fix all issues - cron schedules, timezone, and auto-summary generation

-- =====================================================
-- 1. SET DATABASE TIMEZONE TO ASIA/KOLKATA
-- =====================================================
ALTER DATABASE postgres SET timezone TO 'Asia/Kolkata';

-- Set for current session
SET timezone TO 'Asia/Kolkata';

COMMENT ON DATABASE postgres IS 'Timezone set to Asia/Kolkata (IST) for Subbu Innovative Classes';

-- =====================================================
-- 2. ENSURE REQUIRED EXTENSIONS ARE ENABLED
-- =====================================================
-- pg_cron for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- pg_net for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- =====================================================
-- 3. UNSCHEDULE OLD JOBS (if any exist)
-- =====================================================
DO $$
BEGIN
  -- Remove old cron jobs if they exist
  PERFORM cron.unschedule('process-inactive-sessions') WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'process-inactive-sessions'
  );

  PERFORM cron.unschedule('send-daily-followups') WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'send-daily-followups'
  );

  PERFORM cron.unschedule('cleanup-old-data') WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'cleanup-old-data'
  );
EXCEPTION WHEN OTHERS THEN
  -- Jobs may not exist, ignore error
  NULL;
END$$;

-- =====================================================
-- 4. SETUP CRON JOBS
-- =====================================================

-- Job 1: Process Inactive Sessions - Every 15 minutes
-- This detects sessions that have been inactive for 15+ minutes and generates summaries
SELECT cron.schedule(
  'process-inactive-sessions-v2',
  '*/15 * * * *',
  $$
  SELECT
    extensions.http_post(
      url := 'https://fcsdmvxtootizmndmrli.supabase.co/functions/v1/process-timeouts',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjc2Rtdnh0b290aXptbmRtcmxpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMDk3NTkwMywiZXhwIjoyMDQ2NTUxOTAzfQ.P6Uf2FzVWGS-2_zGAz77u65-YlOqR8W5qvLLKckThlM'
      ),
      body := '{}'::jsonb
    );
  $$
);

-- Job 2: Send Follow-ups - Daily at 10:00 AM IST
SELECT cron.schedule(
  'send-daily-followups-v2',
  '0 10 * * *',
  $$
  SELECT
    extensions.http_post(
      url := 'https://fcsdmvxtootizmndmrli.supabase.co/functions/v1/send-followups',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjc2Rtdnh0b290aXptbmRtcmxpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMDk3NTkwMywiZXhwIjoyMDQ2NTUxOTAzfQ.P6Uf2FzVWGS-2_zGAz77u65-YlOqR8W5qvLLKckThlM'
      ),
      body := '{}'::jsonb
    );
  $$
);

-- =====================================================
-- 5. CREATE MANUAL SESSION TIMEOUT FUNCTION
-- =====================================================
-- This function can be called directly from n8n or other systems
CREATE OR REPLACE FUNCTION public.manual_end_session_and_analyze(
  p_session_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_lead_id UUID;
  v_result JSONB;
BEGIN
  -- Get lead_id from session
  SELECT lead_id INTO v_lead_id
  FROM conversation_sessions
  WHERE id = p_session_id;

  IF v_lead_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Session not found'
    );
  END IF;

  -- End the session
  UPDATE conversation_sessions
  SET session_end = NOW()
  WHERE id = p_session_id
  AND session_end IS NULL;

  -- Clear lead's current session
  UPDATE leads
  SET current_session_id = NULL,
      session_start_at = NULL
  WHERE id = v_lead_id;

  -- Process the session summary
  SELECT auto_process_session_summary(p_session_id) INTO v_result;

  RETURN jsonb_build_object(
    'success', true,
    'session_id', p_session_id,
    'lead_id', v_lead_id,
    'analysis_result', v_result
  );
END;
$$;

COMMENT ON FUNCTION manual_end_session_and_analyze IS 'Manually end a session and trigger AI analysis - useful for testing';

-- =====================================================
-- 6. CREATE MONITORING VIEW FOR CRON JOBS
-- =====================================================
CREATE OR REPLACE VIEW v_cron_job_status AS
SELECT
  j.jobid,
  j.jobname,
  j.schedule,
  j.active,
  j.database,
  (
    SELECT r.status
    FROM cron.job_run_details r
    WHERE r.jobid = j.jobid
    ORDER BY r.start_time DESC
    LIMIT 1
  ) as last_run_status,
  (
    SELECT r.start_time AT TIME ZONE 'Asia/Kolkata'
    FROM cron.job_run_details r
    WHERE r.jobid = j.jobid
    ORDER BY r.start_time DESC
    LIMIT 1
  ) as last_run_time_ist,
  (
    SELECT r.return_message
    FROM cron.job_run_details r
    WHERE r.jobid = j.jobid
    ORDER BY r.start_time DESC
    LIMIT 1
  ) as last_run_message
FROM cron.job j
WHERE j.jobname LIKE '%session%' OR j.jobname LIKE '%followup%'
ORDER BY j.jobname;

COMMENT ON VIEW v_cron_job_status IS 'Monitor cron job execution status with IST timestamps';

-- =====================================================
-- 7. GRANT PERMISSIONS
-- =====================================================
GRANT EXECUTE ON FUNCTION manual_end_session_and_analyze(UUID) TO authenticated, anon, service_role;
GRANT SELECT ON v_cron_job_status TO authenticated, service_role;

-- =====================================================
-- 8. VERIFICATION QUERIES
-- =====================================================

-- Check timezone
DO $$
DECLARE
  v_timezone TEXT;
BEGIN
  SHOW timezone INTO v_timezone;
  RAISE NOTICE 'Database timezone: %', v_timezone;
END$$;

-- Check cron jobs
DO $$
DECLARE
  v_job_count INT;
BEGIN
  SELECT COUNT(*) INTO v_job_count FROM cron.job WHERE jobname LIKE '%v2%';
  RAISE NOTICE 'Active cron jobs (v2): %', v_job_count;
END$$;

-- =====================================================
-- USAGE EXAMPLES
-- =====================================================

-- To manually test session timeout and analysis:
-- SELECT manual_end_session_and_analyze('session-uuid-here');

-- To check cron job status:
-- SELECT * FROM v_cron_job_status;

-- To check recent cron runs:
-- SELECT
--   job.jobname,
--   run.status,
--   run.start_time AT TIME ZONE 'Asia/Kolkata' as start_time_ist,
--   run.return_message
-- FROM cron.job_run_details run
-- JOIN cron.job job ON run.jobid = job.jobid
-- WHERE job.jobname LIKE '%v2%'
-- ORDER BY run.start_time DESC
-- LIMIT 10;
