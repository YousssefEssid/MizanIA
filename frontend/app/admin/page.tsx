"use client";

import * as React from "react";
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

type Employer = { id: number; name: string; country: string };
type CreatedHr = { id: number; email: string; employer_id: number };

export default function AdminHomePage() {
  const [employers, setEmployers] = React.useState<Employer[]>([]);
  const [employerName, setEmployerName] = React.useState("");
  const [creatingEmployer, setCreatingEmployer] = React.useState(false);

  const [targetEmployerId, setTargetEmployerId] = React.useState<string>("");
  const [hrEmail, setHrEmail] = React.useState("");
  const [hrPassword, setHrPassword] = React.useState("");
  const [creatingHr, setCreatingHr] = React.useState(false);
  const [createdHrs, setCreatedHrs] = React.useState<CreatedHr[]>([]);

  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  async function handleCreateEmployer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setCreatingEmployer(true);
    try {
      const e = await api.adminCreateEmployer(employerName.trim());
      setEmployers((prev) => [...prev, e]);
      setEmployerName("");
      setTargetEmployerId(String(e.id));
      setNotice(`Created employer #${e.id} "${e.name}".`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreatingEmployer(false);
    }
  }

  async function handleCreateHr(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    const id = Number(targetEmployerId);
    if (!Number.isFinite(id) || id <= 0) {
      setError("Pick or enter a valid employer ID.");
      return;
    }
    setCreatingHr(true);
    try {
      const u = await api.adminCreateHrAdmin(id, hrEmail.trim(), hrPassword);
      setCreatedHrs((prev) => [{ id: u.id, email: u.email, employer_id: id }, ...prev]);
      setNotice(`Created HR admin "${u.email}" for employer #${id}.`);
      setHrEmail("");
      setHrPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreatingHr(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
          Superadmin console
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Bootstrap new tenants: create an employer, then issue an HR admin login that can manage
          its roster and approvals.
        </p>
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

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Create employer</CardTitle>
            <CardDescription>
              The employer becomes a tenant in AvancI with its own roster, wallet, and ledger.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleCreateEmployer}>
              <div className="space-y-2">
                <Label htmlFor="employer-name">Employer name</Label>
                <Input
                  id="employer-name"
                  value={employerName}
                  onChange={(e) => setEmployerName(e.target.value)}
                  placeholder="e.g. Demo Tunis SARL"
                  required
                />
              </div>
              <Button type="submit" disabled={creatingEmployer}>
                {creatingEmployer ? "Creating…" : "Create employer"}
              </Button>
            </form>
            {employers.length > 0 ? (
              <div className="mt-4 space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Created this session
                </p>
                <ul className="space-y-1 text-sm">
                  {employers.map((e) => (
                    <li
                      key={e.id}
                      className="flex justify-between rounded-md border border-border bg-muted/30 px-3 py-2"
                    >
                      <span>{e.name}</span>
                      <span className="font-mono text-xs text-muted-foreground">#{e.id}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Create HR admin</CardTitle>
            <CardDescription>
              Issues a login that can upload rosters, score employees, and approve advances for the
              chosen employer.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleCreateHr}>
              <div className="space-y-2">
                <Label htmlFor="employer-id">Employer ID</Label>
                <Input
                  id="employer-id"
                  type="number"
                  min="1"
                  value={targetEmployerId}
                  onChange={(e) => setTargetEmployerId(e.target.value)}
                  placeholder="e.g. 1"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hr-email">HR email</Label>
                <Input
                  id="hr-email"
                  type="email"
                  value={hrEmail}
                  onChange={(e) => setHrEmail(e.target.value)}
                  placeholder="hr@employer.tn"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hr-pw">Password</Label>
                <Input
                  id="hr-pw"
                  type="text"
                  minLength={6}
                  value={hrPassword}
                  onChange={(e) => setHrPassword(e.target.value)}
                  placeholder="min. 6 characters"
                  required
                />
              </div>
              <Button type="submit" disabled={creatingHr}>
                {creatingHr ? "Creating…" : "Create HR admin"}
              </Button>
            </form>
            {createdHrs.length > 0 ? (
              <div className="mt-4 space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Created this session
                </p>
                <ul className="space-y-1 text-sm">
                  {createdHrs.map((u) => (
                    <li
                      key={u.id}
                      className="flex justify-between rounded-md border border-border bg-muted/30 px-3 py-2"
                    >
                      <span className="font-mono text-xs">{u.email}</span>
                      <span className="text-xs text-muted-foreground">
                        employer #{u.employer_id}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
