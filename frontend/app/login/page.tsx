import * as React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { NavbarThemeToggle } from "@/components/theme-toggle";
import { MizaniaLogo } from "@/components/mizania-mark";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <Link href="/" className="inline-flex">
          <MizaniaLogo className="h-9 max-w-[220px]" />
        </Link>
        <NavbarThemeToggle />
      </header>
      <main className="mx-auto flex max-w-md flex-col gap-6 px-4 py-12">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Sign in to Mizania</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Company administrators, HR/finance users, and employees use the same entry point—your
            workspace opens after authentication.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Credentials</CardTitle>
            <CardDescription>
              Connected to the WALLAIT API. Use the demo accounts below or your own.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <React.Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
              <LoginForm />
            </React.Suspense>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
