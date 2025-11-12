# n8n Integration Quick Guide
## Connect Your Workflows to Enhanced Supabase

**Last Updated:** 2025-11-10

---

## 🔗 Setup Supabase Connection in n8n

### Step 1: Add Supabase Credentials

1. In n8n, go to **Credentials** → **New**
2. Search for "Supabase"
3. Fill in:
   - **Host:** `https://[your-project-ref].supabase.co`
   - **Service Role Key:** From Supabase Dashboard → Settings → API
   - **Anon Key:** (optional, for client-side operations)

**Get Your Project Details:**
```bash
# Get project URL
npx supabase status | grep "API URL"

# Get service role key (from Supabase Dashboard)
```

---

## 🚀 Ready-to-Use n8n Workflows

### 1. **Lead Source Tracking (WhatsApp → Supabase)**

**Workflow:**
```
WhatsApp Trigger → Extract UTM → Create/Update Lead → Log Success
```

**Supabase Node Configuration:**
```json
{
  "operation": "executeQuery",
  "query": "SELECT * FROM get_or_create_lead_by_phone($1, $2, $3, $4, $5, $6)",
  "parameters": [
    "{{ $json.from }}",           // phone
    "{{ $json.org_id }}",          // organization_id
    "whatsapp",                    // ref_source
    "{{ $json.campaign }}",        // utm_campaign
    "whatsapp_business",           // utm_source
    "chat",                        // utm_medium
    "{{ $json.metadata }}"         // source_metadata (JSON)
  ]
}
```

**Alternative - Simple HTTP Request:**
```yaml
Method: POST
URL: {{$credentials.supabase_host}}/rest/v1/rpc/get_or_create_lead_by_phone
Headers:
  apikey: {{$credentials.supabase_service_key}}
  Authorization: Bearer {{$credentials.supabase_service_key}}
  Content-Type: application/json
Body:
  {
    "phone_input": "{{ $json.from }}",
    "ref_source_input": "whatsapp",
    "utm_campaign_input": "automated_bot",
    "utm_source_input": "whatsapp_business",
    "utm_medium_input": "chat"
  }
```

---

### 2. **Push Notification Processor**

**Workflow:**
```
Schedule (Every 5 min) → Get Pending → Loop → Send → Mark Sent
```

**Node 1: Schedule Trigger**
- Interval: 5 minutes

**Node 2: Get Pending Notifications**
```yaml
Method: POST
URL: {{$credentials.supabase_host}}/rest/v1/rpc/get_pending_notifications
Headers:
  apikey: {{$credentials.supabase_service_key}}
  Authorization: Bearer {{$credentials.supabase_service_key}}
Body:
  {
    "p_channel": "email",
    "p_limit": 50
  }
```

**Node 3: Loop (Split in Batches)**
- Batch Size: 1

**Node 4: Send Email (Resend Node)**
```yaml
From: Subbu Classes <noreply@subbuclasses.com>
To: {{ $json.admin_email }}
Subject: {{ $json.payload.title }}
HTML: {{ $json.payload.body }}
```

**Node 5: Mark as Sent**
```yaml
Method: POST
URL: {{$credentials.supabase_host}}/rest/v1/rpc/mark_notification_sent
Body:
  {
    "p_queue_id": "{{ $json.queue_id }}",
    "p_status": "sent"
  }
```

---

### 3. **Daily Email Digest**

**Workflow:**
```
Schedule (Daily 9 AM) → Get Admins → Loop → Get Digest → Send Email
```

**Node 1: Schedule**
- Cron: `0 9 * * *` (9 AM daily)

**Node 2: Get Admins with Digest Enabled**
```sql
SELECT a.id, a.email, eds.frequency
FROM admins a
JOIN email_digest_settings eds ON a.id = eds.admin_id
WHERE eds.frequency = 'daily'
  AND a.is_active = true
```

