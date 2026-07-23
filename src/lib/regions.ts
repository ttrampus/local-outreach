// Named geographic "sweeps" — curated lists of locations that a single category
// is fanned out across to approximate full-country coverage. Google Text Search
// caps every query at ~60 results, so there is no single "whole country" query;
// we cover the map by querying many regional hubs (each pulls a radius around it).
//
// The country suffix disambiguates smaller towns from same-named places abroad,
// since the search sends a plain text query with no region bias.

/** Slovenian regional hubs, chosen so their search radii overlap to blanket the
 * country: central (Ljubljana belt), Štajerska, Koroška, Prekmurje, Primorska,
 * Dolenjska, Gorenjska and Zasavje are all represented. */
const SLOVENIA: string[] = [
  "Ljubljana, Slovenia",
  "Maribor, Slovenia",
  "Celje, Slovenia",
  "Kranj, Slovenia",
  "Velenje, Slovenia",
  "Koper, Slovenia",
  "Novo mesto, Slovenia",
  "Ptuj, Slovenia",
  "Murska Sobota, Slovenia",
  "Nova Gorica, Slovenia",
  "Slovenj Gradec, Slovenia",
  "Krško, Slovenia",
  "Postojna, Slovenia",
  "Jesenice, Slovenia",
  "Domžale, Slovenia",
  "Škofja Loka, Slovenia",
  "Kočevje, Slovenia",
  "Ajdovščina, Slovenia",
  "Trbovlje, Slovenia",
  "Brežice, Slovenia",
];

export const SWEEP_REGIONS = {
  slovenia: SLOVENIA,
} as const;

export type SweepName = keyof typeof SWEEP_REGIONS;

export const SWEEP_NAMES = Object.keys(SWEEP_REGIONS) as [SweepName, ...SweepName[]];
