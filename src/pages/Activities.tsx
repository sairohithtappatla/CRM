import { useState, useEffect } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import Navbar from "@/components/Navbar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from "@/components/ui/accordion";
import {
  Phone,
  MessageCircle,
  Loader2,
  Users,
  TrendingUp,
  Flame
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import LeadDrawer from "@/components/LeadDrawer";

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
  engagement_score: number | null;
}

interface Message {
  id: number;
  lead_id: string;
  sender: 'user' | 'admin';
  message: string;
  timestamp: string;
}

interface LeadWithLastMessage extends Lead {
  lastMessage?: Message;
}

const Activities = () => {
  const [leads, setLeads] = useState<LeadWithLastMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    fetchLeadsWithMessages();
  }, []);

  const fetchLeadsWithMessages = async () => {
    try {
      setLoading(true);

      const { data: leadsData, error: leadsError } = await supabase
        .from('leads')
        .select('*')
        .order('last_contact_at', { ascending: false });

      if (leadsError) throw leadsError;

      const leadsWithMessages = await Promise.all(
        (leadsData || []).map(async (lead) => {
          const { data: messages } = await supabase
            .from('messages')
            .select('*')
            .eq('lead_id', lead.id)
            .order('timestamp', { ascending: false })
            .limit(1);

          return {
            ...lead,
            lastMessage: messages?.[0] || undefined,
          };
        })
      );

      setLeads(leadsWithMessages);
    } catch (error) {
      console.error('Error fetching activities:', error);
      toast({
        title: "❌ Error",
        description: "Failed to load activities",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLeadClick = (lead: Lead) => {
    setSelectedLead(lead);
    setDrawerOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "HOT":
        return "bg-status-hot text-white";
      case "WARM":
        return "bg-status-warm text-white";
      case "COLD":
        return "bg-status-cold text-white";
      case "FOLLOW-UP":
        return "bg-status-followup text-white";
      case "ADMITTED":
        return "bg-status-admitted text-white";
      default:
        return "bg-muted";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "HOT":
        return <Flame className="h-4 w-4" />;
      case "WARM":
        return <TrendingUp className="h-4 w-4" />;
      case "COLD":
        return <Users className="h-4 w-4" />;
      default:
        return <MessageCircle className="h-4 w-4" />;
    }
  };

  const formatTime = (timestamp: string) => {
    try {
      return format(parseISO(timestamp), 'MMM dd, h:mm a');
    } catch {
      return timestamp;
    }
  };

  const groupedLeads = {
    HOT: leads.filter((l) => l.status === "HOT"),
    WARM: leads.filter((l) => l.status === "WARM"),
    COLD: leads.filter((l) => l.status === "COLD"),
    "FOLLOW-UP": leads.filter((l) => l.status === "FOLLOW-UP"),
    ADMITTED: leads.filter((l) => l.status === "ADMITTED"),
  };

  const stats = {
    total: leads.length,
    hot: groupedLeads.HOT.length,
    warm: groupedLeads.WARM.length,
    cold: groupedLeads.COLD.length,
    followUp: groupedLeads["FOLLOW-UP"].length,
    admitted: groupedLeads.ADMITTED.length,
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col w-full">
          <Navbar />
          <main className="flex-1 p-6 bg-secondary overflow-auto">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-foreground">Recent Activities</h2>
              <p className="text-muted-foreground">Track all interactions with your leads</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold">{stats.total}</div>
                  <p className="text-xs text-muted-foreground">Total Leads</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-status-hot">{stats.hot}</div>
                  <p className="text-xs text-muted-foreground">HOT</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-status-warm">{stats.warm}</div>
                  <p className="text-xs text-muted-foreground">WARM</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-status-cold">{stats.cold}</div>
                  <p className="text-xs text-muted-foreground">COLD</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-status-followup">{stats.followUp}</div>
                  <p className="text-xs text-muted-foreground">FOLLOW-UP</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-status-admitted">{stats.admitted}</div>
                  <p className="text-xs text-muted-foreground">ADMITTED</p>
                </CardContent>
              </Card>
            </div>

            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : leads.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <MessageCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-lg font-medium text-muted-foreground">No activities yet</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Start engaging with leads to see activities here
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Accordion type="multiple" className="space-y-4">
                {Object.entries(groupedLeads).map(([status, statusLeads]) => {
                  if (statusLeads.length === 0) return null;

                  return (
                    <AccordionItem
                      key={status}
                      value={status}
                      className="border rounded-lg bg-card"
                    >
                      <AccordionTrigger className="px-6 py-4 hover:no-underline">
                        <div className="flex items-center gap-3 w-full">
                          <div className={`p-2 rounded-lg ${getStatusColor(status)}`}>
                            {getStatusIcon(status)}
                          </div>
                          <div className="flex-1 text-left">
                            <h3 className="font-semibold text-lg">{status}</h3>
                            <p className="text-sm text-muted-foreground">
                              {statusLeads.length} {statusLeads.length === 1 ? 'lead' : 'leads'}
                            </p>
                          </div>
                          <Badge className={getStatusColor(status)}>
                            {statusLeads.length}
                          </Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-6 pb-4">
                        <div className="space-y-3 pt-2">
                          {statusLeads.map((lead) => (
                            <Card
                              key={lead.id}
                              className="hover:shadow-md transition-shadow cursor-pointer"
                              onClick={() => handleLeadClick(lead)}
                            >
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                      <h4 className="font-semibold hover:text-primary transition-colors">
                                        {lead.parent_name || 'Unknown Parent'}
                                      </h4>
                                      <Badge variant="outline" className="text-xs">
                                        Score: {lead.score}%
                                      </Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground mb-2">
                                      Student: {lead.student_name || 'N/A'} • Class {lead.class || 'N/A'}
                                    </p>

                                    {lead.lastMessage && (
                                      <div className="bg-muted/50 rounded-lg p-3 mt-3">
                                        <div className="flex items-start gap-2">
                                          <MessageCircle className="h-4 w-4 mt-0.5 text-muted-foreground" />
                                          <div className="flex-1">
                                            <p className="text-sm text-foreground mb-1 line-clamp-2">
                                              {lead.lastMessage.message}
                                            </p>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                              <span className="font-medium">
                                                {lead.lastMessage.sender === 'admin' ? 'You' : 'Customer'}
                                              </span>
                                              <span>•</span>
                                              <span>{formatTime(lead.lastMessage.timestamp)}</span>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  <div className="flex gap-2 ml-4">
                                    {lead.phone && (
                                      <>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            window.location.href = `tel:${lead.phone}`;
                                          }}
                                          className="p-2 rounded-lg hover:bg-muted transition-colors"
                                          title="Call"
                                        >
                                          <Phone className="h-4 w-4" />
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const phone = lead.phone?.replace(/\D/g, '');
                                            window.open(`https://wa.me/${phone}`, '_blank');
                                          }}
                                          className="p-2 rounded-lg hover:bg-muted transition-colors"
                                          title="WhatsApp"
                                        >
                                          <MessageCircle className="h-4 w-4" />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            )}
          </main>
        </div>
      </div>

      {/* Lead Drawer for Chat */}
      <LeadDrawer
        lead={selectedLead}
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          fetchLeadsWithMessages();
        }}
      />
    </SidebarProvider>
  );
};

export default Activities;