**Node 3: Get Digest Data**
```yaml
Method: POST
URL: {{$credentials.supabase_host}}/rest/v1/rpc/get_email_digest_data
Body:
  {
    "p_admin_id": "{{ $json.id }}",
    "p_since": "{{ $now.minus({hours: 24}).toISO() }}"
  }
```

**Node 4: Format & Send Email**
Use the returned JSON to create a nice HTML email template.

---

### 4. **Organization Usage Monitor**

**Workflow:**
```
Schedule (Daily) → Get All Orgs → Check Limits → Send Warnings
```

**Node 1: Get Organizations Near Limits**
```sql
SELECT * FROM organization_analytics
WHERE lead_usage_percent > 80
   OR admin_usage_percent > 80
```

**Node 2: Send Warning Email**
```yaml
Subject: ⚠️ Approaching Limits - Upgrade Needed
Body: |
  Your organization {{ $json.organization_name }} is at:
  - Lead usage: {{ $json.lead_usage_percent }}%
  - Admin usage: {{ $json.admin_usage_percent }}%

  Consider upgrading your plan.
```

---

### 5. **AI Semantic Search (Advanced)**

**Workflow:**
```
Webhook → Generate Embedding → Search Similar → Format Response
```

**Node 1: Webhook Trigger**
Receives: `{ "question": "What concerns do parents have?" }`

**Node 2: OpenAI Embeddings**
```yaml
Model: text-embedding-ada-002
Input: {{ $json.question }}
```

**Node 3: Search Similar Messages**
```yaml
Method: POST
URL: {{$credentials.supabase_host}}/rest/v1/rpc/search_similar_messages
Body:
  {
    "query_embedding": {{ $json.embedding }},
    "match_threshold": 0.7,
    "match_count": 10
  }
```

**Node 4: Send to GPT-4**
```yaml
Prompt: |
  Based on these similar conversations:
  {{ $json.results }}

  Answer the question: {{ $('Webhook').item.json.question }}
```

---

### 6. **Inactive Lead Re-engagement**

**Workflow:**
```
Schedule (Daily 9 AM, 5 PM) → Run Function → Get Results → Send WhatsApp
```

**Node 1: Trigger Cron Job**
```yaml
Method: POST
URL: {{$credentials.supabase_host}}/rest/v1/rpc/identify_inactive_leads
```

**Node 2: Get New Notifications**
```sql
SELECT
  an.*,
  l.phone,
  l.parent_name,
  l.student_name
FROM admin_notifications an
JOIN leads l ON an.lead_id = l.id
WHERE an.type = 'urgent'
  AND an.is_read = false
  AND an.created_at > now() - interval '1 hour'
```

**Node 3: Send WhatsApp Re-engagement**
```yaml
To: {{ $json.phone }}
Message: |
  Hi {{ $json.parent_name }},

  We noticed we haven't heard from you in a while.
  How can we help with {{ $json.student_name }}'s education?
```

**Node 4: Log Outreach**
```sql
INSERT INTO reengagement_logs (
  lead_id, message_sent, campaign_type
) VALUES (
  '{{ $json.lead_id }}',
  '{{ $json.message }}',
  'inactive_followup'
)
```

---

## 🔧 Helper Functions Reference

### Lead Management

**Create/Get Lead with Source:**
```javascript
POST /rest/v1/rpc/get_or_create_lead_by_phone
{
  "phone_input": "+919876543210",
  "ref_source_input": "facebook",
  "utm_campaign_input": "summer_ads_2025"
}
```

**Get Recent Messages:**
```javascript
POST /rest/v1/rpc/get_recent_messages
{
  "lead_id_input": "uuid",
  "limit_count": 15
}
```

---

### Notifications

**Queue Notification:**
```javascript
POST /rest/v1/rpc/queue_notification
{
  "p_admin_id": "uuid",
  "p_channel": "email",
  "p_payload": {
    "title": "New Hot Lead",
    "body": "Lead XYZ needs attention"
  }
}
```

