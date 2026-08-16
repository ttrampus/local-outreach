# Putting the console on avenyo.app

The app has to run somewhere always-on, because it needs a persistent SQLite file,
disk for generated previews, headless Chromium, requests that last minutes, and a
background timer for follow-ups. That means a small VPS, not a serverless free
tier.

These steps assume a small Hetzner VPS (this one: CX-series, 2 vCPU, 4GB, Nuremberg) running
**Ubuntu 26.04**, with DNS already at Cloudflare. Any similar box works.

---

## 1. Create the server

1. hetzner.com/cloud → sign up → New Project → Add Server.
2. Location: **Nuremberg** or **Helsinki** (closest to Slovenia).
3. Image: **Ubuntu 26.04**.
4. Type: **Shared vCPU → x86 → CX22** (4GB). Arm64 (CAX11) is cheaper and works,
   but Playwright's Chromium and its system dependencies are far better trodden
   on x86 — worth the difference for a box you only pay for once a month.
5. SSH key: paste your public key (`cat ~/.ssh/id_ed25519.pub`; if you have none,
   `ssh-keygen -t ed25519` first). Password login is worse in every way.
6. Name it `avenyo`, create, and copy the IPv4 address.

## 2. Point the domain at it

In Cloudflare → `avenyo.app` → DNS → Records:

```
Type: A    Name: @      IPv4: 178.104.18.121    Proxy: DNS only (grey cloud)
Type: A    Name: www    IPv4: 178.104.18.121    Proxy: DNS only (grey cloud)
```

**Start with the proxy OFF, deliberately.** Cloudflare's proxy drops any request
that takes longer than 100 seconds (error 524), and generating a preview holds the
request open for minutes while Claude designs the site. Proxied, every preview
generation would fail. Grey cloud also lets Caddy get its TLS certificate over
plain HTTP without extra configuration.

You can revisit this later — see "Turning the proxy on" at the end.

## 3. Base setup on the server

```bash
ssh root@178.104.18.121

# a non-root user to run the app
adduser --disabled-password --gecos "" avenyo
usermod -aG sudo avenyo

# firewall: ssh + web only
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable

# Node 24 LTS
curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
apt-get install -y nodejs git

node --version    # expect v24.x
```

**Node 24, not 22.** `scripts/outreach-selftest.mjs` and `scripts/divergence.mjs`
import the app's own `.ts` modules directly and rely on Node stripping the types
itself — see `scripts/lib/app-imports.mjs`. That is unflagged from Node 23.6
onward; on Node 22 the import throws and `npm run test:outreach` fails, which is
the command Step 10 uses to verify the install. Prove it before moving on:

```bash
printf 'const x: number = 1; console.log("type stripping OK", x);\n' > /tmp/t.ts
node /tmp/t.ts && rm /tmp/t.ts
```

If that prints `type stripping OK 1`, the scripts will run. If it throws a syntax
error on the `: number`, the Node version is too old — do not continue.

## 4. Get the code onto the server

If the repo is on GitHub:

```bash
su - avenyo
git clone https://github.com/ttrampus/local-outreach.git app
cd app
```

If it isn't, push from your laptop instead:

```bash
# on your laptop
rsync -av --exclude node_modules --exclude .next --exclude .git \
  ~/local-outreach/ avenyo@178.104.18.121:~/app/
```

## 5. Install dependencies

```bash
cd ~/app
npm ci
npx playwright install --with-deps chromium   # the screenshot browser
```

`playwright install --with-deps` pulls a long list of system libraries and needs
sudo. If it complains, run `sudo npx playwright install-deps chromium` first. On
an Ubuntu release newer than Playwright knows about, `--with-deps` can refuse
outright with "unsupported distribution" — in that case install the browser alone
(`npx playwright install chromium`), then let the next step tell you what's
actually missing rather than guessing at a package list.

**The schema and the build come after configuration**, in step 6 — `prisma.config.ts`
reads `DATABASE_URL` out of `.env.local`, so `prisma migrate deploy` has no
datasource until that file exists.

## 6. Configuration

Copy your local `.env.local` up — it already has every key working — then change
the two values that differ in production:

```bash
# on your laptop
scp ~/local-outreach/.env.local avenyo@178.104.18.121:~/app/.env.local
```

```bash
# on the server, edit ~/app/.env.local
APP_BASE_URL="https://avenyo.app"
DATABASE_URL="file:/home/avenyo/app/dev.db"
```

