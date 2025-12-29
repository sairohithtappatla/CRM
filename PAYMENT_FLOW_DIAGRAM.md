# Payment Flow Diagrams

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         User WhatsApp Message                        │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Message Processing                           │
│  (Validation, Language Detection, Sentiment Analysis, etc.)         │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         AI Agent Response                            │
│  Generates response + payment command (if needed)                   │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      🆕 Payment Detection                            │
│  Detects: GENERATE_PAYMENT_LINK|amount=5000|description=...        │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
                    ▼                             ▼
        ┌─────────────────────┐      ┌─────────────────────┐
        │  Payment Required   │      │  Normal Message     │
        └─────────────────────┘      └─────────────────────┘
                    │                             │
                    ▼                             ▼
        ┌─────────────────────┐      ┌─────────────────────┐
        │  Payment Flow       │      │  Save & Send        │
        │  (See Below)        │      │  Regular Response   │
        └─────────────────────┘      └─────────────────────┘
```

## Detailed Payment Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    🆕 Detect Payment Request                         │
│                                                                      │
│  Input: AI Response                                                 │
│  Output: {                                                          │
│    should_generate_payment: true/false,                            │
│    payment_amount: 5000,                                           │
│    payment_description: "Enrollment Fee",                          │
│    clean_response: "Great! Let me help you..."                     │
│  }                                                                  │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│              🆕 IF Should Generate Payment?                          │
└─────────────────────────────────────────────────────────────────────┘
                    │
    ┌───────────────┴──────────────┐
    │ YES                           │ NO
    ▼                               ▼
┌─────────────────────┐   ┌─────────────────────┐
│  Payment Flow       │   │  Normal Flow        │
└─────────────────────┘   └─────────────────────┘
    │                               │
    ▼                               │
┌─────────────────────────────────┐ │
│ 🆕 Check Existing Payment       │ │
│                                 │ │
│ Query: SELECT * FROM            │ │
│   payment_links                 │ │
│ WHERE lead_id = ? AND           │ │
│   status = 'pending'            │ │
└─────────────────────────────────┘ │
    │                               │
    ▼                               │
┌─────────────────────────────────┐ │
│ 🆕 Has Existing Payment?        │ │
└─────────────────────────────────┘ │
    │                               │
┌───┴───┐                           │
│ YES   │ NO                        │
▼       ▼                           │
│       │                           │
│   ┌───────────────────────────┐  │
│   │ 🆕 Create Razorpay Order  │  │
│   │                           │  │
│   │ POST /v1/orders           │  │
│   │ {                         │  │
│   │   amount: 500000,         │  │
│   │   currency: "INR",        │  │
│   │   receipt: "rcpt_xxx"     │  │
│   │ }                         │  │
│   └───────────────────────────┘  │
│       │                           │
│       ▼                           │
│   ┌───────────────────────────┐  │
│   │ 🆕 Generate Payment Link  │  │
│   │                           │  │
│   │ POST /v1/payment_links    │  │
│   │ {                         │  │
│   │   amount: 500000,         │  │
│   │   description: "...",     │  │
│   │   customer: {...},        │  │
│   │   notify: {               │  │
│   │     sms: true,            │  │
│   │     whatsapp: true        │  │
│   │   }                       │  │
│   │ }                         │  │
│   └───────────────────────────┘  │
│       │                           │
│       ▼                           │
│   ┌───────────────────────────┐  │
│   │ 🆕 Store Payment Record   │  │
│   │                           │  │
│   │ INSERT INTO payment_links │  │
│   │ VALUES (...)              │  │
│   └───────────────────────────┘  │
│       │                           │
│       ▼                           │
│   ┌───────────────────────────┐  │
│   │ 🆕 Format Payment Message │  │
│   │                           │  │
│   │ Creates WhatsApp message  │  │
│   │ with link and details     │  │
│   └───────────────────────────┘  │
│       │                           │
│       │                           │
│   ┌───┴───────────────────────┐  │
│   │ 🆕 Reuse Existing Link    │  │
│   │                           │  │
│   │ Formats message with      │  │
│   │ existing payment link     │  │
│   └───────────────────────────┘  │
│       │                           │
└───────┴───────┬───────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────┐
│              🆕 Send Payment Link via WhatsApp                       │
│                                                                      │
│  Message Format:                                                    │
│  "Great! Let me generate a payment link for you.                   │
│                                                                      │
│   💳 Payment Link: https://rzp.io/i/xxxxx                           │
│                                                                      │
│   Amount: ₹5000                                                     │
│   Description: Enrollment Fee Class 10                             │
│                                                                      │
│   Please complete the payment using the link above.                │
│   The link is valid for 24 hours."                                 │
└─────────────────────────────────────────────────────────────────────┘
                │
                ▼
        [Message Saved & Workflow Complete]
```

