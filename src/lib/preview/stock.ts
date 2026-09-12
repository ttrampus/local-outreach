// Category stock photos: the floor under every image frame on a kit page.
//
// A preview with an empty hero or a blank gallery reads as broken, and plenty of
// real businesses have two photos on Google, or none, or only flyers. So each
// template names a stock set, and the page is topped up from it after the
// business's own usable photos are counted. Real photos always win a frame they
// can fill — the templates' photo engine sorts stock last — so stock only ever
// covers what would otherwise be empty.
//
// The sets are curated by hand, committed under assets/stock/<set>/, and inlined
// as data URIs exactly like the business's own photos, so a page is still one
// self-contained file that works when deployed anywhere. Curation rules, because
// they are the difference between "polished" and "you scraped me and pasted in a
// stranger":
//   · no recognizable people — a stock face reads as "here is your staff"
//   · no logos, signage or text
//   · the trade's room, tools and materials, lit well
//
// Each set has a manifest.json: [{ "file": "01.webp", "width": 1600, "height": 1067 }].
// A missing set is not an error: the page just gets no stock.
import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

const STOCK_DIR = path.join(process.cwd(), "assets", "stock");

export interface StockPhoto {
  src: string;
  width: number;
  height: number;
  stock: true;
}

interface ManifestEntry {
  file: string;
  width: number;
  height: number;
}

const manifests = new Map<string, Promise<ManifestEntry[]>>();

function manifest(set: string): Promise<ManifestEntry[]> {
  let m = manifests.get(set);
  if (!m) {
    m = readFile(path.join(STOCK_DIR, set, "manifest.json"), "utf8")
      .then((s) => JSON.parse(s) as ManifestEntry[])
      .catch(() => []);
    manifests.set(set, m);
  }
  return m;
}

/**
 * `count` stock photos from `set`, chosen deterministically from `seed` so one
 * business always gets the same pictures (a regenerated preview must not shuffle)
 * while two neighbouring salons do not open on the identical hero.
 */
export async function stockPhotos(set: string, count: number, seed: string): Promise<StockPhoto[]> {
  if (count <= 0) return [];
  const entries = await manifest(set);
  if (!entries.length) return [];

  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const start = h % entries.length;

  const out: StockPhoto[] = [];
  for (let i = 0; i < Math.min(count, entries.length); i++) {
    const e = entries[(start + i) % entries.length];
    try {
      const buf = await readFile(path.join(STOCK_DIR, set, e.file));
      const mime = e.file.endsWith(".webp") ? "image/webp" : "image/jpeg";
      out.push({
        src: `data:${mime};base64,${buf.toString("base64")}`,
        width: e.width,
        height: e.height,
        stock: true,
      });
    } catch {
      /* a missing file in a manifest drops that one photo, not the page */
    }
  }
  return out;
}
