# Razorpay Payment Integration - Implementation Guide

## Overview
This workflow has been enhanced with Razorpay payment link generation capability. When the AI agent determines a user wants to make a payment, it can automatically generate and send a payment link via WhatsApp.

## What's Changed

### 1. AI Agent Prompt Update
The AI Agent (node: `AI Agent1`) now includes payment link generation instructions:

```
11. PAYMENT LINK GENERATION:
• When user confirms enrollment/wants to pay fees, respond naturally FIRST
• Then APPEND on NEW LINE: "GENERATE_PAYMENT_LINK|amount=5000|description=Enrollment Fee"
• amount: fee in INR (default 5000 for enrollment)
• description: brief fee description
• Example: "Great! Let me generate a payment link for you.\nGENERATE_PAYMENT_LINK|amount=5000|description=Enrollment Fee Class 10"
• ONLY use this when user explicitly wants to pay or enroll
```

### 2. New Nodes Added

#### Payment Detection & Control Flow
1. **Detect_Payment_Request** (Code Node)
   - Detects `GENERATE_PAYMENT_LINK` command in AI response
   - Parses amount and description
   - Cleans the response for user display
   - Position: `[-1200, 560]`

2. **IF_Should_Generate_Payment** (IF Node)
   - Checks if payment generation is needed
   - Routes to payment flow or normal message flow
   - Position: `[-1000, 560]`

#### Payment Link Management
3. **Check_Existing_Payment** (HTTP Request - Supabase)
   - Queries for existing pending payment links
   - Prevents duplicate link generation
   - Position: `[-800, 480]`

4. **Has_Existing_Payment** (IF Node)
   - Checks if pending payment link exists
   - Routes to reuse or create new link
   - Position: `[-600, 480]`

#### Razorpay Integration
5. **Create_Razorpay_Order** (HTTP Request)
   - Creates Razorpay order
   - **Requires**: Razorpay API credentials (Basic Auth)
   - Endpoint: `POST https://api.razorpay.com/v1/orders`
   - Position: `[-400, 400]`

6. **Generate_Payment_Link** (HTTP Request)
   - Generates payment link from Razorpay
   - Includes WhatsApp notification
   - Endpoint: `POST https://api.razorpay.com/v1/payment_links`
   - Position: `[-200, 400]`

#### Database & Messaging
7. **Store_Payment_Record** (HTTP Request - Supabase)
   - Stores payment link in database
   - Table: `payment_links`
   - Position: `[0, 400]`

8. **Format_Payment_Message** (Code Node)
   - Formats WhatsApp message with payment link
   - Includes amount, description, validity info
   - Position: `[200, 400]`

9. **Send_Payment_Link** (WhatsApp Node)
   - Sends formatted payment link to user
   - Position: `[400, 400]`

#### Error Handling
10. **Handle_Payment_Error** (Code Node)
    - Handles payment generation failures
    - Creates user-friendly error message
    - Position: `[200, 560]`

11. **Send_Error_Message** (WhatsApp Node)
    - Sends error notification to user
    - Position: `[400, 560]`

#### Link Reuse
12. **Reuse_Existing_Link** (Code Node)
    - Formats message with existing payment link
    - Avoids duplicate charges
    - Position: `[-400, 560]`

## Flow Diagram

```
Extract_AI_Response1
         ↓
Log_AI_Operation1
         ↓
Detect_Payment_Request
         ↓
IF_Should_Generate_Payment
         ↓                    ↓
    (YES - Payment)      (NO - Normal)
         ↓                    ↓
Check_Existing_Payment   Save_User_Message1
         ↓                    ↓
Has_Existing_Payment     (continues to normal flow)
    ↓              ↓
(YES - Exists) (NO - Create New)
    ↓              ↓
Reuse_Existing  Create_Razorpay_Order
    ↓              ↓
    ↓         Generate_Payment_Link
    ↓              ↓
    ↓         Store_Payment_Record
    ↓              ↓
    ↓         Format_Payment_Message
    ↓              ↓
    └──────→ Send_Payment_Link
```

