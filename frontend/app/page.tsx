import type { Metadata } from "next";
import Link from "next/link";
import { NavbarThemeToggle } from "@/components/theme-toggle";
import { AvanciLogo } from "@/components/avanci-logo";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Salary advance platform",
  description:
    "AvancI helps companies and employees manage salary advances with clarity, trust, and operational rigor.",
};

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" className="inline-flex">
            <AvanciLogo priority />
          </Link>
          <div className="flex items-center gap-3">
            <NavbarThemeToggle />
            <Button asChild variant="outline" size="sm">
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-16">
        <p className="text-sm font-medium text-primary">Tunisia · HR-tech · Fintech-trust</p>
        <h1 className="mt-3 font-heading text-4xl font-bold tracking-tight text-foreground md:text-5xl">
          Welcome to AvancI
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          A structured salary advance platform for companies and employees—clean workflows for HR and
          finance, transparent requests for staff, and full traceability across your organization.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/company/dashboard">Open company workspace</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/employee">Open employee portal</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
