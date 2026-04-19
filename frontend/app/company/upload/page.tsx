"use client";

import * as React from "react";
import Link from "next/link";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import * as api from "@/lib/api";
import type { CsvUploadError, EmployeePublic } from "@/lib/api";
import { formatTndCompact, formatDate } from "@/lib/money";

type FilePickSummary =
  | { kind: "csv"; filename: string; dataRows: number; uniqueCodes: number }
  | { kind: "excel"; filename: string };

type UploadOutcome = {
  filename: string;
  created: number;
  updated: number;
  errors: CsvUploadError[];
};

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function parseCsv(text: string): { columns: string[]; rows: Record<string, string>[] } {
  const lines = text.replace(/\r\n?/g, "\n").split("\n").filter((l) => l.length > 0);
  if (lines.length === 0) return { columns: [], rows: [] };
  const columns = splitCsvLine(lines[0]).map((c) => c.toLowerCase().replace(/\s+/g, "_"));
  const rows = lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    const obj: Record<string, string> = {};
    columns.forEach((col, i) => {
      obj[col] = values[i] ?? "";
    });
    return obj;
  });
  return { columns, rows };
}

function summarizeCsvRows(rows: Record<string, string>[]): { dataRows: number; uniqueCodes: number } {
  const dataRows = rows.length;
  const codes = rows
    .map((r) => String(r["employee_code"] ?? "").trim())
    .filter((c) => c.length > 0 && c.toLowerCase() !== "nan");
  const uniqueCodes = new Set(codes).size;
  return { dataRows, uniqueCodes };
}

export default function CompanyUploadPage() {
  const [employees, setEmployees] = React.useState<EmployeePublic[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [fileSummary, setFileSummary] = React.useState<FilePickSummary | null>(null);
  const [outcome, setOutcome] = React.useState<UploadOutcome | null>(null);
  const [pendingFile, setPendingFile] = React.useState<File | null>(null);
  const [importing, setImporting] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const reload = React.useCallback(async () => {
    setLoading(true);
    try {
      const emps = await api.hrEmployees();
      setEmployees(emps);
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

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setOutcome(null);
    setError(null);
    if (!file) {
      setFileSummary(null);
      setPendingFile(null);
      return;
    }
    setPendingFile(file);
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
      setFileSummary({ kind: "excel", filename: file.name });
      return;
    }
    try {
      const text = await file.text();
      const { rows } = parseCsv(text);
      const { dataRows, uniqueCodes } = summarizeCsvRows(rows);
      setFileSummary({ kind: "csv", filename: file.name, dataRows, uniqueCodes });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setFileSummary(null);
    }
  }

  function reset() {
    setFileSummary(null);
    setPendingFile(null);
    setOutcome(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleImport() {
    if (!pendingFile) return;
    setImporting(true);
    setError(null);
    try {
      const res = await api.hrUploadCsv(pendingFile);
      setOutcome({
        filename: pendingFile.name,
        created: res.created,
        updated: res.updated,
        errors: res.errors ?? [],
      });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
          Roster upload
        </h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          Upload a CSV/XLSX of your employees, then import. Scoring and eligibility happen separately
          in the{" "}
          <Link href="/company/results" className="font-medium text-primary hover:underline">
            Results
          </Link>{" "}
          tab.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload file</CardTitle>
          <CardDescription>
            Upserts by <code className="font-mono text-xs">employee_code</code>. If the same code
            appears more than once in a file, the <span className="font-medium">last</span> row wins.
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
              onChange={handleFileChange}
            />
            <Button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="gap-2"
            >
              <Upload className="h-4 w-4" />
              Choose CSV / XLSX
            </Button>
            {pendingFile ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleImport}
                  disabled={importing}
                >
                  {importing ? "Importing…" : `Import ${pendingFile.name}`}
                </Button>
                <Button type="button" variant="ghost" onClick={reset} disabled={importing}>
                  Clear
                </Button>
              </>
            ) : null}
          </div>
          {fileSummary && !outcome ? (
            <p className="text-sm text-muted-foreground">
              {fileSummary.kind === "csv" ? (
                <>
                  <span className="font-medium text-foreground">{fileSummary.filename}</span>
                  {": "}
                  {fileSummary.dataRows} data row{fileSummary.dataRows === 1 ? "" : "s"},{" "}
                  {fileSummary.uniqueCodes} unique code
                  {fileSummary.uniqueCodes === 1 ? "" : "s"}
                  {fileSummary.dataRows > fileSummary.uniqueCodes
                    ? " (duplicate codes use the last row on import)"
                    : ""}
                  .
                </>
              ) : (
                <>
                  <span className="font-medium text-foreground">{fileSummary.filename}</span> (Excel
                  file). Row counts and duplicate handling are applied when you import.
                </>
              )}
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
          {outcome ? (
            <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
              <p className="text-foreground">
                Imported <span className="font-medium">{outcome.filename}</span>
                {": created "}
                <span className="font-medium">{outcome.created}</span>, updated{" "}
                <span className="font-medium">{outcome.updated}</span>, errors{" "}
                <span className="font-medium">{outcome.errors.length}</span>.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Switch to the{" "}
                <Link href="/company/results" className="font-medium text-primary hover:underline">
                  Results
                </Link>{" "}
                tab and click <span className="font-medium">Run model</span> to score the new rows.
              </p>
              {outcome.errors.length > 0 ? (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs font-medium text-[hsl(var(--warning-fg))]">
                    {outcome.errors.length} row error
                    {outcome.errors.length === 1 ? "" : "s"}
                  </summary>
                  <ul className="mt-2 list-inside list-disc space-y-0.5 text-xs text-muted-foreground">
                    {outcome.errors.slice(0, 50).map((err, i) => (
                      <li key={i}>
                        Row {err.row}: {err.error}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Imported roster ({employees.length})</CardTitle>
          <CardDescription>
            Raw employee data currently stored (no model output here). Eligibility lives in the
            Results tab.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Full name</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead className="text-right">Salary</TableHead>
                  <TableHead>Wallet opt-in</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : employees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No employees yet. Upload a CSV to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  employees.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-mono text-xs">{e.employee_code}</TableCell>
                      <TableCell className="font-medium">{e.full_name}</TableCell>
                      <TableCell>{e.department}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatTndCompact(e.salary_millimes)}
                      </TableCell>
                      <TableCell>
                        {e.opted_in_wallet ? (
                          <span className="text-foreground">Yes</span>
                        ) : (
                          <span className="text-muted-foreground">No</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Last refresh: {formatDate(new Date().toISOString())}
      </p>
    </div>
  );
}
