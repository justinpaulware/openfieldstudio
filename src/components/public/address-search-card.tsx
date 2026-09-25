import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { MapCardHeader } from "@/components/map/map-card-header";
import { searchPlaces, type PlaceResult } from "@/lib/geocode.functions";

/**
 * "Search location" card on the published map. Looks up addresses, towns and
 * landmarks, biased toward the current map extent, and reports the pick upward
 * so the viewer can fly there and drop a temporary marker.
 */
export function AddressSearchCard({
  onSelect,
  onClear,
  hasMarker,
  /** Current map extent as [west, south, east, north], used to bias results. */
  getViewbox,
  notice,
  className,
}: {
  /** Status line shown under the input after a pick (e.g. no containing feature). */
  notice?: string | null;
  onSelect: (result: PlaceResult) => void;
  onClear: () => void;
  hasMarker: boolean;
  getViewbox: () => [number, number, number, number] | null;
  className?: string;
}) {
  const [open, setOpen] = useState(true);
  const [value, setValue] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<PlaceResult | null>(null);
  const boxRef = useRef<[number, number, number, number] | null>(null);

  // Debounce typing so we don't query on every keystroke.
  useEffect(() => {
    if (selected) return;
    const trimmed = value.trim();
    const timer = window.setTimeout(() => {
      boxRef.current = getViewbox();
      setQuery(trimmed.length >= 2 ? trimmed : "");
    }, 300);
    return () => window.clearTimeout(timer);
  }, [value, selected, getViewbox]);

  const results = useQuery({
    queryKey: ["place-search", query, boxRef.current?.join(",") ?? ""],
    queryFn: () => searchPlaces({ data: { query, viewbox: boxRef.current } }),
    enabled: query.length >= 2,
    staleTime: 5 * 60 * 1000,
  });

  const list = query.length >= 2 && !selected ? (results.data ?? []) : [];
  const showEmpty =
    query.length >= 2 && !selected && !results.isFetching && (results.data?.length ?? 0) === 0;

  const clear = () => {
    setValue("");
    setQuery("");
    setSelected(null);
    onClear();
  };

  return (
    <div
      className={cn(
        "w-[17rem] max-w-[min(50vw,26rem)] overflow-hidden rounded-lg border border-map-overlay-border bg-map-overlay text-map-overlay-foreground shadow-[var(--shadow-soft)]",
        className,
      )}
    >
      <MapCardHeader
        icon={Search}
        title="Search location"
        open={open}
        onToggle={() => setOpen((v) => !v)}
      />
      {open && (
        <div className="border-t border-map-overlay-border px-3 py-2">
          {selected ? (
            <div className="relative rounded-md border border-map-overlay-border px-2.5 py-1.5 pr-7">
              <p className="text-xs font-medium leading-snug">{selected.name}</p>
              {selected.context && (
                <p className="font-secondary text-[11px] leading-snug opacity-60">
                  {selected.context}
                </p>
              )}
              <button
                type="button"
                onClick={clear}
                aria-label="Clear search"
                className="absolute right-1 top-1.5 rounded p-1 opacity-70 hover:bg-map-overlay-foreground/10 hover:opacity-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="relative">
              <input
                type="search"
                value={value}
                onChange={(event) => {
                  setSelected(null);
                  setValue(event.target.value);
                }}
                placeholder="Search address, place or landmark"
                aria-label="Search address, place or landmark"
                className="w-full rounded-md border border-map-overlay-border bg-transparent py-1.5 pl-2.5 pr-7 font-secondary text-xs outline-none placeholder:text-map-overlay-foreground/50 focus:border-primary"
              />
              {(value || hasMarker) && (
                <button
                  type="button"
                  onClick={clear}
                  aria-label="Clear search"
                  className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 opacity-70 hover:bg-map-overlay-foreground/10 hover:opacity-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}


          {results.isFetching && !selected && query.length >= 2 && (
            <p className="mt-2 flex items-center gap-1.5 font-secondary text-[11px] opacity-70">
              <Loader2 className="h-3 w-3 animate-spin" />
              Searching
            </p>
          )}

          {notice && selected && (
            <div className="mt-2 rounded-md bg-map-overlay-foreground/5 px-2 py-1.5 font-secondary text-[11px]">
              <p className="opacity-80">{notice}</p>
              <button
                type="button"
                onClick={clear}
                className="mt-1 font-medium text-primary hover:underline"
              >
                Clear search
              </button>
            </div>
          )}

          {showEmpty && (
            <p className="mt-2 font-secondary text-[11px] opacity-70">No places found.</p>
          )}

          {list.length > 0 && (
            <ul className="mt-2 max-h-56 space-y-0.5 overflow-y-auto">
              {list.map((result) => (
                <li key={result.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(result);
                      setValue(result.name);
                      onSelect(result);
                    }}
                    className="w-full rounded-md px-2 py-1.5 text-left transition-colors hover:bg-map-overlay-foreground/10"
                  >
                    <span className="block truncate text-xs">{result.name}</span>
                    {result.context && (
                      <span className="block truncate font-secondary text-[11px] opacity-60">
                        {result.context}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
