-- ============================================
-- ENABLE REQUIRED EXTENSIONS
-- ============================================
-- Run this FIRST before applying migrations
-- Execute in Supabase Dashboard → SQL Editor
-- ============================================

-- 1. Enable vector extension for AI embeddings
CREATE EXTENSION IF NOT EXISTS "vector"
WITH SCHEMA public;

-- 2. Enable pg_cron for scheduled jobs
CREATE EXTENSION IF NOT EXISTS "pg_cron"
WITH SCHEMA public;

-- 3. Grant permissions for pg_cron
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL ON ALL TABLES IN SCHEMA cron TO postgres;

-- 4. Verify extensions are enabled
SELECT
  extname,
  extversion,
  nspname as schema
FROM pg_extension e
JOIN pg_namespace n ON e.extnamespace = n.oid
WHERE extname IN ('vector', 'pg_cron', 'uuid-ossp', 'pgcrypto')
ORDER BY extname;

-- ============================================
-- EXPECTED OUTPUT
-- ============================================
-- extname     | extversion | schema
-- ------------|------------|-----------
-- pg_cron     | 1.6.4      | public
-- pgcrypto    | 1.3        | extensions
-- uuid-ossp   | 1.1        | extensions
-- vector      | 0.8.0      | public
--
-- If you see 4 rows, you're ready to proceed!
-- ============================================

-- 5. Additional verification
DO $$
BEGIN
  -- Check vector extension
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    RAISE EXCEPTION 'Vector extension not enabled! Run: CREATE EXTENSION vector;';
  END IF;

  -- Check pg_cron extension
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE EXCEPTION 'pg_cron extension not enabled! Run: CREATE EXTENSION pg_cron;';
  END IF;

  RAISE NOTICE '✅ All required extensions are enabled!';
END $$;

-- ============================================
-- NEXT STEP: Apply migrations
-- ============================================
-- Run: npx supabase db push
-- Or apply migrations manually via SQL Editor
-- ============================================
