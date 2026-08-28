/**
 * ArdhiSasa has no public third-party API. Do not call this for new searches.
 * Kept only so old imports fail loudly in development if revived.
 */
export function lookupTitleDeed(_input: {
  titleNumber: string;
  county: string;
}): never {
  throw new Error(
    "ArdhiSasa has no public API. Use advocate-mediated verification in src/lib/land-registry/verification.ts.",
  );
}
