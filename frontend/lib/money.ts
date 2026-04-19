/**
 * TND amounts on the wire are integer millimes (1 TND = 1000 millimes).
 * Display helpers keep all formatting in one place so we never accidentally
 * mix decimal TND and integer millimes.
 */

const NBSP = "\u00A0";

export function millimesToTnd(m: number | null | undefined): number {
  if (m === null || m === undefined || Number.isNaN(m)) return 0;
  return m / 1000;
}

export function tndToMillimes(tnd: number): number {
  return Math.round(tnd * 1000);
}

export function formatTnd(
  millimes: number | null | undefined,
  opts: { decimals?: number; suffix?: string } = {},
): string {
  if (millimes === null || millimes === undefined) return "N/A";
  const decimals = opts.decimals ?? 3;
  const suffix = opts.suffix ?? "TND";
  const tnd = millimesToTnd(millimes);
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(tnd);
  return `${formatted}${NBSP}${suffix}`;
}

/** Compact display: "1,250 TND" with no decimals when amount is whole-TND. */
export function formatTndCompact(millimes: number | null | undefined): string {
  if (millimes === null || millimes === undefined) return "N/A";
  const isWhole = millimes % 1000 === 0;
  return formatTnd(millimes, { decimals: isWhole ? 0 : 3 });
}

export function formatPct(pct: number | null | undefined, decimals = 1): string {
  if (pct === null || pct === undefined || Number.isNaN(pct)) return "N/A";
  return `${pct.toFixed(decimals)}%`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "N/A";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "N/A";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
