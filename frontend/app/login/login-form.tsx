"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { homeForRole, useAuth } from "@/lib/auth";
import { API_BASE_URL, ApiError } from "@/lib/api";

const DEMO_CREDENTIALS = [
  { label: "HR admin", email: "hr@demo.tn", password: "demo1234" },
  { label: "Employee", email: "amine@demo.tn", password: "employee123" },
  { label: "Superadmin", email: "super@avanci.tn", password: "superadmin123" },
];

export function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const auth = useAuth();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (auth.status === "authenticated") {
      const next = search.get("next");
      router.replace(next || homeForRole(auth.user.role));
    }
  }, [auth, router, search]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const u = await auth.signIn(email.trim(), password);
      const next = search.get("next");
      router.replace(next || homeForRole(u.role));
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message || "Login failed"
          : `Could not reach the API at ${API_BASE_URL}. Is the backend running? (${e instanceof Error ? e.message : String(e)})`,
      );
    } finally {
      setSubmitting(false);
    }
  }

  function fillDemo(demoEmail: string, demoPassword: string) {
    setEmail(demoEmail);
    setPassword(demoPassword);
  }

  return (
    <>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Label htmlFor="email">Work email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
        <Button className="w-full" type="submit" disabled={submitting}>
          {submitting ? "Signing in…" : "Continue"}
        </Button>
      </form>
      <div className="mt-6 space-y-2 border-t border-border pt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Demo accounts
        </p>
        <div className="flex flex-col gap-1.5">
          {DEMO_CREDENTIALS.map((c) => (
            <button
              key={c.email}
              type="button"
              onClick={() => fillDemo(c.email, c.password)}
              className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2 text-left text-xs transition-colors hover:bg-muted"
            >
              <span className="font-medium text-foreground">{c.label}</span>
              <span className="font-mono text-muted-foreground">{c.email}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
