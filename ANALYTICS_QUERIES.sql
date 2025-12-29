-- ========================================
-- ANALYTICS QUERIES FOR SUBBU CONNECT
-- ========================================
-- Quick reference for common analytics queries
-- Last Updated: December 29, 2025

-- ========================================
-- 1. DASHBOARD SUMMARY
-- ========================================

-- Get today's key metrics
SELECT * FROM public.get_dashboard_summary();

-- ========================================
-- 2. CONVERSION ANALYTICS
-- ========================================

-- Last 30 days conversion rates
SELECT 
  date,
  total_leads,
  leads_with_messages,
  leads_paid,
  message_to_payment_conversion_rate,
  overall_conversion_rate
FROM public.v_conversion_analytics
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY date DESC;

-- Weekly conversion trends
SELECT 
  DATE_TRUNC('week', date) as week,
  SUM(total_leads) as total_leads,
  SUM(leads_paid) as total_paid,
  ROUND(AVG(message_to_payment_conversion_rate)::numeric, 2) as avg_conversion_rate
FROM public.v_conversion_analytics
WHERE date >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY DATE_TRUNC('week', date)
ORDER BY week DESC;

-- ========================================
-- 3. RESPONSE TIME ANALYTICS
-- ========================================

-- Last 7 days response time
SELECT 
  date,
  total_responses,
  avg_response_seconds,
  median_response_seconds,
  p95_response_seconds
FROM public.v_response_time_analytics
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY date DESC;

-- Find slow response days (avg > 10 seconds)
SELECT 
  date,
  avg_response_seconds,
  total_responses
FROM public.v_response_time_analytics
WHERE avg_response_seconds > 10
ORDER BY date DESC;

-- ========================================
-- 4. COMMON QUESTIONS ANALYSIS
-- ========================================

-- Top 20 most asked questions
SELECT 
  category,
  message,
  frequency,
  last_asked
FROM public.v_common_questions
ORDER BY frequency DESC
LIMIT 20;

-- Questions by category
SELECT 
  category,
  COUNT(*) as question_count,
  SUM(frequency) as total_asks
FROM public.v_common_questions
GROUP BY category
ORDER BY total_asks DESC;

-- Recent pricing questions
SELECT 
  message,
  frequency,
  last_asked
FROM public.v_common_questions
WHERE category = 'Pricing'
ORDER BY last_asked DESC
LIMIT 10;

-- ========================================
-- 5. SENTIMENT TRENDS
-- ========================================

-- Current sentiment distribution
SELECT 
  current_sentiment,
  COUNT(*) as lead_count,
  ROUND(AVG(sentiment_confidence)::numeric, 2) as avg_confidence
FROM public.leads
WHERE current_sentiment IS NOT NULL
  AND last_contact_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY current_sentiment
ORDER BY lead_count DESC;

-- Sentiment trends over time
SELECT 
  date,
  current_sentiment,
  lead_count,
  avg_confidence
FROM public.v_sentiment_trends
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY date DESC, lead_count DESC;

-- Identify stressed/angry leads (needs attention)
SELECT 
  l.id,
  l.parent_name,
  l.phone,
  l.current_sentiment,
  l.sentiment_confidence,
  l.last_contact_at
FROM public.leads l
WHERE l.current_sentiment IN ('angry', 'stressed', 'anxious')
  AND l.sentiment_confidence > 60
  AND l.last_contact_at >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY l.sentiment_confidence DESC, l.last_contact_at DESC;

-- ========================================
-- 6. SESSION QUALITY METRICS
-- ========================================

-- Last 30 days session quality
SELECT 
  date,
  total_sessions,
  avg_messages_per_session,
  avg_session_duration_minutes,
  engaged_sessions,
  engagement_rate
FROM public.v_session_quality_metrics
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY date DESC;

-- Low engagement days (< 50%)
SELECT 
  date,
  total_sessions,
  engagement_rate
FROM public.v_session_quality_metrics
WHERE engagement_rate < 50
ORDER BY date DESC;

-- ========================================
-- 7. PAYMENT ANALYTICS
-- ========================================

-- Payment performance by assessment type
SELECT 
  assessment_type,
  SUM(total_payments) as total,
  SUM(successful_payments) as paid,
  SUM(failed_payments) as failed,
  SUM(pending_payments) as pending,
  SUM(total_revenue_inr) as revenue,
  ROUND(AVG(success_rate)::numeric, 2) as avg_success_rate
