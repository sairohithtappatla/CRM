-- ==========================================
-- COMPREHENSIVE SECURITY TEST SUITE
-- Password Reset & Change System
-- ==========================================
-- Run these tests from Supabase Dashboard SQL Editor
-- Expected outcomes are documented for each test

-- ==========================================
-- SECTION 1: Schema Validation
-- ==========================================

-- Test 1.1: Verify RLS is enabled
SELECT
    tablename,
    rowsecurity as rls_enabled,
    CASE
        WHEN rowsecurity THEN '✅ PASS'
        ELSE '❌ FAIL'
    END as status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('password_reset_tokens', 'admins', 'security_events')
ORDER BY tablename;
-- Expected: All tables show rls_enabled = true

-- Test 1.2: Verify no permissive policies exist
SELECT
    tablename,
    policyname,
    '❌ FAIL - Policy should not exist' as status
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('password_reset_tokens', 'admins')
  AND permissive = 'PERMISSIVE'
  AND roles::text LIKE '%anon%' OR roles::text LIKE '%authenticated%';
-- Expected: 0 rows (no permissive policies for anon/authenticated)

-- Test 1.3: Verify table schema correctness
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'password_reset_tokens'
ORDER BY ordinal_position;
-- Expected: email, token_hash, used, expires_at all NOT NULL; attempts column exists

-- ==========================================
-- SECTION 2: Token Generation Tests
-- ==========================================

-- Test 2.1: Generate reset token for valid admin
-- Replace with actual admin email from your database
SELECT generate_reset_token('subbuinnovativeclasses@gmail.com');
-- Expected: Returns JSON with success=true, code (6 digits), email

-- Test 2.2: Generate reset token for non-existent email (anti-enumeration)
SELECT generate_reset_token('nonexistent@fake.com');
-- Expected: Returns JSON with success=true (doesn't reveal email doesn't exist)

-- Test 2.3: Verify token was created (for valid email only)
SELECT
    email,
    token_hash IS NOT NULL as has_hash,
    expires_at > now() as not_expired,
    used,
    attempts,
    created_at
FROM password_reset_tokens
WHERE email = 'subbuinnovativeclasses@gmail.com'
  AND used = false
ORDER BY created_at DESC
LIMIT 1;
-- Expected: 1 row, has_hash=true, not_expired=true, used=false, attempts=0

-- Test 2.4: Test rate limiting (try to create 6 tokens)
DO $$
DECLARE
    i int;
    result json;
BEGIN
    FOR i IN 1..6 LOOP
        SELECT generate_reset_token('subbuinnovativeclasses@gmail.com') INTO result;
        RAISE NOTICE 'Attempt %: %', i, result;
    END LOOP;
END $$;
-- Expected: First 5 succeed, 6th returns rate-limited note

-- ==========================================
-- SECTION 3: Token Verification Tests
-- ==========================================

-- Test 3.1: Verify with correct code (use code from Test 2.1)
-- SELECT verify_reset_token('subbuinnovativeclasses@gmail.com', 'CODE_HERE');
-- Expected: Returns {valid: true}

-- Test 3.2: Verify with incorrect code
SELECT verify_reset_token('subbuinnovativeclasses@gmail.com', '999999');
-- Expected: Returns {valid: false, error: 'Invalid code'}, attempts incremented

-- Test 3.3: Check attempts were incremented
SELECT email, attempts, used
FROM password_reset_tokens
WHERE email = 'subbuinnovativeclasses@gmail.com'
  AND used = false
ORDER BY created_at DESC
LIMIT 1;
-- Expected: attempts = 1 (from failed verification)

-- ==========================================
-- SECTION 4: Password Reset Tests
-- ==========================================

-- Test 4.1: Reset password with invalid code
SELECT reset_user_password('subbuinnovativeclasses@gmail.com', '000000', 'NewPass123');
-- Expected: {success: false, error: 'Invalid code'}

-- Test 4.2: Reset password with weak password
-- SELECT reset_user_password('subbuinnovativeclasses@gmail.com', 'VALID_CODE', 'weak');
-- Expected: {success: false, error: 'Password must be 8+ characters...'}

-- Test 4.3: Reset password with valid code (use actual code from Test 2.1)
-- SELECT reset_user_password('subbuinnovativeclasses@gmail.com', 'CODE_HERE', 'NewSecure123!');
-- Expected: {success: true}

-- Test 4.4: Verify token was marked as used
SELECT email, used, expires_at
FROM password_reset_tokens
WHERE email = 'subbuinnovativeclasses@gmail.com'
ORDER BY created_at DESC
LIMIT 1;
-- Expected: used = true

-- Test 4.5: Try to reuse the same code
-- SELECT reset_user_password('subbuinnovativeclasses@gmail.com', 'SAME_CODE', 'AnotherPass123');
-- Expected: {success: false, error: 'Invalid or expired code'}

-- ==========================================
-- SECTION 5: Attempt Locking Tests
-- ==========================================

-- Test 5.1: Create a token and try 11 invalid codes
DO $$
DECLARE
    result json;
    test_code text;
    i int;
BEGIN
    -- Generate a new token
    SELECT generate_reset_token('subbuinnovativeclasses@gmail.com') INTO result;
    test_code := result->>'code';

    -- Try 11 wrong codes
    FOR i IN 1..11 LOOP
        SELECT reset_user_password('subbuinnovativeclasses@gmail.com', '111111', 'Test123!') INTO result;
        RAISE NOTICE 'Attempt %: %', i, result;
    END LOOP;
END $$;
-- Expected: After 10 attempts, returns 'Token locked'

