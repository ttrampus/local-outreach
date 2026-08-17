# Getting every outreach channel to one-click

Follow these in order. Each step is small, and each ends with a command that
proves it worked before you move on. Steps 1–4 are the ones that matter; 5–8 are
optional or can wait.

Every command is safe: the self-test never touches `dev.db` and never messages a
lead. It runs against an emptied copy of the schema in a temp folder, with a fake
mail server and a stubbed Twilio standing in for the real ones. Only `--live`
sends anything, and only to you.

---

## What "one click" actually means

After setup, in the lead panel you click **Send**, then **Send** again to confirm
(a deliberate guard against mis-clicks). What happens on that second click:

| Channel | After the confirm | Truly hands-off? |
|---|---|---|
| Email + SMTP | Message is delivered. Done. | **Yes** |
| SMS + Twilio | Text is delivered. Done. | **Yes** |
| Email, no SMTP | Gmail opens prefilled → you press Send there | No — one extra click |
| SMS, no Twilio | Your messaging app opens prefilled → you press send | No — one extra click |
| Facebook / Instagram DM | Thread opens, message already on your clipboard → Ctrl+V, Enter | **Never possible** |
| Phone | Dialer opens, script on your clipboard | It's a call, not a message |

**The DM channels cannot be automated, by anyone.** Meta publishes no API for
cold DMs and bans accounts that automate them. Paste-and-send is the floor, and
the app already does everything up to the paste.

The good news: **channels are picked best-first** — email, then SMS (only when
Twilio is configured), then DM, then phone. So once Steps 3 and 5 are done, a DM
is only chosen for a business with *no email and no phone at all*, which is rare.
Configuring Twilio doesn't just make SMS one-click; it moves leads off the DM path
entirely.

---

## Step 1 — Fix SMS numbers (2 minutes, free)

**Why:** Google returns Slovene numbers as `064 194 936`. That isn't dialable
internationally, so the app currently *refuses* to text any of them rather than
sending into the void. This one line fixes every phone-based channel.

1. Open `.env.local` in your editor.
2. Find the line `SMS_DEFAULT_COUNTRY_CODE=""`.
3. Change it to:
   ```
   SMS_DEFAULT_COUNTRY_CODE="+386"
   ```
4. Save.
5. Run:
   ```bash
   npm run test:outreach -- --case sms-country-code
   ```

**Expect:** `✓ 2 passed, 0 failed`. If you see a failure, the value is wrong —
it needs the `+` and no spaces.

---

## Step 2 — Check your domain's DNS (10 minutes, free)

**Why:** do this *before* the mailbox exists, because DNS changes take hours to
spread. Cold email from a domain with nothing published lands in spam no matter
how good the message is.

1. Run this with your real domain:
   ```bash
   npm run test:outreach -- --dns you@yourdomain.com
   ```
2. Read the four lines. `✓` = fine, `!` = fix it, `?` = couldn't tell.
3. Log in wherever your domain's DNS lives (registrar or host) and add whatever
   is missing:

   **SPF** — one TXT record on the bare domain. Your mail provider gives you the
   exact value. Google Workspace uses:
   ```
   Type: TXT   Name: @   Value: v=spf1 include:_spf.google.com ~all
   ```
   You may have **exactly one** SPF record. If you already have one, merge the
   `include:` into it rather than adding a second — two records is worse than none.

   **DKIM** — you don't write this one. Turn on DKIM signing in your mail
   provider's admin panel and it generates a key and shows you the record to
   paste. In Google Workspace: Admin console → Apps → Google Workspace → Gmail →
   Authenticate email → Generate new record → then **Start authentication** after
   you've added it.

   **DMARC** — a TXT record you write yourself. Start permissive:
   ```
   Type: TXT   Name: _dmarc   Value: v=DMARC1; p=none; rua=mailto:you@yourdomain.com
   ```
   `p=none` means "monitor and report, change nothing" — the safe starting point.
   Tighten to `p=quarantine` after a few weeks of clean reports.

   **MX** — your mail provider sets these when you add the domain. Without them
   every reply to your outreach bounces.

