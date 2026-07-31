import type { Metadata } from "next";
import { LoginForm } from "@/components/LoginForm";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  // Only ever bounce to a path on this site. `//evil.example.com` is a valid
  // protocol-relative URL, so checking for a leading slash alone is not enough.
  const target =
    next && next.startsWith("/") && !next.startsWith("//") ? next : "/app";

  return (
    <main className="min-h-screen grid place-items-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-6">
          <span className="grid place-items-center w-8 h-8 rounded-lg bg-[var(--accent)] text-white font-bold">
            ◆
          </span>
          <div className="leading-tight">
            <div className="font-semibold text-sm">Outreach Console</div>
            <div className="text-[11px] text-[var(--muted)]">sign in to continue</div>
          </div>
        </div>
        <LoginForm next={target} />
      </div>
    </main>
  );
}
