import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Users, Calendar, CheckCircle } from "lucide-react";

interface Lead {
  id: string;
  status: 'HOT' | 'WARM' | 'COLD' | 'FOLLOW-UP' | 'ADMITTED';
}

interface DashboardStatsProps {
  leads: Lead[];
}

const DashboardStats = ({ leads }: DashboardStatsProps) => {
  const stats = {
    totalLeads: leads.length,
    hotLeads: leads.filter((l) => l.status === "HOT").length,
    followUps: leads.filter((l) => l.status === "FOLLOW-UP").length,
    admitted: leads.filter((l) => l.status === "ADMITTED").length,
  };

  const statCards = [
    {
      title: "Total Leads",
      value: stats.totalLeads,
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Hot Leads",
      value: stats.hotLeads,
      icon: TrendingUp,
      color: "text-status-hot",
      bgColor: "bg-red-50",
    },
    {
      title: "Follow-ups",
      value: stats.followUps,
      icon: Calendar,
      color: "text-status-followup",
      bgColor: "bg-gray-50",
    },
    {
      title: "Admitted",
      value: stats.admitted,
      icon: CheckCircle,
      color: "text-status-admitted",
      bgColor: "bg-green-50",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {statCards.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.title} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={`${stat.bgColor} p-2 rounded-lg`}>
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default DashboardStats;