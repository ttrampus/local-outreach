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