## Error Handling Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│         Any Node in Payment Flow                                    │
└─────────────────────────────────────────────────────────────────────┘
                │
                │ (Error occurs)
                ▼
┌─────────────────────────────────────────────────────────────────────┐
│              🆕 Handle Payment Error                                 │
│                                                                      │
│  Creates error message:                                             │
│  "I apologize, but there was an issue generating                   │
│   the payment link. Our team has been notified..."                 │
└─────────────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────┐
│              🆕 Send Error Message                                   │
│                                                                      │
│  Sends error notification to user via WhatsApp                      │
└─────────────────────────────────────────────────────────────────────┘
                │
                ▼
        [Error logged & User notified]
```

## Node Positions Map

```
                                WhatsApp Trigger
                                    (-5008, 336)
                                         │
                                         ▼
                                   ignore_check1
                                    (-4848, 336)
                                         │
                                         ▼
                              get_or_create_lead_by_phone1
                                    (-4464, 352)
                                         │
                                         ▼
                              Start_Or_Get_Session1
                                    (-4256, 352)
                                         │
                                         ▼
                                Get_recent_msgs1
                                    (-4048, 352)
                                         │
                                         ▼
                                Get_AI_Memory1
                                    (-3840, 352)
                                         │
                                         ▼
                              Build_AI_Context1
                                    (-3632, 368)
                                         │
                                         ▼
                          Validate_Message_And_Intent1
                                    (-3424, 368)
                                         │
                                         ▼
                              IF_Message_Valid1
                                    (-3216, 368)
                                         │
                        ┌────────────────┴────────────────┐
                        ▼                                 ▼
              IF_Language_Changed1                Send_Fallback_Message1
                  (-3008, 368)                         (-3008, 608)
                        │
                        ▼
              Update_Language_Preference1
                  (-2816, 256)
                        │
                        ▼
              IF_Sentiment_Detected1
                  (-2608, 384)
                        │
                        ▼
              Update_Sentiment1
                  (-2352, 368)
                        │
                        ▼
              IF_Escalation_Needed1
                  (-2144, 368)
                        │
            ┌───────────┴───────────┐
            ▼                       ▼
    Notify_Admin_Escalation1   AI Agent1
        (-1856, 208)          (-1616, 384)
                                   │
                                   ▼
                          Extract_AI_Response1
                              (-1344, 384)
                                   │
                                   ▼
                          Log_AI_Operation1
                              (-1104, 384)
                                   │
                                   ▼
                    🆕 Detect_Payment_Request
                          (-1200, 560)
                                   │
                                   ▼
                🆕 IF_Should_Generate_Payment
                          (-1000, 560)
                                   │
                ┌──────────────────┴──────────────────┐
                ▼                                     ▼
    🆕 Check_Existing_Payment              Save_User_Message1
          (-800, 480)                          (-1136, 224)
                │
                ▼
    🆕 Has_Existing_Payment
          (-600, 480)
                │
    ┌───────────┴────────────┐
    ▼                        ▼
🆕 Reuse_Existing_Link  🆕 Create_Razorpay_Order
    (-400, 560)              (-400, 400)
    │                        │
    │                        ▼
    │              🆕 Generate_Payment_Link
    │                      (-200, 400)
    │                        │
    │                        ▼
    │              🆕 Store_Payment_Record
    │                      (0, 400)
    │                        │
    │                        ▼
    │              🆕 Format_Payment_Message
    │                      (200, 400)
    │                        │
    └────────────────────────┴─────────┐
                                       ▼
                          🆕 Send_Payment_Link
                                  (400, 400)
