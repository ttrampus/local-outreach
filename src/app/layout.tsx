import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Outreach Console",
  description: "Local-business outreach pipeline — discovery, qualification, manual outreach.",
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
