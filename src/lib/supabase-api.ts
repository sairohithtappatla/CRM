import { supabase } from './supabaseClient';
import { Lead, Message, Payment, LeadWithDetails, AnalyticsData } from './supabase-types';

// Helper function to format relative time
export const formatRelativeTime = (dateString: string | null): string => {
  if (!dateString) return 'Never';

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

// Fetch all leads
export const fetchLeads = async (): Promise<LeadWithDetails[]> => {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .order('last_contact_at', { ascending: false });

  if (error) {
    console.error('Error fetching leads:', error);
    throw error;
  }

  return data as LeadWithDetails[];
};

// Fetch a single lead with all related data
export const fetchLeadWithDetails = async (leadId: string): Promise<LeadWithDetails | null> => {
  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .single();

  if (leadError) {
    console.error('Error fetching lead:', leadError);
    throw leadError;
  }

  // Fetch messages
  const { data: messages, error: messagesError } = await supabase
    .from('messages')
    .select('*')
    .eq('lead_id', leadId)
    .order('timestamp', { ascending: true });

  if (messagesError) {
    console.error('Error fetching messages:', messagesError);
  }

  // Fetch payments
  const { data: payments, error: paymentsError } = await supabase
    .from('payments')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false });

  if (paymentsError) {
    console.error('Error fetching payments:', paymentsError);
  }

  // Fetch AI memory
  const { data: aiMemory, error: aiMemoryError } = await supabase
    .from('ai_memory')
    .select('*')
    .eq('lead_id', leadId)
    .single();

  if (aiMemoryError && aiMemoryError.code !== 'PGRST116') {
    console.error('Error fetching AI memory:', aiMemoryError);
  }

  // Fetch summary
  const { data: summary, error: summaryError } = await supabase
    .from('summaries')
    .select('*')
    .eq('lead_id', leadId)
    .single();

  if (summaryError && summaryError.code !== 'PGRST116') {
    console.error('Error fetching summary:', summaryError);
  }

  return {
    ...lead,
    messages: messages || [],
    payments: payments || [],
    ai_memory: aiMemory || undefined,
    summary: summary || undefined,
  } as LeadWithDetails;
};

// Fetch messages for a lead
export const fetchMessages = async (leadId: string): Promise<Message[]> => {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('lead_id', leadId)
    .order('timestamp', { ascending: true });

  if (error) {
    console.error('Error fetching messages:', error);
    throw error;
  }

  return data as Message[];
};

// Add a new message
export const addMessage = async (leadId: string, sender: 'user' | 'admin', message: string): Promise<Message> => {
  const { data, error } = await supabase
    .from('messages')
    .insert([
      {
        lead_id: leadId,
        sender,
        message,
        timestamp: new Date().toISOString(),
      },
    ])
    .select()
    .single();

  if (error) {
    console.error('Error adding message:', error);
    throw error;
  }

  // Update last_contact_at for the lead
  await supabase
    .from('leads')
    .update({ last_contact_at: new Date().toISOString() })
    .eq('id', leadId);

  return data as Message;
};

// Update lead status
export const updateLeadStatus = async (leadId: string, status: Lead['status']): Promise<void> => {
  const { error } = await supabase
    .from('leads')
    .update({ status })
    .eq('id', leadId);

  if (error) {
    console.error('Error updating lead status:', error);
    throw error;
  }
};

// Update lead score
export const updateLeadScore = async (leadId: string, score: number): Promise<void> => {
  const { error } = await supabase
    .from('leads')
    .update({ score })
    .eq('id', leadId);

  if (error) {
    console.error('Error updating lead score:', error);
    throw error;
  }
};

// Fetch analytics data
export const fetchAnalytics = async (): Promise<AnalyticsData> => {
  // Fetch all leads for analytics
  const { data: leads, error } = await supabase
    .from('leads')
    .select('*');

  if (error) {
    console.error('Error fetching analytics:', error);
    throw error;
  }

  const totalLeads = leads.length;
  const hotLeads = leads.filter(l => l.status === 'HOT').length;
  const admissions = leads.filter(l => l.status === 'ADMITTED').length;

  // For demos, we'll need to check if there are any scheduled demos in messages or use a placeholder
  const demosScheduled = Math.floor(hotLeads * 0.7); // Approximate

  const conversionRate = totalLeads > 0 ? (admissions / totalLeads) * 100 : 0;

  // Group leads by status
  const leadsByStatus = [
    { name: 'HOT', count: leads.filter(l => l.status === 'HOT').length },
    { name: 'WARM', count: leads.filter(l => l.status === 'WARM').length },
    { name: 'COLD', count: leads.filter(l => l.status === 'COLD').length },
    { name: 'FOLLOW-UP', count: leads.filter(l => l.status === 'FOLLOW-UP').length },
    { name: 'ADMITTED', count: leads.filter(l => l.status === 'ADMITTED').length },
  ];

  // Group leads by source
  const sourceMap = new Map<string, number>();
  leads.forEach(lead => {
    const source = lead.ref_source || 'Unknown';
    sourceMap.set(source, (sourceMap.get(source) || 0) + 1);
  });

  const leadSources = Array.from(sourceMap.entries()).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
    color: getSourceColor(name),
  }));

  // Calculate leads over time (last 6 months)
  const leadsOverTime = calculateLeadsOverTime(leads);

  return {
    totalLeads,
    hotLeads,
    demosScheduled,
    admissions,
    conversionRate,
    leadsOverTime,
    leadsByStatus,
    leadSources,
  };
};

// Helper function to get color for source
const getSourceColor = (source: string): string => {
  const colors: Record<string, string> = {
    whatsapp: '#25D366',
    facebook: '#1877F2',
    instagram: '#E4405F',
    google: '#4285F4',
    referral: '#FF7B00',
    direct: '#2C2C2C',
  };
  return colors[source.toLowerCase()] || '#6B7280';
};

// Calculate leads over time
const calculateLeadsOverTime = (leads: Lead[]): { month: string; leads: number }[] => {
  const now = new Date();
  const months = [];

  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthName = date.toLocaleString('default', { month: 'short' });

    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

    const leadsInMonth = leads.filter(lead => {
      if (!lead.created_at) return false;
      const createdDate = new Date(lead.created_at);
      return createdDate >= monthStart && createdDate <= monthEnd;
    }).length;

    months.push({ month: monthName, leads: leadsInMonth });
  }

  return months;
};

// Subscribe to real-time changes for leads
export const subscribeToLeads = (callback: (payload: any) => void) => {
  const subscription = supabase
    .channel('leads-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, callback)
    .subscribe();

  return subscription;
};

// Subscribe to real-time changes for messages
export const subscribeToMessages = (leadId: string, callback: (payload: any) => void) => {
  const subscription = supabase
    .channel(`messages-${leadId}`)
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `lead_id=eq.${leadId}` },
      callback
    )
    .subscribe();

  return subscription;
};
