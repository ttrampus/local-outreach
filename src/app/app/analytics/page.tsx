import { AnalyticsDashboard } from "@/components/AnalyticsDashboard";

export const dynamic = "force-dynamic";

export default function AnalyticsPage() {
  return (
    <div className="max-w-5xl mx-auto px-8 py-8">
      <header className="mb-6">
        <h1 className="text-xl font-semibold">Analytics</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          Where leads convert — and where they leak. Use the category and region
          breakdowns to aim discovery at what actually produces paying customers.
        </p>
      </header>

      <AnalyticsDashboard />
    </div>
  );
}
