"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import * as api from "@/lib/api";
import type { AdvanceCreateResponse, Profile } from "@/lib/api";
import { formatTndCompact, formatPct, tndToMillimes } from "@/lib/money";

function defaultPayoutDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

export default function EmployeeRequestPage() {
  const router = useRouter();
  const [profile, setProfile] = React.useState<Profile | null>(null);
  const [profileError, setProfileError] = React.useState<string | null>(null);
  const [amountTnd, setAmountTnd] = React.useState("");
  const [payoutDate, setPayoutDate] = React.useState(defaultPayoutDate());
  const [submitting, setSubmitting] = React.useState(false);
  const [result, setResult] = React.useState<AdvanceCreateResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    api
      .myProfile()
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .catch((e) => {
        if (!cancelled) setProfileError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const maxPct = profile?.recommended_max_pct ?? null;
  const maxAmount =
    profile && maxPct !== null
      ? Math.round((profile.salary_millimes * maxPct) / 100)
      : null;
  const eligible = maxPct !== null && maxPct >= 5;

  const requestedMillimes = React.useMemo(() => {
    const tnd = Number(amountTnd);
    if (!Number.isFinite(tnd) || tnd <= 0) return null;
    return tndToMillimes(tnd);
  }, [amountTnd]);

  const overCap =
    requestedMillimes !== null && maxAmount !== null && requestedMillimes > maxAmount;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResult(null);
    if (requestedMillimes === null) {
      setError("Enter a valid amount in TND.");
      return;
    }
    if (!payoutDate) {
      setError("Pick a payout date.");
      return;
    }
    setSubmitting(true);
    try {
      const r = await api.createAdvance(requestedMillimes, payoutDate);
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Request an advance</h1>
        <p className="mt-2 text-muted-foreground">
          Confirm the amount against your allowed maximum and eligibility timing before you submit.
          Pending requests are reviewed by HR.
        </p>
      </div>

      {profileError ? (
        <p
          role="alert"
          className="rounded-md border border-[hsl(var(--danger))]/30 bg-[hsl(var(--badge-danger-bg))] px-3 py-2 text-sm text-[hsl(var(--badge-danger-fg))]"
        >
          {profileError}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Your policy</CardTitle>
          <CardDescription>Limits computed by the WALLAIT scoring model.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <Row label="Allowed maximum amount" value={formatTndCompact(maxAmount)} />
          <Row label="Allowed maximum percentage" value={formatPct(maxPct)} />
          <Row
            label="Eligibility"
            value={
              eligible ? (
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
              )
            }
          />
          {profile ? (
            <Row label="Salary on file" value={formatTndCompact(profile.salary_millimes)} />
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>New request</CardTitle>
          <CardDescription>Enter how much you want and when payroll should pay it out.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="amt">Requested amount (TND)</Label>
              <Input
                id="amt"
                type="number"
                inputMode="decimal"
                step="0.001"
                min="0"
                placeholder="e.g. 400"
                value={amountTnd}
                onChange={(e) => setAmountTnd(e.target.value)}
                required
              />
              {overCap ? (
                <p className="text-xs text-[hsl(var(--badge-danger-fg))]">
                  Over the recommended cap of {formatTndCompact(maxAmount)} — HR may reject.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Stay at or below {formatTndCompact(maxAmount)} to keep within the model cap.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="payout">Payout date</Label>
              <Input
                id="payout"
                type="date"
                value={payoutDate}
                onChange={(e) => setPayoutDate(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
                required
              />
            </div>
            {error ? (
              <p
                role="alert"
                className="rounded-md border border-[hsl(var(--danger))]/30 bg-[hsl(var(--badge-danger-bg))] px-3 py-2 text-sm text-[hsl(var(--badge-danger-fg))]"
              >
                {error}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={submitting || !eligible}>
                {submitting ? "Submitting…" : "Submit request"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/employee")}
                disabled={submitting}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {result ? (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle>Submitted — request #{result.request_id}</CardTitle>
            <CardDescription>Awaiting HR decision.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <Row label="Status" value={<Badge variant="warning">{result.status}</Badge>} />
            <Row
              label="Model recommended cap"
              value={`${formatTndCompact(result.model_recommended_amount_millimes)} (${formatPct(result.model_recommended_pct)})`}
            />
            <Row
              label="Within cap?"
              value={
                result.within_model_cap ? (
                  <Badge variant="success">yes</Badge>
                ) : (
                  <Badge variant="danger">no</Badge>
                )
              }
            />
            <Row label="Note" value={result.note} />
            <div className="pt-2">
              <Button asChild variant="outline" size="sm">
                <Link href="/employee">Back to home</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="max-w-[60%] text-right font-medium">{value}</span>
    </div>
  );
}
