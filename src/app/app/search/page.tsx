import { UsageBar } from "@/components/UsageBar";
import { SearchLauncher } from "@/components/SearchLauncher";

export const dynamic = "force-dynamic";

export default function SearchPage() {
  return (
    <div className="max-w-4xl mx-auto px-8 py-8">
      <header className="mb-6">
        <h1 className="text-xl font-semibold">Discovery</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          Launch a search for (category, location) pairs. Re-running is safe —
          places already in the database are skipped and never re-billed.
        </p>
      </header>

      <div className="mb-6">
        <UsageBar />
      </div>

      <SearchLauncher />
    </div>
  );
}
