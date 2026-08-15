"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useLocale } from "@/components/locale-provider";

type CaseRow = {
  id: string;
  status: string;
  deathDate: string;
  ownerName: string;
  isMine: boolean;
  coolingActive: boolean;
  coolingEndsAt: string | null;
};

export default function AdvocateSuccessionQueuePage() {
  const { locale } = useLocale();
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/advocate/succession");
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Failed");
      return;
    }
    setCases(json.cases || []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-forest-deep">
          {locale === "sw" ? "Foleni ya mirathi" : "Succession queue"}
        </h1>
        <p className="mt-2 text-lg text-muted">
          {locale === "sw"
            ? "Kesi zilizothibitishwa na ops — chukua baada ya kipindi cha kusubiri."
            : "Ops-verified death claims — claim after the cooling period."}
        </p>
        <Link
          href="/advocate/queue"
          className="mt-2 inline-block text-base font-semibold text-forest underline"
        >
          ← {locale === "sw" ? "Foleni ya ukaguzi" : "Legacy review queue"}
        </Link>
      </div>
      {error && <p className="text-[var(--danger)]">{error}</p>}
      <ul className="space-y-3">
        {cases.map((c) => (
          <li
            key={c.id}
            className="rounded-[0.45rem] border-2 border-border bg-surface p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xl font-semibold">{c.ownerName}</p>
                <p className="text-base text-muted capitalize">
                  {c.status.replace(/_/g, " ")} · death {c.deathDate}
                </p>
                {c.coolingActive && c.coolingEndsAt && (
                  <p className="mt-1 text-base text-brass">
                    Cooling until {new Date(c.coolingEndsAt).toLocaleString()}
                  </p>
                )}
              </div>
              <Link
                href={`/advocate/succession/${c.id}`}
                className="btn btn-primary"
              >
                {locale === "sw" ? "Fungua" : "Open"}
              </Link>
            </div>
          </li>
        ))}
        {cases.length === 0 && !error && (
          <li className="text-lg text-muted">
            {locale === "sw" ? "Hakuna kesi bado." : "No succession cases yet."}
          </li>
        )}
      </ul>
    </div>
  );
}
