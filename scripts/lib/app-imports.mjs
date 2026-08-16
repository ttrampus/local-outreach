// Lets a plain `node scripts/*.mjs` import the app's own TypeScript modules.
//
// Node 26 strips types on its own, but it doesn't know two things Next.js does:
// the "@/…" path alias from tsconfig, and extensionless imports ("./pricing").
// It also has no "server-only" package installed — Next resolves that name
// internally, so under bare node every `import "server-only"` would throw.
//
// This registers a resolve hook covering exactly those three gaps, so scripts can
// exercise the SAME code the app runs instead of a second copy that drifts.
// Rewriting is confined to specifiers coming from files under src/: node_modules
// (better-sqlite3 and friends, resolved through CJS require) must be left alone.
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";

/** Project root — this file lives at <root>/scripts/lib/. */
export const ROOT = path.resolve(import.meta.dirname, "..", "..");

const SRC = pathToFileURL(path.join(ROOT, "src") + path.sep).href;
const CANDIDATES = [".ts", ".tsx", ".mts", ".js", ".mjs", "/index.ts", "/index.tsx"];

/** Append the extension TypeScript lets you omit, when the bare path isn't a file. */
function withExtension(url) {
  if (!url.startsWith("file:")) return url;
  const filePath = new URL(url).pathname;
  if (filePath.endsWith("/")) return url;
  if (existsSync(filePath)) return url;
  for (const ext of CANDIDATES) if (existsSync(filePath + ext)) return url + ext;
  return url; // let node report the real "not found"
}

registerHooks({
  resolve(specifier, context, next) {
    // "server-only" / "client-only" are Next.js build markers with no runtime
    // behaviour. An empty module is a faithful stand-in.
    if (specifier === "server-only" || specifier === "client-only") {
      return { url: "data:text/javascript,", shortCircuit: true };
    }
    if (specifier.startsWith("@/")) {
      return next(withExtension(new URL(specifier.slice(2), SRC).href), context);
    }
    // Only rewrite relative specifiers written by our own source files.
    if (specifier.startsWith(".") && context.parentURL?.startsWith(SRC)) {
      return next(withExtension(new URL(specifier, context.parentURL).href), context);
    }
    return next(specifier, context);
  },
});

/** Import an app module by repo-relative path, e.g. app("src/lib/outreach/send.ts"). */
export function app(relativePath) {
  return import(pathToFileURL(path.join(ROOT, relativePath)).href);
}
