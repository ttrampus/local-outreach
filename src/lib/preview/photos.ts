// Fetch a business's REAL Google photos for use in its preview. Google Place
// Photos is a separate billable SKU, so this is:
//   - LAZY: only called when a preview is actually generated (not during discovery),
//     so you never pay to photograph a lead you don't pursue.
//   - CACHED: bytes are written to disk per placeId; a regenerate reads from disk
//     and never re-bills.
//   - GUARDED: respects the same per-SKU daily/monthly ceilings as the other calls.
// Photos are returned as inline data URIs so the headless screenshot (and any
// deployed HTML) is fully self-contained with no external image origin to resolve.
import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";
import { recordCall, dailyLimitReached, monthlyLimitReached } from "@/lib/usage";

const PHOTO_DIR = path.join(process.cwd(), "data", "place-photos");
const BASE = "https://places.googleapis.com/v1";

function safe(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, "_");
}

/**
 * Pixel dimensions of an inline image, read from its header. Returns null for a
 * format we don't parse — the caller must treat shape as simply unknown.
 *
 * Needed because the designer cannot see the photos: without a shape it will
 * happily stretch a tall portrait shot across a full-bleed banner, which both
 * upscales it into mush and crops the subject out.
 */
export function imageSize(dataUri: string): { w: number; h: number } | null {
  const comma = dataUri.indexOf(",");
  if (comma === -1) return null;
  let buf: Buffer;
  try {
    buf = Buffer.from(dataUri.slice(comma + 1), "base64");
  } catch {
    return null;
  }
  if (buf.length < 24) return null;

  // PNG: IHDR width/height are the first two big-endian u32 after the signature.
  if (buf[0] === 0x89 && buf[1] === 0x50) {
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  }

  // JPEG: scan segments for a Start-Of-Frame marker, which carries the size.
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = buf[i + 1];
      // SOF0/1/2/3 and 5..7, 9..11, 13..15 all carry frame dimensions.
      if (
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf)
      ) {
        return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
      }
      if (marker === 0xd8 || marker === 0xd9) {
        i += 2;
        continue;
      }
      i += 2 + buf.readUInt16BE(i + 2);
    }
  }
  return null;
}

/** Human-readable shape hint per photo, e.g. "portrait 900x1200". */
export function describePhotoShapes(photos: string[]): string[] {
  return photos.map((p) => {
    const size = imageSize(p);
    if (!size) return "shape unknown";
    const { w, h } = size;
    const ratio = w / h;
    const kind = ratio > 1.15 ? "landscape" : ratio < 0.87 ? "portrait" : "square-ish";
    return `${kind} ${w}x${h}`;
  });
}

function mimeForExt(ext: string): string {
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}

async function readCached(dir: string): Promise<string[] | null> {
  let files: string[];
  try {
    files = (await readdir(dir)).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort();
  } catch {
    return null; // no dir yet
  }
  if (!files.length) return null;
  const out: string[] = [];
  for (const f of files) {
    const buf = await readFile(path.join(dir, f));
    out.push(`data:${mimeForExt(path.extname(f).toLowerCase())};base64,${buf.toString("base64")}`);
  }
  return out;
}

/** Download one Place Photo's bytes; returns the buffer + a file extension. */
async function fetchOne(photoName: string): Promise<{ buf: Buffer; ext: string } | null> {
  const url =
    `${BASE}/${photoName}/media?maxHeightPx=1200&maxWidthPx=1600&skipHttpRedirect=false`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
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
  await mkdir(dir, { recursive: true });

  const out: string[] = [];
  for (let i = 0; i < refs.length; i++) {
    if (await monthlyLimitReached("PLACE_PHOTOS")) break;
    if (await dailyLimitReached("PLACE_PHOTOS")) break;

    const got = await fetchOne(refs[i]);
    if (!got) continue;
    await recordCall("PLACE_PHOTOS");
    await writeFile(path.join(dir, `${String(i).padStart(2, "0")}${got.ext}`), got.buf);
    out.push(`data:${mimeForExt(got.ext)};base64,${got.buf.toString("base64")}`);
  }
  return out;
}
