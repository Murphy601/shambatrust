"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLocale } from "@/components/locale-provider";
import { mergeIntakeDraft, parseOcrText } from "@/lib/intake/extract";
import { ocrImageText } from "@/lib/intake/ocr-client";
import { emptyIntakeDraft, type IntakeChatMessage, type IntakeDraft, type IntakeStep } from "@/lib/intake/types";
import { vaultCopy } from "@/lib/vault-copy";

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
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = locale === "sw" ? "sw-KE" : "en-KE";
  utter.rate = 0.92;
  window.speechSynthesis.speak(utter);
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
  const [hearAmani, setHearAmani] = useState(false);
  const [locked, setLocked] = useState(false);
  const [asAgent, setAsAgent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [ocrStatus, setOcrStatus] = useState<string | null>(null);
  const [readyToSubmit, setReadyToSubmit] = useState(false);
  const [micSupported] = useState(() => Boolean(speechCtor()));
  const recRef = useRef<InstanceType<SpeechCtor> | null>(null);
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
        speakIfNeeded(greeting);
      }
    })();
    return () => {
      wantListenRef.current = false;
      recRef.current?.abort();
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
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

  function stopListening() {
    wantListenRef.current = false;
    try {
      recRef.current?.stop();
    } catch {
      /* already stopped */
    }
    recRef.current = null;
    setListening(false);
  }

  function startListening() {
    const Ctor = speechCtor();
    if (!Ctor) {
      setError(
        sw
          ? "Kuzungumza hakupatikani kwenye kivinjari hiki. Andika jibu chako."
          : "Voice is not available in this browser. Type your answer instead.",
      );
      return;
    }
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    setError(null);
    transcriptRef.current = "";
    wantListenRef.current = true;
    setListening(true);

    const begin = () => {
      if (!wantListenRef.current) return;
      const rec = new Ctor();
      rec.lang = locale === "sw" ? "sw-KE" : "en-KE";
      rec.continuous = true;
      rec.interimResults = true;
      rec.onresult = (ev) => {
        let text = "";
        for (let i = 0; i < ev.results.length; i += 1) {
          text += ev.results[i]?.[0]?.transcript || "";
        }
        transcriptRef.current = text.trim();
        setInput(transcriptRef.current);
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
        } else {
          setListening(false);
        }
      };
      recRef.current = rec;
      rec.start();
    };
    begin();
  }

  function toggleMic() {
    if (listening || wantListenRef.current) {
      const spoken = (transcriptRef.current || input).trim();
      stopListening();
      if (spoken) void sendTurn(spoken);
      return;
    }
    startListening();
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
              stopListening();
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
                    ? "Endelea kuzungumza… bonyeza Nimeimaliza ukimaliza"
                    : "Keep speaking… tap I’m done when you finish"
                  : sw
                    ? "Andika hapa, au bonyeza mikrofoni"
                    : "Type here, or tap the microphone"
              }
              disabled={busy || locked}
            />
            <p className="text-base text-muted">
              {listening
                ? sw
                  ? "Amani anasubiri. Ongea mpaka umalize, kisha bonyeza Nimeimaliza. Hatutakatiza katikati."
                  : "Amani is waiting. Speak until you finish, then tap I’m done. We will not cut you off mid-sentence."
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
                onChange={(event) => setHearAmani(event.target.checked)}
              />
              {sw
                ? "Soma jibu la Amani kwa sauti (zimia kama inakatiza unapoongea)"
                : "Read Amani’s replies aloud (turn off if it talks over you)"}
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
