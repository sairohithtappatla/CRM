# Deployment Checklist
## Step-by-Step Migration Guide

**Status:** 🟡 Pre-Deployment
**Date:** 2025-11-10

---

## ✅ Pre-Deployment Steps (Do This First!)

### Step 1: Enable Extensions (REQUIRED)

**⚠️ CRITICAL:** These extensions must be enabled BEFORE running migrations.

Open Supabase Dashboard → SQL Editor → Run this:

```sql
-- Enable vector extension for AI embeddings
CREATE EXTENSION IF NOT EXISTS "vector";

-- Enable pg_cron for scheduled jobs
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- Verify extensions are enabled
SELECT extname, extversion FROM pg_extension
WHERE extname IN ('vector', 'pg_cron', 'uuid-ossp', 'pgcrypto');
```

**Expected Result:**
```
extname     | extversion
------------|------------
vector      | 0.8.0
pg_cron     | 1.6.4
uuid-ossp   | 1.1
pgcrypto    | 1.3
```

---

### Step 2: Backup Current Database

```bash
# Create backup before migrations
npx supabase db dump -f backup_before_enhancements_$(date +%Y%m%d).sql
```

Or via Dashboard: Settings → Database → Download Backup

---

### Step 3: Run Migration Tests

#### 3a. Lint Migrations (Check Syntax)
```bash
cd D:\WORK\agents\subbu-innovative-classes\subbu-connect-main

# Lint all migration files
npx supabase db lint
```

**Expected:** No errors, possible warnings about unused indexes (ignore for now)

#### 3b. Dry Run (Test Without Applying)
```bash
# This shows what would be applied WITHOUT actually applying it
npx supabase db push --dry-run
```

**Expected Output:**
```
Would apply migrations:
  - 20251110000001_add_lead_source_tracking.sql
  - 20251110000002_add_vector_embeddings.sql
  - 20251110000003_setup_pg_cron_jobs.sql
  - 20251110000004_add_push_notifications.sql
  - 20251110000005_multi_tenant_improvements.sql
```

---

## 🚀 Deployment Steps

### Step 4: Apply Migrations

**Option A: All at Once (Recommended)**
```bash
npx supabase db push
```

**Option B: One by One (Safer)**
```bash
# Apply migrations individually
npx supabase db push --include-migrations 20251110000001
npx supabase db push --include-migrations 20251110000002
npx supabase db push --include-migrations 20251110000003
npx supabase db push --include-migrations 20251110000004
npx supabase db push --include-migrations 20251110000005
```

**Option C: Via Supabase Dashboard (Manual)**
1. Go to SQL Editor
2. Copy content from `supabase/migrations/20251110000001_add_lead_source_tracking.sql`
3. Run
4. Repeat for 002, 003, 004, 005

---

### Step 5: Verify Deployment

Run this verification script:

