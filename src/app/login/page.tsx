import type { Metadata } from "next";
import { LoginForm } from "@/components/LoginForm";
import { AvenyoMark } from "@/components/brand/Logo";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

const SENTINEL = "https://login-next.invalid";

/** The path to land on after signing in — always one on this site. */
function safeNext(next: string | undefined): string {
  if (!next) return "/app";
  let url: URL;
  try {
    url = new URL(next, SENTINEL);
  } catch {
    return "/app";
  }
  // Anything that resolved to another origin was an absolute or
  // authority-bearing URL, whatever it looked like as a string.
  if (url.origin !== SENTINEL) return "/app";
  return url.pathname + url.search;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  // Only ever bounce to a path on this site. Resolve-then-compare rather than
  // prefix-match: a leading-slash test has to enumerate every way a relative URL
  // can escape the origin, and it always misses one. `//evil.example.com` is a
  // protocol-relative URL, and for http(s) the URL spec treats `\` exactly like
  // `/`, so `/\evil.example.com` resolves to https://evil.example.com/ too.
  // Parsing against a sentinel origin rejects all of them, plus `%09` tricks,
  // with no list to keep up to date.
  const target = safeNext(next);

  return (
    <main className="min-h-screen grid place-items-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 mb-6">
          <AvenyoMark size={32} />
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
