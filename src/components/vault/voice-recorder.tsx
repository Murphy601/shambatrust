"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { formatDuration } from "@/lib/audio";

export type Recording = {
  blob: Blob;
  mimeType: string;
  durationSeconds: number;
  /** Object URL for local preview; revoked when the recording is replaced. */
  previewUrl: string;
};

/** Formats we try in order; the first the browser supports wins. */
const PREFERRED_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/mp4",
];

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return PREFERRED_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
}

/**
 * Microphone capture support, read as an external store so the server render
 * stays neutral (`null`) and the client swaps in the real answer without a
 * hydration mismatch. The capability never changes, so nothing to subscribe to.
 */
const noopSubscribe = () => () => {};

function readRecorderSupport(): boolean {
  return (
    typeof MediaRecorder !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  );
}

function serverRecorderSupport(): boolean | null {
  return null;
}

export function VoiceRecorder({
  onRecorded,
  labels,
  disabled,
}: {
  onRecorded: (recording: Recording | null) => void;
  labels: {
    record: string;
    stop: string;
    discard: string;
    unsupported: string;
  };
  disabled?: boolean;
}) {
  const supported = useSyncExternalStore<boolean | null>(
    noopSubscribe,
    readRecorderSupport,
    serverRecorderSupport,
  );
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef(0);
  const previewUrlRef = useRef<string | null>(null);

  const releasePreview = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  }, []);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  // Release the microphone and any object URL if the page unmounts mid-take.
  useEffect(
    () => () => {
      stopTracks();
      releasePreview();
    },
    [releasePreview, stopTracks],
  );

  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => {
      setElapsed(Math.round((Date.now() - startedAtRef.current) / 1000));
    }, 500);
    return () => window.clearInterval(timer);
  }, [recording]);

  async function start() {
    setError(null);
    releasePreview();
    setPreviewUrl(null);
    onRecorded(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );
      chunksRef.current = [];

      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      });

      recorder.addEventListener("stop", () => {
        const type = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        chunksRef.current = [];
        stopTracks();

        const durationSeconds = Math.max(
          1,
          Math.round((Date.now() - startedAtRef.current) / 1000),
        );
        const url = URL.createObjectURL(blob);
        previewUrlRef.current = url;
        setPreviewUrl(url);
        setRecording(false);
        onRecorded({ blob, mimeType: type, durationSeconds, previewUrl: url });
      });

      startedAtRef.current = Date.now();
      setElapsed(0);
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch {
      stopTracks();
      setRecording(false);
      setError(
        "Microphone permission was refused, or no microphone is available.",
      );
    }
  }

  function stop() {
    recorderRef.current?.stop();
    recorderRef.current = null;
  }

  function discard() {
    releasePreview();
    setPreviewUrl(null);
    setElapsed(0);
    onRecorded(null);
  }

  if (supported === false) {
    return (
      <p className="rounded-[0.35rem] border-2 border-brass bg-[color-mix(in_srgb,var(--brass)_10%,white)] px-4 py-3 text-base">
        {labels.unsupported}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {recording ? (
          <button type="button" className="btn btn-brass" onClick={stop}>
            <span aria-hidden="true">■</span> {labels.stop}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void start()}
            disabled={disabled || supported === null}
          >
            <span aria-hidden="true">●</span> {labels.record}
          </button>
        )}
        <p
          className="text-lg font-semibold tabular-nums text-forest-deep"
          aria-live="polite"
        >
          {recording ? `● ${formatDuration(elapsed)}` : formatDuration(elapsed)}
        </p>
        {previewUrl && !recording && (
          <button type="button" className="btn btn-secondary-dark" onClick={discard}>
            {labels.discard}
          </button>
        )}
      </div>

      {previewUrl && !recording && (
        <audio className="w-full" controls src={previewUrl} preload="metadata" />
      )}

      {error && (
        <p className="text-base font-medium text-[var(--danger)]">{error}</p>
      )}
    </div>
  );
}
