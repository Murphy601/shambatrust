"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatDuration } from "@/lib/audio";
import type { TranscriptStatus } from "@/lib/db/types";

type Row = {
  id: string;
  vaultId: string;
  title: string;
  languageLabel: string;
  durationSeconds: number | null;
  transcript: string;
  transcriptStatus: TranscriptStatus;
  transcriptNotes: string;
  recordedByAgent: boolean;
  createdAt: string;
  ownerName: string;
  ownerPhone: string | null;
};

export default function OpsTranscriptsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/ops/transcripts");
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Failed to load transcription queue.");
      return;
    }
    const list: Row[] = json.testaments || [];
    setRows(list);
    setDrafts(
      Object.fromEntries(list.map((row) => [row.id, row.transcript || ""])),
    );
    setNotes(
      Object.fromEntries(list.map((row) => [row.id, row.transcriptNotes || ""])),
    );
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  async function submit(id: string, transcriptStatus: TranscriptStatus) {
    setBusyId(id);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/ops/transcripts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testamentId: id,
          transcript: drafts[id] || "",
          transcriptNotes: notes[id] || "",
          transcriptStatus,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed.");
      setMessage(`Recording marked ${transcriptStatus.replace(/_/g, " ")}.`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Save failed.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Voice testament transcription</h1>
        <p className="mt-2 text-[#9aa89c]">
          Elders record their wishes in their mother tongue. Transcribe the
          recording so the assigned advocate can read it alongside the dossier.
        </p>
      </div>

      {error && <p className="text-[#e07a5f]">{error}</p>}
      {message && <p className="text-[#d4a574]">{message}</p>}

      {rows.length === 0 ? (
        <p className="rounded border border-[#3d4a40] bg-[#121a16] p-5 text-[#9aa89c]">
          Nothing waiting. New recordings appear here as soon as an elder saves
          one.
        </p>
      ) : (
        <ul className="space-y-4">
          {rows.map((row) => (
            <li
              key={row.id}
              className="rounded border border-[#3d4a40] bg-[#121a16] p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold">{row.title}</p>
                  <p className="mt-1 text-sm text-[#9aa89c]">
                    {row.ownerName}
                    {row.ownerPhone ? ` (${row.ownerPhone})` : ""} ·{" "}
                    {row.languageLabel} · {formatDuration(row.durationSeconds)} ·{" "}
                    {new Date(row.createdAt).toLocaleString()}
                    {row.recordedByAgent ? " · captured by family agent" : ""}
                  </p>
                </div>
                <Link
                  href={`/ops/vaults/${row.vaultId}`}
                  className="text-sm text-[#d4a574] underline"
                >
                  Open vault
                </Link>
              </div>

              <audio
                className="mt-4 w-full"
                controls
                preload="none"
                src={`/api/vault/testaments/${row.id}/audio`}
              />

              <label className="mt-4 block text-sm font-semibold" htmlFor={`t-${row.id}`}>
                Transcript
              </label>
              <textarea
                id={`t-${row.id}`}
                className="mt-1 w-full rounded border border-[#3d4a40] bg-[#0f1411] px-3 py-3 text-base"
                rows={5}
                value={drafts[row.id] ?? ""}
                onChange={(event) =>
                  setDrafts((current) => ({
                    ...current,
                    [row.id]: event.target.value,
                  }))
                }
                placeholder="Type what the elder said, in the language spoken…"
              />

              <label className="mt-3 block text-sm font-semibold" htmlFor={`n-${row.id}`}>
                Transcriber notes
              </label>
              <input
                id={`n-${row.id}`}
                className="mt-1 w-full rounded border border-[#3d4a40] bg-[#0f1411] px-3 py-2 text-base"
                value={notes[row.id] ?? ""}
                onChange={(event) =>
                  setNotes((current) => ({
                    ...current,
                    [row.id]: event.target.value,
                  }))
                }
                placeholder="e.g. background noise at 0:40, dialect confirmed with the family"
              />

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busyId === row.id}
                  onClick={() => void submit(row.id, "transcribed")}
                  className="rounded bg-[#2f5d45] px-4 py-2 font-semibold text-white"
                >
                  Mark transcribed
                </button>
                <button
                  type="button"
                  disabled={busyId === row.id}
                  onClick={() => void submit(row.id, "in_progress")}
                  className="rounded border border-[#3d4a40] px-4 py-2 font-semibold"
                >
                  Save draft
                </button>
                <button
                  type="button"
                  disabled={busyId === row.id}
                  onClick={() => void submit(row.id, "rejected")}
                  className="rounded border border-[#e07a5f] px-4 py-2 font-semibold text-[#e07a5f]"
                >
                  Inaudible / reject
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
