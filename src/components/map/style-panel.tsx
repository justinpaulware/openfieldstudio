import { useState, type ReactNode } from "react";
import { Check, ChevronDown, Loader2, RotateCcw, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { activeCategories, activeGraduated, type LayerStyle, type SimpleKind } from "@/lib/layer-style";
import { CategoryChip, LegendSwatch, categoryRows } from "./map-legend";
import { StyleSymbology, type FieldValue } from "./style-symbology";
import { StyleLabels } from "./style-labels";
import { StylePopups } from "./style-popups";

export type StyleSaveState = "idle" | "dirty" | "saving" | "saved";

type Props = {
  layerName: string;
  kind: SimpleKind;
  style: LayerStyle;
  saveState: StyleSaveState;
  fields: string[];
  valuesFor: (field: string) => FieldValue[];
  numericFields: string[];
  numbersFor: (field: string) => number[];
  onChange: (patch: Partial<LayerStyle>) => void;
  onSave: () => void;
  onReset: () => void;
  onClose: () => void;
};

function Section({
  title,
  hint,
  open,
  onToggle,
  disabled,
  children,
}: {
  title: string;
  hint?: string;
  open: boolean;
  onToggle: () => void;
  disabled?: boolean;
  children?: ReactNode;
}) {
  return (
    <section className="border-b border-border">
      <button
        type="button"
        onClick={disabled ? undefined : onToggle}
        aria-expanded={open}
        className={cn(
          "flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm font-semibold",
          disabled ? "cursor-default text-muted-foreground" : "hover:bg-muted/50",
        )}
      >
        <span className="flex items-center gap-2">
          {title}
          {hint && (
            <span className="font-secondary text-[10px] font-normal uppercase tracking-wide text-muted-foreground">
              {hint}
            </span>
          )}
        </span>
        {!disabled && (
          <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
        )}
      </button>
      {open && children && <div className="px-4 pb-4">{children}</div>}
    </section>
  );
}

export function StylePanel({
  layerName,
  kind,
  style,
  saveState,
  fields,
  valuesFor,
  numericFields,
  numbersFor,
  onChange,
  onSave,
  onReset,
  onClose,
}: Props) {
  const [openSection, setOpenSection] = useState<"styles" | "labels" | "popups" | null>("styles");
  const toggle = (section: "styles" | "labels" | "popups") =>
    setOpenSection((current) => (current === section ? null : section));
  const rows = categoryRows(style);
  const categorized = !!activeCategories(style);
  const graduated = !!activeGraduated(style);

  return (
    <aside className="hidden w-72 shrink-0 flex-col border-l border-border bg-card/40 lg:flex">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          {rows.length ? (
            <CategoryChip colors={rows.map((row) => row.color)} />
          ) : (
            <LegendSwatch kind={kind} style={style} />
          )}
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">{layerName}</h2>
            <p className="font-secondary text-[11px] capitalize text-muted-foreground">
              {kind} · {categorized ? "categories" : graduated ? "graduated" : "single symbol"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close style panel"
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <Section title="Styles" open={openSection === "styles"} onToggle={() => toggle("styles")}>
          <StyleSymbology
            kind={kind}
            style={style}
            fields={fields}
            valuesFor={valuesFor}
            numericFields={numericFields}
            numbersFor={numbersFor}
            onChange={onChange}
          />
        </Section>
        <Section
          title="Labels"
          hint={style.labels?.enabled ? "On" : "Off"}
          open={openSection === "labels"}
          onToggle={() => toggle("labels")}
        >
          <StyleLabels kind={kind} style={style} fields={fields} onChange={onChange} />
        </Section>
        <Section
          title="Popups"
          hint={style.popup?.enabled ? "On" : "Off"}
          open={openSection === "popups"}
          onToggle={() => toggle("popups")}
        >
          <StylePopups style={style} fields={fields} onChange={onChange} />
        </Section>

      </div>

      <div className="space-y-1.5 border-t border-border px-4 py-3">
        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-1"
            onClick={onSave}
            disabled={saveState === "saving" || saveState === "idle" || saveState === "saved"}
          >
            {saveState === "saving" ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : saveState === "saved" ? (
              <Check className="mr-1.5 h-3.5 w-3.5" />
            ) : (
              <Save className="mr-1.5 h-3.5 w-3.5" />
            )}
            {saveState === "saving" ? "Saving" : saveState === "saved" ? "Saved" : "Save"}
          </Button>
          <Button variant="outline" size="sm" className="flex-1" onClick={onReset}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Reset to default
          </Button>
        </div>
        <p className="font-secondary text-[11px] text-muted-foreground">
          {saveState === "dirty"
            ? "Unsaved changes"
            : saveState === "saving"
              ? "Saving changes…"
              : "All changes saved"}
        </p>
      </div>
    </aside>
  );
}