FROM public.v_payment_analytics
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY assessment_type
ORDER BY revenue DESC;

-- Daily revenue trends
SELECT 
  date,
  SUM(total_revenue_inr) as daily_revenue,
  SUM(successful_payments) as payments_count
FROM public.v_payment_analytics
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY date
ORDER BY date DESC;

-- Payment success rate trends
SELECT 
  date,
  ROUND(AVG(success_rate)::numeric, 2) as avg_success_rate,
  SUM(total_payments) as total_attempts
FROM public.v_payment_analytics
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY date
ORDER BY date DESC;

-- Pending payments needing follow-up
SELECT 
  p.id,
  p.lead_id,
  l.parent_name,
  l.phone,
  p.assessment_type,
  p.amount / 100.0 as amount_inr,
  p.follow_up_count,
  p.last_follow_up_at,
  p.created_at,
  EXTRACT(EPOCH FROM (NOW() - p.created_at))/3600 as hours_pending
FROM public.payments p
JOIN public.leads l ON p.lead_id = l.id
WHERE p.status = 'pending'
  AND p.created_at >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY p.created_at DESC;

-- ========================================
-- 8. LEAD SOURCE PERFORMANCE
-- ========================================

-- Marketing channel ROI
SELECT 
  ref_source,
  utm_campaign,
  total_leads,
  engaged_leads,
  converted_leads,
  conversion_rate,
  avg_engagement_score
FROM public.v_lead_source_performance
ORDER BY converted_leads DESC, conversion_rate DESC;

-- Best performing campaigns
SELECT 
  utm_campaign,
  utm_source,
  utm_medium,
  total_leads,
  converted_leads,
  conversion_rate
FROM public.v_lead_source_performance
WHERE utm_campaign IS NOT NULL
ORDER BY conversion_rate DESC, total_leads DESC;

-- WhatsApp vs other sources
SELECT 
  CASE 
    WHEN ref_source = 'whatsapp' THEN 'WhatsApp'
    ELSE 'Other'
  END as source_group,
  SUM(total_leads) as leads,
  SUM(converted_leads) as conversions,
  ROUND(AVG(conversion_rate)::numeric, 2) as avg_conversion_rate
FROM public.v_lead_source_performance
GROUP BY source_group;

-- ========================================
-- 9. LEAD INSIGHTS
-- ========================================

-- Hot leads (high engagement, recent activity)
SELECT 
  l.id,
  l.parent_name,
  l.phone,
  l.engagement_score,
  l.total_messages_sent,
  l.last_contact_at,
  l.current_sentiment
FROM public.leads l
WHERE l.engagement_score > 70
  AND l.last_contact_at >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY l.engagement_score DESC, l.last_contact_at DESC
LIMIT 20;

-- Cold leads (low engagement, need re-engagement)
SELECT 
  l.id,
  l.parent_name,
  l.phone,
  l.engagement_score,
  l.total_messages_sent,
  l.last_contact_at,
  EXTRACT(EPOCH FROM (NOW() - l.last_contact_at))/86400 as days_inactive
FROM public.leads l
WHERE l.engagement_score < 30
  AND l.last_contact_at < CURRENT_DATE - INTERVAL '3 days'
  AND l.total_messages_sent > 0
ORDER BY l.last_contact_at ASC
LIMIT 20;

-- ========================================
-- 10. AI PERFORMANCE METRICS
-- ========================================

