"use client";

import { useEffect, useState, type FormEvent } from "react";

type Dsar = {
  id: string;
  requesterName: string;
  requesterPhone: string;
  requestType: string;
  status: string;
  notes: string;
  createdAt: string;
};

export default function OpsDpoPage() {
  const [rows, setRows] = useState<Dsar[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [requesterName, setRequesterName] = useState("");
  const [requesterPhone, setRequesterPhone] = useState("");
  const [requestType, setRequestType] = useState("access");
  const [notes, setNotes] = useState("");

  async function load() {
    const res = await fetch("/api/ops/dsar");
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Failed");
      return;
    }
    setRows(json.requests || []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function create(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const res = await fetch("/api/ops/dsar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requesterName,
        requesterPhone,
        requestType,
        notes,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Failed");
      return;
    }
    setRequesterName("");
    setRequesterPhone("");
    setNotes("");
    await load();
  }

  async function setStatus(id: string, status: string) {
    await fetch("/api/ops/dsar", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    await load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Data Protection Officer</h1>
        <p className="mt-2 text-[#9aa89c]">
          Log and fulfil Data Subject Access Requests under Kenya’s Data
          Protection Act, 2019.
        </p>
      </div>
      <form
        onSubmit={create}
        className="grid gap-3 rounded border border-[#1E293B] bg-[#0D1117] p-5 sm:grid-cols-2"
      >
        <input
          className="rounded border border-[#1E293B] bg-[#0D1117] px-3 py-2"
          placeholder="Requester name"
          value={requesterName}
          onChange={(e) => setRequesterName(e.target.value)}
          required
        />
        <input
          className="rounded border border-[#1E293B] bg-[#0D1117] px-3 py-2"
          placeholder="Phone +254…"
          value={requesterPhone}
          onChange={(e) => setRequesterPhone(e.target.value)}
          required
        />
        <select
          className="rounded border border-[#1E293B] bg-[#0D1117] px-3 py-2"
          value={requestType}
          onChange={(e) => setRequestType(e.target.value)}
        >
          <option value="access">Access</option>
          <option value="correction">Correction</option>
          <option value="deletion">Deletion</option>
          <option value="restriction">Restriction</option>
        </select>
        <input
          className="rounded border border-[#1E293B] bg-[#0D1117] px-3 py-2"
          placeholder="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <button
          type="submit"
          className="rounded bg-[#7C3AED] px-4 py-2 text-sm font-semibold text-white sm:col-span-2"
        >
          Log DSAR
        </button>
      </form>
      {error && <p className="text-[#e07a5f]">{error}</p>}
      <ul className="space-y-3">
        {rows.map((row) => (
          <li
            key={row.id}
            className="rounded border border-[#1E293B] bg-[#121a16] p-4"
          >
            <p className="font-semibold">
              {row.requesterName} · {row.requestType} · {row.status}
            </p>
            <p className="text-sm text-[#9aa89c]">
              {row.requesterPhone} · {new Date(row.createdAt).toLocaleString()}
            </p>
            {row.notes ? <p className="mt-1 text-sm">{row.notes}</p> : null}
            <div className="mt-3 flex flex-wrap gap-2">
              {["in_progress", "fulfilled", "refused"].map((status) => (
                <button
                  key={status}
                  type="button"
                  className="rounded border border-[#1E293B] px-3 py-1 text-sm"
                  onClick={() => void setStatus(row.id, status)}
                >
                  {status.replace("_", " ")}
                </button>
              ))}
            </div>
          </li>
        ))}
        {rows.length === 0 && (
          <li className="text-[#9aa89c]">No DSARs logged yet.</li>
        )}
      </ul>
    </div>
  );
}