An absolute `DATABASE_URL` matters: a relative path resolves against the working
directory, and a systemd service does not necessarily start where you think.

**Generate a fresh `AUTH_SECRET` for the server** — never reuse the local one on a
publicly reachable box:

```bash
openssl rand -base64 48
```

Both `AUTH_PASSWORD` and `AUTH_SECRET` must be set, or the app returns 503 for
every private path by design.

Now that the configuration exists, create the schema and build. If you are also
bringing existing leads across (step 7), copy `dev.db` up **before** running the
migration, so any pending migrations are applied to the restored database:

```bash
cd ~/app
npx prisma migrate deploy
npm run build
```

## 7. Bring your existing leads (optional)

Your 60 discovered leads and their generated previews live locally. To keep them:

```bash
# on your laptop, with the local app NOT running
rsync -av ~/local-outreach/dev.db avenyo@178.104.18.121:~/app/dev.db
rsync -av ~/local-outreach/public/previews/ avenyo@178.104.18.121:~/app/public/previews/
```

Skip this to start clean — discovery will refill it.

## 8. Run it as a service

```bash
sudo tee /etc/systemd/system/avenyo.service > /dev/null <<'EOF'
[Unit]
Description=Avenyo outreach console
After=network.target

[Service]
Type=simple
User=avenyo
WorkingDirectory=/home/avenyo/app
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now avenyo
sudo systemctl status avenyo        # should say active (running)
```

Logs, when you need them: `journalctl -u avenyo -f`

## 9. HTTPS

Caddy gets and renews certificates automatically:

```bash
sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudflare.com/cloudflare-main.gpg' | sudo tee /usr/share/keyrings/caddy.gpg > /dev/null
sudo apt-get install -y caddy

sudo tee /etc/caddy/Caddyfile > /dev/null <<'EOF'
avenyo.app, www.avenyo.app {
	reverse_proxy localhost:3000
}
EOF

sudo systemctl reload caddy
```

Within a minute `https://avenyo.app` is live with a valid certificate.

> If the Caddy repository line above fails, use the official instructions at
> caddyserver.com/docs/install — the signing key location changes occasionally.

## 10. Verify

1. Open `https://avenyo.app` — the public landing page.
2. Open `https://avenyo.app/app` — should ask for your `AUTH_PASSWORD`.
3. Open a lead's preview link **on your phone with wifi off**. It must load.
4. On the server: `npm run test:outreach` — the readiness table should show email
   as `automatic`, all four deliverability records ✓.
5. Generate one preview from the console and confirm it completes (this is the
   long request that the Cloudflare proxy would have killed).

Then set `APP_BASE_URL` locally too if you keep drafting from your laptop, so
links point at the live site rather than localhost.

---

## Updating later

```bash
ssh avenyo@178.104.18.121
cd ~/app && git pull        # or rsync again
npm ci && npx prisma migrate deploy && npm run build
sudo systemctl restart avenyo
```

## Backups

`dev.db` is the entire business — leads, drafts, funnel state, customers. Back it
up nightly:

```bash
sudo tee /etc/cron.daily/avenyo-backup > /dev/null <<'EOF'
#!/bin/sh
install -d -o avenyo /home/avenyo/backups
sqlite3 /home/avenyo/app/dev.db ".backup /home/avenyo/backups/dev-$(date +%F).db"
find /home/avenyo/backups -name 'dev-*.db' -mtime +14 -delete
EOF
sudo chmod +x /etc/cron.daily/avenyo-backup
sudo apt-get install -y sqlite3
```

Use `.backup` rather than `cp` — it's safe while the app is writing. Pull a copy
down to your laptop from time to time; a backup that only exists on the same
server isn't one.

## Turning the Cloudflare proxy on

Worth doing once previews aren't generated through the proxy — it hides the origin
IP and absorbs DDoS. Before flipping the orange cloud:

1. SSL/TLS → Overview → set mode to **Full (strict)**. Caddy already serves a real
   certificate, so this works; "Flexible" causes redirect loops.
2. Accept that any single request over 100 seconds returns 524. Generate previews
   before switching, or keep a grey-clouded subdomain (e.g. `direct.avenyo.app`)
   for console work and let the proxied apex serve prospects.

Never proxy anything mail-related. Not an issue here — Workspace uses Google's own
servers, so your zone has no mail hostname.
