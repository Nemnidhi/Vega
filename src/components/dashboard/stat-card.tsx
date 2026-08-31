import { Badge } from "@/components/ui/badge";
import { Activity } from "lucide-react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";

interface StatCardProps {
  title: string;
  value: string;
  helperText: string;
  trend?: "up" | "neutral" | "down";
}

const trendMap = {
  up: { label: "Rising", variant: "success" as const },
  neutral: { label: "Stable", variant: "neutral" as const },
  down: { label: "Needs Attention", variant: "warning" as const },
};

export function StatCard({
  title,
  value,
  helperText,
  trend = "neutral",
}: StatCardProps) {
  const trendConfig = trendMap[trend];

  return (
    <Card className="h-full min-h-[128px]">
      <CardContent className="flex h-full flex-col justify-between gap-3 p-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-md border border-vega-purple-border bg-vega-purple-soft text-vega-purple">
              <Activity className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-medium leading-4 text-vega-text-secondary">{title}</p>
              <p className="mt-1 text-[21px] font-semibold leading-6 text-vega-text">{value}</p>
            </div>
          </div>
          <Badge variant={trendConfig.variant}>{trendConfig.label}</Badge>
        </div>
        <div>
          <p className="mb-2 text-[10px] leading-4 text-vega-text-muted">{helperText}</p>
          <div className="h-1.5 w-full overflow-hidden rounded-sm bg-[#263445]">
          <div
            className="h-full rounded-sm bg-vega-purple transition-all duration-300"
            style={{ width: trend === "up" ? "82%" : trend === "down" ? "35%" : "58%" }}
          />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
