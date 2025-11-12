import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";
import { ArrowRight, TrendingDown } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface FunnelStage {
	stage: string;
	count: number;
	percentage: number;
}

const funnelData: FunnelStage[] = [
	{ stage: "Total Leads", count: 100, percentage: 100 },
	{ stage: "Contacted", count: 75, percentage: 75 },
	{ stage: "Demo Scheduled", count: 45, percentage: 45 },
	{ stage: "Demo Completed", count: 35, percentage: 35 },
	{ stage: "Admitted", count: 20, percentage: 20 },
];

const ConversionFunnel = () => {
	return (
		<div className="space-y-3">
			{funnelData.map((stage, index) => {
				const prevStage = index > 0 ? funnelData[index - 1] : null;
				const dropRate = prevStage
					? ((prevStage.count - stage.count) / prevStage.count) * 100
					: null;

				return (
					<div key={stage.stage}>
						<motion.div
							initial={{ opacity: 0, x: -20 }}
							animate={{ opacity: 1, x: 0 }}
							transition={{ delay: index * 0.1 }}
							className="flex items-center gap-4"
						>
							{/* Stage Name & Count */}
							<div className="w-48 text-right">
								<p className="font-semibold text-sm text-subbuText">
									{stage.stage}
								</p>
								<p className="text-xs text-muted-foreground">
									{stage.count} leads
								</p>
							</div>

							{/* Progress Bar */}
							<div className="flex-1 relative">
								<div className="flex items-center gap-3">
									<Progress
										value={stage.percentage}
										className="h-8 bg-subbuGray"
										indicatorClassName={
											stage.percentage >= 80
												? "bg-subbuGreen"
												: stage.percentage >= 50
													? "bg-subbuYellow"
													: "bg-subbuRed"
										}
									/>
									<span className="text-sm font-bold text-subbuText min-w-[3rem]">
										{stage.percentage}%
									</span>
								</div>
							</div>

							{/* Drop Rate */}
							{dropRate && (
								<div className="w-24 flex items-center gap-1 text-xs text-red-600">
									<TrendingDown className="h-3 w-3" />
									<span>{dropRate.toFixed(0)}% lost</span>
								</div>
							)}
						</motion.div>

						{/* Arrow between stages */}
						{index < funnelData.length - 1 && (
							<div className="flex justify-center my-1">
								<ArrowRight className="h-4 w-4 text-muted-foreground rotate-90" />
							</div>
						)}
					</div>
				);
			})}

			{/* Summary */}
			<div className="mt-4 p-3 bg-gradient-to-r from-subbuRed/10 to-subbuGreen/10 rounded-lg border">
				<div className="flex items-center justify-between">
					<div>
						<p className="text-sm font-medium text-subbuText">
							Overall Conversion Rate
						</p>
						<p className="text-xs text-muted-foreground">
							From lead to admission
						</p>
					</div>
					<div className="text-right">
						<p className="text-2xl font-bold text-subbuGreen">20%</p>
						<p className="text-xs text-muted-foreground">20/100 converted</p>
					</div>
				</div>
			</div>
		</div>
	);
};

export default ConversionFunnel;
