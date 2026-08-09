import { Badge } from "@/components/ui/badge";

const labels = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
} as const;

export function StatusChip({ status }: { status: keyof typeof labels }) {
  const className =
    status === "published"
      ? "border-transparent bg-moss/15 text-moss"
      : status === "archived"
        ? "border-transparent bg-muted text-muted-foreground"
        : "border-transparent bg-primary/20 text-foreground";

  return (
    <Badge variant="outline" className={`font-medium ${className}`}>
      {labels[status]}
    </Badge>
  );
}
