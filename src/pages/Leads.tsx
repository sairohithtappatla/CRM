import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LeadWithDetails } from "@/lib/supabase-types";
import { fetchLeads, formatRelativeTime } from "@/lib/supabase-api";
import { Phone, MessageCircle, Mail, Download, Filter, Search } from "lucide-react";
import { useState, useEffect } from "react";
import LeadDrawer from "@/components/LeadDrawer";
import { toast } from "@/hooks/use-toast";

const Leads = () => {
  const [leads, setLeads] = useState<LeadWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedLead, setSelectedLead] = useState<LeadWithDetails | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const loadLeads = async () => {
      try {
        const data = await fetchLeads();
        setLeads(data);
      } catch (error) {
        console.error('Error loading leads:', error);
        toast({
          title: "Error",
          description: "Failed to load leads. Please refresh the page.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadLeads();
  }, []);

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

  const filteredLeads = leads.filter((lead) => {
    const matchesSearch =
      (lead.parent_name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (lead.student_name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (lead.phone || '').includes(searchQuery);

    const matchesStatus = statusFilter === "ALL" || lead.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleLeadClick = (lead: LeadWithDetails) => {
    setSelectedLead(lead);
    setDrawerOpen(true);
  };

  const handleCall = (e: React.MouseEvent, lead: LeadWithDetails) => {
    e.stopPropagation();
    toast({
      title: "📞 Initiating Call",
      description: `Calling ${lead.parent_name} at ${lead.phone}`,
    });
  };

  const handleMessage = (e: React.MouseEvent, lead: LeadWithDetails) => {
    e.stopPropagation();
    toast({
      title: "💬 Opening WhatsApp",
      description: `Starting chat with ${lead.parent_name}`,
    });
  };

  const handleExport = () => {
    toast({
      title: "📥 Exporting Data",
      description: `Exporting ${filteredLeads.length} leads to CSV`,
    });
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col w-full">
          <Navbar />
          <main className="flex-1 p-4 sm:p-6 bg-subbuGray/30 dark:bg-background overflow-auto">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-subbuText">All Leads</h2>
              <p className="text-muted-foreground">Manage and track all your leads</p>
            </div>

            {/* Filters */}
            <Card className="mb-6 bg-white dark:bg-card">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name, student, or phone..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-48">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Status</SelectItem>
                      <SelectItem value="HOT">HOT</SelectItem>
                      <SelectItem value="WARM">WARM</SelectItem>
                      <SelectItem value="COLD">COLD</SelectItem>
                      <SelectItem value="FOLLOW-UP">FOLLOW-UP</SelectItem>
                      <SelectItem value="ADMITTED">ADMITTED</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" onClick={handleExport} className="hover:bg-gray-100 dark:hover:bg-muted">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Leads Table */}
            <Card className="bg-white dark:bg-card">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-subbuText">
                  Leads ({filteredLeads.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent dark:hover:bg-transparent border-b dark:border-gray-700">
                        <TableHead className="text-subbuText font-semibold">Parent Name</TableHead>
                        <TableHead className="text-subbuText font-semibold">Student</TableHead>
                        <TableHead className="text-subbuText font-semibold">Class</TableHead>
                        <TableHead className="text-subbuText font-semibold">Status</TableHead>
                        <TableHead className="text-subbuText font-semibold">Score</TableHead>
                        <TableHead className="text-subbuText font-semibold">Source</TableHead>
                        <TableHead className="text-subbuText font-semibold">Contact</TableHead>
                        <TableHead className="text-subbuText font-semibold">Last Contact</TableHead>
                        <TableHead className="text-subbuText font-semibold text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLeads.length > 0 ? (
                        filteredLeads.map((lead) => (
                          <TableRow
                            key={lead.id}
                            className="cursor-pointer hover:bg-gray-50 dark:hover:bg-muted/30 border-b dark:border-gray-700"
                            onClick={() => handleLeadClick(lead)}
                          >
                            <TableCell className="font-medium text-subbuText">{lead.parent_name || 'N/A'}</TableCell>
                            <TableCell className="text-subbuText">{lead.student_name || 'N/A'}</TableCell>
                            <TableCell className="text-subbuText">{lead.class || 'N/A'}</TableCell>
                            <TableCell>
                              <Badge className={getStatusColor(lead.status || 'WARM')}>{lead.status || 'WARM'}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full transition-all ${(lead.score || 0) >= 80
                                        ? "bg-subbuRed"
                                        : (lead.score || 0) >= 60
                                          ? "bg-subbuYellow"
                                          : "bg-status-cold"
                                      }`}
                                    style={{ width: `${lead.score || 0}%` }}
                                  />
                                </div>
                                <span className="text-sm font-medium text-subbuText">{lead.score || 0}%</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-subbuText border-gray-300 dark:border-gray-600">
                                {lead.ref_source?.charAt(0).toUpperCase() + (lead.ref_source?.slice(1) || '') || 'Unknown'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{lead.phone || 'N/A'}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{formatRelativeTime(lead.last_contact_at)}</TableCell>
                            <TableCell>
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => handleCall(e, lead)}
                                  className="hover:bg-subbuRed hover:text-white dark:hover:bg-subbuRed transition-all"
                                  title="Call"
                                >
                                  <Phone className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => handleMessage(e, lead)}
                                  className="hover:bg-subbuGreen hover:text-white dark:hover:bg-subbuGreen transition-all"
                                  title="WhatsApp"
                                >
                                  <MessageCircle className="h-4 w-4" />
                                </Button>
                                </div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                            No leads found matching your criteria
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </main>
        </div>
      </div>

      {selectedLead && (
        <LeadDrawer lead={selectedLead} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      )}
    </SidebarProvider>
  );
};

export default Leads;