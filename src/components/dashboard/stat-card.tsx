import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
    <Card className="group transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_45px_rgba(7,24,44,0.13)]">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
          <Badge variant={trendConfig.variant}>{trendConfig.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-3">
        <p className="text-4xl font-semibold tracking-tight text-foreground md:text-[2.1rem]">
          {value}
        </p>
        <CardDescription className="mt-3">{helperText}</CardDescription>
        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-surface-soft">
          <div
            className="h-full rounded-full bg-[linear-gradient(120deg,#0b8c83_0%,#1d4ed8_100%)] transition-all duration-300 group-hover:w-full"
            style={{ width: trend === "up" ? "82%" : trend === "down" ? "35%" : "58%" }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
