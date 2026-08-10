import { cn } from "@/lib/utils";

/** Open Field mark: a field horizon with a plotted point. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("h-5 w-5 shrink-0", className)}
      aria-hidden="true"
      fill="none"
    >
      <rect x="1.5" y="1.5" width="21" height="21" rx="6" fill="currentColor" opacity="0.12" />
      <path
        d="M4 16.5 L10 10.5 L14 14.5 L20 8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="10.5" r="2" fill="currentColor" />
    </svg>
  );
}
