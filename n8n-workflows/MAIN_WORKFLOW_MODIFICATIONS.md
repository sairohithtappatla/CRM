# Main Workflow Modifications for Razorpay Payment Integration

## Overview
This guide explains how to modify your existing main WhatsApp AI workflow to add Razorpay payment link generation for assessments.

## Prerequisites
1. Razorpay account with API keys
2. Run the database migration: `20250101000000_add_payment_tracking.sql`
3. Razorpay credentials configured in n8n

---

## Step 1: Update AI Agent Prompt

**Location**: Find the node named "AI Agent1" (around line 486-498 in your workflow.json)

**Current Prompt Section**: The prompt starts with "You are the AI Counselor for Subbu Innovative Classes..."

**NEW PROMPT** (Replace the entire prompt):

```
You are the AI Counselor for Subbu Innovative Classes - warm, empathetic education advisor. STAY IN EDUCATION SCOPE ONLY.

SERVICES:
1. Doorstep tuition (Maths, Physics, Chemistry, Biology, Classes 6-10)
2. Career guidance (JEE/NEET prep, Classes 7-12)
3. Teacher training & Parent workshops
4. AI-powered education tools
5. PAID ASSESSMENTS (₹99 each):
   - iLMH (Integrated Learning & Mental Health)
   - Test Anxiety Assessment
   - iTMPA (Test & Mental Performance)
   - iPMA (Performance & Mindset)

FREE RESOURCES & COURSES:
- JEE/NEET Mentorship: https://subbuninnovativeclasses.akamai.net.in/new-courses/4-jee-neet-mastery-system
- 10th Board Exam Mastery: https://subbuninnovativeclasses.akamai.net.in/new-courses/3-10th-board-exam-mastery-psychology-smart-study-strategy
- 1-1 Strategy Call: https://subbuninnovativeclasses.akamai.net.in/new-courses/2--personal-1-1-strategy-call-with-nbv-subbarao-sir
- Study Abroad Admissions: https://innovative.edumilestones.com/
- Indian College Admissions: https://innovative.edumilestones.com/login/global-admissions/
- INNOMIND.AI Classes: https://lp.innovativeclasses.com/webinar-registration

PROFILE: {{ $json.profile ? JSON.stringify($json.profile) : "New" }}
CONTEXT: {{ $json.context ? JSON.stringify($json.context) : "First chat" }}
SENTIMENT: {{ $json.detected_sentiment }} ({{ $json.sentiment_confidence }}%) | ROLE: {{ $json.detected_role }} | INTENT: {{ $json.detected_intent }}

HISTORY: {{ $json.history }}
MESSAGE: {{ $json.userMessage }}

RULES:

1. SCOPE: ONLY education/tutoring/JEE/NEET/career/assessments. If out-of-scope → "I specialize in education counseling. How can I help with your child's education?" NO medical/legal/weather/general advice.

2. LANGUAGE: {{ $json.language === "te" ? "Telugu+English mix" : $json.language === "hi" ? "Hindi+English mix" : "English" }}. Match user style.

3. EMOTION {{ $json.detected_sentiment }}:
{{ $json.detected_sentiment === "angry" ? "→ Soft, empathetic, apologetic. Listen first." : $json.detected_sentiment === "stressed" || $json.detected_sentiment === "anxious" ? "→ Calm, reassuring, supportive." : $json.detected_sentiment === "happy" ? "→ Warm, encouraging." : "→ Friendly, helpful." }}

4. {{ $json.detected_role === "parent" ? "Parent: Talk child's future, quality, trust" : $json.detected_role === "student" ? "Student: Goals, career success" : "Identify role" }}

5. {{ $json.history === "First conversation" ? "Greet: 'Hello! I'm from Subbu Classes. How may I help?'" : "Continue naturally. NO re-greeting." }}

6. GATHER (if missing): name, class, subjects, goals (JEE/NEET?), concerns. ONE question max.

7. STYLE:
   • 2-4 sentences MAX
   • Friendly, conversational
   • {{ $json.profile?.student_name ? "Use name: " + $json.profile.student_name : "" }}
   • Fees → "Let me connect you with counselor for pricing"
   • NEVER invent prices/dates/schedules
   • Max 1 emoji if appropriate

8. ASSESSMENT PAYMENT FLOW:
   **WHEN USER ASKS ABOUT ASSESSMENTS:**
   - Briefly explain (2-3 sentences): "The [Assessment Name] helps identify [benefit]. It costs ₹99. Would you like me to send you the payment link?"
   - If YES → Reply EXACTLY: "GENERATE_PAYMENT_LINK:[assessment_type]" where assessment_type is one of: iLMH, test_anxiety, iTMPA, iPMA
   - Example: "GENERATE_PAYMENT_LINK:iLMH"
   - DO NOT actually generate or send links yourself - the system will handle it

   **FOR FREE RESOURCES/COURSES:**
   - Just share the relevant link from the list above
   - Example: "Here's our JEE/NEET Mentorship course: [link]"

9. {{ $json.detected_sentiment === "angry" || $json.escalation_needed ? "USER STRESSED/ANGRY: Be extremely empathetic. If complaint → 'I understand your concern. Let me connect you with our team lead immediately.'" : "Normal: Be helpful" }}

10. Goodbye (bye/thanks) → "Thank you! Feel free to message anytime. Best wishes!"

11. VALIDATE: Is response education-related? Is tone appropriate? No hallucination?

REMEMBER: Professional. Build trust. Education ONLY. Quality over quantity. Use GENERATE_PAYMENT_LINK command when user confirms assessment interest.
```

