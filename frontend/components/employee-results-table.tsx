"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { AdvanceRequestHR, EmployeePublic } from "@/lib/api";
import { effectiveMaxPct } from "@/lib/policy";
import { formatTndCompact, formatPct, formatDateTime, formatDate } from "@/lib/money";
import { cn } from "@/lib/utils";

type Eligibility = "Eligible" | "Not Eligible" | "Pending Review";

function deriveEligibility(e: EmployeePublic): Eligibility {
  const eff = effectiveMaxPct(e);
  if (eff === null) return "Pending Review";
  if (!e.opted_in_wallet) return "Not Eligible";
  if (eff < 5) return "Not Eligible";
  return "Eligible";
}

function maxAdvanceMillimes(e: EmployeePublic): number | null {
  const eff = effectiveMaxPct(e);
  if (eff === null) return null;
  return Math.round((e.salary_millimes * eff) / 100);
}

function eligibilityBadge(label: Eligibility) {
  if (label === "Not Eligible") return <Badge variant="danger">{label}</Badge>;
  if (label === "Eligible")
    return (
      <Badge
        variant="outline"
        className="border-primary/30 font-semibold text-foreground dark:border-primary/40"
      >
        {label}
      </Badge>
    );
  return <Badge variant="warning">{label}</Badge>;
}

function requestStatusBadge(status: string) {
  if (status === "paid") return <Badge variant="success">Paid</Badge>;
  if (status === "approved") return <Badge variant="info">Approved</Badge>;
  if (status === "pending") return <Badge variant="warning">Pending</Badge>;
  if (status === "rejected") return <Badge variant="danger">Rejected</Badge>;
  return <Badge variant="neutral">{status}</Badge>;
}

type SortKey =
  | "employee_code"
  | "full_name"
  | "department"
  | "salary_millimes"
  | "recommended_max_pct"
  | "max_amount"
  | "last_scored_at"
  | "eligibility";

