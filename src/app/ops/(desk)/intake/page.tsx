"use client";

import { useEffect, useState } from "react";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

type Lead = {
  id: string;
  fullName: string;
  phone: string;
  source: string;
  notes: string;
  createdAt: string;
};

export default function OpsIntakePage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/ops/intake");
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed");
        return;
      }
      setLeads(json.leads || []);
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">WhatsApp intake</h1>
        <p className="mt-2 text-[#9aa89c]">
          Family members start from /start or WhatsApp. Title-deed photos sent
          in chat are logged here for ops to file into the elder vault.
        </p>
      </div>
      {error && <p className="text-[#e07a5f]">{error}</p>}
      <ul className="space-y-3">
        {leads.map((lead) => (
          <li
            key={lead.id}
            className="rounded border border-[#1E293B] bg-[#121a16] p-4"
          >
            <p className="font-semibold">
              {lead.fullName} · {lead.source}
            </p>
            <p className="text-sm text-[#9aa89c]">
              {lead.phone} · {new Date(lead.createdAt).toLocaleString()}
            </p>
            {lead.notes ? <p className="mt-2 text-sm">{lead.notes}</p> : null}
            <a
              href={buildWhatsAppUrl(
                `Hello, this is ShambaTrust ops following up on your intake (${lead.source}).`,
              )}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-sm text-[#16A34A] underline"
            >
              Open WhatsApp
            </a>
          </li>
        ))}
        {leads.length === 0 && (
          <li className="text-[#9aa89c]">No WhatsApp intake leads yet.</li>
        )}
      </ul>
    </div>
  );
}
