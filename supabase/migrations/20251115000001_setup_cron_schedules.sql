-- Migration: Setup pg_cron Schedules for Automated Tasks
-- Description: Configures cron jobs for auto-summary and follow-up automation
-- Date: 2025-11-15

-- =====================================================
-- ENABLE pg_cron EXTENSION
-- =====================================================
-- Note: pg_cron must be enabled in Supabase Dashboard > Database > Extensions
-- This migration assumes it's already enabled

-- =====================================================
-- 1. PROCESS TIMEOUTS - Every 15 minutes
-- =====================================================
-- Detects inactive sessions and generates AI summaries
-- Runs at: :00, :15, :30, :45 of every hour

SELECT cron.schedule(
  'process-inactive-sessions',           -- Job name
  '*/15 * * * *',                        -- Every 15 minutes
  $$
  SELECT
    net.http_post(
      url := 'https://fcsdmvxtootizmndmrli.supabase.co/functions/v1/process-timeouts',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

COMMENT ON EXTENSION cron IS 'pg_cron extension for scheduled jobs';

-- =====================================================
-- 2. SEND FOLLOW-UPS - Daily at 10:00 AM IST (4:30 AM UTC)
-- =====================================================
-- Sends automated follow-up messages to leads after 24 hours of inactivity
-- Runs at: 10:00 AM India time (4:30 AM UTC)

SELECT cron.schedule(
  'send-daily-followups',                -- Job name
  '30 4 * * *',                          -- Daily at 4:30 AM UTC (10:00 AM IST)
  $$
  SELECT
    net.http_post(
      url := 'https://fcsdmvxtootizmndmrli.supabase.co/functions/v1/send-followups',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- =====================================================
-- 3. CLEANUP OLD DATA - Daily at 2:00 AM IST (8:30 PM UTC previous day)
-- =====================================================
-- Removes old messages, security events, and processing data
-- Runs at: 2:00 AM India time

SELECT cron.schedule(
  'cleanup-old-data',                    -- Job name
  '30 20 * * *',                         -- Daily at 8:30 PM UTC (2:00 AM IST next day)
  $$
  -- Cleanup old messages (keep last 90 days)
  SELECT public.cleanup_old_messages(90);

  -- Cleanup old security events (keep last 180 days)
  SELECT public.cleanup_old_security_data(180);

  -- Cleanup old processing data (keep last 30 days)
  SELECT public.cleanup_old_processing_data(30);
  $$
);

-- =====================================================
-- VIEW SCHEDULED JOBS
-- =====================================================
-- Query to check all scheduled cron jobs:
-- SELECT * FROM cron.job;

-- Query to check cron job execution history:
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;

-- =====================================================
-- UNSCHEDULE A JOB (if needed)
-- =====================================================
-- To remove a scheduled job, use:
-- SELECT cron.unschedule('job-name-here');

-- =====================================================
-- MANUAL TRIGGER (for testing)
-- =====================================================
-- To manually trigger process-timeouts for testing:
-- SELECT net.http_post(
--   url := 'https://fcsdmvxtootizmndmrli.supabase.co/functions/v1/process-timeouts',
--   headers := jsonb_build_object(
--     'Content-Type', 'application/json',
--     'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY_HERE'
--   ),
--   body := '{}'::jsonb
-- );

-- =====================================================
-- CONFIGURATION NOTES
-- =====================================================
-- 1. Ensure pg_cron extension is enabled in Supabase Dashboard
-- 2. Ensure pg_net extension is enabled for http_post
-- 3. Set service_role_key in database settings:
--    ALTER DATABASE postgres SET app.settings.service_role_key TO 'your-service-role-key';
-- 4. Adjust timezone if needed (current setup uses IST - Indian Standard Time)
-- 5. Monitor job execution in cron.job_run_details table

-- =====================================================
-- MONITORING QUERIES
-- =====================================================

-- Check job status
-- SELECT jobid, jobname, schedule, active, database
-- FROM cron.job
-- WHERE jobname IN ('process-inactive-sessions', 'send-daily-followups', 'cleanup-old-data');

-- Check recent job runs
-- SELECT
--   job.jobname,
--   run.status,
--   run.start_time,
--   run.end_time,
--   run.return_message
-- FROM cron.job_run_details run
-- JOIN cron.job job ON run.jobid = job.jobid
-- WHERE job.jobname IN ('process-inactive-sessions', 'send-daily-followups', 'cleanup-old-data')
-- ORDER BY run.start_time DESC
-- LIMIT 20;

-- Check failed jobs
-- SELECT
--   job.jobname,
--   run.start_time,
--   run.return_message
-- FROM cron.job_run_details run
-- JOIN cron.job job ON run.jobid = job.jobid
-- WHERE run.status = 'failed'
-- ORDER BY run.start_time DESC
-- LIMIT 10;