---

## Step 2: Add Payment Detection Node

**Location**: After "Extract_AI_Response1" node (around position [-1344, 384])

**Add new node**: "Detect_Payment_Request"

```json
{
  "parameters": {
    "jsCode": "const aiResponse = $input.first().json.ai_response || '';\nconst leadId = $input.first().json.lead_id;\nconst leadPhone = $input.first().json.lead_phone;\n\n// Check if AI response contains payment generation command\nconst paymentPattern = /GENERATE_PAYMENT_LINK:(iLMH|test_anxiety|iTMPA|iPMA)/i;\nconst match = aiResponse.match(paymentPattern);\n\nif (match) {\n  const assessmentType = match[1];\n  \n  console.log('Payment link generation requested:', {\n    assessmentType,\n    leadId,\n    leadPhone\n  });\n  \n  return {\n    json: {\n      ...$input.first().json,\n      should_generate_payment: true,\n      assessment_type: assessmentType,\n      lead_id: leadId,\n      lead_phone: leadPhone,\n      // Clean the AI response - remove the command\n      ai_response: aiResponse.replace(paymentPattern, '').trim()\n    }\n  };\n} else {\n  return {\n    json: {\n      ...$input.first().json,\n      should_generate_payment: false\n    }\n  };\n}"
  },
  "type": "n8n-nodes-base.code",
  "typeVersion": 2,
  "position": [-1200, 384],
  "id": "detect-payment-request",
  "name": "Detect_Payment_Request"
}
```

**Connection**:
- Connect FROM "Extract_AI_Response1" → TO "Detect_Payment_Request"
- Connect FROM "Detect_Payment_Request" → TO "Save_User_Message1"

---

## Step 3: Add Payment Generation Branch

**Location**: After "Detect_Payment_Request" node

**Add IF Node**: "IF_Should_Generate_Payment"

```json
{
  "parameters": {
    "conditions": {
      "options": {
        "caseSensitive": true,
        "leftValue": "",
        "typeValidation": "strict",
        "version": 2
      },
      "conditions": [
        {
          "id": "payment-check",
          "leftValue": "={{ $json.should_generate_payment }}",
          "rightValue": true,
          "operator": {
            "type": "boolean",
            "operation": "equals"
          }
        }
      ],
      "combinator": "and"
    },
    "options": {}
  },
  "type": "n8n-nodes-base.if",
  "typeVersion": 2.2,
  "position": [-1000, 384],
  "id": "if-payment-needed",
  "name": "IF_Should_Generate_Payment"
}
```

**Connection**:
- Connect FROM "Detect_Payment_Request" → TO "IF_Should_Generate_Payment"
- Connect TRUE branch → TO new payment generation flow
- Connect FALSE branch → TO "Save_User_Message1" (existing flow)

---

## Step 4: Check for Existing Pending Payment

**Add node**: "Check_Existing_Payment"

