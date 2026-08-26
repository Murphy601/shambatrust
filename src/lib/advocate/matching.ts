import type { Asset, User } from "@/lib/db/types";

/**
 * Automated advocate routing.
 *
 * A newly submitted dossier is offered to every practising advocate whose
 * declared counties overlap the counties of the estate's land. Scoring favours
 * advocates who cover more of the estate and who have spare capacity, so the
 * top of the list is the advocate most likely to actually pick the case up.
 */

export const MAX_MATCH_OFFERS = 8;

/** Counties compare case- and whitespace-insensitively ("Uasin Gishu" vs "uasin gishu"). */
export function normalizeCounty(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Distinct counties an estate touches, land first then the elder's own county. */
export function estateCounties(assets: Asset[], ownerCounty: string): string[] {
  const seen = new Map<string, string>();
  const add = (value: string) => {
    const key = normalizeCounty(value);
    if (!key || seen.has(key)) return;
    seen.set(key, value.trim());
  };
  for (const asset of assets) {
    if (asset.type === "land" || asset.type === "commercial_plot") {
      add(asset.county);
      add(asset.landRegistryOffice);
    }
  }
  for (const asset of assets) add(asset.county);
  add(ownerCounty);
  return [...seen.values()];
}

export type MatchCandidate = {
  advocate: User;
  activeCases: number;
};

export type MatchResult = {
  advocateId: string;
  advocateName: string;
  matchedCounties: string[];
  score: number;
  reason: string;
};

function isAvailable(advocate: User, now: number): boolean {
  if (advocate.advocateSuspended) return false;
  if (!advocate.advocateOooUntil) return true;
  const until = new Date(advocate.advocateOooUntil).getTime();
  return Number.isNaN(until) || until <= now;
}

function hasCapacity(candidate: MatchCandidate): boolean {
  const max = candidate.advocate.advocateMaxCases;
  if (max === null) return true;
  return candidate.activeCases < max;
}

/**
 * Rank advocates for an estate. Advocates with no declared counties are never
 * auto-routed — coverage is opt-in so a new partner is not silently spammed.
 */
export function matchAdvocates(input: {
  counties: string[];
  candidates: MatchCandidate[];
  now?: number;
  limit?: number;
}): MatchResult[] {
  const now = input.now ?? Date.now();
  const limit = input.limit ?? MAX_MATCH_OFFERS;
  const wanted = input.counties.map(normalizeCounty).filter(Boolean);
  if (wanted.length === 0) return [];

  const results: MatchResult[] = [];

  for (const candidate of input.candidates) {
    const { advocate } = candidate;
    if (!isAvailable(advocate, now)) continue;

    const covered = advocate.advocateCounties.filter((county) =>
      wanted.includes(normalizeCounty(county)),
    );
    if (covered.length === 0) continue;

    const coverage = covered.length / wanted.length;
    const capacity = hasCapacity(candidate);
    // Coverage dominates; a light caseload only breaks ties between advocates
    // who cover the same ground.
    const load = candidate.activeCases;
    const score =
      Math.round(coverage * 100) + (capacity ? 20 : 0) - Math.min(load, 10);

    const reasons = [
      `Covers ${covered.length}/${wanted.length} estate ${wanted.length === 1 ? "county" : "counties"} (${covered.join(", ")})`,
      capacity ? `${load} active case${load === 1 ? "" : "s"}` : "at capacity",
    ];

    results.push({
      advocateId: advocate.id,
      advocateName: advocate.fullName,
      matchedCounties: covered,
      score,
      reason: reasons.join(" · "),
    });
  }

  return results
    .sort((a, b) => b.score - a.score || a.advocateName.localeCompare(b.advocateName))
    .slice(0, limit);
}