4. Wait (usually 15 minutes to a few hours) and re-run the command from step 1.

**Expect:** all four ✓. DKIM may stay `?` if your provider uses an unusual
selector name — the record's name looks like `<selector>._domainkey`. Take the
selector from it and confirm with:
```bash
DKIM_SELECTOR=<selector> npm run test:outreach -- --dns you@yourdomain.com
```

---

## Step 3 — Connect the company email (20 minutes)

**Why:** this is the big one. It turns email — the channel picked for most leads —
from "opens a Gmail tab" into genuinely one click.

### 3a. Get an app password

An app password is a separate password for programs, so your real login stays
private and revoking it doesn't lock you out.

For **Google Workspace** (recommended if you're getting the mailbox anyway — it's
the same Gmail you know):
1. Sign in to the company account at myaccount.google.com.
2. Security → turn on 2-Step Verification if it isn't already (required).
3. Security → 2-Step Verification → App passwords.
4. Create one named "local-outreach". Copy the 16-character code.

If App passwords doesn't appear, your Workspace admin has disabled it — use the
SMTP relay service instead, or a sending provider from the table below.

### 3b. Fill in `.env.local`

```
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="465"
SMTP_SECURE="on"
SMTP_USER="you@yourdomain.com"
SMTP_PASS="the 16-character app password"
SMTP_FROM="Your Name <you@yourdomain.com>"
OUTREACH_OWNER_EMAIL="you@yourdomain.com"
```

Other providers, same five fields:

| Provider | `SMTP_HOST` | Port | Notes |
|---|---|---|---|
| Google Workspace | `smtp.gmail.com` | 465 | app password |
| Zoho Mail | `smtp.zoho.eu` | 465 | app-specific password |
| Fastmail | `smtp.fastmail.com` | 465 | app password |
| Resend / Postmark | `smtp.resend.com` / `smtp.postmarkapp.com` | 587 | API key as the password; built for volume |

Two rules the preflight will check for you: `SMTP_FROM` must be an address that
account is allowed to send as, and it should be on the **same domain** as
`SMTP_USER`. A mismatch passes every credential check and still fails at the
receiver.

### 3c. Prove it

```bash
npm run test:outreach
```
**Expect:** the email row now reads `· automatic` with your host and user, the
deliverability block shows your domain's records, and `✓ 29 passed, 0 failed`.

If it says `✗ BROKEN`, the message next to it is your provider's own error —
usually a wrong password or 2-Step not enabled.

### 3d. Send yourself a real one

```bash
npm run test:outreach -- --live
```
**Expect:** `✓ live email → you@yourdomain.com`, and the message arrives within a
minute.

**Then check which folder it landed in.** Inbox means Step 2 worked. Spam means
your DNS records haven't propagated or are incomplete — go back to Step 2 before
sending to anyone real.

---

## Step 4 — Make preview links reachable (30 minutes)

**Why:** every draft contains a link to that prospect's mockup, built from
`APP_BASE_URL`. It's still `http://localhost:3000`, so today those links point at
your own laptop — a prospect who clicks one sees nothing. This silently wastes
the best thing in your message.

1. Host the app somewhere public (a small VPS, or Vercel) at your domain.
2. Set in `.env.local` **on the server**:
   ```
   APP_BASE_URL="https://yourdomain.com"
   ```
3. Confirm `AUTH_PASSWORD` and `AUTH_SECRET` are set there too — without them the
   console refuses to serve anything private, which is deliberate.
4. Restart the app.
5. Open a lead's preview link on your phone **with wifi off**. It must load.

No automated check can do this for you — the self-test knows what URL was
generated, not whether the internet can reach it.

---

## Step 5 — One-click SMS (optional, ~€0.05/message)

**Why:** worth it once opening your phone for each text is the bottleneck. It also
moves social-only leads off the DM path, since SMS outranks DM in the picker.

