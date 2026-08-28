const HALLUCINATION_RE =
  /thanks for watching|thank you for watching|please subscribe|please like|transcribed by|lyrics|\[music\]|you're watching|you are watching|as an ai|i hope this helps|the following is a transcription|captioned by|www\.|https?:\/\//i;

type WhisperSegment = {
  text?: string;
  avg_logprob?: number;
  no_speech_prob?: number;
  compression_ratio?: number;
};

export function isHallucinatedTranscript(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (HALLUCINATION_RE.test(trimmed)) return true;
  const words = trimmed.split(/\s+/);
  if (words.length > 40 && /[,:;]/.test(trimmed) === false && words.length / new Set(words.map((w) => w.toLowerCase())).size > 4) {
    return true;
  }
  return false;
}

export function cleanWhisperResult(json: {
  text?: string;
  segments?: WhisperSegment[];
}): string | null {
  const segments = Array.isArray(json.segments) ? json.segments : [];
  const kept = segments
    .filter((segment) => {
      const text = typeof segment.text === "string" ? segment.text.trim() : "";
      if (!text) return false;
      if (typeof segment.no_speech_prob === "number" && segment.no_speech_prob > 0.55) {
        return false;
      }
      if (typeof segment.avg_logprob === "number" && segment.avg_logprob < -0.85) {
        return false;
      }
      if (
        typeof segment.compression_ratio === "number" &&
        segment.compression_ratio > 2.4
      ) {
        return false;
      }
      return !isHallucinatedTranscript(text);
    })
    .map((segment) => String(segment.text).trim());

  const fromSegments = kept.join(" ").replace(/\s+/g, " ").trim();
  if (fromSegments && !isHallucinatedTranscript(fromSegments)) return fromSegments;

  const fallback = typeof json.text === "string" ? json.text.trim() : "";
  if (!fallback || isHallucinatedTranscript(fallback)) return null;
  return fallback;
}

export function splitSpeakChunks(text: string, maxChars = 180): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  if (clean.length <= maxChars) return [clean];
  const parts: string[] = [];
  let rest = clean;
  while (rest.length > maxChars) {
    const window = rest.slice(0, maxChars);
    const breakAt = Math.max(
      window.lastIndexOf(". "),
      window.lastIndexOf("? "),
      window.lastIndexOf("! "),
      window.lastIndexOf(", "),
      window.lastIndexOf(" "),
    );
    const take = breakAt > 40 ? breakAt + 1 : maxChars;
    parts.push(rest.slice(0, take).trim());
    rest = rest.slice(take).trim();
  }
  if (rest) parts.push(rest);
  return parts.filter(Boolean);
}
