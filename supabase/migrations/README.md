# Database Migrations

This directory contains all database migrations for the Subbu Innovative Classes CRM.

## Latest Migrations (2025-11-10)

### New Features Added

1. **20251110000001_add_lead_source_tracking.sql**
   - Adds UTM parameters and source tracking to leads table
   - Creates lead_source_analytics view
   - Updates get_or_create_lead_by_phone function

2. **20251110000002_add_vector_embeddings.sql**
   - Enables vector extension for AI embeddings
   - Creates message_embeddings and conversation_insights tables
   - Adds semantic search functions

3. **20251110000003_setup_pg_cron_jobs.sql**
   - Enables pg_cron for scheduled jobs
   - Creates 6 automated jobs (cleanup, reports, scoring)
   - Adds monitoring functions and views

4. **20251110000004_add_push_notifications.sql**
   - Creates push notification system
   - Adds notification preferences and queue
   - Email digest settings
   - Auto-queuing trigger

5. **20251110000005_multi_tenant_improvements.sql**
   - Enhances organizations with subscription plans
   - Adds usage tracking and limits
   - Organization invitations system
   - Enhanced RLS policies

## How to Deploy

### Option 1: Supabase CLI (Recommended)
```bash
# From project root
cd subbu-connect-main

# Push all migrations
npx supabase db push

# Or apply specific migration
npx supabase db push --include-migrations 20251110000001
```

### Option 2: Supabase Dashboard
1. Go to SQL Editor
2. Copy each migration file content
3. Execute in order (001 → 005)
4. Verify success after each

### Option 3: Direct SQL
```bash
# Connect to database
psql "postgresql://..."

# Run each migration
\i supabase/migrations/20251110000001_add_lead_source_tracking.sql
\i supabase/migrations/20251110000002_add_vector_embeddings.sql
\i supabase/migrations/20251110000003_setup_pg_cron_jobs.sql
\i supabase/migrations/20251110000004_add_push_notifications.sql
\i supabase/migrations/20251110000005_multi_tenant_improvements.sql
```

## Post-Deployment

### 1. Set Environment Variables
```bash
npx supabase secrets set RESEND_API_KEY=re_xxxxx
npx supabase secrets set OPENAI_API_KEY=sk-xxxxx
npx supabase secrets set VAPID_PUBLIC_KEY=xxxxx
npx supabase secrets set VAPID_PRIVATE_KEY=xxxxx
```

### 2. Verify Deployment
```sql
-- Check new tables
SELECT count(*) FROM information_schema.tables
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
-- Should return 9

-- Check extensions
SELECT extname, extversion FROM pg_extension
WHERE extname IN ('vector', 'pg_cron');
-- Should return both

-- Check cron jobs
SELECT count(*) FROM cron.job WHERE database = current_database();
-- Should return 7 jobs
```

### 3. Test Key Features
```sql
-- Test lead source tracking
SELECT * FROM get_or_create_lead_by_phone(
  '+919999999999',
  (SELECT id FROM organizations LIMIT 1),
  'test_source',
  'test_campaign'
);

-- Test cron job manually
SELECT scheduled_cleanup_old_data();

-- Test notification queue
SELECT queue_notification(
  (SELECT id FROM admins LIMIT 1),
  NULL,
  'email',
  '{"title": "Test", "body": "Test notification"}'::jsonb
);

-- Check organization stats
SELECT get_organization_stats((SELECT id FROM organizations LIMIT 1));
```

## Rollback

If needed, rollback by dropping new objects:

```sql
-- See SUPABASE_ENHANCEMENTS_2025-11-10.md for complete rollback script
```

## Migration Order

⚠️ **Important:** Migrations must be applied in order:
1. Lead source tracking (no dependencies)
2. Vector embeddings (requires vector extension)
3. pg_cron jobs (requires functions from #1, #2)
4. Push notifications (standalone)
5. Multi-tenant (modifies existing tables)

## Documentation

- **Detailed Guide:** `../../SUPABASE_ENHANCEMENTS_2025-11-10.md`
- **Quick Summary:** `../../ENHANCEMENT_SUMMARY.md`
- **Original Docs:** `../../SUPABASE_DOCUMENTATION.md`

## Support

For issues:
1. Check migration logs in Supabase Dashboard
2. Review function comments in SQL files
3. See troubleshooting section in enhancement docs
4. Contact development team

---

**Last Updated:** 2025-11-10
**Status:** ✅ Production Ready