## Configuration Required

### 1. Razorpay API Credentials
You need to add Razorpay credentials to n8n:

1. Go to n8n Credentials
2. Add new credential: **HTTP Basic Auth**
3. Name it: `Razorpay API`
4. Username: Your Razorpay Key ID (e.g., `rzp_test_xxxxx`)
5. Password: Your Razorpay Key Secret

### 2. Supabase Database Table
Create a `payment_links` table in Supabase:

```sql
CREATE TABLE payment_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES leads(id),
  razorpay_payment_link_id TEXT NOT NULL,
  razorpay_order_id TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'INR',
  description TEXT,
  short_url TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payment_links_lead_id ON payment_links(lead_id);
CREATE INDEX idx_payment_links_status ON payment_links(status);
CREATE INDEX idx_payment_links_razorpay_id ON payment_links(razorpay_payment_link_id);
```

### 3. Update Webhook Callbacks (Optional)
If you want to handle payment status updates, set up a webhook endpoint for Razorpay:
- Callback URL: `https://your-n8n-instance.com/webhook/razorpay-callback`

## How It Works

### User Journey
1. User: "I want to enroll my son in Class 10"
2. AI: "Great! Let me generate a payment link for you."
3. System detects `GENERATE_PAYMENT_LINK|amount=5000|description=Enrollment Fee Class 10`
4. Checks for existing pending links
5. If none exists:
   - Creates Razorpay order
   - Generates payment link
   - Stores in database
   - Sends to user via WhatsApp
6. If pending link exists:
   - Resends existing link
   - Prevents duplicate charges

### Payment Link Message Format
```
Great! Let me generate a payment link for you.

💳 Payment Link: https://rzp.io/i/xxxxx

Amount: ₹5000
Description: Enrollment Fee Class 10

Please complete the payment using the link above. The link is valid for 24 hours.
```

## Testing

### Test Flow
1. Send message: "I want to pay the enrollment fee"
2. AI should respond with payment instruction
3. System generates payment link
4. Link sent via WhatsApp
5. Check Supabase `payment_links` table for record

### Test Scenarios
- ✅ New payment request → Creates new link
- ✅ Duplicate request → Reuses existing pending link
- ✅ Different amounts → Creates new links
- ✅ Payment link generation failure → Sends error message

## Important Notes

### Security
- **API Keys**: Never commit Razorpay keys to version control
- **Webhook Verification**: Verify Razorpay webhook signatures
- **Amount Validation**: Always validate payment amounts server-side

### Production Checklist
- [ ] Replace test Razorpay keys with live keys
- [ ] Update callback URLs to production domain
- [ ] Set up payment status webhook handler
- [ ] Test payment flow end-to-end
- [ ] Configure payment link expiry (default: 24 hours)
- [ ] Set up monitoring for failed payment link generation
- [ ] Update support phone number in error messages

### Limitations
- Payment links valid for 24 hours (configurable in Razorpay)
- Razorpay charges 2% + GST per transaction
- WhatsApp Business API costs apply
- Requires active Razorpay account

## Troubleshooting

### Payment Link Not Generated
1. Check Razorpay API credentials
2. Verify Supabase connection
3. Check node execution logs
4. Ensure `payment_links` table exists

### Duplicate Links Created
1. Check `Check_Existing_Payment` query
2. Verify lead_id is correctly passed
3. Check status field values

### WhatsApp Message Not Sent
1. Verify WhatsApp credentials
2. Check phone number format (+91...)
3. Verify WhatsApp Business API quota

## Support
For issues or questions:
- Razorpay Docs: https://razorpay.com/docs/api/
- n8n Community: https://community.n8n.io/
- Supabase Docs: https://supabase.com/docs

## Version History
- v1.0 (2025-12-29): Initial Razorpay integration
  - Payment link generation
  - Duplicate prevention
  - Error handling
  - WhatsApp delivery
