import { useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FILTER_OPERATORS,
  operatorArity,
  type FilterConfig,
  type FilterOperator,
  type FilterRule,
} from "@/lib/layer-filter";
import type { FieldValue } from "./style-symbology";

type Props = {
  config: FilterConfig;
  fields: string[];
  numericFields: string[];
  valuesFor: (field: string) => FieldValue[];
  matched: number;
  total: number;
  onChange: (config: FilterConfig) => void;
};

/** Text fields with a small, tidy set of values get a picker instead of free text. */
const PICKER_LIMIT = 40;

/** Typed values commit on a short pause so the map recalculates once, not per keystroke. */
function DebouncedInput({
  value,
  onCommit,
  ...rest
}: {
  value: string;
  onCommit: (value: string) => void;
} & Omit<React.ComponentProps<typeof Input>, "value" | "onChange">) {
  const [draft, setDraft] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(value);
  }, [value]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const commit = (next: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    onCommit(next);
  };

  return (
    <Input
      {...rest}
      value={draft}
      onFocus={() => { focused.current = true; }}
      onChange={(event) => {
        const next = event.target.value;
        setDraft(next);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => commit(next), 350);
      }}
      onBlur={() => { focused.current = false; commit(draft); }}
      onKeyDown={(event) => { if (event.key === "Enter") commit(draft); }}
    />
  );
}

export function LayerFilter({
  config,
  fields,
  numericFields,
  valuesFor,
  matched,
  total,
  onChange,
}: Props) {
  const setRule = (index: number, patch: Partial<FilterRule>) =>
    onChange({
      ...config,
      rules: config.rules.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)),
    });

  const addRule = () =>
    onChange({
      ...config,
      rules: [
        ...config.rules,
        { field: fields[0] ?? "", op: "eq" as FilterOperator, value: "", value2: "" },
      ],
    });

  const removeRule = (index: number) =>
    onChange({ ...config, rules: config.rules.filter((_, i) => i !== index) });

  if (!fields.length) {
    return (
      <p className="font-secondary text-xs text-muted-foreground">
        This layer has no attributes to filter on.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-secondary text-[11px] text-muted-foreground">
          {matched.toLocaleString()} of {total.toLocaleString()} features
        </p>
        {config.rules.length > 0 && (
          <button
            type="button"
            className="font-secondary text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            onClick={() => onChange({ combinator: "and", rules: [] })}
          >
            Clear all
          </button>
        )}
      </div>

      {config.rules.length > 1 && (
        <div className="flex items-center gap-1 rounded-lg border border-border p-1">
          {(["and", "or"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onChange({ ...config, combinator: value })}
              className={
                "flex-1 rounded-md px-2 py-1 font-secondary text-[11px] transition-colors " +
                (config.combinator === value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              {value === "and" ? "Match all" : "Match any"}
            </button>
          ))}
        </div>
      )}

      {config.rules.map((rule, index) => {
        const isNumeric = numericFields.includes(rule.field);
        const arity = operatorArity(rule.op);
        const options = isNumeric ? [] : valuesFor(rule.field).filter((o) => o.value !== "");
        const usePicker =
          !isNumeric && arity === 1 && options.length > 0 && options.length <= PICKER_LIMIT;

        return (
          <div key={index} className="space-y-2 rounded-lg border border-border p-2">
            <div className="flex items-center gap-1.5">
              {index > 0 && (
                <span className="font-secondary text-[10px] uppercase tracking-wide text-muted-foreground">
                  and
                </span>
              )}
              <Select value={rule.field} onValueChange={(field) => setRule(index, { field })}>
                <SelectTrigger className="h-8 flex-1 text-xs">
                  <SelectValue placeholder="Field" />
                </SelectTrigger>
                <SelectContent>
                  {fields.map((field) => (
                    <SelectItem key={field} value={field}>
                      {field}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                aria-label="Remove rule"
                onClick={() => removeRule(index)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>

            <Select
              value={rule.op}
              onValueChange={(op) => setRule(index, { op: op as FilterOperator })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FILTER_OPERATORS.map((op) => (
                  <SelectItem key={op.value} value={op.value}>
                    {op.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {arity > 0 &&
              (usePicker ? (
                <Select value={rule.value} onValueChange={(value) => setRule(index, { value })}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Value" />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.value} ({option.count})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex items-center gap-1.5">
                  <DebouncedInput
                    className="h-8 text-xs"
                    type={isNumeric ? "number" : "text"}
                    value={rule.value}
                    placeholder={arity === 2 ? "Min" : "Value"}
                    onCommit={(value) => setRule(index, { value })}
                  />
                  {arity === 2 && (
                    <DebouncedInput
                      className="h-8 text-xs"
                      type="number"
                      value={rule.value2}
                      placeholder="Max"
                      onCommit={(value2) => setRule(index, { value2 })}
                    />
                  )}
                </div>
              ))}
          </div>
        );
      })}

      <Button variant="outline" size="sm" className="w-full" onClick={addRule}>
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        Add rule
      </Button>
    </div>
  );
}
