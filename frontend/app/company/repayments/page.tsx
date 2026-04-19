"use client";

import * as React from "react";
import { Download } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import * as api from "@/lib/api";
import type { PayrollLine } from "@/lib/api";
import { formatTndCompact } from "@/lib/money";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export default function CompanyRepaymentsPage() {
  const today = React.useMemo(() => new Date(), []);
  const [year, setYear] = React.useState(today.getFullYear());
  const [month, setMonth] = React.useState(today.getMonth() + 1);
  const [rows, setRows] = React.useState<PayrollLine[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await api.hrPayrollDeductions(year, month);
        if (!cancelled) {
          setRows(res);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [year, month]);

  const total = rows.reduce((s, r) => s + r.total_advanced_millimes, 0);

  function downloadCsv() {
    const header = "employee_code,full_name,total_advanced_millimes,total_advanced_tnd";
    const body = rows
      .map((r) =>
        [
          r.employee_code,
          `"${r.full_name.replace(/"/g, '""')}"`,
          r.total_advanced_millimes,
          (r.total_advanced_millimes / 1000).toFixed(3),
        ].join(","),
      )
      .join("\n");
    const blob = new Blob([`${header}\n${body}\n`], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payroll-deductions-${year}-${String(month).padStart(2, "0")}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const years = React.useMemo(() => {
    const y: number[] = [];
    for (let i = today.getFullYear() - 2; i <= today.getFullYear() + 1; i++) y.push(i);
    return y;
  }, [today]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
          Payroll deductions
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Per-employee total of advances paid in the selected month. Hand this over to payroll for
          end-of-month deductions.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <CardTitle>Period</CardTitle>
            <CardDescription>Pick the payroll month to deduct.</CardDescription>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-32 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Month</Label>
              <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-28 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Year</Label>
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={downloadCsv}
              disabled={rows.length === 0}
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error ? (
            <p
              role="alert"
              className="mb-3 rounded-md border border-[hsl(var(--danger))]/30 bg-[hsl(var(--badge-danger-bg))] px-3 py-2 text-sm text-[hsl(var(--badge-danger-fg))]"
            >
              {error}
            </p>
          ) : null}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee code</TableHead>
                  <TableHead>Full name</TableHead>
                  <TableHead className="text-right">Total advanced</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      No paid advances for {MONTHS[month - 1]} {year}.
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {rows.map((r) => (
                      <TableRow key={r.employee_profile_id}>
                        <TableCell className="font-mono text-xs">{r.employee_code}</TableCell>
                        <TableCell className="font-medium">{r.full_name}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatTndCompact(r.total_advanced_millimes)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-t-2 border-border">
                      <TableCell colSpan={2} className="font-semibold">
                        Total
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {formatTndCompact(total)}
                      </TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
