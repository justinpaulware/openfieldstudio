import { cn } from "@/lib/utils";

/**
 * Open Field mark: light slate tile, lowercase "of" above a yellow isometric field plane.
 * Brand colors are fixed so the mark reads identically everywhere (incl. favicon).
 */
export function OpenFieldLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label="Open Field"
      className={cn("h-7 w-7 shrink-0", className)}
    >
      <rect width="64" height="64" rx="14" fill="#e2e8f0" />
      <text
        x="32"
        y="32"
        textAnchor="middle"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        fontWeight="700"
        fontSize="22"
        letterSpacing="-0.5"
        fill="#0f172a"
      >
        OF
      </text>
      <path
        d="M17 35 L9 41 L32 53 L55 41 L47 35"
        fill="none"
        stroke="#0f172a"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
