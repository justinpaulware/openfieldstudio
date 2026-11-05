import { cn } from "@/lib/utils";

/**
 * Open Field mark: a flat, open ground plane (wide front angle, acute side
 * corners, back returns parallel to the opposite front edges) in charcoal on a
 * yellow tile. Brand colors are fixed so the mark matches the favicon.
 */
export function OpenFieldLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label="Open Field"
      className={cn("h-7 w-7 shrink-0", className)}
    >
      <rect width="64" height="64" rx="14" fill="#FACC15" />
      <path
        d="M23 28.4 L12 32.5 L32 40 L52 32.5 L41 28.4"
        fill="none"
        stroke="#171717"
        strokeWidth="4"
        strokeLinecap="butt"
        strokeLinejoin="miter"
        strokeMiterlimit="10"
      />
    </svg>
  );
}
