import { useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { FeatureCollection } from "@/lib/geo";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  layerName: string;
  data: FeatureCollection | null;
};

const PAGE_SIZE = 200;

export function AttributeTable({ open, onOpenChange, layerName, data }: Props) {
  const [query, setQuery] = useState("");

  const columns = useMemo(() => {
    const keys = new Set<string>();
    for (const feature of data?.features.slice(0, 200) ?? []) {
      for (const key of Object.keys(feature.properties ?? {})) keys.add(key);
    }
    return [...keys];
  }, [data]);

  const rows = useMemo(() => {
    const all = data?.features ?? [];
    const needle = query.trim().toLowerCase();
    const filtered = needle
      ? all.filter((feature) =>
          Object.values(feature.properties ?? {}).some((value) =>
            String(value ?? "").toLowerCase().includes(needle),
          ),
        )
      : all;
    return filtered.slice(0, PAGE_SIZE);
  }, [data, query]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[60vh] p-0">
        <SheetHeader className="border-b border-border px-5 py-4">
          <SheetTitle className="flex flex-wrap items-center gap-3">
            {layerName}
            <span className="font-secondary text-xs font-normal text-muted-foreground">
              {(data?.features.length ?? 0).toLocaleString()} features
              {rows.length === PAGE_SIZE ? ` · showing first ${PAGE_SIZE}` : ""}
            </span>
          </SheetTitle>
          <Input
            placeholder="Search attributes…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="mt-2 max-w-sm"
          />
        </SheetHeader>
        <div className="h-[calc(60vh-7.5rem)] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-card">
              <TableRow>
                {columns.map((column) => (
                  <TableHead key={column} className="whitespace-nowrap">
                    {column}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((feature, index) => (
                <TableRow key={index}>
                  {columns.map((column) => (
                    <TableCell key={column} className="whitespace-nowrap text-xs">
                      {String(feature.properties?.[column] ?? "")}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </SheetContent>
    </Sheet>
  );
}
