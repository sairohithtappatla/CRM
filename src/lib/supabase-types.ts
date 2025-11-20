// Database Types based on Supabase Schema
export interface Lead {
  id: string;
  organization_id: string | null;
  parent_name: string | null;
  phone: string | null;
  student_name: string | null;
  class: string | null;
  status: 'HOT' | 'WARM' | 'COLD' | 'FOLLOW-UP' | 'ADMITTED' | null;
  score: number | null;
  engagement_score: number | null;
  last_contact_at: string | null;
  created_at: string | null;
  language_pref: 'en' | 'hi' | 'te' | null;
  current_sentiment: 'worried' | 'proud' | 'stressed' | 'neutral' | 'anxious' | 'angry' | 'happy' | null;
  sentiment_confidence: number | null;
  ref_source: string | null;
  utm_campaign: string | null;
  utm_medium: string | null;
  utm_source: string | null;
  utm_content: string | null;
  utm_term: string | null;
  referrer_url: string | null;
  landing_page: string | null;
  device_type: string | null;
  browser: string | null;
  source_metadata: any | null;
  current_session_id: string | null;
  session_start_at: string | null;
  session_message_count: number | null;
  total_messages_sent: number | null;
  total_messages_received: number | null;
  avg_response_time_seconds: number | null;
}

export interface Message {
  id: number;
  lead_id: string | null;
  sender: 'user' | 'admin';
  message: string;
  timestamp: string | null;
}

export interface Payment {
  id: string;
  lead_id: string | null;
  amount: number;
  status: 'pending' | 'paid' | 'failed' | 'refunded' | null;
  payment_id: string | null;
  purpose: string | null;
  payer_phone: string | null;
  created_at: string | null;
}

export interface AIMemory {
  id: string;
  lead_id: string;
  profile: any | null;
  context: any | null;
  last_updated: string | null;
}

export interface Summary {
  id: string;
  lead_id: string | null;
  ai_summary: string | null;
  next_action: string | null;
  updated_at: string | null;
}

// Extended Lead type with related data for UI
export interface LeadWithDetails extends Lead {
  messages?: Message[];
  payments?: Payment[];
  ai_memory?: AIMemory;
  summary?: Summary;
}

// Analytics types
export interface AnalyticsData {
  totalLeads: number;
  hotLeads: number;
  demosScheduled: number;
  admissions: number;
  conversionRate: number;
  leadsOverTime: { month: string; leads: number }[];
  leadsByStatus: { name: string; count: number }[];
  leadSources: { name: string; value: number; color: string }[];
}
