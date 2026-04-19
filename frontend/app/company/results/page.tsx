"use client";

import * as React from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmployeeResultsTable } from "@/components/employee-results-table";
import * as api from "@/lib/api";
import type { AdvanceRequestHR, EmployeePublic } from "@/lib/api";
import { effectiveMaxPct } from "@/lib/policy";

export default function CompanyResultsPage() {
  const [employees, setEmployees] = React.useState<EmployeePublic[]>([]);
  const [requests, setRequests] = React.useState<AdvanceRequestHR[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [scoring, setScoring] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);

  const reload = React.useCallback(async () => {
    setLoading(true);
    try {
      const [emps, reqs] = await Promise.all([api.hrEmployees(), api.hrRequests()]);
      setEmployees(emps);
      setRequests(reqs);
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

  async function handleScore() {
    setScoring(true);
    setNotice(null);
    setError(null);
    try {
      const res = await api.hrScoreAll();
      setNotice(
        `Scored ${res.scored} employees. ` +
          `Employee logins: ${res.employee_accounts_created} created, ` +
          `${res.employee_accounts_already_linked} already linked. ` +
          `New accounts use password 123456 and email {employee_code}@«your HR email domain» (e.g. demo-002@demo.tn when HR is @demo.tn).`,
      );
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setScoring(false);
    }
  }

  const eligibleCount = employees.filter((e) => {
    const eff = effectiveMaxPct(e);
    return eff !== null && eff >= 5 && e.opted_in_wallet;
  }).length;
  const unscored = employees.filter((e) => e.recommended_max_pct === null).length;
  const overridden = employees.filter((e) => e.policy_max_pct !== null).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
          Employee results
        </h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          Eligibility and advance limits computed by the AvancI model. Upload your roster in the{" "}
          <Link href="/company/upload" className="font-medium text-primary hover:underline">
            Upload
          </Link>{" "}
          tab, run the model here, and tune per-employee caps in{" "}
          <Link href="/company/policy" className="font-medium text-primary hover:underline">
            Policy
          </Link>
          .
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Run the model</CardTitle>
          <CardDescription>
            Recomputes the recommended max % for every employee in your roster and provisions
            employee logins for any new rows.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={handleScore}
              disabled={scoring || employees.length === 0}
              className="gap-2"
            >
              <Sparkles className="h-4 w-4" />
              {scoring ? "Running…" : `Run model (${employees.length})`}
            </Button>
            <Button asChild variant="outline">
              <Link href="/company/upload">Go to upload</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/company/policy">Tune policy</Link>
            </Button>
          </div>

          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span>
              Total: <span className="font-medium text-foreground">{employees.length}</span>
            </span>
            <span>
              Eligible (≥5%, opted-in):{" "}
              <span className="font-medium text-foreground">{eligibleCount}</span>
            </span>
            <span>
              Unscored: <span className="font-medium text-foreground">{unscored}</span>
            </span>
            <span>
              HR overrides: <span className="font-medium text-foreground">{overridden}</span>
            </span>
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
        </CardContent>
      </Card>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading employees…</p>
      ) : (
        <EmployeeResultsTable data={employees} requests={requests} />
      )}
    </div>
  );
}
