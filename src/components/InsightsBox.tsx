import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, MessageCircle, Calendar, Activity } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";

interface Lead {
  id: string;
  parent_name: string | null;
  student_name: string | null;
  phone: string | null;
  class: string | null;
  status: 'HOT' | 'WARM' | 'COLD' | 'FOLLOW-UP' | 'ADMITTED';
  score: number | null;
  engagement_score: number | null;
  last_contact_at: string;
  language_pref: 'en' | 'hi' | 'te';
  organization_id: string | null;
}

interface InsightsBoxProps {
  lead: Lead;
}

interface LeadInsights {
  message_count: number;
  payment_total: number;
  days_since_contact: number;
  ai_summary: string | null;
  next_action: string | null;
  summary_updated_at: string | null;
}

const InsightsBox = ({ lead }: InsightsBoxProps) => {
  const [insights, setInsights] = useState<LeadInsights | null>(null);
  const [loading, setLoading] = useState(true);

  // ✅ FIX 6: Depend only on lead.id, not entire object
  useEffect(() => {
    if (lead?.id) {
      fetchInsights();
    }
  }, [lead.id]);

  // ✅ FIX 1: Single RPC call instead of 2 queries
  // ✅ FIX 4: Server-side time calculation
  // ✅ FIX 5: Null-safe with COALESCE in SQL
  const fetchInsights = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .rpc('get_lead_insights', { p_lead_id: lead.id });

      if (error) throw error;

      setInsights(data as LeadInsights);
    } catch (error) {
      console.error('Error fetching insights:', error);
      // Set safe defaults on error
      setInsights({
        message_count: 0,
        payment_total: 0,
        days_since_contact: 0,
        ai_summary: null,
        next_action: null,
        summary_updated_at: null,
      });
    } finally {
      setLoading(false);
    }
  };

  const getEngagementLevel = () => {
    const engagementScore = lead.engagement_score ?? lead.score ?? 0;
    if (engagementScore >= 80) return { label: 'High', color: 'bg-status-hot' };
    if (engagementScore >= 60) return { label: 'Medium', color: 'bg-status-warm' };
    return { label: 'Low', color: 'bg-status-cold' };
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const engagement = getEngagementLevel();

  // ✅ FIX 3: Use useMemo to prevent recreation on every render
  const insightCards = useMemo(() => {
    const messageCount = insights?.message_count ?? 0;
    const daysSinceContact = insights?.days_since_contact ?? 0;
    const engagementScore = lead.engagement_score ?? lead.score ?? 0;

    return [
      {
        icon: Activity,
        label: "Engagement Level",
        value: engagement.label,
        badge: true,
        badgeColor: engagement.color,
      },
      {
        icon: TrendingUp,
        label: "Engagement Score",
        value: `${Math.round(engagementScore)}%`,
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
        value: daysSinceContact === 0 ? 'Today' : `${daysSinceContact}d ago`,
        badge: false,
      },
    ];
  }, [insights, lead.engagement_score, lead.score, engagement]);

  // ✅ FIX 2: Loading skeleton
  if (loading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-6 w-32 mb-4" />
            <div className="grid grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-16" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-6 w-32 mb-4" />
            <Skeleton className="h-8 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const messageCount = insights?.message_count ?? 0;
  const paymentTotal = insights?.payment_total ?? 0;
  const daysSinceContact = insights?.days_since_contact ?? 0;
  const engagementScore = lead.engagement_score ?? lead.score ?? 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-6">
          <h3 className="font-semibold text-lg mb-4">Lead Insights</h3>
          <div className="grid grid-cols-2 gap-4">
            {insightCards.map((insight, index) => {
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
          <h3 className="font-semibold text-lg mb-3">AI Summary & Recommendations</h3>
          <div className="space-y-3 text-sm">
            {/* AI-Generated Summary from Database */}
            {insights?.ai_summary && (
              <div className="flex items-start gap-2 p-3 bg-background rounded-md border border-border">
                <span className="text-xl">🤖</span>
                <div className="flex-1">
                  <p className="font-medium mb-1">AI Analysis:</p>
                  <p className="text-muted-foreground leading-relaxed">{insights.ai_summary}</p>
                </div>
              </div>
            )}

            {/* Next Action from AI */}
            {insights?.next_action && (
              <div className="flex items-start gap-2 p-3 bg-primary/5 rounded-md border border-primary/20">
                <span className="text-xl">🎯</span>
                <div className="flex-1">
                  <p className="font-medium mb-1">Recommended Action:</p>
                  <p className="text-foreground leading-relaxed">{insights.next_action}</p>
                </div>
              </div>
            )}

            {/* Rule-based recommendations (only show if no AI summary) */}
            {!insights?.ai_summary && (
              <>
                {engagementScore >= 80 && (
                  <div className="flex items-start gap-2">
                    <span className="text-status-hot">🔥</span>
                    <p>High engagement! Consider scheduling a follow-up call within 24 hours.</p>
                  </div>
                )}
                {daysSinceContact > 7 && (
                  <div className="flex items-start gap-2">
                    <span className="text-status-warm">⏰</span>
                    <p>It's been {daysSinceContact} days since last contact. Send a re-engagement message.</p>
                  </div>
                )}
                {messageCount > 10 && paymentTotal === 0 && (
                  <div className="flex items-start gap-2">
                    <span className="text-status-followup">💰</span>
                    <p>High message count but no payments. Discuss payment plans.</p>
                  </div>
                )}
                {engagementScore < 40 && (
                  <div className="flex items-start gap-2">
                    <span className="text-status-cold">❄️</span>
                    <p>Low engagement. Try a different communication approach or offer a demo class.</p>
                  </div>
                )}
              </>
            )}

            {/* Show message if no AI summary generated yet */}
            {!insights?.ai_summary && !insights?.next_action && (
              <div className="flex items-start gap-2 p-3 bg-muted rounded-md">
                <span className="text-xl">⏳</span>
                <p className="text-muted-foreground">AI analysis will be generated after the conversation session ends (15 min of inactivity).</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default InsightsBox;
