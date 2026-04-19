"use client";

import * as React from "react";
import { Check, X } from "lucide-react";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import * as api from "@/lib/api";
import type { AdvanceRequestHR, AdvanceStatus } from "@/lib/api";
import { formatTndCompact, formatPct, formatDate, formatDateTime } from "@/lib/money";

const STATUSES: { value: AdvanceStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "paid", label: "Paid" },
];

function statusBadge(status: AdvanceStatus) {
  if (status === "paid") return <Badge variant="success">Paid</Badge>;
  if (status === "approved") return <Badge variant="info">Approved</Badge>;
  if (status === "pending") return <Badge variant="warning">Pending</Badge>;
  return <Badge variant="danger">Rejected</Badge>;
}

export default function CompanyRequestsPage() {
  const [filter, setFilter] = React.useState<AdvanceStatus | "all">("pending");
  const [rows, setRows] = React.useState<AdvanceRequestHR[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [pendingId, setPendingId] = React.useState<number | null>(null);

  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [rejectTarget, setRejectTarget] = React.useState<AdvanceRequestHR | null>(null);
  const [rejectReason, setRejectReason] = React.useState("");

  const reload = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.hrRequests(filter === "all" ? undefined : filter);
      setRows(res);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [filter]);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  async function handleApprove(req: AdvanceRequestHR) {
    setPendingId(req.id);
    setNotice(null);
    setError(null);
    try {
      const res = await api.hrApprove(req.id);
      setNotice(
        `Request #${req.id} ${res.status} for ${req.employee_name} (${formatTndCompact(req.requested_amount_millimes)}).`,
      );
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPendingId(null);
    }
  }

  function openReject(req: AdvanceRequestHR) {
    setRejectTarget(req);
    setRejectReason("");
    setRejectOpen(true);
  }

  async function confirmReject() {
    if (!rejectTarget) return;
    setPendingId(rejectTarget.id);
    setNotice(null);
    setError(null);
    try {
      await api.hrReject(rejectTarget.id, rejectReason.trim() || "");
      setNotice(`Request #${rejectTarget.id} rejected.`);
      setRejectOpen(false);
      setRejectTarget(null);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
          Request management
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Review pending advances, approve to debit your employer wallet (atomic transfer with
          hash-chain ledger entries), or reject with a reason.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <CardTitle>Filter</CardTitle>
            <CardDescription>Slice requests by status.</CardDescription>
          </div>
          <div className="w-full max-w-[240px]">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Select
              value={filter}
              onValueChange={(v) => setFilter(v as AdvanceStatus | "all")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
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

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>Model max</TableHead>
                  <TableHead>Payout</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      No requests for this filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r) => {
                    const overCap =
                      r.model_recommended_amount_millimes !== null &&
                      r.requested_amount_millimes > r.model_recommended_amount_millimes;
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs">#{r.id}</TableCell>
                        <TableCell className="font-medium">{r.employee_name}</TableCell>
                        <TableCell>{formatTndCompact(r.requested_amount_millimes)}</TableCell>
                        <TableCell className={overCap ? "text-[hsl(var(--danger-fg))]" : undefined}>
                          {formatTndCompact(r.model_recommended_amount_millimes)} (
                          {formatPct(r.model_recommended_pct)})
                          {overCap ? (
                            <span className="ml-1 rounded bg-[hsl(var(--badge-danger-bg))] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[hsl(var(--badge-danger-fg))]">
                              over
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell>{formatDate(r.requested_payout_date)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDateTime(r.created_at)}
                        </TableCell>
                        <TableCell>{statusBadge(r.status)}</TableCell>
                        <TableCell className="text-right">
                          {r.status === "pending" ? (
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleApprove(r)}
                                disabled={pendingId === r.id}
                                className="gap-1"
                              >
                                <Check className="h-3.5 w-3.5" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openReject(r)}
                                disabled={pendingId === r.id}
                                className="gap-1"
                              >
                                <X className="h-3.5 w-3.5" />
                                Reject
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">N/A</span>
                          )}
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

      <Sheet open={rejectOpen} onOpenChange={setRejectOpen}>
        <SheetContent side="right" className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Reject request</SheetTitle>
            <SheetDescription>
              {rejectTarget
                ? `#${rejectTarget.id}: ${rejectTarget.employee_name} · ${formatTndCompact(rejectTarget.requested_amount_millimes)}`
                : ""}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reject-reason">Reason (optional)</Label>
              <Input
                id="reject-reason"
                placeholder="e.g. exceeds policy limit"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRejectOpen(false)}
                disabled={pendingId === rejectTarget?.id}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={confirmReject}
                disabled={pendingId === rejectTarget?.id}
              >
                {pendingId === rejectTarget?.id ? "Rejecting…" : "Confirm reject"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
