// Fetch a business's REAL Google photos for use in its preview. Google Place
// Photos is a separate billable SKU, so this is:
//   - LAZY: only called when a preview is actually generated (not during discovery),
//     so you never pay to photograph a lead you don't pursue.
//   - CACHED: bytes are written to disk per placeId; a regenerate reads from disk
//     and never re-bills.
//   - GUARDED: respects the same per-SKU daily/monthly ceilings as the other calls.
// Photos are returned as inline data URIs so the headless screenshot (and any
// deployed HTML) is fully self-contained with no external image origin to resolve.
//
// Two copies are kept per place:
//   {placeId}/00.jpg          the original bytes exactly as Google returned them
//   {placeId}/display/00.webp a resized, EXIF-corrected WebP — the one we inline
// The original is the archive: Photos bills per REQUEST, not per pixel, so we ask
// for Google's maximum and pay nothing extra for it. The display copy exists
// because inlining a 4800px JPEG as base64 would produce a page too heavy to send
// to a prospect's phone.
import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { env } from "@/lib/env";
import { recordCall, dailyLimitReached, monthlyLimitReached } from "@/lib/usage";

const PHOTO_DIR = path.join(process.cwd(), "data", "place-photos");
const BASE = "https://places.googleapis.com/v1";
const DISPLAY_SUBDIR = "display";
const DISPLAY_QUALITY = 82;

function safe(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export type PhotoOrientation = "landscape" | "portrait" | "square-ish" | "unknown";

export interface PhotoShape {
  w: number;
  h: number;
  orientation: PhotoOrientation;
}

/** Decode a data URI's payload back to bytes. */
function bytesOf(dataUri: string): Buffer | null {
  const comma = dataUri.indexOf(",");
  if (comma === -1) return null;
  try {
    return Buffer.from(dataUri.slice(comma + 1), "base64");
  } catch {
    return null;
  }
}

/**
 * Pixel dimensions and orientation of each inline photo.
 *
 * The designer cannot see the photos, so without this it will happily stretch a
 * tall portrait shot across a full-bleed banner — upscaling it into mush and
 * cropping the subject out. Orientation also gates which compositions may be
 * chosen at all (see designTokens.artDirectionFor).
 *
 * Uses sharp rather than a hand-rolled header parser, so WebP (what the display
 * copies are) is read as easily as JPEG.
 *
 * EXIF orientation is applied by hand: `metadata()` reports the dimensions as
 * STORED, and neither `.rotate()` nor the `autoOrient` option changes that. A
 * quarter-turn tag means the stored axes are transposed relative to how the image
 * displays — so a 900x1600 file that displays 1600x900 must be reported as the
 * landscape it is. The display copies are written through `.rotate()`, which bakes
 * the turn in and clears the tag, so this matters for the fallback path that
 * inlines an unconverted original.
 */
export async function photoShapes(photos: string[]): Promise<PhotoShape[]> {
  return Promise.all(
    photos.map(async (p): Promise<PhotoShape> => {
      const unknown: PhotoShape = { w: 0, h: 0, orientation: "unknown" };
      const buf = bytesOf(p);
      if (!buf) return unknown;
      try {
        const meta = await sharp(buf).metadata();
        // Orientations 5-8 are the quarter-turns; 1-4 leave the axes alone.
        const turned = (meta.orientation ?? 1) >= 5;
        const w = turned ? meta.height : meta.width;
        const h = turned ? meta.width : meta.height;
        if (!w || !h) return unknown;
        const ratio = w / h;
        return {
          w,
          h,
          orientation: ratio > 1.15 ? "landscape" : ratio < 0.87 ? "portrait" : "square-ish",
        };
      } catch {
        return unknown;
      }
    }),
  );
}

/** Human-readable shape hint for the prompt, e.g. "portrait 1500x2000". */
export function describeShape(s: PhotoShape): string {
  return s.orientation === "unknown" ? "shape unknown" : `${s.orientation} ${s.w}x${s.h}`;
}

/** True when at least one photo is wide enough to fill a full-bleed banner. */
export function hasLandscape(shapes: PhotoShape[]): boolean {
  return shapes.some((s) => s.orientation === "landscape");
}

/**
 * Resize + re-encode for inlining: EXIF orientation applied (phone photos
 * frequently carry it), long edge capped, WebP for the size win that lets us
 * ship far more resolution at roughly the old byte cost.
 */
async function toDisplayCopy(buf: Buffer): Promise<Buffer> {
  const max = Math.max(320, env.previewPhotoMaxPx);
  return sharp(buf)
    .rotate() // honour EXIF; without this a portrait shot can render sideways
    .resize({ width: max, height: max, fit: "inside", withoutEnlargement: true })
    .webp({ quality: DISPLAY_QUALITY })
    .toBuffer();
}

function mimeForExt(ext: string): string {
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}

function asDataUri(buf: Buffer, ext: string): string {
  return `data:${mimeForExt(ext)};base64,${buf.toString("base64")}`;
}

async function imageFilesIn(dir: string): Promise<string[] | null> {
  try {
    return (await readdir(dir)).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort();
  } catch {
    return null; // no dir yet
  }
}

/**
 * Serve a place's photos from disk, preferring the display copies.
 *
 * When only originals exist — every place cached before display copies were
 * introduced — they are converted and written on first use. That upgrade is
 * local work, so an old cache improves without re-billing Google. It cannot
 * recover detail the original never had: places fetched under the old 1200px cap
 * stay capped until their directory is cleared and re-fetched.
 */
async function readCached(dir: string): Promise<string[] | null> {
  const displayDir = path.join(dir, DISPLAY_SUBDIR);

  const ready = await imageFilesIn(displayDir);
  if (ready?.length) {
    return Promise.all(
      ready.map(async (f) =>
        asDataUri(await readFile(path.join(displayDir, f)), path.extname(f).toLowerCase()),
      ),
    );
  }

  const originals = await imageFilesIn(dir);
  if (!originals?.length) return null;

  await mkdir(displayDir, { recursive: true });
  const out: string[] = [];
  for (const f of originals) {
    const raw = await readFile(path.join(dir, f));
    try {
      const display = await toDisplayCopy(raw);
      await writeFile(path.join(displayDir, `${path.parse(f).name}.webp`), display);
      out.push(asDataUri(display, ".webp"));
    } catch {
      // Unconvertible (truncated download, odd format) — inline the original
      // rather than dropping a photo the page is counting on.
      out.push(asDataUri(raw, path.extname(f).toLowerCase()));
    }
  }
  return out.length ? out : null;
}

/** Download one Place Photo's bytes; returns the buffer + a file extension. */
async function fetchOne(photoName: string): Promise<{ buf: Buffer; ext: string } | null> {
  // Google's ceiling on both axes. Billing is per request, so asking for the
  // largest available image costs exactly what a small one costs — and the old
  // maxHeightPx=1200 was the reason tall phone photos arrived only ~900px wide.
  const url =
    `${BASE}/${photoName}/media?maxHeightPx=4800&maxWidthPx=4800&skipHttpRedirect=false`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000); // larger images, longer download
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "X-Goog-Api-Key": env.googlePlacesApiKey },
    });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "image/jpeg";
    const ext = type.includes("png") ? ".png" : type.includes("webp") ? ".webp" : ".jpg";
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.byteLength > 0 ? { buf, ext } : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Return up to `previewPhotoCount` real photos for a place as data URIs. Reads the
 * on-disk cache first; on a miss, downloads (respecting cost caps) and caches. Any
 * failure degrades to fewer/no photos rather than throwing — the preview still renders.
 */
