/** Shared rules for voice testament uploads. */

export const MAX_TESTAMENT_BYTES = 20 * 1024 * 1024;

/**
 * Formats a phone or laptop browser can realistically produce. `audio/3gpp`
 * matters here: it is what many low-end Android recorders still emit.
 */
const AUDIO_EXTENSIONS: Record<string, string> = {
  "audio/webm": ".webm",
  "audio/ogg": ".ogg",
  "audio/mpeg": ".mp3",
  "audio/mp3": ".mp3",
  "audio/mp4": ".m4a",
  "audio/x-m4a": ".m4a",
  "audio/aac": ".aac",
  "audio/wav": ".wav",
  "audio/x-wav": ".wav",
  "audio/3gpp": ".3gp",
  "audio/amr": ".amr",
};

/** Codec parameters ride along on MediaRecorder types: "audio/webm;codecs=opus". */
export function baseMimeType(mimeType: string): string {
  return mimeType.split(";")[0].trim().toLowerCase();
}

export function isSupportedAudioType(mimeType: string): boolean {
  return baseMimeType(mimeType) in AUDIO_EXTENSIONS;
}

export function audioExtension(mimeType: string): string {
  return AUDIO_EXTENSIONS[baseMimeType(mimeType)] || ".webm";
}

export function preferredRecorderMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const types = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  return types.find((type) => MediaRecorder.isTypeSupported(type));
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return "—";
  const whole = Math.round(seconds);
  const minutes = Math.floor(whole / 60);
  return `${minutes}:${String(whole % 60).padStart(2, "0")}`;
}
