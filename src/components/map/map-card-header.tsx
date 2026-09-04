import type { ReactNode } from "react";
import { ChevronDown, ChevronUp, type LucideIcon } from "lucide-react";

/**
 * Shared collapsible header for the viewer's overlay cards (Map Views, Legend,
 * Comments). Icon + title on the left, optional actions, collapse chevron on
 * the right. The card body renders below it, separated by a top border.
 */
export function MapCardHeader({
  icon: Icon,
  title,
  subtitle,
  open,
  onToggle,
  actions,
}: {
  icon: LucideIcon;
  title: ReactNode;
  /** Extra muted text after the title (e.g. active view name, count). */
  subtitle?: ReactNode;
  open: boolean;
  onToggle: () => void;
  /** Small buttons rendered before the chevron (eye toggles, add buttons). */
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-1 px-3 py-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-xs font-semibold"
      >
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{title}</span>
        {subtitle != null && (
          <span className="truncate font-secondary text-[11px] font-normal opacity-60">
            {subtitle}
          </span>
        )}
      </button>
      {actions}
      <button
        type="button"
        onClick={onToggle}
        aria-label={open ? "Collapse" : "Expand"}
        className="shrink-0 rounded p-0.5 opacity-70 hover:bg-black/5 hover:opacity-100"
      >
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}