export async function fetchPreviewPhotos(
  placeId: string,
  photoRefs: string[] | undefined,
): Promise<string[]> {
  const dir = path.join(PHOTO_DIR, safe(placeId));

  const cached = await readCached(dir);
  if (cached) return cached;

  if (!env.googlePlacesApiKey || !photoRefs?.length) return [];

  const want = Math.max(1, env.previewPhotoCount);
  const refs = photoRefs.slice(0, want);
  const displayDir = path.join(dir, DISPLAY_SUBDIR);
  await mkdir(displayDir, { recursive: true });

  const out: string[] = [];
  for (let i = 0; i < refs.length; i++) {
    if (await monthlyLimitReached("PLACE_PHOTOS")) break;
    if (await dailyLimitReached("PLACE_PHOTOS")) break;

    const got = await fetchOne(refs[i]);
    if (!got) continue;
    await recordCall("PLACE_PHOTOS");

    const stem = String(i).padStart(2, "0");
    await writeFile(path.join(dir, `${stem}${got.ext}`), got.buf); // archive the original
    try {
      const display = await toDisplayCopy(got.buf);
      await writeFile(path.join(displayDir, `${stem}.webp`), display);
      out.push(asDataUri(display, ".webp"));
    } catch {
      out.push(asDataUri(got.buf, got.ext)); // conversion failed; ship what we have
    }
  }
  return out;
}