```

## Data Flow

### Input to Detect_Payment_Request
```json
{
  "lead_id": "uuid-xxxx",
  "lead_phone": "919876543210",
  "ai_response": "Great! Let me help you with enrollment.\nGENERATE_PAYMENT_LINK|amount=5000|description=Enrollment Fee Class 10",
  "session_id": "session-xxxx"
}
```

### Output from Detect_Payment_Request
```json
{
  "lead_id": "uuid-xxxx",
  "lead_phone": "919876543210",
  "should_generate_payment": true,
  "payment_amount": 5000,
  "payment_description": "Enrollment Fee Class 10",
  "clean_response": "Great! Let me help you with enrollment.",
  "original_response": "Great!...[full text]..."
}
```

### Razorpay Order Creation Request
```json
{
  "amount": 500000,
  "currency": "INR",
  "receipt": "rcpt_uuid-xxxx_1735506000000",
  "notes": {
    "lead_id": "uuid-xxxx",
    "description": "Enrollment Fee Class 10",
    "phone": "919876543210"
  }
}
```

### Razorpay Payment Link Creation Request
```json
{
  "amount": 500000,
  "currency": "INR",
  "description": "Enrollment Fee Class 10",
  "customer": {
    "contact": "+919876543210"
  },
  "notify": {
    "sms": true,
    "whatsapp": true
  },
  "reminder_enable": true,
  "callback_url": "https://subbuclasses.com/payment-success",
  "callback_method": "get"
}
```

### Razorpay Payment Link Response
```json
{
  "id": "plink_xxxxx",
  "short_url": "https://rzp.io/i/xxxxx",
  "amount": 500000,
  "currency": "INR",
  "description": "Enrollment Fee Class 10",
  "status": "created",
  "created_at": 1735506000
}
```

### Supabase payment_links Insert
```json
{
  "lead_id": "uuid-xxxx",
  "razorpay_payment_link_id": "plink_xxxxx",
  "razorpay_order_id": "order_xxxxx",
  "amount": 5000,
  "currency": "INR",
  "description": "Enrollment Fee Class 10",
  "short_url": "https://rzp.io/i/xxxxx",
  "status": "pending",
  "metadata": {
    "session_id": "session-xxxx",
    "phone": "919876543210"
  }
}
```

### Final WhatsApp Message
```
Great! Let me help you with enrollment.

💳 Payment Link: https://rzp.io/i/xxxxx

Amount: ₹5000
Description: Enrollment Fee Class 10

Please complete the payment using the link above. The link is valid for 24 hours.
```

## State Diagram

```
┌─────────────┐
│   Initial   │
│   Message   │
└─────────────┘
      │
      ▼
┌─────────────────┐
│ AI Processing   │
└─────────────────┘
      │
      ▼
    ╱   ╲
   ╱     ╲
  ╱Payment?╲─── NO ──→ Normal Flow
  ╲       ╱
   ╲     ╱
    ╲   ╱
      │ YES
      ▼
    ╱   ╲
   ╱     ╲
  ╱ Exists?╲─── YES ──→ Reuse Link
  ╲       ╱
   ╲     ╱
    ╲   ╱
      │ NO
      ▼
┌─────────────────┐
│ Create Razorpay │
│     Order       │
└─────────────────┘
      │
      ▼
┌─────────────────┐
│  Generate Link  │
└─────────────────┘
      │
      ▼
┌─────────────────┐
│   Store in DB   │
└─────────────────┘
      │
      ▼
┌─────────────────┐
│  Send via WA    │
└─────────────────┘
      │
      ▼
┌─────────────────┐
│   Complete      │
└─────────────────┘
```

## Timeline Diagram

```
User                    AI Agent              System                 Razorpay              WhatsApp
 │                         │                     │                        │                      │
 │──── "I want to pay" ───→│                     │                        │                      │
 │                         │                     │                        │                      │
 │                         │─── Process ────────→│                        │                      │
 │                         │                     │                        │                      │
 │                         │←── Response ────────│                        │                      │
 │                         │  + Payment Command  │                        │                      │
 │                         │                     │                        │                      │
 │                         │                     │─── Check Existing ────→│                      │
 │                         │                     │←── None ───────────────│                      │
 │                         │                     │                        │                      │
 │                         │                     │─── Create Order ───────→│                     │
 │                         │                     │←── Order Created ──────│                     │
 │                         │                     │                        │                      │
 │                         │                     │─── Generate Link ──────→│                     │
 │                         │                     │←── Link Created ────────│                     │
 │                         │                     │                        │                      │
 │                         │                     │─── Store in DB ────────→│                     │
 │                         │                     │←── Stored ──────────────│                     │
 │                         │                     │                        │                      │
 │                         │                     │─── Format Message ─────→│                     │
 │                         │                     │                        │                      │
 │                         │                     │─── Send WhatsApp ──────────────────────────→│
 │                         │                     │                        │                      │
 │←────────────────────────────────────────────────────────────────── Payment Link ──────────────│
 │  💳 https://rzp.io/i/xxx                                                                      │
 │                         │                     │                        │                      │
```

---

*This diagram shows the complete payment flow with all new nodes (marked with 🆕)*
*All positions are in n8n canvas coordinates (x, y)*
