import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { BRAND } from "@/lib/brand";
import { env } from "@/lib/env";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  // Absolute URLs for the OG card. Without this the generated opengraph-image
  // is advertised as a relative path, which no unfurler resolves.
  metadataBase: new URL(env.appBaseUrl),
  // Every page's own title gets the brand appended; `default` covers the ones
  // that set none.
  title: {
    default: `${BRAND.name} — sodobne spletne strani za lokalna podjetja`,
    template: `%s · ${BRAND.name}`,
  },
  description: "Local-business outreach pipeline — discovery, qualification, manual outreach.",
  openGraph: { siteName: BRAND.name, type: "website" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      {/* The single root layout for both the public site and the console. Kept
          bare on purpose: the sidebar chrome belongs to the console alone and
          lives in app/app/layout.tsx. Two root layouts (via route groups) would
          have worked too, but crossing between them forces a full page reload. */}
      <body className="min-h-full">{children}</body>
    </html>
  );
}