export function EmployeeResultsTable({
  data,
  requests = [],
}: {
  data: EmployeePublic[];
  requests?: AdvanceRequestHR[];
}) {
  const [search, setSearch] = React.useState("");
  const [eligibilityFilter, setEligibilityFilter] = React.useState<string>("all");
  const [walletFilter, setWalletFilter] = React.useState<string>("all");
  const [sortKey, setSortKey] = React.useState<SortKey>("full_name");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("asc");
  const [page, setPage] = React.useState(1);
  const pageSize = 8;
  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<EmployeePublic | null>(null);

  const decorated = React.useMemo(
    () =>
      data.map((row) => ({
        row,
        eligibility: deriveEligibility(row),
        max_amount: maxAdvanceMillimes(row),
      })),
    [data],
  );

  const filtered = React.useMemo(() => {
    return decorated.filter(({ row, eligibility }) => {
      const q = search.trim().toLowerCase();
      const matchQ =
        !q ||
        row.full_name.toLowerCase().includes(q) ||
        row.employee_code.toLowerCase().includes(q) ||
        row.department.toLowerCase().includes(q);
      const matchE = eligibilityFilter === "all" || eligibility === eligibilityFilter;
      const matchW =
        walletFilter === "all" ||
        (walletFilter === "in" && row.opted_in_wallet) ||
        (walletFilter === "out" && !row.opted_in_wallet);
      return matchQ && matchE && matchW;
    });
  }, [decorated, search, eligibilityFilter, walletFilter]);

  const sorted = React.useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "asc" ? av - bv : bv - av;
      }
      const as = String(av);
      const bs = String(bv);
      return sortDir === "asc" ? as.localeCompare(bs) : bs.localeCompare(as);
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const slice = sorted.slice((pageSafe - 1) * pageSize, pageSafe * pageSize);

  React.useEffect(() => {
    setPage(1);
  }, [search, eligibilityFilter, walletFilter]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const selectedRequests = React.useMemo(() => {
    if (!selected) return [];
    return requests
      .filter((r) => r.employee_profile_id === selected.id)
      .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
      .slice(0, 10);
  }, [requests, selected]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end">
        <div className="min-w-[200px] flex-1 space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Search</label>
          <Input
            placeholder="Name, employee code, department"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search employees"
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="min-w-[13.5rem] space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Eligibility</label>
            <Select value={eligibilityFilter} onValueChange={setEligibilityFilter}>
              <SelectTrigger
                aria-label="Filter by eligibility"
                className="[&>span]:line-clamp-none"
              >
                <SelectValue placeholder="Eligibility" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="Eligible">Eligible</SelectItem>
                <SelectItem value="Not Eligible">Not Eligible</SelectItem>
                <SelectItem value="Pending Review">Pending Review</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-44 space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Wallet</label>
            <Select value={walletFilter} onValueChange={setWalletFilter}>
              <SelectTrigger aria-label="Filter by wallet opt-in">
                <SelectValue placeholder="Wallet" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="in">Opted in</SelectItem>
                <SelectItem value="out">Not opted in</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="md:hidden">
        <p className="mb-2 text-xs text-muted-foreground">
          Swipe horizontally to see all columns on small screens.
        </p>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <SortableHead label="Employee" k="employee_code" {...{ sortKey, sortDir, toggleSort }} />
              <SortableHead label="Full name" k="full_name" {...{ sortKey, sortDir, toggleSort }} />
              <SortableHead label="Department" k="department" {...{ sortKey, sortDir, toggleSort }} />
              <SortableHead label="Salary" k="salary_millimes" {...{ sortKey, sortDir, toggleSort }} />
              <SortableHead
                label="Effective %"
                k="recommended_max_pct"
                {...{ sortKey, sortDir, toggleSort }}
              />
              <SortableHead
                label="Max advance"
                k="max_amount"
                {...{ sortKey, sortDir, toggleSort }}
              />
              <SortableHead
                label="Last scored"
                k="last_scored_at"
                {...{ sortKey, sortDir, toggleSort }}
              />
              <SortableHead label="Eligibility" k="eligibility" {...{ sortKey, sortDir, toggleSort }} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {slice.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  No employees match the current filters.
                </TableCell>
              </TableRow>
            ) : (
              slice.map(({ row, eligibility, max_amount }) => {
                return (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer"
                    onClick={() => {
                      setSelected(row);
                      setOpen(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelected(row);
                        setOpen(true);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={`Open details for ${row.full_name}`}
                  >
                    <TableCell className="font-mono text-xs">{row.employee_code}</TableCell>
                    <TableCell className="font-medium">{row.full_name}</TableCell>
                    <TableCell>{row.department}</TableCell>
                    <TableCell>{formatTndCompact(row.salary_millimes)}</TableCell>
                    <TableCell>
                      {formatPct(effectiveMaxPct(row))}
                      {row.recommended_max_pct != null &&
                      effectiveMaxPct(row) != null &&
                      Math.abs(effectiveMaxPct(row)! - row.recommended_max_pct) > 1e-6 ? (
                        <span className="ml-1 text-[10px] uppercase text-muted-foreground">
                          (HR)
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>{formatTndCompact(max_amount)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.last_scored_at ? formatDateTime(row.last_scored_at) : "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {eligibilityBadge(eligibility)}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Page {pageSafe} of {totalPages} · {sorted.length} row{sorted.length === 1 ? "" : "s"}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={pageSafe <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={pageSafe >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="overflow-y-auto sm:max-w-lg">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.full_name}</SheetTitle>
                <SheetDescription>
                  {selected.employee_code} · {selected.department}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                <div className="grid gap-3 rounded-lg border border-border bg-muted/30 p-4 text-sm">
                  <Row label="Salary" value={formatTndCompact(selected.salary_millimes)} />
                  <Row
                    label="Model max %"
                    value={formatPct(selected.recommended_max_pct)}
                  />
                  <Row
                    label="HR override %"
                    value={
                      selected.policy_max_pct === null || selected.policy_max_pct === undefined
                        ? "— (per row)"
                        : formatPct(selected.policy_max_pct)
                    }
                  />
                  <Row
                    label="Global HR max %"
                    value={
                      selected.global_policy_max_pct === null ||
                      selected.global_policy_max_pct === undefined
                        ? "—"
                        : formatPct(selected.global_policy_max_pct)
                    }
                  />
                  <Row
                    label="Effective max %"
                    value={formatPct(effectiveMaxPct(selected))}
                  />
                  <Row
                    label="Max advance amount"
                    value={formatTndCompact(maxAdvanceMillimes(selected))}
                  />
                  <Row
                    label="Last scored"
                    value={
                      selected.last_scored_at
                        ? formatDateTime(selected.last_scored_at)
                        : "Never — run \"Score all\" above"
                    }
                  />
                  <Row
                    label="Wallet opt-in"
                    value={selected.opted_in_wallet ? "Yes" : "No"}
                  />
                  <Row
                    label="Eligibility"
                    value={eligibilityBadge(deriveEligibility(selected))}
                  />
                </div>

                <div>
                  <h4 className="mb-2 text-sm font-semibold">Request history</h4>
                  <div className="overflow-hidden rounded-lg border border-border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2">ID</th>
                          <th className="px-3 py-2">Amount</th>
                          <th className="px-3 py-2">Payout</th>
                          <th className="px-3 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedRequests.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-3 py-4 text-center text-muted-foreground">
                              No requests yet.
                            </td>
                          </tr>
                        ) : (
                          selectedRequests.map((r) => (
                            <tr key={r.id} className="border-t border-border">
                              <td className="px-3 py-2 font-mono text-xs">#{r.id}</td>
                              <td className="px-3 py-2">
                                {formatTndCompact(r.requested_amount_millimes)}
                              </td>
                              <td className="px-3 py-2 text-muted-foreground">
                                {formatDate(r.requested_payout_date)}
                              </td>
                              <td className="px-3 py-2">{requestStatusBadge(r.status)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 sm:items-center">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right font-medium">{value}</span>
    </div>
  );
}

function sortValue(
  d: { row: EmployeePublic; eligibility: Eligibility; max_amount: number | null },
  key: SortKey,
): string | number | null {
  switch (key) {
    case "employee_code":
      return d.row.employee_code;
    case "full_name":
      return d.row.full_name;
    case "department":
      return d.row.department;
    case "salary_millimes":
      return d.row.salary_millimes;
    case "recommended_max_pct":
      return effectiveMaxPct(d.row);
    case "max_amount":
      return d.max_amount;
    case "last_scored_at":
      return d.row.last_scored_at ? +new Date(d.row.last_scored_at) : null;
    case "eligibility":
      return d.eligibility;
  }
}

function SortableHead({
  label,
  k,
  sortKey,
  sortDir,
  toggleSort,
}: {
  label: string;
  k: SortKey;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  toggleSort: (k: SortKey) => void;
}) {
  const active = sortKey === k;
  return (
    <TableHead>
      <button
        type="button"
        className={cn(
          "inline-flex items-center gap-1 rounded px-1 py-0.5 text-left font-semibold hover:bg-muted/80",
          active && "text-foreground",
        )}
        onClick={() => toggleSort(k)}
      >
        {label}
        {active && <span className="text-[10px] opacity-70">{sortDir === "asc" ? "▲" : "▼"}</span>}
      </button>
    </TableHead>
  );
}
