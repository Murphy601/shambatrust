"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { AdvocateApplication } from "@/lib/db/types";

export default function OpsAdvocatesPage() {
  const [applications, setApplications] = useState<AdvocateApplication[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [outreach, setOutreach] = useState<{
    id: string;
    message: string;
    whatsappUrl: string;
    portalUrl: string;
  } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/ops/advocate-applications");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to load");
      return;
    }
    setApplications(data.applications);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(
    applicationId: string,
    decision: "approved" | "rejected" | "needs_info",
  ) {
    setBusy(applicationId);
    setError(null);
    try {
      const res = await fetch("/api/ops/advocate-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId,
          decision,
          adminNotes: notes[applicationId] || "",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setOutreach({
        id: applicationId,
        message: data.message,
        whatsappUrl: data.whatsappUrl,
        portalUrl: data.portalUrl,
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-[#e8efe9]">
          Advocate applications
        </h1>
        <p className="mt-2 text-[#9aa89c]">
          Verify ID + LSK documents, then approve, reject, or request more info.
          After a decision, send the WhatsApp message with portal status.
        </p>
      </div>

      {error && <p className="text-[#e07a5f]">{error}</p>}

      {outreach && (
        <div className="rounded border border-[#d4a574]/50 bg-[#d4a574]/10 p-4">
          <p className="font-semibold text-[#d4a574]">Outreach ready</p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-[#e8efe9]">
            {outreach.message}
          </p>
          <p className="mt-2 text-sm text-[#9aa89c]">
            Portal: <code className="text-[#d4a574]">{outreach.portalUrl}</code>
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={outreach.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded bg-[#25D366] px-3 py-2 text-sm font-semibold text-[#0f1411]"
            >
              Open WhatsApp to applicant
            </a>
            <button
              type="button"
              className="rounded border border-[#3d4a40] px-3 py-2 text-sm"
              onClick={() => void navigator.clipboard.writeText(outreach.message)}
            >
              Copy message
            </button>
          </div>
        </div>
      )}

      {applications.length === 0 ? (
        <p className="text-[#9aa89c]">No applications yet.</p>
      ) : (
        <ul className="space-y-4">
          {applications.map((app) => (
            <li
              key={app.id}
              className="rounded border border-[#3d4a40] bg-[#121a16] p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-[#e8efe9]">
                    {app.fullName}
                  </h2>
                  <p className="mt-1 text-sm text-[#9aa89c]">
                    {app.phone} · {app.email} · LSK {app.lskNumber}
                  </p>
                  <p className="mt-1 text-sm capitalize text-[#d4a574]">
                    Status: {app.status.replace("_", " ")}
                  </p>
                  {(app.lawFirm || app.organization || app.officeAddress) && (
                    <p className="mt-2 text-sm text-[#9aa89c]">
                      {[app.lawFirm, app.organization, app.officeAddress]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 text-sm">
                  <a
                    className="rounded border border-[#3d4a40] px-2 py-1 hover:border-[#d4a574]"
                    href={`/api/ops/advocate-applications/${app.id}/file?slot=idFront`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    ID front
                  </a>
                  <a
                    className="rounded border border-[#3d4a40] px-2 py-1 hover:border-[#d4a574]"
                    href={`/api/ops/advocate-applications/${app.id}/file?slot=idBack`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    ID back
                  </a>
                  <a
                    className="rounded border border-[#3d4a40] px-2 py-1 hover:border-[#d4a574]"
                    href={`/api/ops/advocate-applications/${app.id}/file?slot=lskCert`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    LSK cert
                  </a>
                </div>
              </div>

              {(app.status === "pending" || app.status === "needs_info") && (
                <div className="mt-4 space-y-3">
                  <textarea
                    className="w-full rounded border border-[#3d4a40] bg-[#0f1411] px-3 py-2 text-sm"
                    rows={2}
                    placeholder="Admin notes (reason / what info is missing)"
                    value={notes[app.id] || ""}
                    onChange={(e) =>
                      setNotes((prev) => ({ ...prev, [app.id]: e.target.value }))
                    }
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy === app.id}
                      className="rounded bg-[#2f5d45] px-3 py-2 text-sm font-semibold text-white"
                      onClick={() => void decide(app.id, "approved")}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={busy === app.id}
                      className="rounded border border-[#d4a574] px-3 py-2 text-sm font-semibold text-[#d4a574]"
                      onClick={() => void decide(app.id, "needs_info")}
                    >
                      Need more info
                    </button>
                    <button
                      type="button"
                      disabled={busy === app.id}
                      className="rounded border border-[#e07a5f] px-3 py-2 text-sm font-semibold text-[#e07a5f]"
                      onClick={() => void decide(app.id, "rejected")}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              )}

              {app.adminNotes && app.status !== "pending" && (
                <p className="mt-3 text-sm text-[#9aa89c]">
                  Notes: {app.adminNotes}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <Link href="/ops" className="text-sm text-[#9aa89c] underline">
        ← Ops overview
      </Link>
    </div>
  );
}
