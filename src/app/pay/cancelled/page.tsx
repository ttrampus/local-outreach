// Public landing if the customer backs out of Stripe Checkout. No state changes —
// they can always reopen the link later.
export const dynamic = "force-dynamic";

export default function PayCancelledPage() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6 py-16 text-center">
      <div className="max-w-md">
        <h1 className="text-2xl font-semibold mb-2">No problem — nothing was charged</h1>
        <p className="text-[var(--muted)] leading-relaxed">
          You closed the checkout before finishing. Whenever you&apos;re ready, just open the
          payment link again — or reply to my message if you have any questions first.
        </p>
      </div>
    </div>
  );
}
