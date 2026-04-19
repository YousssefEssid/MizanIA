/** Effective max-advance % = min(model, optional global HR cap, optional per-employee cap). */

export type MaxPctInputs = {
  recommended_max_pct: number | null;
  policy_max_pct?: number | null;
  global_policy_max_pct?: number | null;
};

export function effectiveMaxPct(p: MaxPctInputs): number | null {
  if (p.recommended_max_pct === null || p.recommended_max_pct === undefined) return null;
  let cap = p.recommended_max_pct;
  if (p.global_policy_max_pct !== null && p.global_policy_max_pct !== undefined) {
    cap = Math.min(cap, Math.max(0, p.global_policy_max_pct));
  }
  if (p.policy_max_pct !== null && p.policy_max_pct !== undefined) {
    cap = Math.min(cap, Math.max(0, p.policy_max_pct));
  }
  return cap;
}
