export function money(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  if (value >= 1000) return `$${Math.round(value).toLocaleString("en-US")}`;
  if (value >= 100) return `$${value.toFixed(0)}`;
  if (value >= 10) return `$${value.toFixed(1)}`;
  if (value >= 0.1) return `$${value.toFixed(2)}`;
  return `$${value.toFixed(3)}`;
}
export function tokens(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(value >= 1e5 ? 0 : 1)}k`;
  return String(Math.round(value));
}
