import { OutreachReview } from "@/components/OutreachReview";

export const dynamic = "force-dynamic";

export default function OutreachPage() {
  return (
    <div className="max-w-4xl mx-auto px-8 py-8">
      <header className="mb-6">
        <h1 className="text-xl font-semibold">Outreach</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          Review and edit drafts, approve, then send — one lead at a time. The
          first message to a prospect is always sent by you; only approved
          follow-ups can go out on their own.
        </p>
      </header>

      <OutreachReview />
    </div>
  );
}
