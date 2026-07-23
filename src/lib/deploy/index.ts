// Opt-in deploy. Takes already-generated site HTML and publishes it to a hosting
// target (configurable via DEPLOY_TARGET). This is the ONLY step that creates real
// hosted infrastructure — never automatic, run manually per interested lead.
import { env } from "@/lib/env";

export class DeployError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeployError";
  }
}

export interface DeployInput {
  /** A stable, URL-safe-ish project name derived from the lead. */
  name: string;
  html: string;
}

/** A DNS record the owner must set for a custom domain to go live. */
export interface DnsRecord {
  type: string; // A | CNAME | TXT
  name: string; // host, e.g. "@" or "www"
  value: string; // target value
}

export interface DomainResult {
  domain: string;
  verified: boolean;
  records: DnsRecord[]; // what to add at the domain's DNS provider
}

/** Deploy a single static index.html to Vercel. Returns the live https URL. */
async function deployVercel({ name, html }: DeployInput): Promise<string> {
  const token = process.env.VERCEL_TOKEN;
  if (!token) {
    throw new DeployError(
      "VERCEL_TOKEN is not set. Add it to .env.local to deploy to Vercel.",
    );
  }
  const teamId = process.env.VERCEL_TEAM_ID;
  const url = `https://api.vercel.com/v13/deployments${teamId ? `?teamId=${teamId}` : ""}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      target: "production",
      projectSettings: { framework: null },
      files: [
        {
          file: "index.html",
          data: Buffer.from(html, "utf8").toString("base64"),
          encoding: "base64",
        },
      ],
    }),
  });

  const json = (await res.json().catch(() => ({}))) as {
    url?: string;
    error?: { message?: string };
  };
  if (!res.ok) {
    throw new DeployError(json.error?.message ?? `Vercel API error (${res.status})`);
  }
  if (!json.url) throw new DeployError("Vercel returned no deployment URL.");
  return `https://${json.url}`;
}

// Vercel's standard targets for an apex + www custom domain, shown when the API
// doesn't return explicit verification records (the common case for a fresh domain).
const VERCEL_DEFAULT_RECORDS: DnsRecord[] = [
  { type: "A", name: "@", value: "76.76.21.21" },
  { type: "CNAME", name: "www", value: "cname.vercel-dns.com" },
];

/**
 * Attach a custom domain to the lead's Vercel project and return the DNS records
 * the owner must add for it to go live. Idempotent-ish: a domain already on the
 * project is treated as success. Only the Vercel target is supported.
 */
async function attachVercelDomain(projectName: string, domain: string): Promise<DomainResult> {
  const token = process.env.VERCEL_TOKEN;
  if (!token) throw new DeployError("VERCEL_TOKEN is not set — cannot attach a domain.");
  const teamId = process.env.VERCEL_TEAM_ID;
  const qs = teamId ? `?teamId=${teamId}` : "";
  const clean = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");

  const res = await fetch(`https://api.vercel.com/v10/projects/${projectName}/domains${qs}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: clean }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    verified?: boolean;
    verification?: { type: string; domain: string; value: string }[];
    error?: { code?: string; message?: string };
  };

  // "domain already exists on project" is fine — surface the DNS records anyway.
  if (!res.ok && json.error?.code !== "domain_already_in_use") {
    throw new DeployError(json.error?.message ?? `Vercel domain error (${res.status})`);
  }

  const records: DnsRecord[] = json.verification?.length
    ? json.verification.map((v) => ({ type: v.type, name: v.domain, value: v.value }))
    : VERCEL_DEFAULT_RECORDS;

  return { domain: clean, verified: Boolean(json.verified), records };
}

/** Attach a custom domain to an already-deployed project (Vercel only for now). */
export async function attachDomain(projectName: string, domain: string): Promise<DomainResult> {
  if (env.deployTarget !== "vercel") {
    throw new DeployError(
      `Custom domains are only wired for the Vercel target (DEPLOY_TARGET is "${env.deployTarget}").`,
    );
  }
  return attachVercelDomain(projectName, domain);
}

/**
 * Cloudflare Pages is supported as a target but not yet wired (its direct-upload
 * flow needs a project + asset-manifest dance). The abstraction is here so adding
 * it is a single function — for now, deploy with DEPLOY_TARGET=vercel.
 */
async function deployCloudflare(input: DeployInput): Promise<string> {
  throw new DeployError(
    `Cloudflare Pages target is not implemented yet (project "${input.name}"). ` +
      "Set DEPLOY_TARGET=vercel in .env.local, or implement deployCloudflare() " +
      "in src/lib/deploy/index.ts.",
  );
}

export async function deploySite(input: DeployInput): Promise<string> {
  switch (env.deployTarget) {
    case "vercel":
      return deployVercel(input);
    case "cloudflare":
      return deployCloudflare(input);
    default:
      throw new DeployError(
        `Unknown DEPLOY_TARGET "${env.deployTarget}". Use "vercel" or "cloudflare".`,
      );
  }
}