```sql
-- ============================================
-- DEPLOYMENT VERIFICATION SCRIPT
-- ============================================

-- 1. Check new tables exist (should return 9)
SELECT COUNT(*) as new_tables_count FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'message_embeddings',
    'conversation_insights',
    'push_subscriptions',
    'notification_preferences',
    'notification_queue',
    'email_digest_settings',
    'organization_usage',
    'organization_invitations',
    'cron_execution_log'
  );
-- Expected: 9

-- 2. Check new columns in leads (should return 11)
SELECT COUNT(*) as new_lead_columns FROM information_schema.columns
WHERE table_name = 'leads'
  AND column_name IN (
    'ref_source', 'utm_campaign', 'utm_source', 'utm_medium',
    'utm_content', 'utm_term', 'referrer_url', 'landing_page',
    'device_type', 'browser', 'source_metadata'
  );
-- Expected: 11

-- 3. Check new columns in organizations (should return 11)
SELECT COUNT(*) as new_org_columns FROM information_schema.columns
WHERE table_name = 'organizations'
  AND column_name IN (
    'subscription_plan', 'subscription_status', 'trial_ends_at',
    'max_leads', 'max_admins', 'features', 'settings',
    'phone', 'address', 'is_active', 'updated_at'
  );
-- Expected: 11

-- 4. Check new columns in admins (should return 4)
SELECT COUNT(*) as new_admin_columns FROM information_schema.columns
WHERE table_name = 'admins'
  AND column_name IN ('role', 'is_active', 'last_login_at', 'updated_at');
-- Expected: 4

-- 5. Check extensions (should return 4)
SELECT COUNT(*) as extensions_count FROM pg_extension
WHERE extname IN ('vector', 'pg_cron', 'uuid-ossp', 'pgcrypto');
-- Expected: 4

-- 6. Check cron jobs (should return 7)
SELECT COUNT(*) as cron_jobs_count FROM cron.job
WHERE database = current_database();
-- Expected: 7

-- 7. Check new views (should return 3)
SELECT COUNT(*) as new_views FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name IN (
    'lead_source_analytics',
    'organization_analytics',
    'cron_job_status'
  );
-- Expected: 3

-- 8. Check new functions (should return 14+)
SELECT COUNT(*) as new_functions FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'search_similar_messages',
    'get_contextual_messages',
    'search_conversation_insights',
    'should_send_notification',
    'queue_notification',
    'get_push_subscriptions_for_admin',
    'mark_notification_sent',
    'get_pending_notifications',
    'get_email_digest_data',
    'check_organization_limit',
    'get_organization_stats',
    'has_organization_feature',
    'record_organization_usage',
    'scheduled_cleanup_old_data',
    'generate_daily_conversation_reports',
    'identify_inactive_leads',
    'update_lead_scores',
    'archive_old_insights'
  );
-- Expected: 18+

-- ============================================
-- SUMMARY
-- ============================================
SELECT
  'Deployment Status' as check_type,
  CASE
    WHEN (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('message_embeddings', 'push_subscriptions')) = 2
    THEN '✅ SUCCESS'
    ELSE '❌ FAILED - Check logs'
  END as status;
```

**Expected Final Output:**
```
check_type         | status
-------------------|-------------
Deployment Status  | ✅ SUCCESS
```

---

### Step 6: Set Environment Variables

```bash
# Set required API keys
npx supabase secrets set RESEND_API_KEY=your_resend_key_here
npx supabase secrets set OPENAI_API_KEY=your_openai_key_here

# Optional: For PWA push notifications (generate at https://web-push-codelab.glitch.me/)
npx supabase secrets set VAPID_PUBLIC_KEY=your_vapid_public_key
npx supabase secrets set VAPID_PRIVATE_KEY=your_vapid_private_key
npx supabase secrets set VAPID_SUBJECT=mailto:admin@subbuclasses.com
```

**Verify Secrets:**
```bash
npx supabase secrets list
```

---

### Step 7: Test Key Features

Run these tests to ensure everything works:

#### Test 1: Lead Source Tracking
```sql
-- Create test lead with source tracking
SELECT * FROM get_or_create_lead_by_phone(
  phone_input := '+919999999999',
  org_id_input := (SELECT id FROM organizations LIMIT 1),
  ref_source_input := 'test_whatsapp',
  utm_campaign_input := 'deployment_test',
  utm_source_input := 'manual_test',
  utm_medium_input := 'testing'
);

-- Check if source was recorded
SELECT ref_source, utm_campaign FROM leads WHERE phone = '+919999999999';
-- Expected: ref_source = 'test_whatsapp', utm_campaign = 'deployment_test'

-- Clean up test
DELETE FROM leads WHERE phone = '+919999999999';
```

#### Test 2: Vector Extension
```sql
-- Test vector type works
SELECT '[0.1, 0.2, 0.3]'::vector(3);
-- Expected: [0.1,0.2,0.3]

-- Test similarity search (will be empty until embeddings are added)
SELECT COUNT(*) FROM message_embeddings;
-- Expected: 0 (empty but table exists)
```

#### Test 3: Cron Jobs
```sql
-- List all scheduled jobs
SELECT * FROM cron_job_status;
-- Expected: 7 jobs shown

-- Manually trigger a job to test
SELECT scheduled_cleanup_old_data();
-- Expected: No errors

-- Check job execution history
SELECT * FROM get_cron_job_history('daily-cleanup', 5);
-- Expected: Shows execution history
```

#### Test 4: Notification System
```sql
-- Create test notification preference
INSERT INTO notification_preferences (admin_id, channel, notification_type, enabled)
SELECT id, 'email', 'hot_lead', true FROM admins LIMIT 1
ON CONFLICT DO NOTHING;

-- Queue a test notification
SELECT queue_notification(
  (SELECT id FROM admins LIMIT 1),
  NULL,
  'email',
  '{"title": "Test Notification", "body": "Deployment test successful!"}'::jsonb
);

-- Check queue
SELECT * FROM notification_queue WHERE status = 'pending';
-- Expected: 1 pending notification

-- Clean up test
DELETE FROM notification_queue WHERE status = 'pending';
DELETE FROM notification_preferences WHERE notification_type = 'hot_lead' AND channel = 'email';
```

