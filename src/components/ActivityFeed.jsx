import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Phone, MessageCircle, CreditCard, UserPlus } from "lucide-react";
import { motion } from "framer-motion";

const activities = [
  {
    icon: Phone,
    text: "Called Ramesh Kumar",
    time: "2 min ago",
    color: "text-subbuRed",
  },
  {
    icon: MessageCircle,
    text: "WhatsApp sent to Lakshmi Devi",
    time: "5 min ago",
    color: "text-subbuGreen",
  },
  {
    icon: CreditCard,
    text: "Payment received from Madhavi",
    time: "10 min ago",
    color: "text-subbuYellow",
  },
  {
    icon: UserPlus,
    text: "New lead: Prakash Rao",
    time: "15 min ago",
    color: "text-blue-500",
  },
];

const ActivityFeed = () => {
  return (
    <Card className="bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-subbuText flex items-center gap-2">
          <div className="w-2 h-2 bg-subbuGreen rounded-full animate-pulse" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px] pr-4">
          <div className="space-y-4">
            {activities.map((activity, index) => (
              <motion.div
                key={index}
                className="flex items-start gap-3 p-3 rounded-lg hover:bg-subbuGray/50 transition-colors cursor-pointer"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <div
                  className={`p-2 rounded-full bg-subbuGray ${activity.color}`}
                >
                  <activity.icon className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-subbuText">
                    {activity.text}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {activity.time}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default ActivityFeed;
