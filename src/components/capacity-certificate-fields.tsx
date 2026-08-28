"use client";

import { useState } from "react";

export type CapacityDraft = {
  over75OrFrail: boolean;
  medicalCapacityAttached: boolean;
  medicalCapacityDocumentName: string | null;
  medicalCapacityDocumentPath: string | null;
  birthYear: number | null;
};

export function CapacityCertificateFields({
  value,
  onChange,
  recommended,
  locale,
}: {
  value: CapacityDraft;
  onChange: (next: CapacityDraft) => void;
  recommended: boolean;
  locale: "en" | "sw";
}) {
  const sw = locale === "sw";
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File | null) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/vault/upload", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Upload failed");
        return;
      }
      onChange({
        ...value,
        medicalCapacityAttached: true,
        medicalCapacityDocumentName: json.documentName,
        medicalCapacityDocumentPath: json.documentPath,
      });
    } finally {
      setUploading(false);
    }
  }

  return (
    <fieldset className="rounded-[0.35rem] border-2 border-border p-4">
      <legend className="px-2 text-base font-semibold text-forest-deep">
        {sw ? "Cheti cha uwezo wa akili (daktari)" : "Doctor’s certificate of capacity"}
      </legend>
      {recommended && (
        <p className="rounded-[0.35rem] border-2 border-brass bg-[#fff8e8] px-3 py-2 text-base text-ink">
          {sw
            ? "Umri wa 75 au zaidi: mahakama inaweza kupinga wosia kwa madai ya akili. Cheti cha daktari kinasaidia."
            : "Age 75 or older: a Will or Trust can be challenged for unsound mind. A doctor’s certificate of testamentary capacity is strongly recommended."}
        </p>
      )}
      <label className="mt-3 flex min-h-12 items-start gap-3 text-lg">
        <input
          type="checkbox"
          className="mt-1 h-5 w-5"
          checked={value.over75OrFrail}
          onChange={(e) => onChange({ ...value, over75OrFrail: e.target.checked })}
        />
        <span>
          {sw
            ? "Nina miaka 75 au zaidi, au daktari amesema nina udhaifu."
            : "I am 75 or older, or a doctor has said I am frail."}
        </span>
      </label>
      <label className="mt-3 flex min-h-12 items-start gap-3 text-lg">
        <input
          type="checkbox"
          className="mt-1 h-5 w-5"
          checked={value.medicalCapacityAttached}
          onChange={(e) =>
            onChange({ ...value, medicalCapacityAttached: e.target.checked })
          }
        />
        <span>
          {sw
            ? "Nitaambatisha cheti cha daktari (si lazima — inapendekezwa kwa 75+)."
            : "Attach a doctor’s certificate of capacity (optional — recommended for 75+)."}
        </span>
      </label>
      {value.medicalCapacityAttached && (
        <div className="mt-3">
          <input
            className="field"
            type="file"
            accept="application/pdf,image/*"
            onChange={(e) => void onFile(e.target.files?.[0] || null)}
          />
          {uploading && <p className="mt-2 text-muted">{sw ? "Inapakia…" : "Uploading…"}</p>}
          {value.medicalCapacityDocumentName && (
            <p className="mt-2 font-semibold text-forest">
              {sw ? "Imehifadhiwa:" : "On file:"} {value.medicalCapacityDocumentName}
            </p>
          )}
        </div>
      )}
      {error && <p className="mt-2 text-[var(--danger)]">{error}</p>}
    </fieldset>
  );
}