**Get Pending:**
```javascript
POST /rest/v1/rpc/get_pending_notifications
{
  "p_channel": "email",
  "p_limit": 50
}
```

---

### Organization

**Get Stats:**
```javascript
POST /rest/v1/rpc/get_organization_stats
{
  "p_organization_id": "uuid"
}
```

**Check Limits:**
```javascript
POST /rest/v1/rpc/check_organization_limit
{
  "p_organization_id": "uuid",
  "p_limit_type": "leads"
}
```

**Check Feature:**
```javascript
POST /rest/v1/rpc/has_organization_feature
{
  "p_organization_id": "uuid",
  "p_feature_name": "ai_insights"
}
```

---

### AI Features

**Search Similar Messages:**
```javascript
POST /rest/v1/rpc/search_similar_messages
{
  "query_embedding": [0.1, 0.2, ...],  // 1536 dimensions
  "match_threshold": 0.7,
  "match_count": 10
}
```

**Search Insights:**
```javascript
POST /rest/v1/rpc/search_conversation_insights
{
  "query_embedding": [0.1, 0.2, ...],
  "insight_type_filter": "objection",  // optional
  "match_threshold": 0.7
}
```

---

## 📊 Example: Marketing Attribution Report

**Workflow:**
```
Schedule (Weekly) → Query Analytics → Format Report → Email
```

**Query:**
```sql
SELECT
  ref_source,
  utm_campaign,
  total_leads,
  converted_leads,
  conversion_rate,
  avg_score
FROM lead_source_analytics
WHERE ref_source IS NOT NULL
ORDER BY conversion_rate DESC
```

**Format as Table:**
```
Source      Campaign         Leads  Converted  Rate   Score
----------  ---------------  -----  ---------  -----  -----
whatsapp    summer_2025      145    23         15.9%  67
facebook    paid_ads         98     12         12.2%  54
google      organic          67     15         22.4%  71
```

---

## 🎯 Best Practices

### 1. Error Handling
Always wrap Supabase calls in try-catch:
```javascript
try {
  const result = await $('Supabase').first().json;
  if (!result.success) {
    throw new Error(result.error);
  }
} catch (error) {
  // Log to monitoring
  // Retry logic
  // Notify admin
}
```

### 2. Rate Limiting
- Batch operations where possible
- Use schedule triggers wisely (not too frequent)
- Implement exponential backoff for retries

### 3. Monitoring
- Log all workflow executions
- Track error rates
- Set up alerts for failures

### 4. Security
- Use Service Role Key only in n8n (server-side)
- Never expose keys in frontend
- Use RLS policies as backup security layer

---

## 📈 Workflow Templates (Import Ready)

Coming soon - exportable n8n workflow JSON files for:
- [ ] Lead source tracking
- [ ] Notification processor
- [ ] Email digests
- [ ] Usage monitoring
- [ ] Semantic search
- [ ] Re-engagement campaigns

---

## 🆘 Troubleshooting

### Issue: "Function not found"
**Solution:** Ensure migrations are applied. Check:
```sql
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name LIKE 'get_%';
```

### Issue: "Row Level Security policy violation"
**Solution:** Use Service Role Key (bypasses RLS) or add appropriate RLS policies.

### Issue: "Vector dimension mismatch"
**Solution:** Ensure embeddings are exactly 1536 dimensions (OpenAI ada-002).

---

## 📚 Resources

- **Full Documentation:** `SUPABASE_ENHANCEMENTS_2025-11-10.md`
- **Deployment Guide:** `DEPLOYMENT_CHECKLIST.md`
- **Quick Reference:** `ENHANCEMENT_SUMMARY.md`
- **Supabase Docs:** https://supabase.com/docs
- **n8n Docs:** https://docs.n8n.io

---

**Ready to automate!** 🤖
Start with the simplest workflow (lead source tracking) and build from there.
