import { Layers } from "lucide-react";

import { cn } from "@/lib/utils";

/** Open Field mark: matches the dashboard/landing header logo. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground",
        className,
      )}
    >
      <Layers className="h-4 w-4" />
    </span>
  );
}