```json
{
  "parameters": {
    "method": "POST",
    "url": "https://fcsdmvxtootizmndmrli.supabase.co/rest/v1/rpc/get_pending_payment_for_lead",
    "authentication": "predefinedCredentialType",
    "nodeCredentialType": "supabaseApi",
    "sendBody": true,
    "specifyBody": "json",
    "jsonBody": "={\n  \"p_lead_id\": \"{{ $json.lead_id }}\",\n  \"p_assessment_type\": \"{{ $json.assessment_type }}\"\n}",
    "options": {}
  },
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.2,
  "position": [-800, 200],
  "id": "check-existing-payment",
  "name": "Check_Existing_Payment",
  "credentials": {
    "supabaseApi": {
      "id": "U9FyFNZfHsDO0qib",
      "name": "Supabase account"
    }
  }
}
```

---

## Step 5: Decide - Reuse or Create New Payment

**Add IF Node**: "Has_Existing_Payment"

```json
{
  "parameters": {
    "conditions": {
      "options": {
        "caseSensitive": true,
        "leftValue": "",
        "typeValidation": "strict",
        "version": 2
      },
      "conditions": [
        {
          "id": "existing-payment-check",
          "leftValue": "={{ $json.length }}",
          "rightValue": 0,
          "operator": {
            "type": "number",
            "operation": "gt"
          }
        }
      ],
      "combinator": "and"
    },
    "options": {}
  },
  "type": "n8n-nodes-base.if",
  "typeVersion": 2.2,
  "position": [-600, 200],
  "id": "has-existing-payment",
  "name": "Has_Existing_Payment"
}
```

---

## Step 6: Create Razorpay Payment Link

**Add node**: "Create_Razorpay_Order"

**IMPORTANT**: You need to add your Razorpay API credentials to n8n first!

```json
{
  "parameters": {
    "method": "POST",
    "url": "https://api.razorpay.com/v1/orders",
    "authentication": "predefinedCredentialType",
    "nodeCredentialType": "httpBasicAuth",
    "sendBody": true,
    "specifyBody": "json",
    "jsonBody": "={{ {\n  \"amount\": 9900,\n  \"currency\": \"INR\",\n  \"notes\": {\n    \"lead_id\": $('Detect_Payment_Request').first().json.lead_id,\n    \"assessment_type\": $('Detect_Payment_Request').first().json.assessment_type,\n    \"parent_name\": $('Detect_Payment_Request').first().json.parent_name || \"Parent\",\n    \"phone\": $('Detect_Payment_Request').first().json.lead_phone\n  }\n} }}",
    "options": {}
  },
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.2,
  "position": [-400, 100],
  "id": "create-razorpay-order",
  "name": "Create_Razorpay_Order",
  "credentials": {
    "httpBasicAuth": {
      "id": "YOUR_RAZORPAY_CREDENTIALS_ID",
      "name": "Razorpay API"
    }
  }
}
```

---

## Step 7: Generate Payment Link

**Add node**: "Generate_Payment_Link"

```json
{
  "parameters": {
    "method": "POST",
    "url": "https://api.razorpay.com/v1/payment_links",
    "authentication": "predefinedCredentialType",
    "nodeCredentialType": "httpBasicAuth",
    "sendBody": true,
    "specifyBody": "json",
    "jsonBody": "={{ {\n  \"amount\": 9900,\n  \"currency\": \"INR\",\n  \"accept_partial\": false,\n  \"reference_id\": $json.id,\n  \"description\": \"Assessment Payment - \" + $('Detect_Payment_Request').first().json.assessment_type,\n  \"customer\": {\n    \"name\": $('Detect_Payment_Request').first().json.parent_name || \"Parent\",\n    \"contact\": $('Detect_Payment_Request').first().json.lead_phone\n  },\n  \"notify\": {\n    \"sms\": false,\n    \"email\": false\n  },\n  \"reminder_enable\": false,\n  \"notes\": {\n    \"lead_id\": $('Detect_Payment_Request').first().json.lead_id,\n    \"assessment_type\": $('Detect_Payment_Request').first().json.assessment_type\n  },\n  \"callback_url\": \"https://your-n8n-instance.com/webhook/razorpay-webhook\",\n  \"callback_method\": \"get\",\n  \"expire_by\": Math.floor(Date.now()/1000) + (48 * 3600)\n} }}",
    "options": {}
  },
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.2,
  "position": [-200, 100],
  "id": "generate-payment-link",
  "name": "Generate_Payment_Link",
  "credentials": {
    "httpBasicAuth": {
      "id": "YOUR_RAZORPAY_CREDENTIALS_ID",
      "name": "Razorpay API"
    }
  }
}
```

