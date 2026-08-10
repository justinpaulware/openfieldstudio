import { useState } from "react";
import { GripVertical, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  DEFAULT_POPUP,
  type LayerStyle,
  type PopupField,
  type PopupFieldFormat,
  type PopupSpec,
} from "@/lib/layer-style";
import { SliderField } from "./style-symbology";

type Props = {
  style: LayerStyle;
  fields: string[];
  onChange: (patch: Partial<LayerStyle>) => void;
};

const FORMATS: { value: PopupFieldFormat; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "link", label: "Link" },
  { value: "image", label: "Image" },
];

/** Merge detected attributes into the saved list, keeping order and aliases. */
function syncFields(existing: PopupField[], fields: string[]): PopupField[] {
  const known = new Set(fields);
  const kept = existing.filter((field) => known.has(field.name));
  const seen = new Set(kept.map((field) => field.name));
  const added = fields
    .filter((name) => !seen.has(name))
    .map((name) => ({ name, alias: name, visible: true, format: "text" as PopupFieldFormat }));
  return [...kept, ...added];
}

export function StylePopups({ style, fields, onChange }: Props) {
  const spec = style.popup ?? DEFAULT_POPUP;
  const set = (patch: Partial<PopupSpec>) => onChange({ popup: { ...spec, ...patch } });
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const rows = spec.fields;

  const patchField = (index: number, patch: Partial<PopupField>) =>
    set({ fields: rows.map((field, i) => (i === index ? { ...field, ...patch } : field)) });

  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= rows.length) return;
    const next = [...rows];
    const [moved] = next.splice(from, 1);
    if (moved) next.splice(to, 0, moved);
    set({ fields: next });
  };

  return (
    <div className="space-y-4 pt-1">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs text-muted-foreground">Enable popups</Label>
        <Switch checked={spec.enabled} onCheckedChange={(enabled) => set({ enabled })} />
      </div>

      {spec.enabled && (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Trigger</Label>
            <div className="flex gap-1">
              {(["click", "hover"] as const).map((trigger) => (
                <button
                  key={trigger}
                  type="button"
                  onClick={() => set({ trigger })}
                  className={cn(
                    "flex-1 rounded-md border border-border px-2 py-1 text-xs capitalize transition-colors hover:bg-muted",
                    spec.trigger === trigger && "border-primary/60 bg-primary/15 text-foreground",
                  )}
                >
                  {trigger}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Title field</Label>
            <select
              value={spec.titleField}
              onChange={(event) => set({ titleField: event.target.value })}
              className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
            >
              <option value="">Layer name</option>
              {fields.map((field) => (
                <option key={field} value={field}>
                  {field}
                </option>
              ))}
            </select>
            <Input
              value={spec.titleText}
              placeholder="Or a fixed title…"
              onChange={(event) => set({ titleText: event.target.value })}
              className="h-8 text-xs"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Fields</Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 text-[11px]"
                onClick={() => set({ fields: syncFields(rows, fields) })}
              >
                <RefreshCw className="mr-1 h-3 w-3" />
                {rows.length ? "Sync fields" : "Load fields"}
              </Button>
            </div>
            {!rows.length ? (
              <p className="font-secondary text-[11px] text-muted-foreground">
                Showing every attribute. Load fields to rename, reorder or hide them.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {rows.map((field, index) => (
                  <li
                    key={field.name}
                    draggable
                    onDragStart={() => setDragIndex(index)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => {
                      if (dragIndex !== null) move(dragIndex, index);
                      setDragIndex(null);
                    }}
                    className={cn(
                      "rounded-md border border-border p-1.5",
                      dragIndex === index && "opacity-60",
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-muted-foreground" />
                      <Switch
                        checked={field.visible}
                        onCheckedChange={(visible) => patchField(index, { visible })}
                      />
                      <Input
                        value={field.alias}
                        onChange={(event) => patchField(index, { alias: event.target.value })}
                        className="h-7 flex-1 text-xs"
                      />
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 pl-5">
                      <span className="truncate font-secondary text-[10px] text-muted-foreground">
                        {field.name}
                      </span>
                      <select
                        value={field.format}
                        onChange={(event) =>
                          patchField(index, { format: event.target.value as PopupFieldFormat })
                        }
                        className="ml-auto h-6 rounded border border-border bg-background px-1 text-[11px]"
                      >
                        {FORMATS.map((format) => (
                          <option key={format.value} value={format.value}>
                            {format.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs text-muted-foreground">Hide empty values</Label>
            <Switch checked={spec.hideEmpty} onCheckedChange={(hideEmpty) => set({ hideEmpty })} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Density</Label>
            <div className="flex gap-1">
              {(["compact", "roomy"] as const).map((density) => (
                <button
                  key={density}
                  type="button"
                  onClick={() => set({ density })}
                  className={cn(
                    "flex-1 rounded-md border border-border px-2 py-1 text-xs capitalize transition-colors hover:bg-muted",
                    spec.density === density && "border-primary/60 bg-primary/15 text-foreground",
                  )}
                >
                  {density}
                </button>
              ))}
            </div>
          </div>

          <SliderField
            label="Max width"
            value={spec.maxWidth}
            min={180}
            max={480}
            step={20}
            suffix="px"
            onChange={(maxWidth) => set({ maxWidth })}
          />
        </>
      )}
    </div>
  );
}
