import { useState, useEffect } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import Navbar from "@/components/Navbar";
import LeadCard from "@/components/LeadCard";
import LeadDrawer from "@/components/LeadDrawer";
import DashboardStats from "@/components/DashboardStats";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "@/hooks/use-toast";
import { Loader2, ChevronDown, ChevronUp ,Plus,Minus} from "lucide-react";
import { Button } from "@/components/ui/button";

interface Lead {
  id: string;
  parent_name: string | null;
  student_name: string | null;
  phone: string | null;
  class: string | null;
  status: 'HOT' | 'WARM' | 'COLD' | 'FOLLOW-UP' | 'ADMITTED';
  score: number;
  engagement_score: number | null;  // ✅ ADD THIS LINE
  last_contact_at: string;
  language_pref: 'en' | 'hi' | 'te';
  organization_id: string | null;
}
const Dashboard = () => {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsedColumns, setCollapsedColumns] = useState<Record<string, boolean>>({
    HOT: false,
    WARM: false,
    COLD: false,
    "FOLLOW-UP": false,
    ADMITTED: false,
  });

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('last_contact_at', { ascending: false });

      if (error) throw error;

      setLeads(data || []);
    } catch (error) {
      console.error('Error fetching leads:', error);
      toast({
        title: "❌ Error",
        description: "Failed to load leads",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const leadsByStatus = {
    HOT: leads.filter((l) => l.status === "HOT"),
    WARM: leads.filter((l) => l.status === "WARM"),
    COLD: leads.filter((l) => l.status === "COLD"),
    "FOLLOW-UP": leads.filter((l) => l.status === "FOLLOW-UP"),
    ADMITTED: leads.filter((l) => l.status === "ADMITTED"),
  };

  const handleLeadClick = (lead: Lead) => {
    setSelectedLead(lead);
    setDrawerOpen(true);
  };

  const toggleColumn = (status: string) => {
    setCollapsedColumns(prev => ({
      ...prev,
      [status]: !prev[status]
    }));
  };

  const getColumnColor = (status: string) => {
    switch (status) {
      case "HOT":
        return "border-status-hot";
      case "WARM":
        return "border-status-warm";
      case "COLD":
        return "border-status-cold";
      case "FOLLOW-UP":
        return "border-status-followup";
      case "ADMITTED":
        return "border-status-admitted";
      default:
        return "border-border";
    }
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col w-full">
          <Navbar />
          <main className="flex-1 p-6 bg-secondary overflow-auto">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-foreground">WhatsApp Lead Dashboard</h2>
              <p className="text-muted-foreground">Manage and track your WhatsApp leads</p>
            </div>

            <DashboardStats leads={leads} />

            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : leads.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <p className="text-lg font-medium text-muted-foreground">No leads yet</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Start receiving leads from WhatsApp to see them here
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mt-6">
                {Object.entries(leadsByStatus).map(([status, statusLeads]) => (
                  <div key={status} className="space-y-3">
                    <div className={`border-t-4 ${getColumnColor(status)} bg-card rounded-lg p-3`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-foreground">{status}</h3>
                          <span className="text-sm text-muted-foreground bg-secondary px-2 py-1 rounded">
                            {statusLeads.length}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => toggleColumn(status)}
                        >
                          {collapsedColumns[status] ? (
                            <Plus className="h-4 w-4" />
                          ) : (
                            <Minus className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    {!collapsedColumns[status] && (
                      <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                        {statusLeads.length === 0 ? (
                          <div className="text-center py-8 text-sm text-muted-foreground">
                            No {status.toLowerCase()} leads
                          </div>
                        ) : (
                          statusLeads.map((lead) => (
                            <LeadCard
                              key={lead.id}
                              lead={lead}
                              onClick={() => handleLeadClick(lead)}
                            />
                          ))
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </main>
        </div>
      </div>

      <LeadDrawer
        lead={selectedLead}
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          fetchLeads();
        }}
      />
    </SidebarProvider>
  );
};

export default Dashboard;