-- AI operation success rate
SELECT 
  DATE(created_at) as date,
  operation_type,
  COUNT(*) as total_operations,
  SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful,
  ROUND(100.0 * SUM(CASE WHEN success THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate,
  ROUND(AVG(latency_ms)::numeric, 2) as avg_latency_ms
FROM public.ai_audit_logs
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(created_at), operation_type
ORDER BY date DESC, operation_type;

-- AI errors (needs investigation)
SELECT 
  created_at,
  operation_type,
  model_used,
  error_message,
  metadata
FROM public.ai_audit_logs
WHERE success = false
  AND created_at >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY created_at DESC;

-- ========================================
-- 11. MESSAGE PATTERNS
-- ========================================

-- Messages per hour (find peak times)
SELECT 
  EXTRACT(HOUR FROM timestamp) as hour,
  COUNT(*) as message_count,
  COUNT(DISTINCT lead_id) as unique_leads
FROM public.messages
WHERE timestamp >= CURRENT_DATE - INTERVAL '7 days'
  AND sender = 'user'
GROUP BY EXTRACT(HOUR FROM timestamp)
ORDER BY hour;

-- Average conversation length
SELECT 
  cs.id,
  cs.lead_id,
  l.parent_name,
  cs.message_count,
  EXTRACT(EPOCH FROM (cs.session_end - cs.session_start))/60 as duration_minutes
FROM public.conversation_sessions cs
JOIN public.leads l ON cs.lead_id = l.id
WHERE cs.session_end IS NOT NULL
  AND cs.session_start >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY cs.message_count DESC
LIMIT 20;

-- ========================================
-- 12. ASSESSMENT LINKS MANAGEMENT
-- ========================================

-- View all assessment links
SELECT 
  assessment_type,
  display_name,
  price_inr / 100.0 as price_inr,
  description,
  active,
  updated_at
FROM public.assessment_links
ORDER BY assessment_type;

-- Get assessment info for AI (formatted)
SELECT public.get_assessment_info_for_ai();

-- Get specific assessment details
SELECT * FROM public.get_assessment_link_by_type('iLMH');

-- Update assessment link (example)
-- UPDATE public.assessment_links
-- SET google_form_link = 'https://new-link-here',
--     updated_at = NOW()
-- WHERE assessment_type = 'iLMH';

-- ========================================
-- 13. ADMIN NOTIFICATIONS
-- ========================================

-- Unread urgent notifications
SELECT 
  an.id,
  an.type,
  an.severity,
  an.message,
  an.created_at,
  l.parent_name,
  l.phone
FROM public.admin_notifications an
LEFT JOIN public.leads l ON an.lead_id = l.id
WHERE an.is_read = false
  AND an.severity IN ('high', 'critical')
ORDER BY an.created_at DESC;

-- Notification trends
SELECT 
  DATE(created_at) as date,
  type,
  severity,
  COUNT(*) as count
FROM public.admin_notifications
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at), type, severity
ORDER BY date DESC, count DESC;

-- ========================================
-- 14. RATE LIMIT MONITORING
-- ========================================

-- Note: Rate limits are tracked in n8n workflow memory
-- To monitor, check n8n logs for "rate_limit_exceeded" entries

-- Check for potential spam patterns in database
SELECT 
  lead_id,
  DATE(timestamp) as date,
  COUNT(*) as message_count,
  MIN(timestamp) as first_message,
  MAX(timestamp) as last_message,
  EXTRACT(EPOCH FROM (MAX(timestamp) - MIN(timestamp)))/60 as duration_minutes
FROM public.messages
WHERE sender = 'user'
  AND timestamp >= CURRENT_DATE - INTERVAL '1 day'
GROUP BY lead_id, DATE(timestamp)
HAVING COUNT(*) > 20
ORDER BY message_count DESC;

-- ========================================
-- 15. CUSTOM REPORTS
-- ========================================

-- Weekly summary report
SELECT 
  DATE_TRUNC('week', CURRENT_DATE) as week_start,
  (SELECT COUNT(*) FROM public.leads WHERE created_at >= DATE_TRUNC('week', CURRENT_DATE)) as new_leads,
  (SELECT COUNT(*) FROM public.payments WHERE status = 'paid' AND created_at >= DATE_TRUNC('week', CURRENT_DATE)) as payments,
  (SELECT SUM(amount)/100.0 FROM public.payments WHERE status = 'paid' AND created_at >= DATE_TRUNC('week', CURRENT_DATE)) as revenue,
  (SELECT ROUND(AVG(avg_response_seconds)::numeric, 2) FROM public.v_response_time_analytics WHERE date >= DATE_TRUNC('week', CURRENT_DATE)) as avg_response_time,
  (SELECT ROUND(AVG(engagement_rate)::numeric, 2) FROM public.v_session_quality_metrics WHERE date >= DATE_TRUNC('week', CURRENT_DATE)) as avg_engagement_rate;

-- Monthly comparison
SELECT 
  DATE_TRUNC('month', date) as month,
  SUM(total_leads) as leads,
  SUM(leads_paid) as conversions,
  ROUND(AVG(message_to_payment_conversion_rate)::numeric, 2) as avg_conversion_rate
FROM public.v_conversion_analytics
WHERE date >= CURRENT_DATE - INTERVAL '6 months'
GROUP BY DATE_TRUNC('month', date)
ORDER BY month DESC;

-- ========================================
-- END OF ANALYTICS QUERIES
-- ========================================

-- For more information, see WORKFLOW_IMPROVEMENTS_SUMMARY.md

