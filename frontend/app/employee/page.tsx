"use client";

import * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
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
import type { MyAdvance, MyWalletResponse, Profile } from "@/lib/api";
import { effectiveMaxPct } from "@/lib/policy";
import { formatTndCompact, formatPct, formatDate, formatDateTime } from "@/lib/money";

function statusBadge(status: MyAdvance["status"]) {
  if (status === "paid") return <Badge variant="success">Paid</Badge>;
  if (status === "approved") return <Badge variant="info">Approved</Badge>;
  if (status === "pending") return <Badge variant="warning">Pending</Badge>;
  return <Badge variant="danger">Rejected</Badge>;
}

export default function EmployeeHomePage() {
  const [profile, setProfile] = React.useState<Profile | null>(null);
  const [wallet, setWallet] = React.useState<MyWalletResponse | null>(null);
  const [walletError, setWalletError] = React.useState<string | null>(null);
  const [advances, setAdvances] = React.useState<MyAdvance[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [p, advs] = await Promise.all([api.myProfile(), api.myAdvances()]);
        if (cancelled) return;
        setProfile(p);
        setAdvances(advs);
        setError(null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
      try {
        const w = await api.myWallet();
        if (!cancelled) {
          setWallet(w);
          setWalletError(null);
        }
      } catch (e) {
        if (!cancelled) setWalletError(e instanceof Error ? e.message : String(e));
      }
      if (!cancelled) setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const maxPct = profile ? effectiveMaxPct(profile) : null;
  const maxAmount =
    profile && maxPct !== null
      ? Math.round((profile.salary_millimes * maxPct) / 100)
      : null;
  const eligible = maxPct !== null && maxPct >= 5 && !walletError;

  const activePending = advances.find((a) => a.status === "pending");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Welcome to AvancI</h1>
        <p className="mt-2 text-muted-foreground">
          Your salary advance workspace—see what you can request, what is in flight, and your wallet
          balance.
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

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardDescription>Eligibility</CardDescription>
            <CardTitle className="flex items-center gap-2 text-xl">
              {loading ? (
                <span className="text-muted-foreground">…</span>
              ) : eligible ? (
                <Badge
                  variant="outline"
                  className="border-primary/30 font-semibold text-foreground dark:border-primary/40"
                >
                  Eligible
                </Badge>
              ) : maxPct === null ? (
                <Badge variant="warning">Pending review</Badge>
              ) : (
                <Badge variant="danger">Not eligible</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {profile
              ? `${profile.full_name} · ${profile.department}`
              : "Profile not loaded."}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Maximum advance</CardDescription>
            <CardTitle className="font-heading text-2xl tabular-nums">
              {loading ? "…" : formatTndCompact(maxAmount)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Up to <span className="font-medium text-foreground">{formatPct(maxPct)}</span> of salary
            {profile ? ` · Net salary: ${formatTndCompact(profile.salary_millimes)}` : ""}
          </CardContent>
        </Card>
      </div>

      <Card className="border-primary/20 bg-muted/20">
        <CardHeader>
          <CardTitle>Wallet</CardTitle>
          <CardDescription>Internal balance you can withdraw or have deducted from payroll.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="font-heading text-3xl tabular-nums text-foreground">
              {wallet ? formatTndCompact(wallet.wallet.balance_millimes) : walletError ? "—" : "…"}
            </p>
            <p className="text-xs text-muted-foreground">
              {wallet
                ? `Wallet #${wallet.wallet_id} · ${wallet.wallet.currency}`
                : walletError ?? "Loading wallet…"}
            </p>
          </div>
          <Button asChild size="lg" className="shrink-0" disabled={activePending !== undefined}>
            <Link href="/employee/request">
              {activePending ? "Request pending review" : "Request an advance"}
            </Link>
          </Button>
        </CardContent>
      </Card>

      {wallet ? (
        <Card>
          <CardHeader>
            <CardTitle>Recent ledger</CardTitle>
            <CardDescription>Last 25 movements on your wallet.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Direction</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Request</TableHead>
                    <TableHead>When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {wallet.recent.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        No movements yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    wallet.recent.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell>
                          {e.direction === "credit" ? (
                            <Badge variant="success">credit</Badge>
                          ) : (
                            <Badge variant="warning">debit</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatTndCompact(e.amount_millimes)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {e.related_request_id ? `#${e.related_request_id}` : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDateTime(e.created_at)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>My advance requests</CardTitle>
          <CardDescription>Newest first.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead className="text-right">Requested</TableHead>
                  <TableHead className="text-right">Model max</TableHead>
                  <TableHead>Payout</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {advances.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No requests yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  advances.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-mono text-xs">#{a.id}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatTndCompact(a.requested_amount_millimes)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatTndCompact(a.model_recommended_amount_millimes)}
                      </TableCell>
                      <TableCell>{formatDate(a.requested_payout_date)}</TableCell>
                      <TableCell>{statusBadge(a.status)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
