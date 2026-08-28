"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useLocale } from "@/components/locale-provider";
import { audioExtension, preferredRecorderMimeType } from "@/lib/audio";
import { speakAmani, stopAmaniVoice } from "@/lib/intake/amani-voice";
import { mergeIntakeDraft, parseOcrText } from "@/lib/intake/extract";
import { ocrImageText } from "@/lib/intake/ocr-client";
import { emptyIntakeDraft, type IntakeChatMessage, type IntakeDraft, type IntakeStep } from "@/lib/intake/types";
import { vaultCopy } from "@/lib/vault-copy";

const HEAR_AMANI_KEY = "shambatrust-hear-amani";

function subscribeHearAmani(onStoreChange: () => void) {
  const onChange = () => onStoreChange();
  window.addEventListener("storage", onChange);
  window.addEventListener("amani-hear", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("amani-hear", onChange);
  };
}

function hearAmaniSnapshot(): boolean {
  try {
    return window.localStorage.getItem(HEAR_AMANI_KEY) !== "0";
  } catch {
    return true;
  }
}

function setHearAmaniPreference(on: boolean) {
  try {
    window.localStorage.setItem(HEAR_AMANI_KEY, on ? "1" : "0");
  } catch {
    /* private mode */
  }
  window.dispatchEvent(new Event("amani-hear"));
}

const STEP_META: Record<IntakeStep, { en: string; sw: string }> = {
  1: { en: "Your details", sw: "Taarifa zako" },
  2: { en: "Family & heirs", sw: "Familia na warithi" },
  3: { en: "Land & assets", sw: "Ardhi na mali" },
  4: { en: "Money & business", sw: "Pesa na biashara" },
  5: { en: "Review & submit", sw: "Kagua na wasilisha" },
};