**A trial account cannot do this at all — upgrade before you start.** Twilio's
trial only sends its own predefined templates, so an outreach body comes back as
`Invalid template name. Trial accounts can only use predefined SMS templates.
(Twilio 572006)` — after the credentials, the sender and the request have all
been accepted. A trial send from the Twilio console succeeds because the console
uses one of those templates, which makes the trial look usable when it isn't.
Upgrading to pay-as-you-go lifts it; nothing in this app changes.

1. Sign up at twilio.com, complete verification, and **upgrade to pay-as-you-go**.
2. Buy a Slovenian number (Phone Numbers → Buy a number, SMS-capable).
3. Copy the Account SID and Auth Token from the console home page.
4. In `.env.local`:
   ```
   TWILIO_ACCOUNT_SID="AC..."
   TWILIO_AUTH_TOKEN="..."
   TWILIO_FROM="+386..."
   ```
5. Prove the wiring, then send yourself one:
   ```bash
   npm run test:outreach -- --case twilio
   npm run test:outreach -- --live
   ```

**Expect:** the SMS row reads `· automatic — sending from +386…`, and a text
arrives on your phone.

The preflight confirms `TWILIO_FROM` is a number your account actually owns — a
typo there is otherwise invisible until a real send fails.

Cold SMS is regulated: honour opt-outs, and don't message numbers on a do-not-call
register. That part is on you, not on Twilio.

---

## Step 6 — Check the manual channels once (5 minutes)

DMs and calls have no API, so this is a one-time confirmation by hand.

```bash
npm run test:outreach -- --links
```

Click each printed link once and confirm the right app opens with the text
prefilled. That's it — you never need to repeat this.

You do **not** need to find Facebook/Instagram handles yourself: when Google lists
a business's website as their Facebook or Instagram page, drafting converts it to
an `m.me` / `ig.me` thread link automatically. You'd only paste one into the
contact field by hand for a business where Google listed something else.

The automated checks already cover what breaks silently here: the right link is
used, the message reaches the clipboard, and `[Your name]` is replaced with your
`OUTREACH_OWNER_NAME`.

---

## Step 7 — Hands-off follow-ups (after Step 3 works)

**Why:** most replies to cold outreach come from a follow-up, not the first message.

```
AUTO_SEND_FOLLOWUPS="on"
AUTO_SEND_INTERVAL_MIN="60"
```

You always approve and send the first touch yourself. Only the already-approved
sequence runs unattended, and it stops the instant a prospect replies or clicks
"I'm interested". DM and phone follow-ups stay in the manual queue.

```bash
npm run test:outreach -- --case autosend
```
**Expect:** 3 passed — a due email follow-up goes out, a due DM follow-up is left
alone, an interested prospect is never nudged.

---

## Step 8 — The real end-to-end run

The final proof, through the actual UI, with you as the prospect:

1. Add a lead you control — your own business, or edit a test lead's email to your
   personal address (not the company one you're sending *from*).
2. Generate its preview.
3. Draft the outreach.
4. Tick the pre-send checklist and approve.
5. Click **Send**, then confirm.
6. Check the message arrived, click the preview link inside it, and confirm the
   mockup loads.
7. Delete the test lead.

If that works, the pipeline works.

---

## Definition of done

- [ ] `npm run test:outreach` → `✓ 29 passed, 0 failed`
- [ ] Email row reads `automatic`, SMS row reads `automatic` (or `assisted` if you skipped Twilio)
- [ ] Deliverability: SPF, DKIM, DMARC, MX all `✓`
- [ ] `npm run test:outreach -- --live` → real email and text arrive, email in the **inbox**
- [ ] A preview link opens on your phone with wifi off
- [ ] Step 8 completed end to end

---

## Still missing, but not for outreach

- `VERCEL_TOKEN` — only needed to deploy a customer's site after they buy.
  vercel.com/account/tokens.
- `OUTREACH_OWNER_BOOKING_URL` — optional "book a call" button on the public
  preview's owner bar.