---

## Step 8: Store Payment in Database

**Add node**: "Store_Payment_Record"

```json
{
  "parameters": {
    "method": "POST",
    "url": "https://fcsdmvxtootizmndmrli.supabase.co/rest/v1/rpc/create_payment_record",
    "authentication": "predefinedCredentialType",
    "nodeCredentialType": "supabaseApi",
    "sendBody": true,
    "specifyBody": "json",
    "jsonBody": "={\n  \"p_lead_id\": \"{{ $('Detect_Payment_Request').first().json.lead_id }}\",\n  \"p_assessment_type\": \"{{ $('Detect_Payment_Request').first().json.assessment_type }}\",\n  \"p_razorpay_order_id\": \"{{ $('Create_Razorpay_Order').first().json.id }}\",\n  \"p_payment_link\": \"{{ $json.short_url }}\",\n  \"p_amount\": 9900,\n  \"p_expires_at\": \"{{ new Date(Date.now() + 48*3600*1000).toISOString() }}\"\n}",
    "options": {}
  },
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.2,
  "position": [0, 100],
  "id": "store-payment-record",
  "name": "Store_Payment_Record",
  "credentials": {
    "supabaseApi": {
      "id": "U9FyFNZfHsDO0qib",
      "name": "Supabase account"
    }
  }
}
```

---

## Step 9: Format Payment Message

**Add node**: "Format_Payment_Message"

```json
{
  "parameters": {
    "jsCode": "const paymentData = $input.first().json;\nconst assessmentType = $('Detect_Payment_Request').first().json.assessment_type;\nconst parentName = $('Detect_Payment_Request').first().json.parent_name || 'Parent';\n\n// Get payment link from either new payment or existing payment\nlet paymentLink;\nif (paymentData.payment_link) {\n  paymentLink = paymentData.payment_link;\n} else if (paymentData.short_url) {\n  paymentLink = paymentData.short_url;\n} else {\n  paymentLink = $('Generate_Payment_Link').first()?.json?.short_url || 'Link generation failed';\n}\n\n// Format assessment name\nlet formattedName = assessmentType;\nif (assessmentType === 'iLMH') formattedName = 'iLMH Assessment';\nelse if (assessmentType === 'test_anxiety') formattedName = 'Test Anxiety Assessment';\nelse if (assessmentType === 'iTMPA') formattedName = 'iTMPA Assessment';\nelse if (assessmentType === 'iPMA') formattedName = 'iPMA Assessment';\n\nconst message = `Great! Here's your payment link for the ${formattedName} (₹99):\\n\\n${paymentLink}\\n\\nThe link is valid for 48 hours. After payment, you'll receive the assessment link immediately!\\n\\nFeel free to ask if you have any questions! 😊\\n\\n- Subbu Innovative Classes`;\n\nreturn {\n  json: {\n    phone: $('Detect_Payment_Request').first().json.lead_phone,\n    message: message,\n    lead_id: $('Detect_Payment_Request').first().json.lead_id,\n    payment_link: paymentLink\n  }\n};"
  },
  "type": "n8n-nodes-base.code",
  "typeVersion": 2,
  "position": [200, 100],
  "id": "format-payment-message",
  "name": "Format_Payment_Message"
}
```

---

## Step 10: Send Payment Link via WhatsApp

**Add node**: "Send_Payment_Link"

```json
{
  "parameters": {
    "operation": "send",
    "phoneNumberId": "879646611896807",
    "recipientPhoneNumber": "={{ $json.phone }}",
    "textBody": "={{ $json.message }}",
    "additionalFields": {}
  },
  "type": "n8n-nodes-base.whatsApp",
  "typeVersion": 1.1,
  "position": [400, 100],
  "id": "send-payment-link",
  "name": "Send_Payment_Link",
  "webhookId": "send-payment-link-whatsapp",
  "credentials": {
    "whatsAppApi": {
      "id": "h6CpnDFBzUfo5NYz",
      "name": "WhatsApp account-subbu"
    }
  }
}
```

---

## Step 11: Add Error Handling

