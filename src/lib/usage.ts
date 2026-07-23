// Per-SKU API usage accounting. Google's March-2025 pricing gives each API SKU
// its own free monthly allowance, so we track each SKU as a separate cost center.
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import type { ApiSku } from "@/lib/leadSource/types";

function utcDay(d = new Date()): string {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function utcMonthPrefix(d = new Date()): string {
  return d.toISOString().slice(0, 7); // YYYY-MM
}

/** Record one billable call against a SKU for today (UTC). */
export async function recordCall(sku: ApiSku): Promise<void> {
  const day = utcDay();
  await prisma.apiUsage.upsert({
    where: { sku_day: { sku, day } },
    create: { sku, day, count: 1 },
    update: { count: { increment: 1 } },
  });
}

/** How many calls of this SKU have been made today (UTC). */
export async function callsToday(sku: ApiSku): Promise<number> {
  const row = await prisma.apiUsage.findUnique({
    where: { sku_day: { sku, day: utcDay() } },
  });
  return row?.count ?? 0;
}

/** How many calls of this SKU have been made this calendar month (UTC). */
export async function callsThisMonth(sku: ApiSku): Promise<number> {
  const rows = await prisma.apiUsage.findMany({
    where: { sku, day: { startsWith: utcMonthPrefix() } },
  });
  return rows.reduce((sum, r) => sum + r.count, 0);
}

const DAILY_CEILING: Record<ApiSku, number> = {
  TEXT_SEARCH: env.maxSearchPerDay,
  PLACE_DETAILS: env.maxDetailsPerDay,
  PLACE_PHOTOS: env.maxPhotosPerDay,
  STATIC_MAP: env.maxStaticMapsPerDay,
};

const MONTHLY_CEILING: Record<ApiSku, number> = {
  TEXT_SEARCH: env.maxSearchPerMonth,
  PLACE_DETAILS: env.maxDetailsPerMonth,
  PLACE_PHOTOS: env.maxPhotosPerMonth,
  STATIC_MAP: env.maxStaticMapsPerMonth,
};

/** True when today's calls for this SKU are at/over the configured daily stop. */
export async function dailyLimitReached(sku: ApiSku): Promise<boolean> {
  return (await callsToday(sku)) >= DAILY_CEILING[sku];
}

/**
 * True when this month's calls for this SKU are at/over the monthly free-tier
 * guard. This is the real $0 failsafe: the Google free allowance is monthly, so
 * the daily cap alone can't guarantee it. Independent of any GCP-side quota.
 */
export async function monthlyLimitReached(sku: ApiSku): Promise<boolean> {
  return (await callsThisMonth(sku)) >= MONTHLY_CEILING[sku];
}

export interface UsageSummary {
  sku: ApiSku;
  today: number;
  dailyLimit: number;
  month: number;
  freeTierMonthly: number;
  /** 0–100+, share of the (estimated) free monthly allowance consumed. */
  freeTierPct: number;
}

/** Dashboard view: today + this-month totals per SKU, against free-tier estimates. */
export async function usageSummary(): Promise<UsageSummary[]> {
  const monthRows = await prisma.apiUsage.findMany({
    where: { day: { startsWith: utcMonthPrefix() } },
  });

  const monthBySku = new Map<string, number>();
  for (const r of monthRows) {
    monthBySku.set(r.sku, (monthBySku.get(r.sku) ?? 0) + r.count);
  }

  const skus: ApiSku[] = ["TEXT_SEARCH", "PLACE_DETAILS", "PLACE_PHOTOS", "STATIC_MAP"];
  const freeTier: Record<ApiSku, number> = {
    TEXT_SEARCH: env.freeTierTextSearchPerMonth,
    PLACE_DETAILS: env.freeTierPlaceDetailsPerMonth,
    PLACE_PHOTOS: env.freeTierPlacePhotosPerMonth,
    STATIC_MAP: env.freeTierStaticMapsPerMonth,
  };

  const result: UsageSummary[] = [];
  for (const sku of skus) {
    const today = await callsToday(sku);
    const month = monthBySku.get(sku) ?? 0;
    const freeTierMonthly = freeTier[sku];
    result.push({
      sku,
      today,
      dailyLimit: DAILY_CEILING[sku],
      month,
      freeTierMonthly,
      freeTierPct: freeTierMonthly > 0 ? Math.round((month / freeTierMonthly) * 100) : 0,
    });
  }
  return result;
}
