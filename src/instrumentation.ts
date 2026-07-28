// Next.js instrumentation hook — runs once per server boot, before requests are
// served. Used to start the follow-up auto-send timer (a no-op unless
// AUTO_SEND_FOLLOWUPS=on and SMTP is configured).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startFollowupAutomation } = await import("@/lib/outreach/autoSend");
    startFollowupAutomation();
  }
}
