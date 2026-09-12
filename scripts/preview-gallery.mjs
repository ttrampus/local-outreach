// Build a browsable index of every generated preview.
//
// The generated pages live in data/previews/ (HTML) with their screenshots in
// public/previews/ (PNG). Neither is reachable through the app unless a Lead row
// points at it, so trial renders — and any preview whose lead was regenerated
// since — are invisible. This writes a plain gallery over whatever is on disk.
//
//   node scripts/preview-gallery.mjs && python3 -m http.server 8080
//   → http://localhost:8080/preview-gallery.html
import { readdir, writeFile, stat } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const HTML_DIR = path.join(ROOT, "data", "previews");
const IMG_DIR = path.join(ROOT, "public", "previews");

const htmlFiles = (await readdir(HTML_DIR)).filter((f) => f.endsWith(".html") && f !== "index.html");
const imgFiles = new Set(await readdir(IMG_DIR));

const entries = [];
for (const file of htmlFiles) {
  const base = file.replace(/\.html$/, "");
  const { mtime } = await stat(path.join(HTML_DIR, file));
  // Engine is encoded in the filename: "<placeId>--<engine>-v<n>-<stamp>".
  const engine = base.includes("--") ? (base.split("--")[1]?.split("-")[0] ?? "template") : "template";
  entries.push({
    file,
    engine,
    mtime,
    shot: imgFiles.has(`${base}.png`) ? `${base}.png` : null,
  });
}
entries.sort((a, b) => b.mtime - a.mtime);

const counts = entries.reduce((acc, e) => ({ ...acc, [e.engine]: (acc[e.engine] ?? 0) + 1 }), {});
// Full-page designs first in the filter bar — they are what's being worked on.
const DESIGN_IDS = ["atelier", "kiosk", "vitrine", "noir", "maison"];
const order = [
  ...DESIGN_IDS.filter((d) => counts[d]),
  ...Object.keys(counts).filter((k) => !DESIGN_IDS.includes(k)).sort(),
];

const card = (e) => `
  <a class="card" data-engine="${e.engine}" href="/data/previews/${encodeURIComponent(e.file)}" target="_blank">
    ${
      e.shot
        ? `<img loading="lazy" src="/public/previews/${encodeURIComponent(e.shot)}" alt="">`
        : `<div class="noshot">no screenshot</div>`
    }
    <div class="meta">
      <span class="engine engine-${e.engine}">${e.engine}</span>
      <time>${e.mtime.toISOString().slice(0, 16).replace("T", " ")}</time>
    </div>
    <div class="file">${e.file}</div>
  </a>`;

const html = `<!doctype html>
<meta charset="utf-8">
<title>Preview gallery (${entries.length})</title>
<style>
  :root { color-scheme: light dark; }
  body { margin:0; padding:24px; font:14px/1.5 system-ui,sans-serif; background:#0e0e10; color:#e8e8ea; }
  h1 { font-size:16px; margin:0 0 4px; }
  p.sub { margin:0 0 20px; color:#8a8a92; }
  .grid { display:grid; gap:16px; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); }
  .card { display:block; text-decoration:none; color:inherit; background:#17171a; border:1px solid #26262b;
          border-radius:10px; overflow:hidden; transition:border-color .15s; }
  .card:hover { border-color:#5b8cff; }
  .card img { display:block; width:100%; aspect-ratio:4/3; object-fit:cover; object-position:top; background:#000; }
  .noshot { aspect-ratio:4/3; display:grid; place-items:center; color:#55555c; }
  .meta { display:flex; justify-content:space-between; align-items:center; padding:8px 10px 2px; }
  .engine { font-size:11px; font-weight:600; padding:1px 7px; border-radius:99px; }
  .engine-ai { background:#3a2a5e; color:#c9b4ff; }
  .engine-spec { background:#12402f; color:#7ee2b8; }
  .engine-template { background:#2b2b31; color:#a5a5ad; }
  .engine-manual { background:#3d3320; color:#e6c88a; }
  /* full-page designs */
  .engine-atelier { background:#1d3550; color:#9cc8ff; }
  .engine-kiosk { background:#4a1f1f; color:#ff9d9d; }
  .engine-vitrine { background:#123f45; color:#7fe0ee; }
  .engine-noir { background:#111; color:#f0f0f0; box-shadow:inset 0 0 0 1px #444; }
  .engine-maison { background:#4a3a22; color:#f2cd97; }
  .bar { display:flex; flex-wrap:wrap; gap:8px; margin:0 0 20px; }
  .chip { font:inherit; font-size:12px; padding:6px 13px; border-radius:99px; cursor:pointer;
          background:#17171a; color:#c8c8d0; border:1px solid #2a2a31; }
  .chip:hover { border-color:#5b8cff; }
  .chip.on { background:#5b8cff; color:#0e0e10; border-color:#5b8cff; font-weight:600; }
  .card.hide { display:none; }
  time { font-size:11px; color:#6e6e76; }
  .file { padding:0 10px 10px; font-size:10px; color:#55555c; overflow-wrap:anywhere; }
</style>
<h1>Preview gallery</h1>
<p class="sub">${entries.length} pages · newest first · click any card to open the real HTML</p>
<div class="bar">
  <button class="chip on" data-f="all">All (${entries.length})</button>
  ${order.map((k) => `<button class="chip" data-f="${k}">${k} (${counts[k]})</button>`).join("")}
</div>
<div class="grid">${entries.map(card).join("")}</div>
<script>
  const chips = document.querySelectorAll(".chip");
  const cards = document.querySelectorAll(".card");
  chips.forEach((chip) => chip.addEventListener("click", () => {
    chips.forEach((c) => c.classList.toggle("on", c === chip));
    const f = chip.dataset.f;
    cards.forEach((card) => {
      card.classList.toggle("hide", f !== "all" && card.dataset.engine !== f);
    });
  }));
</script>
`;

await writeFile(path.join(ROOT, "preview-gallery.html"), html);
console.log(`preview-gallery.html — ${entries.length} previews`);
for (const [engine, n] of Object.entries(
  entries.reduce((acc, e) => ({ ...acc, [e.engine]: (acc[e.engine] ?? 0) + 1 }), {}),
)) {
  console.log(`  ${engine}: ${n}`);
}
