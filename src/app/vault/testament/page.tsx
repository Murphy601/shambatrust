"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useLocale } from "@/components/locale-provider";
import {
  VoiceRecorder,
  type Recording,
} from "@/components/vault/voice-recorder";
import { formatDuration, isSupportedAudioType } from "@/lib/audio";
import {
  DEFAULT_SPOKEN_LANGUAGE,
  SPOKEN_LANGUAGES,
  spokenLanguageLabel,
  type SpokenLanguage,
} from "@/lib/languages";
import { vaultCopy } from "@/lib/vault-copy";
import type { Asset, AudioTestament } from "@/lib/db/types";

export default function TestamentPage() {
  const { locale } = useLocale();
  const t = vaultCopy(locale);
  const sw = locale === "sw";

  const [testaments, setTestaments] = useState<AudioTestament[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [locked, setLocked] = useState(false);
  const [asAgent, setAsAgent] = useState(false);

  const [title, setTitle] = useState("");
  const [language, setLanguage] = useState<SpokenLanguage>(
    DEFAULT_SPOKEN_LANGUAGE,
  );
  const [assetId, setAssetId] = useState("");
  const [recording, setRecording] = useState<Recording | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const [audioGuidance, setAudioGuidance] = useState(false);
  const [prefsBusy, setPrefsBusy] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [testamentsRes, assetsRes, prefsRes] = await Promise.all([
      fetch("/api/vault/testaments"),
      fetch("/api/vault/assets"),
      fetch("/api/vault/preferences"),
    ]);

    const testamentsData = await testamentsRes.json();
    if (!testamentsRes.ok) {
      setError(testamentsData.error || "Could not load recordings.");
      return;
    }
    setTestaments(testamentsData.testaments || []);
    setLocked(Boolean(testamentsData.locked));
    setAsAgent(Boolean(testamentsData.asAgent));

    if (assetsRes.ok) {
      const assetsData = await assetsRes.json();
      setAssets(assetsData.assets || []);
    }
    if (prefsRes.ok) {
      const prefsData = await prefsRes.json();
      const preferred = prefsData.preferences?.preferredLanguage;
      if (preferred) setLanguage(preferred);
      setAudioGuidance(Boolean(prefsData.preferences?.audioGuidance));
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  async function savePreferences(event: FormEvent) {
    event.preventDefault();
    setPrefsBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/vault/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferredLanguage: language, audioGuidance }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save preferences.");
      setMessage(sw ? "Mapendeleo yamehifadhiwa." : "Preferences saved.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save.");
    } finally {
      setPrefsBusy(false);
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const source: { blob: Blob; name: string; duration: number | null } | null =
      recording
        ? {
            blob: recording.blob,
            name: `${title.trim() || "voice-testament"}`,
            duration: recording.durationSeconds,
          }
        : uploadFile
          ? { blob: uploadFile, name: uploadFile.name, duration: null }
          : null;

    if (!source) {
      setError(
        sw
          ? "Rekodi ujumbe au pakia faili la sauti kwanza."
          : "Record a message or upload an audio file first.",
      );
      return;
    }
    if (!isSupportedAudioType(source.blob.type || "")) {
      setError(
        sw
          ? "Faili hili si la sauti linalotambulika."
          : "That file is not a recognised audio format.",
      );
      return;
    }

    setBusy(true);
    try {
      const form = new FormData();
      form.set("file", source.blob, source.name);
      form.set("title", title);
      form.set("language", language);
      if (assetId) form.set("assetId", assetId);
      if (source.duration !== null) {
        form.set("durationSeconds", String(source.duration));
      }

      const res = await fetch("/api/vault/testaments", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save recording.");

      setMessage(
        sw
          ? "Rekodi imehifadhiwa. Timu yetu itaiandika."
          : "Recording saved. Our team will transcribe it.",
      );
      setTitle("");
      setAssetId("");
      setRecording(null);
      setUploadFile(null);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (
      !confirm(sw ? "Futa rekodi hii?" : "Delete this recording permanently?")
    ) {
      return;
    }
    setError(null);
    const res = await fetch(`/api/vault/testaments/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not delete.");
      return;
    }
    await load();
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-forest-deep">
          {t.testamentTitle}
        </h1>
        <p className="mt-2 max-w-2xl text-lg text-muted">
          {t.testamentSubtitle}
        </p>
        <p className="mt-3 rounded-[0.35rem] border-2 border-brass bg-[color-mix(in_srgb,var(--brass)_10%,white)] px-4 py-3 text-base">
          {t.testamentDisclaimer}
        </p>
      </div>

      {error && (
        <p className="text-base font-medium text-[var(--danger)]">{error}</p>
      )}
      {message && <p className="text-base font-medium text-forest">{message}</p>}

      <form
        onSubmit={savePreferences}
        className="space-y-4 rounded-[0.45rem] border-2 border-border bg-surface p-5 sm:p-7"
      >
        <h2 className="text-2xl font-semibold text-forest-deep">
          {t.languagePrefTitle}
        </h2>
        <p className="text-base text-muted">{t.languagePrefSubtitle}</p>
        <div>
          <label className="field-label" htmlFor="preferredLanguage">
            {t.languagePrefField}
          </label>
          <select
            id="preferredLanguage"
            className="field"
            value={language}
            onChange={(event) =>
              setLanguage(event.target.value as SpokenLanguage)
            }
          >
            {SPOKEN_LANGUAGES.map((option) => (
              <option key={option.code} value={option.code}>
                {spokenLanguageLabel(option.code)}
              </option>
            ))}
          </select>
        </div>
        <label className="flex min-h-12 items-center gap-3 text-lg">
          <input
            type="checkbox"
            className="h-5 w-5"
            checked={audioGuidance}
            onChange={(event) => setAudioGuidance(event.target.checked)}
          />
          {t.languagePrefAudio}
        </label>
        <button type="submit" className="btn btn-secondary-dark" disabled={prefsBusy}>
          {prefsBusy ? "…" : t.languagePrefSave}
        </button>
      </form>

      {locked ? (
        <p className="rounded-[0.45rem] border-2 border-border bg-surface p-5 text-lg text-muted">
          {t.submittedBanner}
        </p>
      ) : (
        <form
          onSubmit={save}
          className="space-y-5 rounded-[0.45rem] border-2 border-border bg-surface p-5 sm:p-7"
        >
          <h2 className="text-2xl font-semibold text-forest-deep">
            {t.testament}
          </h2>
          {asAgent && (
            <p className="rounded-[0.35rem] border border-brass bg-[color-mix(in_srgb,var(--brass)_10%,white)] px-4 py-3 text-base">
              {sw
                ? "Unarekodi kwa niaba ya mzee. Rekodi itaonyesha kuwa ilikamatwa na msaidizi wa familia."
                : "You are recording on the elder's behalf. The dossier will show it was captured by a family agent."}
            </p>
          )}

          <div>
            <label className="field-label" htmlFor="testamentTitle">
              {t.testamentLabel}
            </label>
            <input
              id="testamentTitle"
              className="field"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={
                sw
                  ? "mf. Matakwa yangu kuhusu shamba la Nyeri"
                  : "e.g. My wishes for the Nyeri shamba"
              }
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="testamentLanguage">
                {t.testamentLanguage}
              </label>
              <select
                id="testamentLanguage"
                className="field"
                value={language}
                onChange={(event) =>
                  setLanguage(event.target.value as SpokenLanguage)
                }
              >
                {SPOKEN_LANGUAGES.map((option) => (
                  <option key={option.code} value={option.code}>
                    {spokenLanguageLabel(option.code)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="testamentAsset">
                {t.testamentLinkAsset}
              </label>
              <select
                id="testamentAsset"
                className="field"
                value={assetId}
                onChange={(event) => setAssetId(event.target.value)}
              >
                <option value="">
                  {sw ? "Mali yote / jumla" : "Whole estate"}
                </option>
                {assets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <VoiceRecorder
            onRecorded={(next) => {
              setRecording(next);
              if (next) setUploadFile(null);
            }}
            disabled={busy}
            labels={{
              record: t.testamentRecord,
              stop: t.testamentStop,
              discard: t.testamentDiscard,
              unsupported: t.testamentNoMic,
            }}
          />

          <div>
            <label className="field-label" htmlFor="testamentUpload">
              {t.testamentUpload}
            </label>
            <input
              id="testamentUpload"
              type="file"
              accept="audio/*"
              className="field"
              onChange={(event) => {
                const file = event.target.files?.[0] || null;
                setUploadFile(file);
                if (file) setRecording(null);
              }}
            />
            {uploadFile && (
              <p className="mt-2 text-base font-semibold text-forest">
                {uploadFile.name}
              </p>
            )}
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={busy || (!recording && !uploadFile)}
          >
            {busy ? "…" : t.testamentSave}
          </button>
        </form>
      )}

      <section className="rounded-[0.45rem] border-2 border-border bg-surface p-5 sm:p-7">
        <h2 className="text-2xl font-semibold text-forest-deep">
          {sw ? "Rekodi zangu" : "My recordings"}
        </h2>
        {testaments.length === 0 ? (
          <p className="mt-3 text-lg text-muted">{t.testamentEmpty}</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {testaments.map((testament) => {
              const asset = assets.find((a) => a.id === testament.assetId);
              return (
                <li
                  key={testament.id}
                  className="rounded-[0.35rem] border border-border p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-ink">
                        {testament.title}
                      </p>
                      <p className="text-base text-muted">
                        {spokenLanguageLabel(testament.language)} ·{" "}
                        {formatDuration(testament.durationSeconds)} ·{" "}
                        {new Date(testament.createdAt).toLocaleString()}
                        {asset ? ` · ${asset.title}` : ""}
                      </p>
                      <p
                        className={`mt-1 text-base font-semibold ${
                          testament.transcriptStatus === "transcribed"
                            ? "text-forest"
                            : "text-brass"
                        }`}
                      >
                        {testament.transcriptStatus === "transcribed"
                          ? t.testamentDone
                          : t.testamentPending}
                      </p>
                    </div>
                    {!locked && !asAgent && (
                      <button
                        type="button"
                        className="btn btn-secondary-dark"
                        onClick={() => void remove(testament.id)}
                      >
                        {t.delete}
                      </button>
                    )}
                  </div>

                  <audio
                    className="mt-3 w-full"
                    controls
                    preload="none"
                    src={`/api/vault/testaments/${testament.id}/audio`}
                  />

                  {testament.transcript && (
                    <div className="mt-3 rounded-[0.35rem] bg-bg-deep/60 p-3">
                      <p className="text-base font-semibold text-ink">
                        {sw ? "Maandishi" : "Transcript"}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-base text-ink">
                        {testament.transcript}
                      </p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
