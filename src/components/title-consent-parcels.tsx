"use client";

import { useState } from "react";

export type ConsentParcelDraft = {
  titleNumber: string;
  parcelNumber: string;
  blockNumber: string;
  registrationSection: string;
  county: string;
};

const EMPTY: ConsentParcelDraft = {
  titleNumber: "",
  parcelNumber: "",
  blockNumber: "",
  registrationSection: "",
  county: "",
};

function startingRows(initial: ConsentParcelDraft[]): ConsentParcelDraft[] {
  const rows = initial.map((row) => ({ ...EMPTY, ...row }));
  const blanks = Math.max(0, 3 - rows.length);
  for (let i = 0; i < blanks; i += 1) rows.push({ ...EMPTY });
  if (initial.length > 0) rows.push({ ...EMPTY });
  return rows;
}

function WriteLine({
  label,
  value,
  onChange,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      <input
        className="field print:rounded-none print:border-x-0 print:border-t-0 print:border-b-2 print:border-ink print:bg-transparent"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete || "off"}
      />
    </label>
  );
}

export function TitleConsentParcels({
  initial,
  locale,
}: {
  initial: ConsentParcelDraft[];
  locale: "en" | "sw";
}) {
  const sw = locale === "sw";
  const [rows, setRows] = useState<ConsentParcelDraft[]>(() => startingRows(initial));

  function patch(index: number, key: keyof ConsentParcelDraft, value: string) {
    setRows((current) =>
      current.map((row, i) => (i === index ? { ...row, [key]: value } : row)),
    );
  }

  return (
    <section className="mt-8">
      <h3 className="text-xl font-semibold text-forest-deep">
        {sw ? "Viwanja vinavyoidhinishwa" : "Land parcels covered"}
      </h3>
      <p className="mt-2 text-lg text-muted">
        {sw
          ? "Jaza nambari ya hati (LR), kiwanja, block, na sehemu ya usajili. Unaweza kuandika kwenye skrini au kalamu baada ya kuchapisha."
          : "Fill Title / LR, parcel, block, and registry section. Type here, or print and write in pen."}
      </p>
      <div className="mt-4 space-y-4">
        {rows.map((row, index) => (
          <fieldset
            key={index}
            className="rounded-[0.35rem] border-2 border-border p-4 print:break-inside-avoid"
          >
            <legend className="px-2 text-base font-semibold text-forest-deep">
              {sw ? `Kiwanja ${index + 1}` : `Parcel ${index + 1}`}
            </legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <WriteLine
                label={sw ? "Nambari ya hati (LR)" : "Title / LR number"}
                value={row.titleNumber}
                onChange={(v) => patch(index, "titleNumber", v)}
              />
              <WriteLine
                label={sw ? "Nambari ya kiwanja" : "Parcel number"}
                value={row.parcelNumber}
                onChange={(v) => patch(index, "parcelNumber", v)}
              />
              <WriteLine
                label={sw ? "Nambari ya block" : "Block number"}
                value={row.blockNumber}
                onChange={(v) => patch(index, "blockNumber", v)}
              />
              <WriteLine
                label={sw ? "Sehemu ya usajili" : "Registration section"}
                value={row.registrationSection}
                onChange={(v) => patch(index, "registrationSection", v)}
              />
              <WriteLine
                label={sw ? "Kaunti / ofisi ya ardhi" : "County / land registry"}
                value={row.county}
                onChange={(v) => patch(index, "county", v)}
              />
            </div>
          </fieldset>
        ))}
      </div>
      <button
        type="button"
        className="btn btn-secondary-dark mt-4 print:hidden"
        onClick={() => setRows((current) => [...current, { ...EMPTY }])}
      >
        {sw ? "Ongeza kiwanja kingine" : "Add another parcel"}
      </button>
    </section>
  );
}
