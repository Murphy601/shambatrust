import type { TitleLookupResult } from "@/lib/db/types";

/**
 * Simulated ArdhiSasa / Ministry of Lands title search.
 * Replace with a real API adapter when credentials are available.
 */
export function lookupTitleDeed(input: {
  titleNumber: string;
  county: string;
}): TitleLookupResult {
  const title = input.titleNumber.trim().toUpperCase();
  const county = input.county.trim() || "Unknown county";
  const checkedAt = new Date().toISOString();

  if (!title) {
    return {
      found: false,
      simulated: true,
      ownerName: null,
      registrationStatus: "invalid_query",
      approximateLocation: null,
      caveats: ["Title number required"],
      checkedAt,
      rawNote: "Empty title number — lookup skipped.",
    };
  }

  // Deterministic mock: titles ending in odd digit = found with caveat;
  // ending in even = clean found; letters-only edge = not found.
  const lastChar = title.replace(/[^0-9A-Z]/g, "").slice(-1);
  const lastDigit = Number.parseInt(lastChar, 10);

  if (Number.isNaN(lastDigit) && /[A-Z]/.test(lastChar) && !/\d/.test(title)) {
    return {
      found: false,
      simulated: true,
      ownerName: null,
      registrationStatus: "not_found",
      approximateLocation: county,
      caveats: ["No matching folio in simulated registry"],
      checkedAt,
      rawNote: `SIMULATED: No record for ${title} in ${county}.`,
    };
  }

  const foundClean = !Number.isNaN(lastDigit) && lastDigit % 2 === 0;
  const ownerName = inventOwnerName(title);

  return {
    found: true,
    simulated: true,
    ownerName,
    registrationStatus: foundClean ? "registered" : "registered_with_caveat",
    approximateLocation: `${county} (approx. from title folio)`,
    caveats: foundClean
      ? []
      : [
          "Simulated caveat: confirm against physical green card / official search",
          "Possible prior charge — request official search certificate",
        ],
    checkedAt,
    rawNote: foundClean
      ? `SIMULATED ArdhiSasa hit: ${title} appears registered to ${ownerName}.`
      : `SIMULATED ArdhiSasa hit with caution flags for ${title}.`,
  };
}

function inventOwnerName(title: string): string {
  const seeds = [
    "Kamau Wanjiru Family Trust",
    "Otieno Okoth",
    "Njeri Mwangi",
    "Chebet Kiprop",
    "Hassan Ali Mohamed",
  ];
  let hash = 0;
  for (let i = 0; i < title.length; i += 1) {
    hash = (hash + title.charCodeAt(i) * (i + 1)) % seeds.length;
  }
  return seeds[hash];
}