**Add node**: "Handle_Payment_Error"

```json
{
  "parameters": {
    "jsCode": "const error = $input.first().json;\n\nconsole.error('Payment Link Generation Error:', error);\n\nconst parentName = $('Detect_Payment_Request').first()?.json?.parent_name || 'Parent';\nconst phone = $('Detect_Payment_Request').first()?.json?.lead_phone;\n\nconst message = `I apologize, ${parentName}. I'm having trouble generating the payment link right now.\\n\\nLet me connect you with our team who can assist you directly. Please hold on!\\n\\n- Subbu Innovative Classes`;\n\nreturn {\n  json: {\n    phone: phone,\n    message: message,\n    error: true,\n    error_details: error\n  }\n};"
  },
  "type": "n8n-nodes-base.code",
  "typeVersion": 2,
  "position": [200, 300],
  "id": "handle-payment-error",
  "name": "Handle_Payment_Error",
  "onError": "continueRegularOutput"
}
```

**Add node**: "Send_Error_Message"

```json
{
  "parameters": {
    "operation": "send",
    "phoneNumberId": "879646611896807",
    "recipientPhoneNumber": "={{ $json.phone }}",
    "textBody": "={{ $json.message }}",
    "additionalFields": {}
  },
  "type": "n8n-nodes-base.whatsApp",
  "typeVersion": 1.1,
  "position": [400, 300],
  "id": "send-error-message",
  "name": "Send_Error_Message",
  "webhookId": "send-error-whatsapp",
  "credentials": {
    "whatsAppApi": {
      "id": "h6CpnDFBzUfo5NYz",
      "name": "WhatsApp account-subbu"
    }
  }
}
```

---

## Complete Connection Flow

Here's the complete flow for the payment generation branch:

```
Extract_AI_Response1
    ↓
Detect_Payment_Request
    ↓
IF_Should_Generate_Payment
    ├─ TRUE ──→ Check_Existing_Payment
    │               ↓
    │           Has_Existing_Payment
    │               ├─ TRUE (reuse) ──→ Format_Payment_Message
    │               │                       ↓
    │               │                   Send_Payment_Link
    │               │                       ↓
    │               │                   [Merge back to main flow]
    │               │
    │               └─ FALSE (new) ──→ Create_Razorpay_Order
    │                                       ↓
    │                                   Generate_Payment_Link
    │                                       ↓
    │                                   Store_Payment_Record
    │                                       ↓
    │                                   Format_Payment_Message
    │                                       ↓
    │                                   Send_Payment_Link
    │                                       ↓
    │                                   [Merge back to main flow]
    │
    └─ FALSE ──→ Save_User_Message1 [Continue existing flow]

[Error handling on all payment nodes]
    → Handle_Payment_Error
    → Send_Error_Message
    → [Merge back to main flow]
```

---

## Important Notes

1. **Razorpay Credentials**: Create HTTP Basic Auth credentials in n8n with:
   - Username: Your Razorpay Key ID (starts with `rzp_`)
   - Password: Your Razorpay Key Secret

2. **Webhook URL**: Replace `https://your-n8n-instance.com/webhook/razorpay-webhook` with your actual n8n webhook URL from the Razorpay webhook handler workflow.

3. **Testing**: Use Razorpay TEST mode first before going live!
   - Test Key ID starts with `rzp_test_`
   - Live Key ID starts with `rzp_live_`

4. **Error Handling**: All Razorpay API nodes should have error handling enabled to gracefully handle failures.

5. **Rate Limiting**: Add appropriate delays if sending multiple messages in sequence.

---

## Validation Checklist

Before deploying:

- [ ] Database migration applied successfully
- [ ] Razorpay credentials configured in n8n
- [ ] Webhook handler workflow imported and activated
- [ ] Follow-up scheduler workflow imported and activated
- [ ] AI Agent prompt updated with GENERATE_PAYMENT_LINK command
- [ ] All new nodes added to main workflow
- [ ] Connection flow verified
- [ ] Error handling tested
- [ ] Test payment with Razorpay test mode successful
- [ ] Webhook URL configured in Razorpay dashboard

---

## Next Steps

1. Import the three workflow JSONs into n8n
2. Run the database migration
3. Configure Razorpay credentials
4. Test end-to-end flow
5. Monitor logs for any issues
6. Go live!
