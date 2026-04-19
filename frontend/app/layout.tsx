import type { Metadata } from "next";
import { Inter, Manrope, Dancing_Script } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/lib/auth";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

const wordmark = Dancing_Script({
  weight: ["500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-wordmark",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "AvancI", template: "%s · AvancI" },
  description:
    "AvancI: salary advance management for companies and employees. Modern, trustworthy, operational.",
  applicationName: "AvancI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${manrope.variable} ${wordmark.variable} font-sans`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
          storageKey="avanci-theme"
        >
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
