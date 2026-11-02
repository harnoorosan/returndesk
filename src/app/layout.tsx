import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Figtree, Fraunces, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
});

const figtree = Figtree({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-figtree",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: {
    default: "ReturnDesk",
    template: "%s · ReturnDesk",
  },
  description: "Returns desk for a small online store.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${figtree.variable} ${geistMono.variable} h-full`}
    >
      <body className="flex min-h-full flex-col antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded-full focus:bg-white focus:px-3 focus:py-2"
        >
          Skip to content
        </a>
        <header className="border-b border-line bg-card">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4">
            <Link href="/" className="min-w-0">
              <span className="block font-serif text-2xl leading-none tracking-tight">
                ReturnDesk
              </span>
              <span className="mt-1 block text-sm text-muted">Returns counter</span>
            </Link>
            <Link
              href="/requests/new"
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-stamp px-4 text-sm font-semibold text-white hover:bg-stamp-deep"
            >
              New request
            </Link>
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