type SpeechCtor = new () => {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((ev: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

function speechCtor(): SpeechCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechCtor;
    webkitSpeechRecognition?: SpeechCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

function speakText(text: string, locale: "en" | "sw") {
  void speakAmani(text, locale);
}

function previewRows(draft: IntakeDraft, sw: boolean): Array<{ label: string; value: string }> {
  return [
    { label: sw ? "Jina" : "Full name", value: draft.fullName },
    { label: sw ? "Kitambulisho" : "National ID", value: draft.nationalId },
    { label: "KRA PIN", value: draft.kraPin },
    { label: sw ? "Mke / mume" : "Spouse", value: draft.spouseName },
    { label: sw ? "Warithi" : "Heirs", value: draft.heirs.join(", ") },
    { label: sw ? "Msimamizi" : "Trusted person", value: draft.trusteeName },
    { label: sw ? "Mahali pa shamba" : "Shamba location", value: draft.shambaLocation },
    { label: sw ? "Namba ya LR" : "LR / title", value: draft.lrNumber },
    { label: sw ? "Ukubwa" : "Plot size", value: draft.plotSize },
    { label: "SACCO", value: draft.saccoName },
    { label: sw ? "Benki" : "Bank", value: draft.bankName },
    { label: sw ? "Mteule wa M-Pesa" : "M-Pesa nominee", value: draft.mpesaNominee },
  ].filter((row) => row.value.trim().length > 0);
}

export function AIElderAssistant() {
  const { locale } = useLocale();
  const t = vaultCopy(locale);
  const sw = locale === "sw";
  const [draft, setDraft] = useState<IntakeDraft>(emptyIntakeDraft);
  const [messages, setMessages] = useState<IntakeChatMessage[]>([]);
  const [step, setStep] = useState<IntakeStep>(1);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const hearAmani = useSyncExternalStore(
    subscribeHearAmani,
    hearAmaniSnapshot,
    () => true,
  );
  const [locked, setLocked] = useState(false);
  const [asAgent, setAsAgent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [ocrStatus, setOcrStatus] = useState<string | null>(null);
  const [readyToSubmit, setReadyToSubmit] = useState(false);
  const [micSupported] = useState(
    () =>
      typeof MediaRecorder !== "undefined" &&
      Boolean(navigator.mediaDevices?.getUserMedia),
  );
  const recRef = useRef<InstanceType<SpeechCtor> | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const draftRef = useRef(draft);
  const messagesRef = useRef(messages);
  const wantListenRef = useRef(false);
  const transcriptRef = useRef("");

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const speakIfNeeded = useCallback(
    (text: string) => {
      if (hearAmani && !wantListenRef.current) speakText(text, locale);
    },
    [hearAmani, locale],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.speechSynthesis?.getVoices();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/vault/intake/chat?locale=${locale}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Could not open Amani.");
        return;
      }
      setDraft(json.draft || emptyIntakeDraft());
      setStep(json.step || 1);
      setLocked(Boolean(json.locked));
      setAsAgent(Boolean(json.asAgent));
      setReadyToSubmit(Boolean(json.readyToSubmit));
      const greeting = String(json.greeting || "");
      if (greeting) {
        setMessages([{ role: "assistant", content: greeting }]);
        let shouldSpeak = true;
        try {
          shouldSpeak = window.localStorage.getItem(HEAR_AMANI_KEY) !== "0";
        } catch {
          shouldSpeak = true;
        }
        if (shouldSpeak) speakText(greeting, locale);
      }
    })();
    return () => {
      wantListenRef.current = false;
      recRef.current?.abort();
      try {
        recorderRef.current?.stop();
      } catch {
        /* already stopped */
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      stopAmaniVoice();
    };
    // Opening greeting should speak once on first load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sendTurn(text: string, ocrText?: string) {
    const trimmed = text.trim();
    if (!trimmed && !ocrText) return;
    if (locked) {
      setError(
        sw
          ? "Hifadhi iko katika ukaguzi. Amani hawezi kuhifadhi mabadiliko sasa."
          : "This vault is in review. Amani cannot save changes right now.",
      );
      return;
    }
    const nextMessages: IntakeChatMessage[] = trimmed
      ? [...messagesRef.current, { role: "user", content: trimmed }]
      : messagesRef.current;
    setMessages(nextMessages);
    messagesRef.current = nextMessages;
    setInput("");
    transcriptRef.current = "";
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/vault/intake/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages,
          draft: draftRef.current,
          locale,
          ocrText,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Amani could not reply.");
        return;
      }
      if (json.draft) {
        setDraft(json.draft);
        draftRef.current = json.draft;
      }
      if (json.step) setStep(json.step);
      setReadyToSubmit(Boolean(json.readyToSubmit) || json.step === 5);
      const reply = String(json.reply || "");
      if (reply) {
        const withReply: IntakeChatMessage[] = [
          ...nextMessages,
          { role: "assistant", content: reply },
        ];
        setMessages(withReply);
        messagesRef.current = withReply;
        speakIfNeeded(reply);
      }
    } catch {
      setError(sw ? "Mtandao umekatika. Jaribu tena." : "Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function stopBrowserSpeech() {
    wantListenRef.current = false;
    try {
      recRef.current?.stop();
    } catch {
      /* already stopped */
    }
    recRef.current = null;
  }

  function stopTracks() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  function startBrowserSpeech() {
    const Ctor = speechCtor();
    if (!Ctor) return;
    const begin = () => {
      if (!wantListenRef.current) return;
      const rec = new Ctor();
      rec.lang = locale === "sw" ? "sw-KE" : "en-KE";
      rec.continuous = true;
      rec.interimResults = false;
      rec.onresult = (ev) => {
        let text = "";
        for (let i = 0; i < ev.results.length; i += 1) {
          if (ev.results[i]?.isFinal) text += ev.results[i]?.[0]?.transcript || "";
        }
        if (text.trim()) transcriptRef.current = text.trim();
      };
      rec.onerror = (ev) => {
        if (ev.error === "not-allowed") {
          wantListenRef.current = false;
          setListening(false);
          setError(
            sw
              ? "Ruhusu maikrofoni kwenye kivinjari, kisha jaribu tena."
              : "Allow the microphone in your browser, then try again.",
          );
        }
      };
      rec.onend = () => {
        if (wantListenRef.current) {
          try {
            begin();
          } catch {
            window.setTimeout(begin, 250);
          }
        }
      };
      recRef.current = rec;
      rec.start();
    };
    begin();
  }

  async function startListening() {
    stopAmaniVoice();
    setError(null);
    transcriptRef.current = "";
    chunksRef.current = [];
    wantListenRef.current = true;
    setListening(true);
    setInput("");

    if (navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined") {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        if (!wantListenRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const mimeType = preferredRecorderMimeType();
        const recorder = new MediaRecorder(
          stream,
          mimeType ? { mimeType } : undefined,
        );
        recorder.addEventListener("dataavailable", (event) => {
          if (event.data.size > 0) chunksRef.current.push(event.data);
        });
        try {
          recorder.start(400);
        } catch {
          recorder.start();
        }
        recorderRef.current = recorder;
        return;
      } catch {
        stopTracks();
        setListening(false);
        wantListenRef.current = false;
        setError(
          sw
            ? "Ruhusu maikrofoni kwenye kivinjari, kisha jaribu tena."
            : "Allow the microphone in your browser, then try again.",
        );
        return;
      }
    }

    startBrowserSpeech();
  }

  function waitForRecording(): Promise<Blob | null> {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      recorder.addEventListener(
        "stop",
        () => {
          const type = recorder.mimeType || preferredRecorderMimeType() || "audio/webm";
          const blob = new Blob(chunksRef.current, { type });
          chunksRef.current = [];
          resolve(blob.size > 0 ? blob : null);
        },
        { once: true },
      );
      try {
        if (recorder.state === "recording") {
          try {
            recorder.requestData();
          } catch {
            /* Safari may not implement requestData */
          }
        }
        recorder.stop();
      } catch {
        resolve(null);
      }
    });
  }

  async function transcribeRecording(blob: Blob): Promise<string> {
    const form = new FormData();
    form.set("file", blob, `answer${audioExtension(blob.type || "audio/webm")}`);
    form.set("locale", locale);
    const res = await fetch("/api/vault/intake/transcribe", {
      method: "POST",
      body: form,
    });
    if (!res.ok) return "";
    const json = (await res.json()) as { text?: string };
    return typeof json.text === "string" ? json.text.trim() : "";
  }

  async function finishSpokenAnswer() {
    const preview = (transcriptRef.current || input).trim();
    wantListenRef.current = false;
    stopBrowserSpeech();
    setListening(false);
    setBusy(true);
    setOcrStatus(
      sw ? "Inaandika maneno yako kwa usahihi…" : "Writing your words carefully…",
    );
    try {
      const blob = await waitForRecording();
      stopTracks();
      recorderRef.current = null;
      const hadRecording = Boolean(blob);
      let spoken = "";
      if (blob) {
        spoken = await transcribeRecording(blob);
      } else {
        spoken = preview;
      }
      setInput(spoken);
      setOcrStatus(null);
      if (spoken) await sendTurn(spoken);
      else {
        setError(
          hadRecording
            ? sw
              ? "Sikukusikia vizuri. Jaribu tena, polepole, au andika jibu."
              : "I did not catch that clearly. Please try again slowly, or type the answer."
            : sw
              ? "Sikukusikia vizuri. Jaribu tena, polepole kidogo."
              : "I did not catch that. Please try again, a little slower.",
        );
      }
    } catch {
      setOcrStatus(null);
      if (!preview) {
        setError(sw ? "Sikukusikia vizuri. Jaribu tena." : "I did not catch that. Please try again.");
      } else if (!recorderRef.current) {
        await sendTurn(preview);
      } else {
        setError(
          sw
            ? "Sikukusikia vizuri. Andika jibu ili kuepuka maneno ya kubahatisha."
            : "I did not catch that clearly. Please type the answer so we do not guess.",
        );
      }
    } finally {
      setBusy(false);
      setOcrStatus(null);
    }
  }

  async function toggleMic() {
    if (listening || wantListenRef.current) {
      await finishSpokenAnswer();
      return;
    }
    await startListening();
  }

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      setError(sw ? "Picha ni kubwa mno (8MB)." : "Photo is too large (max 8MB).");
      return;
    }
    setOcrStatus(sw ? "Inasoma picha…" : "Reading the photo…");
    setError(null);
    try {
      const [ocrText, uploaded] = await Promise.all([
        ocrImageText(file),
        (async () => {
          const form = new FormData();
          form.set("file", file);
          const res = await fetch("/api/vault/upload", { method: "POST", body: form });
          if (!res.ok) return null;
          return (await res.json()) as { documentName?: string; documentPath?: string };
        })(),
      ]);
      const fromOcr = parseOcrText(ocrText);
      setDraft((current) =>
        mergeIntakeDraft(current, {
          ...fromOcr,
          documentName: uploaded?.documentName || file.name,
          documentPath: uploaded?.documentPath || "",
        }),
      );
      setOcrStatus(
        ocrText
          ? sw
            ? "Picha imesomwa. Amani atajaza namba zilizoonekana."
            : "Photo read. Amani will fill any numbers found."
          : sw
            ? "Picha imehifadhiwa. Andika namba ya LR au kitambulisho ukiona."
            : "Photo saved. Type the LR or ID number if you can see it.",
      );
      await sendTurn(
        sw
          ? "Nimepakia picha ya kitambulisho au hati miliki."
          : "I uploaded a photo of my ID or title deed.",
        ocrText,
      );
    } catch {
      setError(
        sw
          ? "Imeshindikana kusoma picha. Jaribu picha wazi zaidi."
          : "Could not read that photo. Try a clearer picture.",
      );
    } finally {
      setOcrStatus(null);
    }
  }

  async function confirmSubmit() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/vault/intake/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Could not save the vault.");
        return;
      }
      setMessage(
        json.warning ||
          (sw
            ? "Taarifa zimehifadhiwa kwenye hifadhi yako. Unaweza kuziweka sawa kwenye Mali na Warithi."
            : "Saved into your vault. You can tidy details on Assets and Heirs."),
      );
    } catch {
      setError(sw ? "Imeshindikana kuhifadhi." : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  const percent = readyToSubmit || step === 5 ? 100 : Math.round(((step - 1) / 5) * 100);
  const rows = previewRows(draft, sw);
  const stepLabel = STEP_META[step][sw ? "sw" : "en"];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-forest-deep">{t.intake}</h1>
        <p className="mt-2 text-lg text-muted">
          {sw
            ? "Amani anauliza swali moja kwa wakati. Unaweza kuzungumza, kuandika, au kupiga picha ya hati."
            : "Amani asks one question at a time. Speak, type, or photograph a document."}
        </p>
      </div>

      <div className="rounded-[0.45rem] border-2 border-border bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-base font-semibold text-forest-deep">
            {sw ? "Hatua" : "Step"} {step} {sw ? "kati ya" : "of"} 5: {stepLabel}
          </p>
          <p className="text-base text-muted">{percent}%</p>
        </div>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-bg-deep">
          <div
            className="h-full rounded-full bg-forest"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {locked && (
        <p className="rounded-[0.45rem] border-2 border-brass bg-brass-soft/30 p-4 text-lg">
          {sw
            ? "Hifadhi iko katika ukaguzi. Unaweza kuona, lakini Amani hawezi kuhifadhi mabadiliko."
            : "This vault is in review. You can look, but Amani cannot save changes."}
        </p>
      )}
      {asAgent && (
        <p className="text-base text-muted">
          {sw
            ? "Hali ya wakala: warithi watahitaji idhini ya mzee kabla ya kuhifadhiwa."
            : "Family helper mode: heirs still need the elder’s approval before they are saved."}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.8fr)]">
        <section className="rounded-[0.45rem] border-2 border-border bg-surface p-4 sm:p-6">
          <div className="mb-4 flex items-center gap-3">
            <div
              aria-hidden
              className="flex h-14 w-14 items-center justify-center rounded-full bg-forest text-2xl text-white"
            >
              A
            </div>
            <div>
              <p className="text-xl font-semibold text-forest-deep">Amani</p>
              <p className="text-base text-muted">
                {sw ? "Mwongozi wa hifadhi" : "Vault intake guide"}
              </p>
            </div>
          </div>

          <div className="max-h-[28rem] space-y-3 overflow-y-auto pr-1">
            {messages.map((item, index) => (
              <div
                key={`${item.role}-${index}`}
                className={`max-w-[95%] rounded-[0.45rem] px-4 py-3 text-lg ${
                  item.role === "assistant"
                    ? "bg-bg-deep text-forest-deep"
                    : "ml-auto bg-forest text-white"
                }`}
              >
                  {item.content}
              </div>
            ))}
            {busy && (
              <p className="text-base text-muted">
                {sw ? "Amani anasikiliza…" : "Amani is listening…"}
              </p>
            )}
            <div ref={bottomRef} />
          </div>

          <form
            className="mt-4 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (listening || wantListenRef.current || recorderRef.current) {
                void finishSpokenAnswer();
                return;
              }
              void sendTurn(input);
            }}
          >
            <label className="field-label" htmlFor="amani-answer">
              {sw ? "Jibu lako" : "Your answer"}
            </label>
            <textarea
              id="amani-answer"
              className="min-h-24 w-full rounded-[0.35rem] border-2 border-border p-3 text-lg"
              value={input}
              onChange={(event) => {
                setInput(event.target.value);
                transcriptRef.current = event.target.value;
              }}
              placeholder={
                listening
                  ? sw
                    ? "Inasikiliza… maneno yataandikwa ukimaliza, siyo wakati unazungumza."
                    : "Listening… words are written after you finish, not while you speak."
                  : sw
                    ? "Andika hapa, au bonyeza mikrofoni"
                    : "Type here, or tap the microphone"
              }
              disabled={busy || locked}
            />
            <p className="text-base text-muted">
              {listening
                ? sw
                  ? "Amani anasubiri kimya. Ongea mpaka umalize, kisha Nimeimaliza. Hatutakisia maneno katikati."
                  : "Amani is waiting quietly. Speak until you finish, then I’m done. We will not guess words while you talk."
                : sw
                  ? "Bonyeza Sema jibu, ongea taratibu, kisha Nimeimaliza. Amani anajibu baada tu ya hapo."
                  : "Tap Speak Answer, talk at your own pace, then I’m done. Amani replies only after that."}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={toggleMic}
                disabled={busy || locked || !micSupported}
                className={`min-h-12 rounded-[0.35rem] px-5 text-lg font-semibold ${
                  listening
                    ? "bg-[#b22222] text-white"
                    : "bg-[#0B1D3A] text-white"
                }`}
              >
                {listening
                  ? sw
                    ? "⏹ Nimeimaliza"
                    : "⏹ I’m done"
                  : sw
                    ? "🎤 Sema jibu"
                    : "🎤 Speak Answer"}
              </button>
              <button
                type="submit"
                disabled={busy || locked || !input.trim()}
                className="btn btn-primary min-h-12 px-5 text-lg"
              >
                {sw ? "Tuma" : "Send"}
              </button>
              <label className="min-h-12 cursor-pointer rounded-[0.35rem] border-2 border-border px-4 py-2 text-lg font-semibold">
                {sw ? "Pakia picha ya hati / kitambulisho" : "Upload photo of title deed / ID"}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  disabled={busy || locked}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    void onPhoto(file);
                  }}
                />
              </label>
            </div>
            <label className="flex items-center gap-2 text-base">
              <input
                type="checkbox"
                checked={hearAmani}
                onChange={(event) => setHearAmaniPreference(event.target.checked)}
              />
              {sw
                ? "Soma jibu la Amani kwa sauti (zimia kama inakatiza unapoongea)"
                : "Read Amani’s replies aloud (turn off if she talks over you)"}
            </label>
          </form>
          {ocrStatus && <p className="mt-3 text-base text-forest">{ocrStatus}</p>}
          {error && <p className="mt-3 text-base text-[#b22222]">{error}</p>}
          {message && <p className="mt-3 text-base text-forest">{message}</p>}
        </section>

        <aside className="rounded-[0.45rem] border-2 border-border bg-surface p-4 sm:p-6">
          <h2 className="text-xl font-semibold text-forest-deep">
            {sw ? "Kadi ya hifadhi" : "Live vault preview"}
          </h2>
          <p className="mt-1 text-base text-muted">
            {sw
              ? "Inajazwa wakati unajibu. Bado unaweza kuhariri kwenye fomu za kawaida."
              : "Filled as you answer. You can still edit the usual forms."}
          </p>
          <ul className="mt-4 space-y-2">
            {rows.length === 0 ? (
              <li className="text-base text-muted">
                {sw ? "Bado hakuna taarifa." : "Nothing filled yet."}
              </li>
            ) : (
              rows.map((row) => (
                <li key={row.label}>
                  <p className="text-sm font-semibold uppercase tracking-wide text-muted">
                    {row.label}
                  </p>
                  <p className="text-lg text-forest-deep">{row.value}</p>
                </li>
              ))
            )}
          </ul>
          <button
            type="button"
            onClick={() => void confirmSubmit()}
            disabled={busy || locked || !draft.fullName.trim() || !draft.nationalId.trim()}
            className="mt-6 min-h-14 w-full rounded-[0.35rem] bg-[#1E5631] px-4 text-lg font-semibold text-white disabled:opacity-50"
          >
            {sw ? "Thibitisha na hifadhi" : "Confirm & Submit Vault"}
          </button>
          <p className="mt-3 text-base text-muted">
            {sw ? "Baadaye unaweza kufungua" : "Afterwards you can open"}{" "}
            <Link href="/vault/assets" className="font-semibold text-forest underline">
              {t.assets}
            </Link>{" "}
            {sw ? "au" : "or"}{" "}
            <Link href="/vault/heirs" className="font-semibold text-forest underline">
              {t.heirs}
            </Link>
            .
          </p>
        </aside>
      </div>
    </div>
  );
}
