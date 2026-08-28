const FEMALE_VOICE =
  /female|woman|samantha|karen|moira|tessa|veena|fiona|zira|hazel|susan|salli|ivy|joanna|olivia|emma|serena|victoria|kate|nicky|martha|linda|heera|tanya|aria|jenny|nora|google uk english female|google us english female|microsoft zira|microsoft hazel|microsoft susan/i;

const MALE_VOICE =
  /male|\bman\b|david|daniel|mark|george|fred|james|thomas|\balex\b|google uk english male|google us english male|microsoft david|microsoft mark|microsoft george/i;

function langRank(locale: "en" | "sw", lang: string): number {
  const value = lang.toLowerCase();
  const prefer =
    locale === "sw"
      ? ["sw-ke", "sw", "en-ke", "en-za", "en-gb", "en-us", "en"]
      : ["en-ke", "en-za", "en-gb", "en-in", "en-us", "en"];
  const index = prefer.findIndex(
    (code) => value === code || value.startsWith(code),
  );
  return index === -1 ? 40 : index;
}

function genderRank(voice: SpeechSynthesisVoice): number {
  const haystack = `${voice.name} ${voice.voiceURI}`;
  if (FEMALE_VOICE.test(haystack)) return 0;
  if (MALE_VOICE.test(haystack)) return 2;
  return 1;
}

export function pickAmaniVoice(
  locale: "en" | "sw",
): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const scored = voices.map((voice) => ({
    voice,
    score: genderRank(voice) * 100 + langRank(locale, voice.lang),
  }));
  scored.sort((a, b) => a.score - b.score);
  return scored[0]?.voice || null;
}

export function speakAmani(text: string, locale: "en" | "sw") {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();

  const play = () => {
    const utter = new SpeechSynthesisUtterance(text);
    const voice = pickAmaniVoice(locale);
    if (voice) {
      utter.voice = voice;
      utter.lang = voice.lang || (locale === "sw" ? "sw-KE" : "en-KE");
      utter.pitch = genderRank(voice) === 0 ? 1 : 1.12;
    } else {
      utter.lang = locale === "sw" ? "sw-KE" : "en-KE";
      utter.pitch = 1.15;
    }
    utter.rate = 0.88;
    window.speechSynthesis.speak(utter);
  };

  if (window.speechSynthesis.getVoices().length > 0) {
    play();
    return;
  }
  const onVoices = () => {
    window.speechSynthesis.removeEventListener("voiceschanged", onVoices);
    play();
  };
  window.speechSynthesis.addEventListener("voiceschanged", onVoices);
  window.setTimeout(() => {
    window.speechSynthesis.removeEventListener("voiceschanged", onVoices);
    play();
  }, 600);
}
