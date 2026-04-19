"use client";

import * as React from "react";
import { ShieldCheck, Wallet as WalletIcon } from "lucide-react";
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
import type { EmployerWalletInfo, VerifyChainResponse, WalletLedger } from "@/lib/api";
import { formatTndCompact, formatDateTime, tndToMillimes } from "@/lib/money";

export default function CompanyWalletPage() {
  const [wallet, setWallet] = React.useState<EmployerWalletInfo | null>(null);
  const [ledger, setLedger] = React.useState<WalletLedger | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const [amountTnd, setAmountTnd] = React.useState("");
  const [funding, setFunding] = React.useState(false);

  const [verifyResult, setVerifyResult] = React.useState<VerifyChainResponse | null>(null);
  const [verifying, setVerifying] = React.useState(false);

  const reload = React.useCallback(async () => {
    setLoading(true);
    try {
      const w = await api.hrWallet();
      setWallet(w);
      const l = await api.walletLedger(w.wallet_id, 50);
      setLedger(l);
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

  async function handleFund(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    setError(null);
    const tnd = Number(amountTnd);
    if (!Number.isFinite(tnd) || tnd <= 0) {
      setError("Enter an amount greater than 0 TND.");
      return;
    }
    setFunding(true);
    try {
      const res = await api.hrFundWallet(tndToMillimes(tnd));
      setNotice(
        `Credited ${formatTndCompact(tndToMillimes(tnd))} to wallet #${res.wallet_id}. New balance ${formatTndCompact(res.balance_millimes)}.`,
      );
      setAmountTnd("");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setFunding(false);
    }
  }

  async function handleVerify() {
    if (!wallet) return;
    setVerifying(true);
    setVerifyResult(null);
    try {
      const r = await api.verifyChain(wallet.wallet_id);
      setVerifyResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
          Employer wallet
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Internal wallet that funds employee advances. Every credit and debit is appended to a
          per-wallet SHA-256 hash chain so the full history is tamper-evident.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardDescription>Available balance</CardDescription>
            <CardTitle className="flex items-center gap-2 font-heading text-3xl tabular-nums">
              <WalletIcon className="h-6 w-6 text-primary" />
              {loading ? "…" : formatTndCompact(wallet?.balance_millimes)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {wallet
              ? `Wallet #${wallet.wallet_id} · Employer #${wallet.employer_id}`
              : "—"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Fund wallet</CardTitle>
            <CardDescription>
              Demo top-up — credits the employer wallet directly. In production this would be a bank
              webhook.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleFund} className="flex flex-wrap items-end gap-3">
              <div className="min-w-[180px] flex-1 space-y-1.5">
                <Label htmlFor="fund-amount">Amount (TND)</Label>
                <Input
                  id="fund-amount"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.001"
                  placeholder="e.g. 10000"
                  value={amountTnd}
                  onChange={(e) => setAmountTnd(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" disabled={funding}>
                {funding ? "Funding…" : "Credit wallet"}
              </Button>
            </form>
          </CardContent>
        </Card>
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
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Hash-chain integrity</CardTitle>
            <CardDescription>
              Recompute every entry hash and confirm the chain links back to genesis.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {verifyResult ? (
              verifyResult.ok ? (
                <Badge variant="success">Chain OK</Badge>
              ) : (
                <Badge variant="danger">
                  Broken at #
                  {verifyResult.broken_at_entry_id ??
                    verifyResult.broken_at ??
                    "?"}
                </Badge>
              )
            ) : null}
            <Button
              type="button"
              variant="outline"
              onClick={handleVerify}
              disabled={!wallet || verifying}
              className="gap-2"
            >
              <ShieldCheck className="h-4 w-4" />
              {verifying ? "Verifying…" : "Verify chain"}
            </Button>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent ledger entries</CardTitle>
          <CardDescription>Newest first — debits leave the wallet, credits enter.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Entry</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Request</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Hash</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!ledger ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : ledger.entries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No entries yet — credit the wallet to start the chain.
                    </TableCell>
                  </TableRow>
                ) : (
                  [...ledger.entries].reverse().map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-mono text-xs">#{e.id}</TableCell>
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
                      <TableCell
                        className="max-w-[160px] truncate font-mono text-[10px] text-muted-foreground"
                        title={e.entry_hash}
                      >
                        {e.entry_hash.slice(0, 12)}…
                      </TableCell>
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