-- Test 5.2: Verify token is locked
SELECT email, attempts, used
FROM password_reset_tokens
WHERE email = 'subbuinnovativeclasses@gmail.com'
  AND created_at > now() - interval '5 minutes'
ORDER BY created_at DESC
LIMIT 1;
-- Expected: attempts >= 10

-- ==========================================
-- SECTION 6: Password Change Tests (Settings)
-- ==========================================

-- Test 6.1: Change password with incorrect current password
SELECT change_user_password('subbuinnovativeclasses@gmail.com', 'WrongPass', 'NewPass123!');
-- Expected: {success: false, error: 'Current password is incorrect'}

-- Test 6.2: Change password with correct current password
-- SELECT change_user_password('subbuinnovativeclasses@gmail.com', 'CURRENT_PASSWORD', 'UpdatedPass123!');
-- Expected: {success: true}

-- ==========================================
-- SECTION 7: Security Events Logging
-- ==========================================

-- Test 7.1: View recent security events
SELECT
    email,
    event_type,
    metadata,
    created_at
FROM security_events
WHERE email = 'subbuinnovativeclasses@gmail.com'
ORDER BY created_at DESC
LIMIT 10;
-- Expected: Shows password_reset, password_changed, login_failed events

-- Test 7.2: Count events by type
SELECT
    event_type,
    count(*) as event_count
FROM security_events
GROUP BY event_type
ORDER BY event_count DESC;
-- Expected: Shows distribution of security events

-- ==========================================
-- SECTION 8: Cleanup Tests
-- ==========================================

-- Test 8.1: View old tokens (before cleanup)
SELECT count(*) as old_tokens_count
FROM password_reset_tokens
WHERE created_at < now() - interval '7 days' OR used = true;
-- Expected: Count of old/expired tokens

-- Test 8.2: Run cleanup
SELECT cleanup_old_security_data();
-- Expected: void return

-- Test 8.3: Verify cleanup worked
SELECT count(*) as remaining_old_tokens
FROM password_reset_tokens
WHERE (created_at < now() - interval '7 days') OR (used = true AND created_at < now() - interval '7 days');
-- Expected: 0 (all old tokens removed)

-- ==========================================
-- SECTION 9: Permission Tests
-- ==========================================

-- Test 9.1: Verify function grants
SELECT
    p.proname as function_name,
    pg_catalog.pg_get_function_identity_arguments(p.oid) as arguments,
    CASE
        WHEN p.proacl IS NULL THEN 'PUBLIC'
        WHEN p.proacl::text LIKE '%service_role%' THEN '✅ service_role'
        WHEN p.proacl::text LIKE '%anon%' THEN '✅ anon'
        WHEN p.proacl::text LIKE '%authenticated%' THEN '✅ authenticated'
        ELSE p.proacl::text
    END as acl
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN ('generate_reset_token', 'reset_user_password', 'change_user_password', 'verify_reset_token')
ORDER BY p.proname;
-- Expected:
-- generate_reset_token: service_role only
-- reset_user_password: anon, authenticated
-- change_user_password: authenticated only
-- verify_reset_token: authenticated only

-- ==========================================
-- FINAL VALIDATION CHECKLIST
-- ==========================================

-- Run this query for final status check
SELECT
    'password_reset_tokens RLS' as check_name,
    CASE WHEN rowsecurity THEN '✅ PASS' ELSE '❌ FAIL' END as status
FROM pg_tables
WHERE tablename = 'password_reset_tokens'

UNION ALL

SELECT
    'admins RLS' as check_name,
    CASE WHEN rowsecurity THEN '✅ PASS' ELSE '❌ FAIL' END as status
FROM pg_tables
WHERE tablename = 'admins'

UNION ALL

SELECT
    'security_events table exists' as check_name,
    CASE WHEN EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'security_events')
         THEN '✅ PASS' ELSE '❌ FAIL' END as status

UNION ALL

SELECT
    'attempts column exists' as check_name,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'password_reset_tokens' AND column_name = 'attempts'
    ) THEN '✅ PASS' ELSE '❌ FAIL' END as status

UNION ALL

SELECT
    'No permissive policies on sensitive tables' as check_name,
    CASE WHEN NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename IN ('password_reset_tokens', 'admins')
          AND permissive = 'PERMISSIVE'
    ) THEN '✅ PASS' ELSE '❌ FAIL' END as status;

-- Expected: All checks show ✅ PASS

-- ==========================================
-- MONITORING QUERIES
-- (Run these periodically for monitoring)
-- ==========================================

-- Monitor 1: Active reset tokens
SELECT
    email,
    expires_at,
    attempts,
    created_at,
    CASE
        WHEN expires_at < now() THEN '⏰ Expired'
        WHEN attempts >= 10 THEN '🔒 Locked'
        WHEN attempts >= 5 THEN '⚠️ High attempts'
        ELSE '✅ Active'
    END as status
FROM password_reset_tokens
WHERE used = false
  AND created_at > now() - interval '1 day'
ORDER BY created_at DESC;

-- Monitor 2: Failed attempts by email (potential abuse)
SELECT
    email,
    count(*) as failed_attempts,
    max(created_at) as last_attempt
FROM security_events
WHERE event_type = 'login_failed'
  AND created_at > now() - interval '1 hour'
GROUP BY email
HAVING count(*) >= 5
ORDER BY failed_attempts DESC;

-- Monitor 3: Recent password changes
SELECT
    email,
    event_type,
    metadata->>'source' as source,
    created_at
FROM security_events
WHERE event_type IN ('password_reset', 'password_changed')
  AND created_at > now() - interval '24 hours'
ORDER BY created_at DESC;

-- ==========================================
-- END OF TEST SUITE
-- ==========================================
