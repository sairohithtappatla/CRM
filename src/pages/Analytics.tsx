import { useState, useEffect } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import Navbar from "@/components/Navbar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  Legend,
  Cell,
} from "recharts";
import {
  TrendingUp,
  Users,
  Calendar,
  Flame,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import AnimatedStatCard from "@/components/AnimatedStatCard";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

interface Lead {
  id: string;
  status: "HOT" | "WARM" | "COLD" | "FOLLOW-UP" | "ADMITTED";
  score: number;
  created_at: string;
}

const Analytics = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("leads")
        .select("id, status, score, created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      console.error("Error fetching analytics:", error);
      toast({
        title: "❌ Error",
        description: "Failed to load analytics",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const analyticsData = {
    totalLeads: leads.length,
    hotLeads: leads.filter((l) => l.status === "HOT").length,
    demosScheduled: Math.floor(leads.length * 0.4),
    admissions: leads.filter((l) => l.status === "ADMITTED").length,
  };

  const leadsByStatus = [
    {
      name: "HOT",
      count: leads.filter((l) => l.status === "HOT").length,
      color: "hsl(var(--status-hot))",
    },
    {
      name: "WARM",
      count: leads.filter((l) => l.status === "WARM").length,
      color: "hsl(var(--status-warm))",
    },
    {
      name: "COLD",
      count: leads.filter((l) => l.status === "COLD").length,
      color: "hsl(var(--status-cold))",
    },
    {
      name: "FOLLOW-UP",
      count: leads.filter((l) => l.status === "FOLLOW-UP").length,
      color: "hsl(var(--status-followup))",
    },
    {
      name: "ADMITTED",
      count: leads.filter((l) => l.status === "ADMITTED").length,
      color: "hsl(var(--status-admitted))",
    },
  ];

  // Prepare monthly data
  const getMonthlyData = () => {
    const monthly: Record<
      string,
      { admissions: number; totalLeads: number; conversionRate: number }
    > = {};

    leads.forEach((lead) => {
      const date = new Date(lead.created_at);
      const monthYear = date.toLocaleString("default", {
        month: "short",
        year: "numeric",
      });
      if (!monthly[monthYear]) {
        monthly[monthYear] = {
          admissions: 0,
          totalLeads: 0,
          conversionRate: 0,
        };
      }
      monthly[monthYear].totalLeads += 1;
      if (lead.status === "ADMITTED") monthly[monthYear].admissions += 1;
    });

    Object.keys(monthly).forEach((m) => {
      const d = monthly[m];
      d.conversionRate =
        d.totalLeads > 0 ? Math.round((d.admissions / d.totalLeads) * 100) : 0;
    });

    return Object.entries(monthly)
      .map(([month, data]) => ({
        month,
        ...data,
      }))
      .sort(
        (a, b) =>
          new Date(a.month).getTime() - new Date(b.month).getTime()
      )
      .slice(-6);
  };

  const monthlyData = getMonthlyData();

  const calculateGrowthTrend = () => {
    if (monthlyData.length < 2) return { percentage: 0, isPositive: true };
    const current = monthlyData[monthlyData.length - 1].admissions;
    const previous = monthlyData[monthlyData.length - 2].admissions;
    if (previous === 0) return { percentage: 100, isPositive: true };
    const growth = ((current - previous) / previous) * 100;
    return {
      percentage: Math.abs(Math.round(growth)),
      isPositive: growth >= 0,
    };
  };

  const growthTrend = calculateGrowthTrend();

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-card border border-border rounded-lg shadow-lg p-3">
          <p className="font-semibold text-foreground mb-2">{data.month}</p>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Admissions:</span>
              <span className="font-bold text-status-admitted">
                {data.admissions}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Leads:</span>
              <span className="font-medium">{data.totalLeads}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Conversion:</span>
              <span className="font-bold text-status-hot">
                {data.conversionRate}%
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <SidebarProvider>
        <div className="flex min-h-screen w-full">
          <AppSidebar />
          <div className="flex-1 flex flex-col">
            <Navbar />
            <main className="flex-1 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </main>
          </div>
        </div>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <Navbar />
          <main className="flex-1 p-4 sm:p-6 bg-secondary overflow-auto">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-foreground">
                Analytics Dashboard
              </h2>
              <p className="text-muted-foreground">
                Track your WhatsApp lead performance metrics
              </p>
            </div>

            {/* Top Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <AnimatedStatCard
                title="Total Leads"
                value={analyticsData.totalLeads}
                icon={<Users className="h-5 w-5 text-muted-foreground" />}
                trend={12}
                delay={0}
                className="bg-card border border-border"
              />
              <AnimatedStatCard
                title="Hot Leads"
                value={analyticsData.hotLeads}
                icon={<Flame className="h-5 w-5 text-status-hot" />}
                delay={0.1}
                className="bg-card border border-border"
              />
              <AnimatedStatCard
                title="Demos Scheduled"
                value={analyticsData.demosScheduled}
                icon={<Calendar className="h-5 w-5 text-muted-foreground" />}
                delay={0.2}
                className="bg-card border border-border"
              />
              <AnimatedStatCard
                title="Admissions"
                value={analyticsData.admissions}
                icon={<TrendingUp className="h-5 w-5 text-status-admitted" />}
                delay={0.3}
                className="bg-card border border-border"
              />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Status Distribution */}
              <Card className="flex flex-col">
                <CardHeader>
                  <CardTitle>Lead Status Distribution</CardTitle>
                </CardHeader>
                <CardContent className="flex-1">
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart
                      data={leadsByStatus}
                      margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="hsl(var(--border))"
                      />
                      <XAxis
                        dataKey="name"
                        stroke="hsl(var(--muted-foreground))"
                        angle={-45}
                        textAnchor="end"
                        height={80}
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis
                        stroke="hsl(var(--muted-foreground))"
                        tick={{ fontSize: 12 }}
                        allowDecimals={false}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      <Bar
                        dataKey="count"
                        radius={[8, 8, 0, 0]}
                        maxBarSize={60}
                      >
                        {leadsByStatus.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.color}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Monthly Admissions Growth */}
              <Card className="flex flex-col">
                <CardHeader className="pb-2">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                        📈 Monthly Admissions Growth
                        <Badge variant="outline" className="ml-1 sm:ml-2">
                          Last 6 Months
                        </Badge>
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        WhatsApp leads conversion tracking
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {growthTrend.isPositive ? (
                        <ArrowUpRight className="h-5 w-5 text-green-500" />
                      ) : (
                        <ArrowDownRight className="h-5 w-5 text-red-500" />
                      )}
                      <span
                        className={`text-2xl font-bold ${
                          growthTrend.isPositive
                            ? "text-green-500"
                            : "text-red-500"
                        }`}
                      >
                        {growthTrend.isPositive ? "+" : "-"}
                        {growthTrend.percentage}%
                      </span>
                      <span className="text-sm text-muted-foreground whitespace-nowrap">
                        vs last month
                      </span>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="flex-1">
                  <ResponsiveContainer width="100%" height={320}>
                    <AreaChart
                      data={monthlyData}
                      margin={{ top: 20, right: 30, left: 10, bottom: 20 }}
                    >
                      <defs>
                        <linearGradient
                          id="admissionsGradient"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="hsl(var(--status-admitted))"
                            stopOpacity={0.8}
                          />
                          <stop
                            offset="95%"
                            stopColor="hsl(var(--status-admitted))"
                            stopOpacity={0.1}
                          />
                        </linearGradient>
                        <linearGradient
                          id="leadsGradient"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="hsl(var(--primary))"
                            stopOpacity={0.6}
                          />
                          <stop
                            offset="95%"
                            stopColor="hsl(var(--primary))"
                            stopOpacity={0.05}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="hsl(var(--border))"
                      />
                      <XAxis
                        dataKey="month"
                        stroke="hsl(var(--muted-foreground))"
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis
                        stroke="hsl(var(--muted-foreground))"
                        tick={{ fontSize: 12 }}
                        allowDecimals={false}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="totalLeads"
                        stroke="hsl(var(--primary))"
                        fill="url(#leadsGradient)"
                        strokeWidth={2}
                        name="Total Leads"
                      />
                      <Area
                        type="monotone"
                        dataKey="admissions"
                        stroke="hsl(var(--status-admitted))"
                        fill="url(#admissionsGradient)"
                        strokeWidth={3}
                        name="Admissions"
                      />
                    </AreaChart>
                  </ResponsiveContainer>

                  {/* Monthly Insights */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                    <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
                      <CardContent className="p-4">
                        <p className="text-xs text-green-700 dark:text-green-300 font-medium">
                          Best Month
                        </p>
                        <h3 className="text-xl font-bold text-green-900 dark:text-green-100">
                          {monthlyData.length > 0
                            ? monthlyData.reduce((max, item) =>
                                item.admissions > max.admissions
                                  ? item
                                  : max
                              ).month
                            : "N/A"}
                        </h3>
                        <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                          {monthlyData.length > 0
                            ? `${
                                monthlyData.reduce((max, item) =>
                                  item.admissions > max.admissions
                                    ? item
                                    : max
                                ).admissions
                              } admissions`
                            : "0 admissions"}
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
                      <CardContent className="p-4">
                        <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                          Avg. Conversion
                        </p>
                        <h3 className="text-xl font-bold text-blue-900 dark:text-blue-100">
                          {monthlyData.length > 0
                            ? Math.round(
                                monthlyData.reduce(
                                  (sum, item) => sum + item.conversionRate,
                                  0
                                ) / monthlyData.length
                              )
                            : 0}
                          %
                        </h3>
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                          Last 6 months average
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
                      <CardContent className="p-4">
                        <p className="text-xs text-purple-700 dark:text-purple-300 font-medium">
                          Total Admitted
                        </p>
                        <h3 className="text-xl font-bold text-purple-900 dark:text-purple-100">
                          {monthlyData.reduce(
                            (sum, item) => sum + item.admissions,
                            0
                          )}
                        </h3>
                        <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                          In last 6 months
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Bottom Insights */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
              <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
                <CardContent className="p-4">
                  <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                    Conversion Rate
                  </p>
                  <h3 className="text-3xl font-bold text-blue-900 dark:text-blue-100">
                    {leads.length > 0
                      ? Math.round(
                          (analyticsData.admissions / leads.length) * 100
                        )
                      : 0}
                    %
                  </h3>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    {analyticsData.admissions} of {leads.length} admitted
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
                <CardContent className="p-4">
                  <p className="text-sm text-green-700 dark:text-green-300 font-medium">
                    Avg. Response Time
                  </p>
                  <h3 className="text-3xl font-bold text-green-900 dark:text-green-100">
                    2.5h
                  </h3>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                    First contact time
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
                <CardContent className="p-4">
                  <p className="text-sm text-purple-700 dark:text-purple-300 font-medium">
                    Success Rate
                  </p>
                  <h3 className="text-3xl font-bold text-purple-900 dark:text-purple-100">
                    77%
                  </h3>
                  <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                    Demo to admission
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800">
                <CardContent className="p-4">
                  <p className="text-sm text-orange-700 dark:text-orange-300 font-medium">
                    Active Leads
                  </p>
                  <h3 className="text-3xl font-bold text-orange-900 dark:text-orange-100">
                    {analyticsData.hotLeads +
                      leads.filter((l) => l.status === "WARM").length}
                  </h3>
                  <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                    Hot + Warm
                  </p>
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Analytics;
