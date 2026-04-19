"use client";

import * as React from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DashboardMiniChart } from "@/components/dashboard-mini-chart";
import * as api from "@/lib/api";
import type { AdvanceRequestHR, EmployeePublic, EmployerWalletInfo } from "@/lib/api";
import { formatTndCompact, formatDateTime } from "@/lib/money";

type DashboardData = {
  employees: EmployeePublic[];
  pending: AdvanceRequestHR[];
  paid: AdvanceRequestHR[];
  wallet: EmployerWalletInfo;
};

export default function CompanyDashboardPage() {
  const [data, setData] = React.useState<DashboardData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [employees, pending, paid, wallet] = await Promise.all([
          api.hrEmployees(),
          api.hrRequests("pending"),
          api.hrRequests("paid"),
          api.hrWallet(),
        ]);
        if (cancelled) return;
        setData({ employees, pending, paid, wallet });
        setError(null);
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
  }, []);

  const employeesImported = data?.employees.length ?? 0;
  const eligibleEmployees = data
    ? data.employees.filter((e) => (e.recommended_max_pct ?? 0) >= 5).length
    : 0;
  const pendingCount = data?.pending.length ?? 0;
  const monthStart = React.useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }, []);
  const paidThisMonth = data
    ? data.paid.filter((r) => new Date(r.created_at) >= monthStart).length
    : 0;
  const totalPaidThisMonth = data
    ? data.paid
        .filter((r) => new Date(r.created_at) >= monthStart)
        .reduce((s, r) => s + r.requested_amount_millimes, 0)
    : 0;

  const lastImport = data?.employees.reduce<EmployeePublic | null>((acc, e) => {
    if (!e.last_scored_at) return acc;
    if (!acc || new Date(e.last_scored_at) > new Date(acc.last_scored_at!)) return e;
    return acc;
  }, null);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
          Mizania company dashboard
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Welcome back—here is a concise view of imports, eligibility coverage, requests, and
          repayments for your organization.
        </p>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-[hsl(var(--danger))]/30 bg-[hsl(var(--badge-danger-bg))] px-3 py-2 text-sm text-[hsl(var(--badge-danger-fg))]"
        >
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Employees imported"
          value={loading ? "…" : String(employeesImported)}
          hint={
            lastImport?.last_scored_at
              ? `Last scored ${formatDateTime(lastImport.last_scored_at)}`
              : "No employees yet — upload a CSV"
          }
        />
        <KpiCard
          label="Eligible employees"
          value={loading ? "…" : String(eligibleEmployees)}
          hint={`${employeesImported} total · threshold 5%`}
        />
        <KpiCard
          label="Pending requests"
          value={loading ? "…" : String(pendingCount)}
          hint={`${paidThisMonth} paid this month`}
        />
        <KpiCard
          label="Wallet balance"
          value={loading ? "…" : formatTndCompact(data?.wallet.balance_millimes)}
          hint={`Paid out this month: ${formatTndCompact(totalPaidThisMonth)}`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Requests trend</CardTitle>
            <CardDescription>
              Illustrative chart — connect analytics when ready.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DashboardMiniChart />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent paid advances</CardTitle>
            <CardDescription>Latest disbursements from your wallet.</CardDescription>
          </CardHeader>
          <CardContent>
            {data && data.paid.length > 0 ? (
              <ul className="space-y-3 text-sm text-muted-foreground">
                {data.paid.slice(0, 5).map((r) => (
                  <li key={r.id}>
                    <span className="font-medium text-foreground">
                      {r.employee_name}
                    </span>{" "}
                    — {formatTndCompact(r.requested_amount_millimes)}
                    <br />
                    <span className="text-xs">
                      {formatDateTime(r.created_at)} · request #{r.id}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                No paid advances yet. Approve a pending request to see it here.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-primary/20">
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>Quick actions</CardTitle>
            <CardDescription>Common operations to keep your workspace flowing.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/company/results">Manage employees</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/company/requests">Review requests</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/company/wallet">Fund wallet</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/company/repayments">Payroll deductions</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="font-heading text-3xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}
