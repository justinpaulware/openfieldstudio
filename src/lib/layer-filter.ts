/** Attribute filtering: a layer-level property applied everywhere the layer draws. */
import type { FeatureCollection } from "@/lib/geo";

export const FILTER_OPERATORS = [
  { value: "eq", label: "equals", arity: 1 },
  { value: "neq", label: "not equal", arity: 1 },
  { value: "contains", label: "contains", arity: 1 },
  { value: "starts", label: "starts with", arity: 1 },
  { value: "ends", label: "ends with", arity: 1 },
  { value: "gt", label: "greater than", arity: 1 },
  { value: "lt", label: "less than", arity: 1 },
  { value: "between", label: "between", arity: 2 },
  { value: "empty", label: "is empty", arity: 0 },
  { value: "notEmpty", label: "is not empty", arity: 0 },
] as const;

export type FilterOperator = (typeof FILTER_OPERATORS)[number]["value"];

export type FilterRule = {
  field: string;
  op: FilterOperator;
  value: string;
  value2: string;
};

export type FilterCombinator = "and" | "or";

export type FilterConfig = {
  combinator: FilterCombinator;
  rules: FilterRule[];
};

export const EMPTY_FILTER: FilterConfig = { combinator: "and", rules: [] };

const OPS = new Set(FILTER_OPERATORS.map((o) => o.value as string));

export function operatorArity(op: FilterOperator): number {
  return FILTER_OPERATORS.find((o) => o.value === op)?.arity ?? 1;
}

export function parseFilterConfig(raw: unknown): FilterConfig {
  if (!raw || typeof raw !== "object") return EMPTY_FILTER;
  const rules = (raw as { rules?: unknown }).rules;
  if (!Array.isArray(rules)) return EMPTY_FILTER;
  const parsed: FilterRule[] = [];
  for (const item of rules) {
    if (!item || typeof item !== "object") continue;
    const rule = item as Partial<FilterRule>;
    if (typeof rule.field !== "string" || !rule.field) continue;
    const op = typeof rule.op === "string" && OPS.has(rule.op) ? (rule.op as FilterOperator) : "eq";
    parsed.push({
      field: rule.field,
      op,
      value: rule.value === undefined || rule.value === null ? "" : String(rule.value),
      value2: rule.value2 === undefined || rule.value2 === null ? "" : String(rule.value2),
    });
  }
  return { combinator: "and", rules: parsed };
}

/** A rule only filters once it is complete enough to mean something. */
export function isRuleReady(rule: FilterRule): boolean {
  if (!rule.field) return false;
  const arity = operatorArity(rule.op);
  if (arity === 0) return true;
  if (arity === 1) return rule.value !== "";
  return rule.value !== "" && rule.value2 !== "";
}

export function activeRules(config: FilterConfig | null | undefined): FilterRule[] {
  return (config?.rules ?? []).filter(isRuleReady);
}

export function isFilterActive(config: FilterConfig | null | undefined): boolean {
  return activeRules(config).length > 0;
}

function asText(raw: unknown): string {
  return raw === null || raw === undefined ? "" : String(raw);
}

function matchesRule(props: Record<string, unknown>, rule: FilterRule): boolean {
  const raw = props[rule.field];
  const text = asText(raw);
  const lower = text.toLowerCase();
  const target = rule.value.toLowerCase();
  const num = Number(text);
  const targetNum = Number(rule.value);
  const targetNum2 = Number(rule.value2);

  switch (rule.op) {
    case "eq":
      return lower === target;
    case "neq":
      return lower !== target;
    case "contains":
      return lower.includes(target);
    case "starts":
      return lower.startsWith(target);
    case "ends":
      return lower.endsWith(target);
    case "gt":
      return Number.isFinite(num) && Number.isFinite(targetNum) && num > targetNum;
    case "lt":
      return Number.isFinite(num) && Number.isFinite(targetNum) && num < targetNum;
    case "between":
      return (
        Number.isFinite(num) &&
        Number.isFinite(targetNum) &&
        Number.isFinite(targetNum2) &&
        num >= Math.min(targetNum, targetNum2) &&
        num <= Math.max(targetNum, targetNum2)
      );
    case "empty":
      return text.trim() === "";
    case "notEmpty":
      return text.trim() !== "";
    default:
      return true;
  }
}

export function matchesFilter(
  props: Record<string, unknown> | null | undefined,
  config: FilterConfig | null | undefined,
): boolean {
  const rules = activeRules(config);
  if (!rules.length) return true;
  const properties = props ?? {};
  return rules.every((rule) => matchesRule(properties, rule));
}

/** Returns the same collection reference when no rule is active. */
export function filterCollection<T extends FeatureCollection | null | undefined>(
  data: T,
  config: FilterConfig | null | undefined,
): T {
  if (!data || !isFilterActive(config)) return data;
  return {
    ...data,
    features: data.features.filter((feature) => matchesFilter(feature.properties, config)),
  } as T;
}
