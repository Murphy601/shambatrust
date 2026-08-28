import { splitSpeakChunks } from "@/lib/intake/whisper-clean";

const FEMALE_VOICE =
  /female|woman|samantha|karen|moira|tessa|veena|fiona|zira|hazel|susan|salli|ivy|joanna|olivia|emma|serena|victoria|kate|nicky|martha|linda|google uk english female|google us english female|microsoft zira|microsoft hazel/i;

const MALE_VOICE =
  /male|\bman\b|david|daniel|mark|george|fred|james|thomas|\balex\b|google uk english male|microsoft david/i;

let playGeneration = 0;
let currentAudio: HTMLAudioElement | null = null;

export function stopAmaniVoice() {
  playGeneration += 1;
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.removeAttribute("src");
    currentAudio = null;
  }
  if (typeof window !== "undefined") window.speechSynthesis?.cancel();
}

function pickBrowserVoice(locale: "en" | "sw"): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  const preferLang = locale === "sw" ? ["sw-ke", "sw", "en-gb", "en-us"] : ["en-gb", "en-us", "en"];
  const scored = voices.map((voice) => {
    const hay = `${voice.name} ${voice.voiceURI}`;
    const gender = FEMALE_VOICE.test(hay) ? 0 : MALE_VOICE.test(hay) ? 2 : 1;
    const lang = voice.lang.toLowerCase();
    const langScore = preferLang.findIndex((code) => lang === code || lang.startsWith(code));
    return { voice, score: gender * 100 + (langScore === -1 ? 40 : langScore) };
  });
  scored.sort((a, b) => a.score - b.score);
  return scored[0]?.voice || null;
}

function speakBrowser(text: string, locale: "en" | "sw") {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  const voice = pickBrowserVoice(locale);
  if (voice) {
    utter.voice = voice;
    utter.lang = voice.lang;
  } else {
    utter.lang = locale === "sw" ? "sw-KE" : "en-GB";
  }
  utter.rate = 0.96;
  utter.pitch = 1;
  window.speechSynthesis.speak(utter);
}

function playWav(bytes: Blob, generation: number): Promise<void> {
  return new Promise((resolve) => {
    if (generation !== playGeneration) {
      resolve();
      return;
    }
    const url = URL.createObjectURL(bytes);
    const audio = new Audio(url);
    currentAudio = audio;
    const finish = () => {
      URL.revokeObjectURL(url);
      if (currentAudio === audio) currentAudio = null;
      resolve();
    };
    audio.addEventListener("ended", finish, { once: true });
    audio.addEventListener("error", finish, { once: true });
    void audio.play().catch(finish);
  });
}

export async function speakAmani(text: string, locale: "en" | "sw") {
  if (typeof window === "undefined") return;
  const spoken = text.replace(/\s+/g, " ").trim();
  if (!spoken) return;
  const generation = playGeneration + 1;
  stopAmaniVoice();
  playGeneration = generation;

  const chunks = splitSpeakChunks(spoken);
  try {
    for (const chunk of chunks) {
      if (generation !== playGeneration) return;
      const res = await fetch("/api/vault/intake/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: chunk }),
      });
      if (!res.ok) {
        speakBrowser(spoken, locale);
        return;
      }
      const blob = await res.blob();
      if (generation !== playGeneration) return;
      await playWav(blob, generation);
    }
  } catch {
    if (generation === playGeneration) speakBrowser(spoken, locale);
  }
}
