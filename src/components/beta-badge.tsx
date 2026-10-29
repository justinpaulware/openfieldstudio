import { cn } from "@/lib/utils";

/** Small "Beta" tag shown next to the Open Field wordmark. */
export function BetaBadge({ className }: { className?: string }) {
  return (
    <span
      title="Open Field is in beta — features are still being built and refined."
      className={cn(
        "rounded-full border border-border bg-muted px-1.5 py-px font-secondary text-[10px] font-semibold uppercase leading-4 tracking-wide text-muted-foreground",
        className,
      )}
    >
      Beta
    </span>
  );
}
