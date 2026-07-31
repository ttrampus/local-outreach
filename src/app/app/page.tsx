import { UsageBar } from "@/components/UsageBar";
import { LeadsTable } from "@/components/LeadsTable";

export const dynamic = "force-dynamic";

export default function LeadsPage() {
  return (
    <div className="max-w-6xl mx-auto px-8 py-8">
      <header className="mb-6">
        <h1 className="text-xl font-semibold">Leads</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          Discovered businesses, scored by how much they need a modern site.
        </p>
      </header>

      <div className="mb-6">
        <UsageBar />
      </div>

      <LeadsTable />
    </div>
  );
}
