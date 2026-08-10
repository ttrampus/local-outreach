// Public landing the customer hits after a successful Stripe Checkout. The lead is
// marked paid by the webhook (not here), so this is purely a friendly confirmation.
import { AvenyoLogo } from "@/components/brand/Logo";

export const dynamic = "force-dynamic";

export default function PaySuccessPage() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6 py-16 text-center">
      <div className="max-w-md">
        {/* A payment page with no branding on it is where people start wondering
            who they just paid — this arrives straight from Stripe. */}
        <div className="mb-8 flex justify-center">
          <AvenyoLogo size={30} />
        </div>
        <div className="text-4xl mb-4">✅</div>
        <h1 className="text-2xl font-semibold mb-2">Thank you — you&apos;re all set!</h1>
        <p className="text-[var(--muted)] leading-relaxed">
          Your payment went through. I&apos;ll get your website live shortly and send you the
          link. If you need anything changed, just reply to my message — edits are always
          included.
        </p>
      </div>
    </div>
  );
}
