// What a business's photo actually shows, decided locally and for free.
//
// The templates used to give the hero to whichever photo had the most pixels,
// with no idea what was in it — which is how a lash studio's page opened on a
// macro shot of an eye, and how a salon with three good interior photos got an
// empty hero because they happened to be portrait. Google tells us nothing about
// content, and the obvious fix (a vision API call per photo) costs money per lead.
//
// So this runs CLIP (a small image/text model) on the server itself through
// transformers.js: zero-shot, no training, ~70ms a photo on CPU, and no bill.
// Each photo gets a role, and the role decides where it may go:
//
//   interior / exterior  → hero candidates (interior preferred — it is what makes
//                           an owner say "that's my place")
//   food / work / vehicle → gallery and photo slots (and hero, for the trades
//                           where that is the product: a dish, a car)
//   closeup / person     → gallery only, never the hero
//   graphic / other      → dropped: flyers, logos, text posters and blurry shots
//                           make a page look scraped, not built
//
// Everything here is best-effort. If the model cannot load (no disk, no network
// on first run), photos pass through unclassified and the templates fall back to
// their own size-based placement — a generation never fails because of this.
import "server-only";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

export type PhotoRole =
  | "interior"
  | "exterior"
  | "food"
  | "work"
  | "vehicle"
  | "closeup"
  | "person"
  | "graphic"
  | "other";

// Phrased as captions, which is what CLIP was trained to match. Tuned on real
// Slovene small-business photos: the "closeup" wording is what separates a lash
// macro from a finished-work shot, food has its own label because a plated dish
// otherwise reads as a restaurant interior, and vehicles have theirs because a
// driving school's fleet photos otherwise land in "other" and get dropped.
const LABELS: Record<PhotoRole, string> = {
  interior: "a photo of the inside of a shop, salon, restaurant, workshop or office",
  exterior: "a photo of a building entrance or storefront seen from the street",
  food: "a photo of a plate of food, a dessert or a drink",
  work: "a photo of finished work or products, like a hairstyle, nails, furniture or a repaired car",
  vehicle: "a photo of a car, a van or a motorcycle",
  closeup: "an extreme close-up macro photo of an eye, skin, lips or fingernails",
  person: "a portrait photo of a person or a group of people",
  graphic: "a logo, poster, flyer, price list or an image with a lot of text",
  other: "a blurry, dark or meaningless photo",
};
const ROLES = Object.keys(LABELS) as PhotoRole[];
const TEXTS = ROLES.map((r) => LABELS[r]);

export interface PhotoInsight {
  role: PhotoRole;
  /** Score of the winning label, 0–1. */
  confidence: number;
  scores: Partial<Record<PhotoRole, number>>;
}

// Bump when LABELS change, so cached verdicts from the old wording are ignored.
const CACHE_VERSION = 1;
const CACHE_DIR = path.join(process.cwd(), "data", "photo-roles");
const MODEL = "Xenova/clip-vit-base-patch32";

type Classifier = (
  image: unknown,
  labels: string[],
) => Promise<{ label: string; score: number }[]>;

let loading: Promise<{ clf: Classifier; RawImage: new (...a: unknown[]) => unknown } | null> | null =
  null;

/** Load the model once per process. Resolves null if it cannot be loaded. */
function loadModel() {
  loading ??= (async () => {
    try {
      const tf = await import("@huggingface/transformers");
      // Model files live beside the app's other data, not in a home-dir cache
      // that a deploy user or a container may not have.
      tf.env.cacheDir = path.join(process.cwd(), "data", "models");
      const clf = (await tf.pipeline("zero-shot-image-classification", MODEL, {
        dtype: "q8",
      })) as unknown as Classifier;
      return { clf, RawImage: tf.RawImage as unknown as new (...a: unknown[]) => unknown };
    } catch (err) {
      console.warn("[photo-roles] model unavailable, photos stay unclassified:", err);
      return null;
    }
  })();
  return loading;
}

function decodeDataUri(src: string): Buffer | null {
  const i = src.indexOf(";base64,");
  return src.startsWith("data:") && i > 0 ? Buffer.from(src.slice(i + 8), "base64") : null;
}

async function classifyOne(src: string): Promise<PhotoInsight | null> {
  const buf = decodeDataUri(src);
  if (!buf) return null;

  const key = createHash("sha1").update(buf).digest("hex");
  const cacheFile = path.join(CACHE_DIR, `${key}.v${CACHE_VERSION}.json`);
  try {
    return JSON.parse(await readFile(cacheFile, "utf8")) as PhotoInsight;
  } catch {
    /* not cached yet */
  }

  const model = await loadModel();
  if (!model) return null;

  try {
    // CLIP looks at 224px anyway; decoding a 4MP photo to pass it in would only
    // cost memory on a small server.
    const { data, info } = await sharp(buf)
      .rotate()
      .resize(336, 336, { fit: "inside" })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const image = new model.RawImage(new Uint8ClampedArray(data), info.width, info.height, 3);
    const out = await model.clf(image, TEXTS);

    const scores: Partial<Record<PhotoRole, number>> = {};
    for (const o of out) scores[ROLES[TEXTS.indexOf(o.label)]] = +o.score.toFixed(3);
    const best = out[0];
    const insight: PhotoInsight = {
      role: ROLES[TEXTS.indexOf(best.label)],
      confidence: +best.score.toFixed(3),
      scores,
    };

    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(cacheFile, JSON.stringify(insight));
    return insight;
  } catch (err) {
    console.warn("[photo-roles] classification failed for one photo:", err);
    return null;
  }
}

/**
 * Classify photos sequentially. Sequential because the model is CPU-bound and
 * shares a small server with a headless browser; running them in parallel would
 * only contend for the same cores.
 */
export async function classifyPhotos(srcs: string[]): Promise<(PhotoInsight | null)[]> {
  const out: (PhotoInsight | null)[] = [];
  for (const s of srcs) out.push(await classifyOne(s));
  return out;
}

/** What may open a page when a template does not say otherwise: the place itself. */
export const DEFAULT_HERO_ROLES: PhotoRole[] = ["interior", "exterior"];

/**
 * May this photo be the hero?
 *
 * `heroRoles` comes from the template, because the right first image depends on
 * the trade: a salon should open on its room, a restaurant may open on a dish,
 * and a photographer's portfolio portraits are exactly what their hero is for.
 *
 * A strong close-up signal is refused whatever won — the eye photo that started
 * this scored "work" first and "closeup" a close second.
 */
export function heroEligible(p: PhotoInsight | null, heroRoles: PhotoRole[]): boolean {
  if (!p) return true; // unclassified: leave the template's own judgement in charge
  if ((p.scores.closeup ?? 0) >= 0.2 && p.role !== "interior") return false;
  // A weak win is a guess, and the hero is the one place a guess shows.
  return heroRoles.includes(p.role) && p.confidence >= 0.5;
}

/**
 * Order hero candidates best-first: earlier roles in `heroRoles` win (the room
 * before the storefront), then the more confident verdict.
 */
export function heroRank(p: PhotoInsight, heroRoles: PhotoRole[]): number {
  return (heroRoles.length - heroRoles.indexOf(p.role)) + p.confidence;
}

/** Drop from the page entirely: text graphics and junk photos. */
export function unusable(p: PhotoInsight | null): boolean {
  if (!p) return false;
  return (p.role === "graphic" && p.confidence >= 0.5) || (p.role === "other" && p.confidence >= 0.6);
}
