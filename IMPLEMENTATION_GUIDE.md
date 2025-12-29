# Implementation Guide

## Quick Start: Deploying the Improvements

This guide walks you through implementing all the workflow improvements step-by-step.

---

## ✅ ALREADY COMPLETED

The following have been automatically applied:

1. ✅ Workflow JSON updated with new nodes
2. ✅ Database migrations applied
3. ✅ Analytics views created
4. ✅ Functions created in Supabase
5. ✅ Error handling nodes added
6. ✅ Rate limiting implemented
7. ✅ Parent name extraction enhanced

---

## 🔧 MANUAL STEPS REQUIRED

### Step 1: Set Razorpay Webhook Secret

**Why:** Enables webhook signature verification to prevent fraud.

**How:**

1. **Get your webhook secret from Razorpay:**
   - Log in to Razorpay Dashboard
   - Go to **Settings** → **Webhooks**
   - Copy the **Webhook Secret**

2. **Add to n8n environment:**
   
   **Option A: Via n8n UI**
   - Go to n8n Settings → Variables
   - Add new variable:
     - Name: `RAZORPAY_WEBHOOK_SECRET`
     - Value: `your_webhook_secret_here`

   **Option B: Via Docker/Environment**
   ```bash
   # In your .env file or docker-compose.yml
   RAZORPAY_WEBHOOK_SECRET=your_webhook_secret_here
   ```

3. **Restart n8n** to load the new environment variable

4. **Test:** Send a test webhook from Razorpay Dashboard

**Verification:**
- Check n8n logs for: `✅ Webhook signature verified`
- Should NOT see: `⚠️ WARNING: Webhook signature verification skipped`

---

### Step 2: Configure Razorpay API Credentials

**Why:** Enables payment link generation.

**How:**

1. **Get API credentials from Razorpay:**
   - Log in to Razorpay Dashboard
   - Go to **Settings** → **API Keys**
   - Copy **Key ID** and **Key Secret**

2. **Add to n8n:**
   - Open the workflow in n8n
   - Find the `Generate_Razorpay_Link` node
   - Click on **Credentials** → **Create New**
   - Select **HTTP Basic Auth**
   - Enter:
     - Username: `your_razorpay_key_id`
     - Password: `your_razorpay_key_secret`
   - Save as: "Razorpay API"

3. **Test:** Trigger a payment request in the workflow

**Verification:**
- Payment link should be generated successfully
- Check Razorpay Dashboard for test payment link

---

### Step 3: Test Error Handling

**Why:** Ensure payment failures are handled gracefully.

**Test Scenarios:**

