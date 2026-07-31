// Chrome for the internal console. Everything under /app is password-gated by
// src/proxy.ts; nothing here is meant for prospects, hence the noindex.
import type { Metadata } from "next";
import { Sidebar } from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "Outreach Console",
  robots: { index: false, follow: false },
};

export default function ConsoleLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
