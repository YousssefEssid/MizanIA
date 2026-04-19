"use client";

import * as React from "react";
import { Sparkles, Upload } from "lucide-react";
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

type UploadResult = { created: number; updated: number; errors: string[] };

export default function CompanyResultsPage() {
  const [employees, setEmployees] = React.useState<EmployeePublic[]>([]);
  const [requests, setRequests] = React.useState<AdvanceRequestHR[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [scoring, setScoring] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [uploadResult, setUploadResult] = React.useState<UploadResult | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

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

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setNotice(null);
    setUploadResult(null);
    setError(null);
    try {
      const res = await api.hrUploadCsv(file);
      setUploadResult(res);
      setNotice(
        `Imported file "${file.name}" — created ${res.created}, updated ${res.updated}, errors ${res.errors.length}.`,
      );
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const eligibleCount = employees.filter(
    (e) => (e.recommended_max_pct ?? 0) >= 5 && e.opted_in_wallet,
  ).length;
  const unscored = employees.filter((e) => e.recommended_max_pct === null).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
          Employee results
        </h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          Eligibility and advance limits in plain language. Upload a CSV/XLSX of your roster, run
          scoring, and open a row for full detail and request history.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Roster operations</CardTitle>
          <CardDescription>
            CSV/XLSX upload upserts by <code className="font-mono text-xs">employee_code</code>.
            Required columns:{" "}
            <span className="font-mono text-xs">
              employee_code, full_name, department, salary_millimes, hire_date
            </span>
            ; optional:{" "}
            <span className="font-mono text-xs">
              performance_score, on_time_repayment_rate, past_advance_count, days_since_last_advance,
              has_active_advance, dept_attrition_rate, existing_debt_ratio, opted_in_wallet
            </span>
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={handleUpload}
            />
            <Button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="gap-2"
            >
              <Upload className="h-4 w-4" />
              {uploading ? "Uploading…" : "Upload roster (CSV/XLSX)"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleScore}
              disabled={scoring || employees.length === 0}
              className="gap-2"
            >
              <Sparkles className="h-4 w-4" />
              {scoring ? "Scoring…" : `Score all (${employees.length})`}
            </Button>
          </div>

          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span>
              Total: <span className="font-medium text-foreground">{employees.length}</span>
            </span>
            <span>
              Eligible (≥5%, opted-in): <span className="font-medium text-foreground">{eligibleCount}</span>
            </span>
            <span>
              Unscored: <span className="font-medium text-foreground">{unscored}</span>
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
          {uploadResult && uploadResult.errors.length > 0 ? (
            <details className="rounded-md border border-[hsl(var(--warning))]/30 bg-[hsl(var(--warning-soft))] px-3 py-2 text-sm text-[hsl(var(--warning-fg))]">
              <summary className="cursor-pointer font-medium">
                {uploadResult.errors.length} row error{uploadResult.errors.length === 1 ? "" : "s"} in
                last upload
              </summary>
              <ul className="mt-2 list-inside list-disc space-y-0.5 text-xs">
                {uploadResult.errors.slice(0, 50).map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </details>
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
