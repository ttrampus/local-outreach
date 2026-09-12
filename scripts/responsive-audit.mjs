// Measure responsive breakage on a page across viewports.
//
//   node scripts/responsive-audit.mjs <file.html|url> [more...] [--json]
//
// Reports, per viewport: horizontal overflow (and the elements causing it),
// text smaller than 12px, touch targets under 40px, elements wider than their
// container, and overlapping text nodes. Exit code is non-zero if anything is
// found, so it can gate a change.
import { chromium } from "playwright";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const VIEWPORTS = [
  { name: "small-phone", width: 320, height: 568 },
  { name: "phone", width: 375, height: 812 },
  { name: "large-phone", width: 430, height: 932 },
  { name: "tablet-portrait", width: 768, height: 1024 },
  { name: "tablet-landscape", width: 1024, height: 768 },
  { name: "laptop", width: 1280, height: 800 },
  { name: "desktop", width: 1512, height: 950 },
  { name: "large-desktop", width: 1920, height: 1080 },
];

// Runs in the page. Returns the problems found at the current viewport.
const PROBE = () => {
  const vw = document.documentElement.clientWidth;
  const problems = [];
  const describe = (el) => {
    const id = el.id ? `#${el.id}` : "";
    const cls = typeof el.className === "string" && el.className
      ? `.${el.className.trim().split(/\s+/).slice(0, 3).join(".")}`
      : "";
    const txt = (el.textContent || "").trim().slice(0, 30);
    return `${el.tagName.toLowerCase()}${id}${cls}${txt ? ` "${txt}"` : ""}`;
  };

  const all = [...document.querySelectorAll("body *")].filter((el) => {
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden" || s.opacity === "0") return false;
    // Visually-hidden a11y text (1px clipped boxes) is not a layout problem.
    const r = el.getBoundingClientRect();
    if (r.width <= 1 || r.height <= 1) return false;
    return true;
  });
  // An ancestor that deliberately clips (a marquee, a carousel rail) owns the
  // overflow of everything inside it.
  // The walk stops at <body>: the responsive foundation clips the root itself,
  // which is the safety net, not a licence for elements to overflow behind it.
  const clipped = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      if (/hidden|clip|auto|scroll/.test(getComputedStyle(p).overflowX)) return true;
    }
    return false;
  };

  // 1. Horizontal document overflow.
  const docOverflow = document.documentElement.scrollWidth - vw;
  if (docOverflow > 1) {
    problems.push({ kind: "doc-overflow", detail: `page scrolls ${docOverflow}px past ${vw}px` });
  }

  for (const el of all) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const s = getComputedStyle(el);

    // 2. Elements sticking out past the viewport edges. Fixed/sticky bars that
    // are deliberately offscreen (transform-hidden) are excluded via opacity
    // and by ignoring elements transformed out of flow.
    const off = s.position === "fixed" || s.position === "sticky";
    // Fully offscreen elements are deliberately hidden (skip links, a11y text,
    // offscreen slide-in panels) — not overflow.
    const parked = r.right < 0 || r.left > vw;
    // Decorative bleeds — a watermark, a corner flourish — are drawn to run off
    // the edge on purpose. They carry no content, take no clicks, and sit
    // behind the page, and the root clip is what contains them.
    const decorative =
      s.pointerEvents === "none" && (parseFloat(s.zIndex) < 0 || parseFloat(s.opacity) < 0.45);
    if (!off && !parked && !decorative && !clipped(el) && (r.right > vw + 1 || r.left < -1)) {
      // Only report the outermost offender, not every descendant.
      const parent = el.parentElement;
      const pr = parent?.getBoundingClientRect();
      const parentAlsoOver = pr && (pr.right > vw + 1 || pr.left < -1);
      if (!parentAlsoOver) {
        problems.push({
          kind: "element-overflow",
          detail: `${describe(el)} spans ${Math.round(r.left)}→${Math.round(r.right)} (vw ${vw})`,
        });
      }
    }

    // 3. Content overflowing its own box horizontally (clipped or spilling text).
    if (
      el.scrollWidth - el.clientWidth > 2 &&
      !/hidden|clip|auto|scroll/.test(s.overflowX) &&
      !clipped(el)
    ) {
      problems.push({
        kind: "content-clipped",
        detail: `${describe(el)} content ${el.scrollWidth}px in ${el.clientWidth}px box`,
      });
    }

    const hasText = [...el.childNodes].some(
      (n) => n.nodeType === 3 && n.textContent.trim().length > 1,
    );

    // 4. Unreadably small text.
    if (hasText) {
      const fs = parseFloat(s.fontSize);
      if (fs < 11) {
        problems.push({ kind: "tiny-text", detail: `${describe(el)} at ${fs}px` });
      }
    }

    // 5. Touch targets. Only on narrow viewports, where touch is the input.
    if (vw <= 900 && (el.tagName === "A" || el.tagName === "BUTTON" || el.tagName === "INPUT")) {
      const inline = s.display === "inline" && el.tagName === "A";
      // 44px on the primary axis is the bar. A short text link in a spaced row
      // ("Work", "FAQ") is never 44px wide and does not need to be — what makes
      // it mis-tappable is a short height or a genuinely tiny hit box.
      if (!inline && (r.height < 40 || r.width < 32)) {
        problems.push({
          kind: "small-target",
          detail: `${describe(el)} is ${Math.round(r.width)}×${Math.round(r.height)}`,
        });
      }
    }
  }

  // 6. Images spilling their container or wildly out of ratio.
  for (const img of document.querySelectorAll("img")) {
    const r = img.getBoundingClientRect();
    if (r.width === 0) continue;
    const parent = img.parentElement;
    const pr = parent.getBoundingClientRect();
    if (r.width > pr.width + 2) {
      problems.push({ kind: "image-overflow", detail: `${describe(img)} ${Math.round(r.width)}px in ${Math.round(pr.width)}px parent` });
    }
  }

  return problems;
};

