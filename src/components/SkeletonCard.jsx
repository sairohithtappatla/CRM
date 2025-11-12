import { Card, CardContent } from "@/components/ui/card";

const SkeletonCard = () => {
  return (
    <Card className="animate-pulse">
      <CardContent className="p-4">
        <div className="space-y-3">
          <div className="h-4 bg-subbuGray rounded w-3/4"></div>
          <div className="h-3 bg-subbuGray rounded w-1/2"></div>
          <div className="h-2 bg-subbuGray rounded w-full"></div>
          <div className="flex gap-2">
            <div className="h-8 bg-subbuGray rounded flex-1"></div>
            <div className="h-8 bg-subbuGray rounded flex-1"></div>
            <div className="h-8 bg-subbuGray rounded flex-1"></div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SkeletonCard;