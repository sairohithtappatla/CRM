import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";
import CountUp from "react-countup";

// If you have a cn() helper, you can use it. Here's a safe merge without it.
interface AnimatedStatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  trend?: number;
  delay?: number;
  className?: string; // <-- added
}

const AnimatedStatCard = ({
  title,
  value,
  icon,
  trend,
  delay = 0,
  className, // <-- added
}: AnimatedStatCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
    >
      <Card
        className={
          `
          relative overflow-hidden cursor-pointer transition-all duration-300
          bg-white dark:bg-card
          border border-border/60 dark:border-border/50
          hover:shadow-xl hover:scale-[1.02]
          ` + (className ? ` ${className}` : "") // <-- merge extra classes
        }
      >
        {/* soft corner tint — balanced for both themes */}
        <div
          className="
            absolute top-0 right-0 -mr-16 -mt-16 h-32 w-32 rounded-full
            bg-gradient-to-br from-subbuRed/10 to-transparent
            dark:from-subbuRed/15
          "
        />

        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-subbuText">{title}</CardTitle>
          <div className="p-2 rounded-lg bg-subbuRed/10 dark:bg-subbuRed/15">
            {icon}
          </div>
        </CardHeader>

        <CardContent>
          <div className="text-3xl font-bold text-subbuText">
            <CountUp end={value} duration={2} separator="," />
          </div>

          {typeof trend === "number" && (
            <motion.p
              className="mt-1 flex items-center gap-1 text-xs text-subbuGreen"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: delay + 0.5 }}
            >
              <span>↗</span> +{trend}% from last month
            </motion.p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default AnimatedStatCard;