#### Test 5: Organization Features
```sql
-- Check organization stats
SELECT get_organization_stats((SELECT id FROM organizations LIMIT 1));
-- Expected: JSON with leads, admins, messages, payments stats

-- Check limits
SELECT check_organization_limit(
  (SELECT id FROM organizations LIMIT 1),
  'leads'
);
-- Expected: true (if under limit)

-- Check feature access
SELECT has_organization_feature(
  (SELECT id FROM organizations LIMIT 1),
  'ai_insights'
);
-- Expected: false (default is disabled)
```

---

## 🎯 Post-Deployment Actions

### Immediate (Next 1 hour)

- [ ] ✅ All verification tests passed
- [ ] Set environment variables (RESEND_API_KEY, OPENAI_API_KEY)
- [ ] Test one real lead creation with source tracking
- [ ] Monitor Supabase logs for errors
- [ ] Update team documentation

### Short Term (This Week)

- [ ] Update frontend to capture UTM parameters
- [ ] Implement service worker for PWA push notifications
- [ ] Create first n8n workflow (notification processor)
- [ ] Set up OpenAI integration for embeddings
- [ ] Configure email digest templates

### Medium Term (This Month)

- [ ] Build marketing attribution dashboard
- [ ] Create AI semantic search integration
- [ ] Implement organization admin panel
- [ ] Set up monitoring dashboards
- [ ] Train team on new features

---

## 🚨 Troubleshooting

### Issue: "Extension vector does not exist"
**Solution:**
```sql
-- Run this first
CREATE EXTENSION IF NOT EXISTS "vector";
```

### Issue: "Extension pg_cron does not exist"
**Solution:**
```sql
CREATE EXTENSION IF NOT EXISTS "pg_cron";
GRANT USAGE ON SCHEMA cron TO postgres;
```

### Issue: "Function already exists"
**Solution:** Functions have `CREATE OR REPLACE`, so this shouldn't happen. If it does:
```sql
-- Drop and recreate
DROP FUNCTION IF EXISTS function_name CASCADE;
-- Then re-run migration
```

### Issue: Migration fails midway
**Solution:**
```sql
-- Check which migrations were applied
SELECT * FROM supabase_migrations.schema_migrations
ORDER BY version DESC;

-- Apply remaining migrations manually via SQL Editor
```

### Issue: Cron jobs not showing
**Solution:**
```sql
-- Check pg_cron extension
SELECT * FROM pg_extension WHERE extname = 'pg_cron';

-- If missing, enable it
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- Re-run migration 003
```

---

## 📊 Deployment Status Tracker

**Pre-Deployment:**
- [ ] Extensions enabled (vector, pg_cron)
- [ ] Database backup created
- [ ] Migration lint passed
- [ ] Dry run successful

**Deployment:**
- [ ] Migration 001 applied (Lead Source Tracking)
- [ ] Migration 002 applied (Vector Embeddings)
- [ ] Migration 003 applied (pg_cron Jobs)
- [ ] Migration 004 applied (Push Notifications)
- [ ] Migration 005 applied (Multi-Tenant)

**Verification:**
- [ ] New tables exist (9 tables)
- [ ] New columns added to leads (11)
- [ ] New columns added to organizations (11)
- [ ] Extensions active (4)
- [ ] Cron jobs scheduled (7)
- [ ] Functions created (18+)
- [ ] All tests passed

**Post-Deployment:**
- [ ] Environment variables set
- [ ] Team notified
- [ ] Documentation updated
- [ ] Monitoring enabled

---

## 📝 Notes

**Migration Time:** ~2-3 minutes for all migrations
**Downtime:** None (migrations are additive)
**Rollback Available:** Yes (see SUPABASE_ENHANCEMENTS_2025-11-10.md)

**Support:**
- Documentation: `SUPABASE_ENHANCEMENTS_2025-11-10.md`
- Quick Guide: `ENHANCEMENT_SUMMARY.md`
- Migration README: `supabase/migrations/README.md`

---

**Status:** Ready for deployment! 🚀
**Last Updated:** 2025-11-10
