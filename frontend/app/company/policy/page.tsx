"use client";

import * as React from "react";
import { CalendarClock, Percent, RotateCcw, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import * as api from "@/lib/api";
import type { EmployeePublic, EmployerPolicy } from "@/lib/api";
import { effectiveMaxPct } from "@/lib/policy";
import { formatPct, formatTndCompact } from "@/lib/money";
import { cn } from "@/lib/utils";

type RowState = {
  draft: string;
  saving: boolean;
  error: string | null;
};

export default function CompanyPolicyPage() {
  const [employees, setEmployees] = React.useState<EmployeePublic[]>([]);
  const [policy, setPolicy] = React.useState<EmployerPolicy | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const [cutoffDraft, setCutoffDraft] = React.useState<string>("");
  const [globalDraft, setGlobalDraft] = React.useState<string>("");
  const [savingPolicy, setSavingPolicy] = React.useState(false);

  const [rowStates, setRowStates] = React.useState<Record<number, RowState>>({});

  const reload = React.useCallback(async () => {
    setLoading(true);
    try {
      const [emps, pol] = await Promise.all([api.hrEmployees(), api.hrGetPolicy()]);
      setEmployees(emps);
      setPolicy(pol);
      setCutoffDraft(
        pol.request_cutoff_day_of_month === null ? "" : String(pol.request_cutoff_day_of_month),
      );
      setGlobalDraft(
        pol.global_policy_max_pct === null || pol.global_policy_max_pct === undefined
          ? ""
          : String(pol.global_policy_max_pct),
      );
      const next: Record<number, RowState> = {};
      for (const e of emps) {
        next[e.id] = {
          draft:
            e.policy_max_pct === null || e.policy_max_pct === undefined
              ? ""
              : String(e.policy_max_pct),
          saving: false,
          error: null,
        };
      }
      setRowStates(next);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  async function savePolicy() {
    setSavingPolicy(true);
    setNotice(null);
    setError(null);
    try {
      const trimmed = cutoffDraft.trim();
      let day: number | null = null;
      if (trimmed.length > 0) {
        const n = Number(trimmed);
        if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1 || n > 31) {
          throw new Error("Cut-off day must be an integer between 1 and 31, or empty.");
        }
        day = n;
      }
      const gtrim = globalDraft.trim();
      let globalPct: number | null = null;
      if (gtrim.length > 0) {
        const g = Number(gtrim);
        if (!Number.isFinite(g) || g < 0 || g > 100) {
          throw new Error("Global HR override % must be between 0 and 100, or empty.");
        }
        globalPct = g;
      }
      const res = await api.hrUpdatePolicy({
        request_cutoff_day_of_month: day,
        global_policy_max_pct: globalPct,
      });
      setPolicy(res);
      const cutMsg =
        day === null
          ? "Cut-off cleared (requests allowed any day)."
          : `Cut-off: day ${day} of each month.`;
      const globMsg =
        globalPct === null
          ? "Global HR cap cleared."
          : `Global HR cap: ${globalPct}% (per-employee caps can lower further).`;
      setNotice(`${cutMsg} ${globMsg}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingPolicy(false);
    }
  }

  function patchRow(id: number, patch: Partial<RowState>) {
    setRowStates((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? { draft: "", saving: false, error: null }), ...patch },
    }));
  }

  async function saveRow(emp: EmployeePublic) {
    const state = rowStates[emp.id];
    if (!state) return;
    const trimmed = state.draft.trim();
    let pct: number | null = null;
    if (trimmed.length > 0) {
      const n = Number(trimmed);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        patchRow(emp.id, { error: "Enter a number between 0 and 100, or leave blank." });
        return;
      }
      const modelCap = emp.recommended_max_pct;
      const gCap = policy?.global_policy_max_pct;
      const ceiling =
        modelCap === null || modelCap === undefined
          ? 100
          : gCap === null || gCap === undefined
            ? modelCap
            : Math.min(modelCap, gCap);
      if (modelCap !== null && modelCap !== undefined && n > ceiling + 1e-6) {
        patchRow(emp.id, {
          error: `Cap must be ≤ ${ceiling.toFixed(2)}% (model${gCap != null ? " & global HR" : ""}).`,
        });
        return;
      }
      pct = n;
    }
    patchRow(emp.id, { saving: true, error: null });
    try {
      const updated = await api.hrUpdateEmployeePolicy(emp.id, pct);
      setEmployees((prev) => prev.map((e) => (e.id === emp.id ? updated : e)));
      patchRow(emp.id, {
        draft:
          updated.policy_max_pct === null || updated.policy_max_pct === undefined
            ? ""
            : String(updated.policy_max_pct),
        saving: false,
      });
    } catch (e) {
      patchRow(emp.id, {
        saving: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  async function clearRow(emp: EmployeePublic) {
    patchRow(emp.id, { draft: "" });
    patchRow(emp.id, { saving: true, error: null });
    try {
      const updated = await api.hrUpdateEmployeePolicy(emp.id, null);
      setEmployees((prev) => prev.map((e) => (e.id === emp.id ? updated : e)));
      patchRow(emp.id, { draft: "", saving: false });
    } catch (e) {
      patchRow(emp.id, {
        saving: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const overriddenCount = employees.filter(
    (e) => e.policy_max_pct !== null && e.policy_max_pct !== undefined,
  ).length;
  const unscoredCount = employees.filter(
    (e) => e.recommended_max_pct === null || e.recommended_max_pct === undefined,
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
          Advance policy
        </h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          Set a monthly cut-off, an optional employer-wide max advance %, and per-employee caps.
          Effective % is the minimum of model, global HR, and row override.
        </p>
      </div>

      {notice ? (
        <p className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-foreground">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="rounded-md border border-[hsl(var(--danger))]/30 bg-[hsl(var(--badge-danger-bg))] px-3 py-2 text-sm text-[hsl(var(--badge-danger-fg))]"
        >
          {error}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" />
            <span>Employer-wide policy</span>
          </CardTitle>
          <CardDescription>
            Monthly request cut-off and optional global max advance % that applies to every employee
            (per-row overrides can only reduce further, not exceed the model or this cap).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void savePolicy();
            }}
          >
            <div className="flex flex-wrap items-end gap-4">
              <div className="w-40 space-y-1.5">
                <Label htmlFor="cutoff">Cut-off day (1–31)</Label>
                <Input
                  id="cutoff"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={31}
                  step={1}
                  placeholder="e.g. 25"
                  value={cutoffDraft}
                  onChange={(e) => setCutoffDraft(e.target.value)}
                />
              </div>
              <div className="w-44 space-y-1.5">
                <Label htmlFor="global-pct" className="flex items-center gap-1.5">
                  <Percent className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                  Global HR max %
                </Label>
                <Input
                  id="global-pct"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={100}
                  step="0.1"
                  placeholder="e.g. 10 (optional)"
                  value={globalDraft}
                  onChange={(e) => setGlobalDraft(e.target.value)}
                />
              </div>
              <Button type="submit" className="gap-2" disabled={savingPolicy || loading}>
                <Save className="h-4 w-4" />
                {savingPolicy ? "Saving…" : "Save policy"}
              </Button>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <p>
                Cut-off:{" "}
                <span className="font-medium text-foreground">
                  {policy?.request_cutoff_day_of_month
                    ? `Day ${policy.request_cutoff_day_of_month} of each month`
                    : "Open all month"}
                </span>
              </p>
              <p>
                Global max %:{" "}
                <span className="font-medium text-foreground">
                  {policy?.global_policy_max_pct != null
                    ? formatPct(policy.global_policy_max_pct)
                    : "— (no cap)"}
                </span>
              </p>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Per-employee caps</CardTitle>
          <CardDescription>
            Override the model downward per person. Leave blank to use only the global cap (if any)
            and model. Effective cap = min(model, global HR, row override).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span>
              Total: <span className="font-medium text-foreground">{employees.length}</span>
            </span>
            <span>
              HR overrides: <span className="font-medium text-foreground">{overriddenCount}</span>
            </span>
            <span>
              Unscored: <span className="font-medium text-foreground">{unscoredCount}</span>
            </span>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead className="text-right">Salary</TableHead>
                  <TableHead className="text-right">Model max %</TableHead>
                  <TableHead>HR override %</TableHead>
                  <TableHead className="text-right">Effective max</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : employees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No employees yet — upload a roster first.
                    </TableCell>
                  </TableRow>
                ) : (
                  employees.map((e) => {
                    const state = rowStates[e.id] ?? {
                      draft: "",
                      saving: false,
                      error: null,
                    };
                    const eff = effectiveMaxPct(e);
                    const effAmount =
                      eff === null ? null : Math.round((e.salary_millimes * eff) / 100);
                    const overridden =
                      e.policy_max_pct !== null && e.policy_max_pct !== undefined;
                    const unscored =
                      e.recommended_max_pct === null || e.recommended_max_pct === undefined;
                    const rowCeiling =
                      e.recommended_max_pct == null
                        ? 100
                        : policy?.global_policy_max_pct == null
                          ? e.recommended_max_pct
                          : Math.min(e.recommended_max_pct, policy.global_policy_max_pct);
                    return (
                      <TableRow key={e.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{e.full_name}</span>
                            <span className="font-mono text-xs text-muted-foreground">
                              {e.employee_code}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {e.department}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatTndCompact(e.salary_millimes)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {unscored ? (
                            <Badge variant="warning">Unscored</Badge>
                          ) : (
                            formatPct(e.recommended_max_pct)
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                min={0}
                                max={rowCeiling}
                                step="0.1"
                                placeholder={
                                  unscored
                                    ? "Run model first"
                                    : `0 – ${rowCeiling.toFixed(1)}`
                                }
                                value={state.draft}
                                onChange={(ev) =>
                                  patchRow(e.id, { draft: ev.target.value, error: null })
                                }
                                disabled={state.saving || unscored}
                                className={cn(
                                  "h-9 w-28",
                                  state.error &&
                                    "border-[hsl(var(--danger))] focus-visible:ring-[hsl(var(--danger))]",
                                )}
                                aria-label={`HR override percentage for ${e.full_name}`}
                              />
                              {overridden ? (
                                <Badge variant="info" className="shrink-0">
                                  Override
                                </Badge>
                              ) : null}
                            </div>
                            {state.error ? (
                              <p className="text-[10px] text-[hsl(var(--badge-danger-fg))]">
                                {state.error}
                              </p>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {eff === null ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <div className="flex flex-col items-end leading-tight">
                              <span className="font-medium">{formatPct(eff)}</span>
                              <span className="text-xs text-muted-foreground">
                                {formatTndCompact(effAmount)}
                              </span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => saveRow(e)}
                              disabled={state.saving || unscored}
                              className="gap-1"
                            >
                              <Save className="h-3.5 w-3.5" />
                              {state.saving ? "Saving…" : "Save"}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => clearRow(e)}
                              disabled={state.saving || !overridden}
                              className="gap-1"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              Clear
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
