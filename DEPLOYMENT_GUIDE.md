# Razorpay Payment Integration - Deployment Guide

## 📋 Table of Contents
1. [Prerequisites](#prerequisites)
2. [Database Setup](#database-setup)
3. [Razorpay Configuration](#razorpay-configuration)
4. [n8n Workflow Setup](#n8n-workflow-setup)
5. [Webhook Configuration](#webhook-configuration)
6. [Testing](#testing)
7. [Go Live Checklist](#go-live-checklist)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Accounts & Access
- ✅ Razorpay account (sign up at https://razorpay.com)
- ✅ Access to Supabase database
- ✅ n8n instance with proper permissions
- ✅ WhatsApp Business API credentials (already configured)

### Required Information
- Razorpay API Key ID (Test + Live)
- Razorpay API Key Secret (Test + Live)
- n8n webhook base URL
- Supabase project URL and service role key

---

## Database Setup

### Step 1: Run Migration

```bash
# Connect to your Supabase project
cd supabase/migrations

# Apply the migration
psql YOUR_DATABASE_URL -f 20250101000000_add_payment_tracking.sql
```

**Or via Supabase Dashboard:**
1. Go to SQL Editor
2. Copy entire contents of `20250101000000_add_payment_tracking.sql`
3. Execute the query
4. Verify no errors

### Step 2: Verify Tables

Run this query to verify:

```sql
SELECT * FROM assessment_links;
SELECT column_name FROM information_schema.columns WHERE table_name = 'payments';
SELECT column_name FROM information_schema.columns WHERE table_name = 'sessions';
```

Expected output:
- `assessment_links` should have 4 rows (iLMH, test_anxiety, iTMPA, iPMA)
- `payments` should have new columns: `assessment_type`, `razorpay_order_id`, `payment_link`, etc.
- `sessions` should have new columns: `follow_up_sent`, `last_follow_up_at`, `last_message_at`

---

## Razorpay Configuration

### Step 1: Get API Keys

**For Testing:**
1. Login to Razorpay Dashboard
2. Go to Settings → API Keys
3. Download **Test** API Keys
4. Save:
   - Key ID (starts with `rzp_test_`)
   - Key Secret

**For Production:**
1. Complete KYC verification
2. Go to Settings → API Keys
3. Download **Live** API Keys
4. Save:
   - Key ID (starts with `rzp_live_`)
   - Key Secret

### Step 2: Configure Razorpay Settings

1. **Payment Methods**: Enable UPI, Cards, Net Banking, Wallets
2. **Auto-capture**: Enable (payments captured automatically)
3. **Settlement**: Configure bank account for settlements
4. **Checkout Settings**:
   - Brand name: "Subbu Innovative Classes"
   - Brand logo: Upload your logo
   - Theme color: Match your brand

### Step 3: Enable Webhooks in Razorpay

1. Go to Settings → Webhooks
2. Click "Add New Webhook"
3. Configure:
   - **Webhook URL**: `https://your-n8n-instance.com/webhook/razorpay-webhook`
   - **Active Events**:
     - ✅ `payment.captured`
     - ✅ `payment.failed`
     - ✅ `order.paid`
   - **Secret**: Auto-generated (copy this for later)
4. Save webhook

---

## n8n Workflow Setup

### Step 1: Configure Razorpay Credentials in n8n

1. Open n8n
2. Go to Credentials → Add Credential
3. Select "HTTP Basic Auth"
4. Configure:
   - **Name**: "Razorpay API - Test" (or "Razorpay API - Live")
   - **Username**: `rzp_test_XXXXX` (your Razorpay Key ID)
   - **Password**: Your Razorpay Key Secret
5. Save credential

### Step 2: Import Workflows

**Import these 3 workflow JSON files:**

1. **Main Workflow** (Modified version)
   - File: Your existing `workflow.json` + modifications from `MAIN_WORKFLOW_MODIFICATIONS.md`
   - Name: "WhatsApp AI Agent - Main"
   - Status: Active

2. **Razorpay Webhook Handler**
   - File: `n8n-workflows/razorpay-webhook-handler.json`
   - Name: "Razorpay Payment Webhook Handler"
   - Status: Active
   - **Important**: Copy the webhook URL after activation!

3. **Follow-up Scheduler**
   - File: `n8n-workflows/automated-followup-scheduler.json`
   - Name: "Automated Follow-up Scheduler"
   - Status: Active
   - Schedule: Every 1 hour

### Step 3: Update Workflow Variables

**In Main Workflow:**
- Update Razorpay credentials ID in nodes:
  - `Create_Razorpay_Order`
  - `Generate_Payment_Link`
- Update `callback_url` in `Generate_Payment_Link` node to your webhook URL

**In Webhook Handler:**
- Verify Supabase credentials
- Verify WhatsApp credentials

**In Follow-up Scheduler:**
- Verify schedule timing (default: hourly)
- Verify Supabase credentials
- Verify WhatsApp credentials

### Step 4: Activate All Workflows

1. Main workflow: ✅ Active
2. Webhook handler: ✅ Active
3. Follow-up scheduler: ✅ Active

---

## Webhook Configuration

### n8n Webhook URL

After activating the "Razorpay Payment Webhook Handler" workflow:

1. Open the workflow
2. Click on "Razorpay Webhook" node
3. Copy the "Test URL" or "Production URL"
4. Format: `https://your-n8n-instance.com/webhook/razorpay-webhook`

### Configure in Razorpay Dashboard

1. Go to Settings → Webhooks
2. Edit or create webhook
3. Set URL to: `https://your-n8n-instance.com/webhook/razorpay-webhook`
4. Enable events:
   - `payment.captured`
   - `payment.failed`
   - `order.paid`
5. Copy webhook secret
6. Save

### Verify Webhook

Test webhook:
```bash
curl -X POST https://your-n8n-instance.com/webhook/razorpay-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event": "payment.captured",
    "payload": {
      "payment": {
        "id": "pay_test123",
        "order_id": "order_test123",
        "status": "captured"
      }
    }
  }'
```

Expected response:
```json
{
  "success": true,
  "message": "Webhook processed successfully"
}
```

---

## Testing

### Test Checklist

#### 1. Database Tests
```sql
-- Test: Get assessment links
SELECT * FROM get_assessment_link('iLMH');

-- Test: Create payment record
SELECT * FROM create_payment_record(
  'LEAD_ID_HERE'::uuid,
  'iLMH',
  'test_order_123',
  'https://test-link.com',
  9900
);

-- Test: Get pending payments
SELECT * FROM get_payments_needing_followup();

-- Test: Get inactive sessions
SELECT * FROM get_inactive_sessions_needing_followup();
```

#### 2. Payment Flow Test (Test Mode)

1. **Trigger Assessment Request**:
   - Send WhatsApp message: "I want to take the iLMH assessment"
   - AI should respond with payment confirmation
   - Reply: "Yes, send payment link"

2. **Verify Payment Link Generation**:
   - Check if payment link is sent via WhatsApp
   - Link should be short (e.g., `https://rzp.io/l/xxxxx`)
   - Link should be valid and clickable

3. **Make Test Payment**:
   - Click payment link
   - Use Razorpay test card: `4111 1111 1111 1111`
   - Expiry: Any future date
   - CVV: Any 3 digits
   - Complete payment

4. **Verify Post-Payment**:
   - Within 30 seconds, check WhatsApp
   - Should receive: "Payment received! Here's your assessment link: [Google Form URL]"
   - Check database: `SELECT * FROM payments WHERE status='paid' ORDER BY created_at DESC LIMIT 1;`
   - Lead status should be 'HOT': `SELECT status FROM leads WHERE id='LEAD_ID';`

#### 3. Follow-up Test

**Test Payment Follow-ups**:

1. Create a test payment (don't complete it)
2. Manually update created_at to 4 hours ago:
   ```sql
   UPDATE payments
   SET created_at = NOW() - INTERVAL '4 hours'
   WHERE id = 'PAYMENT_ID';
   ```
3. Wait for next scheduler run (or trigger manually)
4. Verify first follow-up message sent
5. Update created_at to 25 hours ago
6. Verify second follow-up message sent

**Test Session Follow-ups**:

1. Start a conversation, then stop replying
2. Update session:
   ```sql
   UPDATE sessions
   SET last_message_at = NOW() - INTERVAL '25 hours'
   WHERE session_id = 'SESSION_ID';
   ```
3. Wait for scheduler run
4. Verify inactive session follow-up sent

#### 4. Error Handling Tests

1. **Razorpay API Failure**:
   - Use invalid API key temporarily
   - Trigger payment request
   - Verify error message sent to user

2. **Duplicate Payment Prevention**:
   - Request payment for same assessment twice
   - Verify same link is sent (not a new one)

3. **Webhook Validation**:
   - Send invalid webhook payload
   - Verify error response

---

## Go Live Checklist

### Pre-Launch

- [ ] All test scenarios passed
- [ ] Database migration applied to production
- [ ] Razorpay KYC verification completed
- [ ] Live API keys obtained
- [ ] Webhook configured with live URL
- [ ] n8n workflows updated with live credentials
- [ ] Assessment Google Form links verified
- [ ] WhatsApp number verified
- [ ] Error notifications configured

### Launch Day

- [ ] Switch Razorpay credentials from Test to Live
- [ ] Update webhook URL in Razorpay dashboard
- [ ] Activate all workflows
- [ ] Send test message to verify end-to-end flow
- [ ] Monitor n8n execution logs
- [ ] Monitor Razorpay dashboard
- [ ] Set up alerts for failed payments

### Post-Launch Monitoring (First 24 Hours)

- [ ] Monitor payment success rate
- [ ] Check webhook delivery success rate
- [ ] Verify assessment links sent correctly
- [ ] Verify follow-ups triggered at right time
- [ ] Check for any error logs
- [ ] Verify database records correct

---

## Troubleshooting

### Common Issues

#### Issue 1: Payment Link Not Generated

**Symptoms**: AI responds but no payment link sent

**Diagnosis**:
```sql
-- Check if payment record created
SELECT * FROM payments WHERE lead_id='LEAD_ID' ORDER BY created_at DESC LIMIT 1;

-- Check n8n execution logs
-- Look for "Create_Razorpay_Order" node failure
```

**Solutions**:
1. Verify Razorpay credentials in n8n
2. Check Razorpay API key permissions
3. Verify lead_id exists in database
4. Check n8n error logs for API response

#### Issue 2: Webhook Not Triggered

**Symptoms**: Payment completed but no assessment link sent

**Diagnosis**:
```bash
# Check webhook logs in Razorpay dashboard
# Settings → Webhooks → View Logs

# Check n8n webhook execution history
```

**Solutions**:
1. Verify webhook URL configured correctly in Razorpay
2. Check n8n webhook URL is accessible publicly
3. Verify webhook events enabled (payment.captured, order.paid)
4. Test webhook manually with curl command
5. Check if firewall blocking Razorpay IPs

#### Issue 3: Follow-ups Not Sent

**Symptoms**: No follow-up messages after expected time

**Diagnosis**:
```sql
-- Check if there are pending payments needing follow-up
SELECT * FROM get_payments_needing_followup();

-- Check if follow-up already marked as sent
SELECT follow_up_count, last_follow_up_at FROM payments WHERE id='PAYMENT_ID';
```

**Solutions**:
1. Verify follow-up scheduler workflow is active
2. Check scheduler trigger settings (should run hourly)
3. Verify Supabase RPC function permissions
4. Check if follow_up_count already at maximum (2)
5. Check WhatsApp API rate limits

#### Issue 4: Duplicate Payment Links

**Symptoms**: Same user gets multiple payment links for same assessment

**Diagnosis**:
```sql
-- Check for multiple pending payments
SELECT * FROM payments
WHERE lead_id='LEAD_ID' AND assessment_type='iLMH' AND status='pending'
ORDER BY created_at DESC;
```

**Solutions**:
1. Verify "Check_Existing_Payment" node working correctly
2. Check if payment expiry logic working
3. Add unique constraint if missing:
   ```sql
   CREATE UNIQUE INDEX idx_unique_pending_payment
   ON payments(lead_id, assessment_type)
   WHERE status = 'pending';
   ```

#### Issue 5: Assessment Link Not Sent After Payment

**Symptoms**: Payment successful but Google Form link not sent

**Diagnosis**:
```sql
-- Check payment status and webhook processing
SELECT
  id, status, razorpay_payment_id,
  assessment_link_sent, assessment_link_sent_at
FROM payments
WHERE razorpay_order_id='ORDER_ID';
```

**Solutions**:
1. Verify webhook handler workflow is active
2. Check if assessment_links table populated correctly
3. Verify WhatsApp API credentials
4. Check n8n execution logs for webhook handler
5. Manually trigger assessment link send:
   ```sql
   -- Get payment details
   SELECT p.*, al.google_form_link, l.phone, l.parent_name
   FROM payments p
   JOIN assessment_links al ON p.assessment_type = al.assessment_type
   JOIN leads l ON p.lead_id = l.id
   WHERE p.id = 'PAYMENT_ID';

   -- Then send via WhatsApp manually if needed
   ```

### Emergency Rollback

If critical issues occur:

1. **Disable new payment generation**:
   - Deactivate main workflow's payment branch
   - AI will respond normally without payment links

2. **Stop follow-ups**:
   - Deactivate follow-up scheduler workflow

3. **Disable webhook**:
   - Deactivate webhook handler workflow
   - Disable webhook in Razorpay dashboard

4. **Manual processing**:
   - Check pending payments: `SELECT * FROM payments WHERE status='pending';`
   - Process manually if needed

### Support Contacts

- **Razorpay Support**: support@razorpay.com
- **n8n Community**: https://community.n8n.io
- **Supabase Support**: https://supabase.com/support

---

## Monitoring & Analytics

### Key Metrics to Track

1. **Payment Metrics**:
   ```sql
   -- Payment success rate
   SELECT
     COUNT(*) FILTER (WHERE status = 'paid') * 100.0 / COUNT(*) as success_rate,
     COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
     COUNT(*) FILTER (WHERE status = 'pending') as pending_count
   FROM payments
   WHERE created_at > NOW() - INTERVAL '7 days';

   -- Average payment time
   SELECT AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) / 60 as avg_minutes
   FROM payments
   WHERE status = 'paid' AND created_at > NOW() - INTERVAL '7 days';
   ```

2. **Follow-up Effectiveness**:
   ```sql
   -- Follow-up to payment conversion
   SELECT
     follow_up_count,
     COUNT(*) FILTER (WHERE status = 'paid') as paid_count,
     COUNT(*) FILTER (WHERE status = 'pending') as still_pending
   FROM payments
   WHERE follow_up_count > 0
   GROUP BY follow_up_count;
   ```

3. **Assessment Popularity**:
   ```sql
   -- Most requested assessments
   SELECT
     assessment_type,
     COUNT(*) as total_requests,
     COUNT(*) FILTER (WHERE status = 'paid') as completed_payments
   FROM payments
   GROUP BY assessment_type
   ORDER BY total_requests DESC;
   ```

### Daily Health Check

Run this query every morning:

```sql
-- Daily Payment Health Check
SELECT
  'Total Payments Today' as metric,
  COUNT(*)::text as value
FROM payments WHERE created_at::date = CURRENT_DATE

UNION ALL

SELECT
  'Successful Payments',
  COUNT(*)::text
FROM payments WHERE created_at::date = CURRENT_DATE AND status = 'paid'

UNION ALL

SELECT
  'Failed Payments',
  COUNT(*)::text
FROM payments WHERE created_at::date = CURRENT_DATE AND status = 'failed'

UNION ALL

SELECT
  'Pending > 24hrs',
  COUNT(*)::text
FROM payments
WHERE status = 'pending'
  AND created_at < NOW() - INTERVAL '24 hours'

UNION ALL

SELECT
  'Follow-ups Sent Today',
  COUNT(*)::text
FROM payments
WHERE last_follow_up_at::date = CURRENT_DATE;
```

---

## Appendix

### Assessment Details

| Assessment Type | Price | Google Form Link | Purpose |
|----------------|-------|------------------|---------|
| iLMH | ₹99 | [Form Link](https://docs.google.com/forms/d/e/1FAIpQLScO7koC_vkswF0y6kh7bC535-oPFetDJeNUBUpomN78Uv17TA/viewform) | Integrated Learning & Mental Health |
| Test Anxiety | ₹99 | [Form Link](https://docs.google.com/forms/d/e/1FAIpQLSe3CtxGvT0xL-zXEXmLIzHYf728gNJliMJClv7McAeLOhg4GA/viewform) | Test Anxiety Evaluation |
| iTMPA | ₹99 | [Form Link](https://docs.google.com/forms/d/e/1FAIpQLSfczWS8B3OBig8OWXQHtIOZr2jKpzzseCY-fwy9Ez7K0Ds8-g/viewform) | Test & Mental Performance |
| iPMA | ₹99 | [Form Link](https://docs.google.com/forms/d/e/1FAIpQLSdBUzs6Z1PBRr4DPoeN1b0Prp70cZyu3-enKnFdo9KYYUGsuA/viewform) | Performance & Mindset |

### Razorpay Test Cards

| Card Number | Type | Behavior |
|------------|------|----------|
| 4111 1111 1111 1111 | Visa | Success |
| 5555 5555 5555 4444 | Mastercard | Success |
| 4111 1111 1111 1234 | Visa | Failure |

### Environment Variables

Store these securely:

```env
# Razorpay
RAZORPAY_KEY_ID_TEST=rzp_test_XXXXX
RAZORPAY_KEY_SECRET_TEST=XXXXX
RAZORPAY_KEY_ID_LIVE=rzp_live_XXXXX
RAZORPAY_KEY_SECRET_LIVE=XXXXX

# n8n
N8N_WEBHOOK_BASE_URL=https://your-n8n-instance.com

# Supabase
SUPABASE_URL=https://fcsdmvxtootizmndmrli.supabase.co
SUPABASE_SERVICE_ROLE_KEY=XXXXX

# WhatsApp
WHATSAPP_PHONE_NUMBER_ID=879646611896807
WHATSAPP_ACCESS_TOKEN=XXXXX
```

---

## Success Criteria

✅ **Deployment is successful when:**

1. User can request assessment payment
2. Payment link generated and sent via WhatsApp within 5 seconds
3. Payment can be completed successfully
4. Assessment Google Form link sent within 30 seconds of payment
5. Follow-up messages sent at 3 hours and 24 hours for pending payments
6. Inactive session follow-ups sent after 24 hours
7. Lead status updated to HOT after payment
8. No duplicate payment links generated
9. All errors handled gracefully with user-friendly messages
10. Database records accurate and complete

---

## Next Steps After Deployment

1. **Monitor for 48 hours** - Check logs, payments, follow-ups
2. **Gather user feedback** - Are messages clear? Any confusion?
3. **Optimize timing** - Adjust follow-up intervals if needed
4. **Add analytics** - Build dashboard for payment metrics
5. **Scale up** - Add more assessment types if needed
6. **Iterate** - Improve based on real-world usage

---

**Last Updated**: 2025-01-01
**Version**: 1.0
**Author**: Claude (Anthropic)
