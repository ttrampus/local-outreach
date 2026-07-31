import { FollowupsQueue } from "@/components/FollowupsQueue";

export const dynamic = "force-dynamic";

export default function FollowupsPage() {
  return (
    <div className="max-w-3xl mx-auto px-8 py-8">
      <header className="mb-6">
        <h1 className="text-xl font-semibold">Follow-ups</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          The sequence keeps working after the first send. Follow-ups become due
          automatically — but only while the prospect hasn&apos;t replied or shown
          interest. Send each one yourself; nothing goes out on its own.
        </p>
      </header>

      <FollowupsQueue />
    </div>
  );
}
