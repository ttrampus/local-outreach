// Fetch a clean static map of a business's REAL location for its preview's
// contact/location section. A real map of their street reads as "this is genuinely
// us" far more than any stock imagery. Same discipline as the photos pipeline:
//   - LAZY: only fetched when a preview is built, never during discovery.
//   - CACHED: bytes are written to disk per placeId; regenerating never re-bills.
//   - GUARDED: respects per-SKU daily/monthly ceilings (STATIC_MAP).
//   - INLINED: returned as a data URI so the deployed HTML is self-contained and
//     the Google API key never appears in any client-visible URL.
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";
import { recordCall, dailyLimitReached, monthlyLimitReached } from "@/lib/usage";
import type { NormalizedPlaceDetails } from "@/lib/leadSource/types";

const MAP_DIR = path.join(process.cwd(), "data", "place-maps");
const BASE = "https://maps.googleapis.com/maps/api/staticmap";

function safe(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, "_");
}

// A restrained, light style: neutral land/water, no point-of-interest clutter, so
// the map looks designed rather than like a raw screenshot. Kept compact to stay
// well within the Static Maps URL length limit.
const STYLE = [
  "feature:poi|visibility:off",
  "feature:transit|visibility:off",
  "feature:road|element:labels.icon|visibility:off",
  "feature:landscape|color:0xf3f1ec",
  "feature:water|color:0xdfe6e6",
  "feature:road|element:geometry|color:0xffffff",
];

/** Build the request URL. Prefer precise lat/lng; fall back to the address string. */
function mapUrl(details: NormalizedPlaceDetails): string | null {
  const center =
    details.latitude != null && details.longitude != null
      ? `${details.latitude},${details.longitude}`
      : details.address;
  if (!center) return null;

  const params = new URLSearchParams({
    center,
    zoom: "15",
    size: "640x420",
    scale: "2",
    format: "png",
    markers: `color:0x2a2a2a|${center}`,
    key: env.googlePlacesApiKey,
  });
  // URLSearchParams would percent-encode the `|` in each style rule (Static Maps
  // wants it literal), so append style params by hand.
  const styleQs = STYLE.map((s) => `style=${encodeURIComponent(s)}`).join("&");
  return `${BASE}?${params.toString()}&${styleQs}`;
}

async function readCached(file: string): Promise<string | null> {
  try {
    const buf = await readFile(file);
    return buf.byteLength ? `data:image/png;base64,${buf.toString("base64")}` : null;
  } catch {
    return null;
  }
}

/**
 * Return a static-map data URI for a place, or null when unavailable (disabled, no
 * key, no location, capped, or fetch failure). Reads the on-disk cache first; on a
 * miss, downloads (respecting cost caps) and caches. Never throws — the preview
 * still renders without a map.
 */
export async function fetchStaticMap(
  placeId: string,
  details: NormalizedPlaceDetails,
): Promise<string | null> {
  if (!env.previewMap || !env.googlePlacesApiKey) return null;

  const file = path.join(MAP_DIR, safe(placeId), "map.png");
  const cached = await readCached(file);
  if (cached) return cached;

  const url = mapUrl(details);
  if (!url) return null;

  if (await monthlyLimitReached("STATIC_MAP")) return null;
  if (await dailyLimitReached("STATIC_MAP")) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.byteLength) return null;
    await recordCall("STATIC_MAP");
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, buf);
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
