import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, MessageCircle, Calendar, Activity } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface Lead {
  id: string;
  parent_name: string | null;
  student_name: string | null;
  phone: string | null;
  class: string | null;
  status: 'HOT' | 'WARM' | 'COLD' | 'FOLLOW-UP' | 'ADMITTED';
  score: number;
  last_contact_at: string;
  language_pref: 'en' | 'hi' | 'te';
  organization_id: string | null;
}

interface InsightsBoxProps {
  lead: Lead;
}

const InsightsBox = ({ lead }: InsightsBoxProps) => {
  const [messageCount, setMessageCount] = useState(0);
  const [paymentTotal, setPaymentTotal] = useState(0);
  const [lastInteractionDays, setLastInteractionDays] = useState(0);

  useEffect(() => {
    if (lead) {
      fetchInsights();
    }
  }, [lead]);

  const fetchInsights = async () => {
    try {
      // Fetch message count
      const { count: msgCount } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('lead_id', lead.id);

      setMessageCount(msgCount || 0);

      // Fetch payment total
      const { data: payments } = await supabase
        .from('payments')
        .select('amount')
        .eq('lead_id', lead.id)
        .eq('status', 'paid');

      const total = payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
      setPaymentTotal(total);

      // Calculate last interaction days
      const lastContact = new Date(lead.last_contact_at);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - lastContact.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      setLastInteractionDays(diffDays);
    } catch (error) {
      console.error('Error fetching insights:', error);
    }
  };

  const getEngagementLevel = () => {
    if (lead.score >= 80) return { label: 'High', color: 'bg-status-hot' };
    if (lead.score >= 60) return { label: 'Medium', color: 'bg-status-warm' };
    return { label: 'Low', color: 'bg-status-cold' };
  };

  const engagement = getEngagementLevel();

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const insights = [
    {
      icon: Activity,
      label: "Engagement Level",
      value: engagement.label,
      badge: true,
      badgeColor: engagement.color,
    },
    {
      icon: TrendingUp,
      label: "Lead Score",
      value: `${lead.score}%`,
      badge: false,
    },
    {
      icon: MessageCircle,
      label: "Total Messages",
      value: messageCount.toString(),
      badge: false,
    },
    {
      icon: Calendar,
      label: "Last Contact",
      value: lastInteractionDays === 0 ? 'Today' : `${lastInteractionDays}d ago`,
      badge: false,
    },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-6">
          <h3 className="font-semibold text-lg mb-4">Lead Insights</h3>
          <div className="grid grid-cols-2 gap-4">
            {insights.map((insight, index) => {
              const Icon = insight.icon;
              return (
                <div key={index} className="space-y-2">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Icon className="h-4 w-4" />
                    <span className="text-sm">{insight.label}</span>
                  </div>
                  {insight.badge ? (
                    <Badge className={`${insight.badgeColor} text-white`}>
                      {insight.value}
                    </Badge>
                  ) : (
                    <p className="text-lg font-semibold">{insight.value}</p>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <h3 className="font-semibold text-lg mb-4">Payment Summary</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Total Paid</span>
              <span className="text-xl font-bold text-status-admitted">
                {formatAmount(paymentTotal)}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Payment Status</span>
              <Badge variant="outline">
                {paymentTotal > 0 ? 'Active' : 'No Payments'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <h3 className="font-semibold text-lg mb-4">Quick Info</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Class</span>
              <span className="font-medium">{lead.class || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Language</span>
              <span className="font-medium">
                {lead.language_pref === 'en' ? 'English' :
                  lead.language_pref === 'hi' ? 'Hindi' : 'Telugu'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge
                className={
                  lead.status === 'HOT' ? 'bg-status-hot text-white' :
                    lead.status === 'WARM' ? 'bg-status-warm text-white' :
                      lead.status === 'COLD' ? 'bg-status-cold text-white' :
                        lead.status === 'FOLLOW-UP' ? 'bg-status-followup text-white' :
                          'bg-status-admitted text-white'
                }
              >
                {lead.status}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-muted/50">
        <CardContent className="p-6">
          <h3 className="font-semibold text-lg mb-3">AI Recommendations</h3>
          <div className="space-y-3 text-sm">
            {lead.score >= 80 && (
              <div className="flex items-start gap-2">
                <span className="text-status-hot">🔥</span>
                <p>High engagement! Consider scheduling a follow-up call within 24 hours.</p>
              </div>
            )}
            {lastInteractionDays > 7 && (
              <div className="flex items-start gap-2">
                <span className="text-status-warm">⏰</span>
                <p>It's been {lastInteractionDays} days since last contact. Send a re-engagement message.</p>
              </div>
            )}
            {messageCount > 10 && paymentTotal === 0 && (
              <div className="flex items-start gap-2">
                <span className="text-status-followup">💰</span>
                <p>High message count but no payments. Discuss payment plans.</p>
              </div>
            )}
            {lead.score < 40 && (
              <div className="flex items-start gap-2">
                <span className="text-status-cold">❄️</span>
                <p>Low engagement. Try a different communication approach or offer a demo class.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default InsightsBox;
