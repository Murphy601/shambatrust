/**
 * Spoken-language preferences for audio-guided forms and voice testaments.
 *
 * This is deliberately separate from the UI `Locale` ("en" | "sw"): the site
 * chrome is only translated into English and Kiswahili, but an elder may
 * dictate a testament in a mother tongue that ops/advocates transcribe later.
 */
export const SPOKEN_LANGUAGES = [
  { code: "en", label: "English", native: "English" },
  { code: "sw", label: "Kiswahili", native: "Kiswahili" },
  { code: "ki", label: "Kikuyu", native: "Gĩkũyũ" },
  { code: "luo", label: "Dholuo", native: "Dholuo" },
  { code: "kln", label: "Kalenjin", native: "Kalenjin" },
  { code: "kam", label: "Kamba", native: "Kĩkamba" },
  { code: "luy", label: "Luhya", native: "Luluhya" },
  { code: "guz", label: "Kisii", native: "Ekegusii" },
  { code: "mas", label: "Maasai", native: "Maa" },
  { code: "som", label: "Somali", native: "Af-Soomaali" },
  { code: "mer", label: "Meru", native: "Kĩmĩrũ" },
  { code: "other", label: "Other", native: "Other" },
] as const;

export type SpokenLanguage = (typeof SPOKEN_LANGUAGES)[number]["code"];

export const SPOKEN_LANGUAGE_CODES = SPOKEN_LANGUAGES.map(
  (language) => language.code,
) as SpokenLanguage[];

export const DEFAULT_SPOKEN_LANGUAGE: SpokenLanguage = "en";

export function isSpokenLanguage(value: unknown): value is SpokenLanguage {
  return (
    typeof value === "string" &&
    SPOKEN_LANGUAGE_CODES.includes(value as SpokenLanguage)
  );
}

export function normalizeSpokenLanguage(value: unknown): SpokenLanguage {
  return isSpokenLanguage(value) ? value : DEFAULT_SPOKEN_LANGUAGE;
}

export function spokenLanguageLabel(code: SpokenLanguage): string {
  const match = SPOKEN_LANGUAGES.find((language) => language.code === code);
  if (!match) return DEFAULT_SPOKEN_LANGUAGE;
  return match.label === match.native
    ? match.label
    : `${match.label} (${match.native})`;
}
