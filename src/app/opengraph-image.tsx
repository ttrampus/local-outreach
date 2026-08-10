// The card that shows up when the public page gets pasted into a chat, an email
// preview or a search result. Prospects are sent a link and nothing else, so the
// unfurl is often the first time they see the brand at all — hence the lockup
// rather than a screenshot of the page.
import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { BRAND } from "@/lib/brand";

export const alt = "Avenyo — sodobne spletne strani za lokalna podjetja";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The mark, reversed for the dark ground. Inlined as a data URI because this
// renders through satori, which draws <img> reliably but only supports a subset
// of SVG elements written inline.
const MARK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <path d="M6 87 L27 87 L48.5 20 L43 20 Z" fill="${BRAND.paper}"/>
  <path d="M94 87 L73 87 L51.5 20 L57 20 Z" fill="${BRAND.paper}"/>
  <rect x="44.5" y="55" width="11" height="17" rx="2.5" fill="${BRAND.signalLight}"/>
</svg>`;

export default async function Image() {
  const archivo = await readFile(join(process.cwd(), "src/app/_brand/Archivo-Bold.ttf"));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 96px",
          // The site's own ground, lifted by the same accent glow the hero uses.
          background: "linear-gradient(140deg, #0b0e14 55%, #141b2e 100%)",
          color: BRAND.paper,
          fontFamily: "Archivo",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 54 }}>
          <img
            width={168}
            height={168}
            src={`data:image/svg+xml;base64,${Buffer.from(MARK).toString("base64")}`}
            alt=""
          />
          <div style={{ fontSize: 104, letterSpacing: "0.005em" }}>AVENYO</div>
        </div>
        <div style={{ marginTop: 48, fontSize: 40, color: "#9aa3b2", lineHeight: 1.3 }}>
          Sodobne spletne strani za lokalna podjetja.
        </div>
        <div style={{ marginTop: 16, fontSize: 40, color: BRAND.signalLight }}>
          Predlog pripravim vnaprej in brezplačno.
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "Archivo", data: archivo, style: "normal", weight: 700 }],
    },
  );
}