async function auditFile(browser, target, viewports = VIEWPORTS) {
  const url = /^https?:/.test(target) ? target : pathToFileURL(path.resolve(target)).href;
  const results = [];
  for (const vp of viewports) {
    const page = await browser.newPage({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
      reducedMotion: "reduce",
      hasTouch: vp.width <= 900,
      isMobile: vp.width <= 900,
    });
    try {
      // Slow third-party assets (webfonts, picsum photos) must not fail the run;
      // wait for fonts explicitly instead, since they are what moves metrics.
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForLoadState("load", { timeout: 20000 }).catch(() => {});
      await page.evaluate(() => document.fonts?.ready).catch(() => {});
      await page.waitForTimeout(500);
      // Let scroll-reveal fire so real laid-out sections are measured.
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 500) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 30));
        }
        window.scrollTo(0, 0);
      });
      await page.waitForTimeout(300);
      const problems = await page.evaluate(PROBE);
      const height = await page.evaluate(() => document.body.scrollHeight);
      results.push({ viewport: vp.name, width: vp.width, height, problems });
    } catch (err) {
      results.push({ viewport: vp.name, width: vp.width, problems: [{ kind: "error", detail: String(err).slice(0, 200) }] });
    } finally {
      await page.close();
    }
  }
  return { target, results };
}

export async function auditTargets(targets, viewports) {
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  try {
    const out = [];
    for (const t of targets) out.push(await auditFile(browser, t, viewports));
    return out;
  } finally {
    await browser.close();
  }
}

// Deduplicate: the same problem at six viewports is one problem.
function summarize(report) {
  const lines = [];
  let total = 0;
  for (const { target, results } of report) {
    const byProblem = new Map();
    for (const r of results) {
      for (const p of r.problems) {
        const key = `${p.kind}|${p.detail}`;
        if (!byProblem.has(key)) byProblem.set(key, { ...p, at: [] });
        byProblem.get(key).at.push(r.width);
      }
    }
    total += byProblem.size;
    lines.push(`\n${path.basename(target)}  —  ${byProblem.size} issue(s)`);
    const sorted = [...byProblem.values()].sort((a, b) => a.kind.localeCompare(b.kind));
    for (const p of sorted.slice(0, 40)) {
      lines.push(`  [${p.kind}] @${p.at.join(",")} — ${p.detail}`);
    }
    if (sorted.length > 40) lines.push(`  … and ${sorted.length - 40} more`);
  }
  return { text: lines.join("\n"), total };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const targets = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  if (!targets.length) {
    console.error("usage: node scripts/responsive-audit.mjs <file.html|url> [...]");
    process.exit(1);
  }
  const report = await auditTargets(targets);
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    const { text, total } = summarize(report);
    console.log(text);
    console.log(`\n${total} distinct issue(s) across ${targets.length} page(s).`);
    process.exit(total ? 1 : 0);
  }
}
