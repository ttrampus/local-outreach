// Registry of full-page designs.
//
// A Design owns the entire document body and ships its own CSS, unlike the
// hero-only archetypes in template.ts. Adding one here makes it selectable
// everywhere without touching the generator.
import type { Ctx } from "../template";
import { atelierBody, atelierCss } from "./atelier";
import { kioskBody, kioskCss } from "./kiosk";
import { vitrineBody, vitrineCss } from "./vitrine";
import { noirBody, noirCss } from "./noir";
import { maisonBody, maisonCss } from "./maison";

export interface Design {
  id: string;
  /** Human name, for the gallery and the console. */
  label: string;
  /** The complete document body: nav, hero, every section, footer. */
  body(c: Ctx): string;
  /** CSS appended after the shared token/reset base. */
  css(): string;
}

export const DESIGNS = {
  atelier: { id: "atelier", label: "Atelier", body: atelierBody, css: atelierCss },
  kiosk: { id: "kiosk", label: "Kiosk", body: kioskBody, css: kioskCss },
  vitrine: { id: "vitrine", label: "Vitrine", body: vitrineBody, css: vitrineCss },
  noir: { id: "noir", label: "Noir", body: noirBody, css: noirCss },
  maison: { id: "maison", label: "Maison", body: maisonBody, css: maisonCss },
} as const satisfies Record<string, Design>;

export type DesignId = keyof typeof DESIGNS;

export const DESIGN_IDS = Object.keys(DESIGNS) as DesignId[];