#### Test 1: Invalid Razorpay Credentials
1. Temporarily set wrong credentials in `Generate_Razorpay_Link`
2. Trigger a payment request
3. **Expected:**
   - User receives: "I'm sorry, I couldn't generate the payment link..."
   - Admin gets notification
   - Workflow continues (doesn't crash)

#### Test 2: Network Failure
1. Disconnect internet temporarily
2. Trigger payment request
3. **Expected:** Same as Test 1

#### Test 3: Successful Payment
1. Restore correct credentials
2. Trigger payment request
3. **Expected:**
   - User receives payment link
   - Payment record saved in database
   - No error messages

---

### Step 4: Test Rate Limiting

**Why:** Verify spam protection works.

**Test:**

1. Send 10 messages rapidly from same phone number (within 60 seconds)
2. **Expected:** All 10 messages processed

3. Send 11th message immediately
4. **Expected:**
   - Message rejected
   - User sees: "You're sending messages too quickly..."
   - Workflow logs show: `⚠️ Rate limit exceeded for [phone]`

5. Wait 60 seconds, send another message
6. **Expected:** Message processed normally

**Monitoring:**
```sql
-- Check for rate-limited users
SELECT 
  lead_id,
  COUNT(*) as message_count,
  MAX(timestamp) as last_message
FROM public.messages
WHERE timestamp >= NOW() - INTERVAL '1 hour'
GROUP BY lead_id
HAVING COUNT(*) > 20
ORDER BY message_count DESC;
```

---

### Step 5: Verify Analytics Views

**Why:** Ensure data is flowing correctly.

**Test Queries:**

```sql
-- 1. Dashboard summary
SELECT * FROM public.get_dashboard_summary();

-- 2. Recent conversions
SELECT * FROM public.v_conversion_analytics
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY date DESC;

-- 3. Response times
SELECT * FROM public.v_response_time_analytics
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY date DESC;

-- 4. Common questions
SELECT * FROM public.v_common_questions
LIMIT 10;

-- 5. Payment analytics
SELECT * FROM public.v_payment_analytics
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY date DESC;
```

**Expected:**
- All queries return data (if you have activity)
- No errors
- Data looks reasonable

---

### Step 6: Test Parent Name Extraction

**Why:** Verify enhanced profile extraction works.

**Test Messages:**

1. **Test 1:** Parent introduces themselves
   ```
   User: "Hi, I'm Rajesh Kumar. I want to know about JEE coaching for my son."
   ```
   **Expected:** `parent_name = "Rajesh Kumar"` extracted

2. **Test 2:** Student name mentioned
   ```
   User: "My son Arjun is in class 10."
   ```
   **Expected:** `student_name = "Arjun"` extracted

3. **Test 3:** Both names
   ```
   User: "I'm Priya Sharma, mother of Riya who is preparing for NEET."
   ```
   **Expected:**
   - `parent_name = "Priya Sharma"`
   - `student_name = "Riya"`

**Verification:**
```sql
-- Check extracted names
SELECT 
  id,
  parent_name,
  phone,
  (SELECT profile->>'student_name' FROM public.ai_memory WHERE lead_id = leads.id) as student_name
FROM public.leads
WHERE parent_name IS NOT NULL
  OR EXISTS (
    SELECT 1 FROM public.ai_memory 
    WHERE lead_id = leads.id 
    AND profile->>'student_name' IS NOT NULL
  )
ORDER BY created_at DESC
LIMIT 10;
```

---

### Step 7: Optional - Implement Batch Save Messages

**Why:** 50% faster message saving.

**Current Flow:**
```
Extract_AI_Response1 
  → Save_User_Message1 
  → Save_AI_Message1 
  → Verify_Messages_Saved1
```

**New Flow:**
```
Extract_AI_Response1 
  → Batch_Save_Messages 
  → Verify_Messages_Saved1
```

**Implementation:**

1. **Add new node after `Extract_AI_Response1`:**
   - Type: HTTP Request
   - Name: `Batch_Save_Messages`
   - Method: POST
   - URL: `https://fcsdmvxtootizmndmrli.supabase.co/rest/v1/rpc/batch_save_messages`
   - Authentication: Supabase API
   - Body:
   ```json
   {
     "p_lead_id": "={{ $json.lead_id }}",
     "p_user_message": "={{ $json.user_message }}",
     "p_ai_message": "={{ $json.ai_response }}",
     "p_user_role": "={{ $json.user_role }}",
     "p_language": "={{ $json.user_language }}",
     "p_session_id": "={{ $json.session_id }}"
   }
   ```

2. **Update connections:**
   - Remove: `Save_User_Message1` and `Save_AI_Message1` nodes
   - Connect: `Extract_AI_Response1` → `Batch_Save_Messages` → `Verify_Messages_Saved1`

3. **Update `Verify_Messages_Saved1` node:**
   ```javascript
   const batchResult = $input.first().json;
   
   if (batchResult.success) {
     return {
       json: {
         success: true,
         user_message_id: batchResult.user_message_id,
         ai_message_id: batchResult.ai_message_id,
         session_id: batchResult.session_id,
         // ... rest of fields
       }
     };
   } else {
     // Handle error
   }
   ```

**Benefits:**
- 50% faster (1 DB call instead of 2)
- Atomic transaction
- Reduced latency

---

### Step 8: Update AI Prompt with Database Links

**Why:** No need to update workflow when assessment links change.

**Current:** Hardcoded links in AI Agent prompt

**New:** Fetch from database

**Implementation:**

1. **Add node before AI Agent:**
   - Type: HTTP Request
   - Name: `Fetch_Assessment_Info`
   - Method: POST
   - URL: `https://fcsdmvxtootizmndmrli.supabase.co/rest/v1/rpc/get_assessment_info_for_ai`
   - Authentication: Supabase API

2. **Update AI Agent prompt:**

   Replace:
   ```
   PAID ASSESSMENTS (₹99 each):
   - iLMH Assessment
   - Test Anxiety Assessment
   - iTMPA Assessment
   - iPMA Assessment
   ```

   With:
   ```
   PAID ASSESSMENTS (₹99 each):
   {{ $('Fetch_Assessment_Info').first().json }}
   ```

**Benefits:**
- Update links in database, no workflow changes needed
- Centralized management
- Easy to add/remove assessments

---

## 📊 MONITORING SETUP

### Daily Checks

Run these queries daily:

```sql
-- 1. Today's summary
SELECT * FROM public.get_dashboard_summary();

-- 2. Any errors?
SELECT * FROM public.ai_audit_logs
WHERE success = false
  AND created_at >= CURRENT_DATE
ORDER BY created_at DESC;

-- 3. Pending payments
SELECT COUNT(*) as pending_count
FROM public.payments
WHERE status = 'pending'
  AND created_at >= CURRENT_DATE - INTERVAL '7 days';

-- 4. Stressed/angry leads
SELECT COUNT(*) as needs_attention
FROM public.leads
WHERE current_sentiment IN ('angry', 'stressed')
  AND sentiment_confidence > 60
  AND last_contact_at >= CURRENT_DATE - INTERVAL '1 day';
```

### Weekly Review

```sql
-- 1. Conversion rate trend
SELECT * FROM public.v_conversion_analytics
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY date DESC;

-- 2. Response time performance
SELECT 
  ROUND(AVG(avg_response_seconds)::numeric, 2) as avg_response_time,
  MAX(avg_response_seconds) as worst_day
FROM public.v_response_time_analytics
WHERE date >= CURRENT_DATE - INTERVAL '7 days';

-- 3. Top questions
SELECT category, COUNT(*) as count
FROM public.v_common_questions
GROUP BY category
ORDER BY count DESC;

-- 4. Marketing performance
SELECT * FROM public.v_lead_source_performance
ORDER BY conversion_rate DESC
LIMIT 10;
```

---

## 🚨 ALERTS TO SET UP

### Critical Alerts

1. **Payment Generation Failures**
   - Monitor: Admin notifications with type = 'urgent'
   - Threshold: > 3 per hour
   - Action: Check Razorpay API status

2. **High Response Time**
   - Monitor: `v_response_time_analytics.avg_response_seconds`
   - Threshold: > 10 seconds
   - Action: Check OpenAI API status

3. **Low Conversion Rate**
   - Monitor: `v_conversion_analytics.message_to_payment_conversion_rate`
   - Threshold: < 10%
   - Action: Review AI responses, check pricing

4. **Rate Limit Hits**
   - Monitor: n8n logs for "rate_limit_exceeded"
   - Threshold: > 10 per day
   - Action: Investigate potential spam/attack

---

## 🔍 TROUBLESHOOTING

### Issue: Webhook signature verification fails

**Symptoms:**
- Error: "Invalid webhook signature"
- Webhooks not processing

**Solution:**
1. Verify `RAZORPAY_WEBHOOK_SECRET` is set correctly
2. Check Razorpay Dashboard → Webhooks for correct secret
3. Restart n8n after setting environment variable
4. Test with Razorpay's "Send Test Webhook" feature

### Issue: Payment links not generating

**Symptoms:**
- User receives error message
- Admin gets notification

**Solution:**
1. Check Razorpay API credentials in `Generate_Razorpay_Link` node
2. Verify Razorpay account is active
3. Check Razorpay API logs for errors
4. Test API credentials with curl:
   ```bash
   curl -u key_id:key_secret https://api.razorpay.com/v1/payment_links
   ```

### Issue: Rate limiting too aggressive

**Symptoms:**
- Legitimate users getting blocked
- Complaints about "too quickly" message

**Solution:**
1. Increase limit in `ignore_check1` node:
   ```javascript
   const maxMessages = 15; // Increase from 10
   ```
2. Or increase window:
   ```javascript
   const windowMs = 120000; // 2 minutes instead of 1
   ```

### Issue: Analytics views empty

**Symptoms:**
- Queries return no data
- Dashboard shows zeros

**Solution:**
1. Check if you have activity in base tables:
   ```sql
   SELECT COUNT(*) FROM public.leads;
   SELECT COUNT(*) FROM public.messages;
   SELECT COUNT(*) FROM public.payments;
   ```
2. If counts are > 0 but views empty, check date filters
3. Views only show last 30-90 days - adjust if needed

---

## 📝 MAINTENANCE

### Monthly Tasks

1. **Review Analytics:**
   - Run weekly review queries
   - Identify trends
   - Adjust AI responses based on common questions

2. **Update Assessment Links:**
   ```sql
   -- If Google Form link changes
   UPDATE public.assessment_links
   SET google_form_link = 'new_link_here',
       updated_at = NOW()
   WHERE assessment_type = 'iLMH';
   ```

3. **Clean Old Data:**
   ```sql
   -- Archive messages older than 6 months
   -- (Only if storage is an issue)
   ```

4. **Review Error Logs:**
   ```sql
   SELECT 
     operation_type,
     COUNT(*) as error_count,
     array_agg(DISTINCT error_message) as errors
   FROM public.ai_audit_logs
   WHERE success = false
     AND created_at >= CURRENT_DATE - INTERVAL '30 days'
   GROUP BY operation_type;
   ```

---

## ✅ VERIFICATION CHECKLIST

After completing all steps, verify:

- [ ] Razorpay webhook secret configured
- [ ] Razorpay API credentials added
- [ ] Payment error handling tested
- [ ] Rate limiting tested (11 messages)
- [ ] Webhook signature verification working
- [ ] Analytics views returning data
- [ ] Parent name extraction working
- [ ] Dashboard summary query working
- [ ] No errors in n8n workflow
- [ ] No errors in Supabase logs
- [ ] Monitoring queries bookmarked
- [ ] Team trained on new features

---

## 🎯 SUCCESS METRICS

Track these KPIs weekly:

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Conversion Rate | > 15% | ___ % | ___ |
| Avg Response Time | < 5s | ___ s | ___ |
| Payment Success Rate | > 80% | ___ % | ___ |
| Engagement Rate | > 60% | ___ % | ___ |
| Error Rate | < 1% | ___ % | ___ |

---

## 📞 SUPPORT

For issues:
1. Check this guide first
2. Review `WORKFLOW_IMPROVEMENTS_SUMMARY.md`
3. Run queries in `ANALYTICS_QUERIES.sql`
4. Check n8n workflow logs
5. Check Supabase logs

---

**Last Updated:** December 29, 2025
**Version:** 2.0
**Status:** Ready for Production

