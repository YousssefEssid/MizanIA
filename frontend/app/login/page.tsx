import * as React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { NavbarThemeToggle } from "@/components/theme-toggle";
import { AvanciLogo } from "@/components/avanci-logo";
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
      <header className="sticky top-0 z-30 border-b border-border bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="inline-flex">
            <AvanciLogo priority />
          </Link>
          <NavbarThemeToggle />
        </div>
      </header>
      <main className="mx-auto flex max-w-md flex-col gap-6 px-4 py-12">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Sign in to AvancI</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Company administrators, HR/finance users, and employees use the same entry point: your
            workspace opens after authentication.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Credentials</CardTitle>
            <CardDescription>
              Connected to the AvancI API. Use the demo accounts below or your own.
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
