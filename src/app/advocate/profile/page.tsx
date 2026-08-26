"use client";

import { useEffect, useState, type FormEvent } from "react";
import { KENYA_COUNTIES } from "@/lib/kenya-counties";
import type { User } from "@/lib/db/types";

export default function AdvocateProfilePage() {
  const [profile, setProfile] = useState<User | null>(null);
  const [activeCases, setActiveCases] = useState(0);
  const [maxCases, setMaxCases] = useState("");
  const [oooUntil, setOooUntil] = useState("");
  const [oooNote, setOooNote] = useState("");
  const [counties, setCounties] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/advocate/profile");
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Could not load profile.");
        return;
      }
      setProfile(json.profile);
      setActiveCases(json.activeCases || 0);
      setMaxCases(json.profile.advocateMaxCases?.toString() || "");
      setOooUntil(json.profile.advocateOooUntil?.slice(0, 16) || "");
      setOooNote(json.profile.advocateOooNote || "");
      setCounties(json.profile.advocateCounties || []);
    })();
  }, []);

  function toggleCounty(county: string) {
    setCounties((current) =>
      current.includes(county)
        ? current.filter((value) => value !== county)
        : [...current, county],
    );
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/advocate/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          advocateMaxCases: maxCases ? Number(maxCases) : null,
          advocateOooUntil: oooUntil ? new Date(oooUntil).toISOString() : null,
          advocateOooNote: oooNote,
          advocateCounties: counties,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed.");
      setProfile(json.profile);
      setMessage("Profile saved.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!profile && !error) return <p className="text-muted">Loading profile…</p>;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-forest-deep">
          Profile, coverage &amp; availability
        </h1>
        <p className="mt-2 text-muted">
          {profile?.fullName} · LSK {profile?.advocateLicense || "—"} · Active
          cases {activeCases}
        </p>
      </div>
      {profile?.advocateSuspended && (
        <p className="rounded-[0.35rem] border-2 border-[var(--danger)] p-4 font-semibold text-[var(--danger)]">
          Your account is suspended. You cannot claim new cases.
        </p>
      )}
      {error && <p className="text-[var(--danger)]">{error}</p>}
      {message && <p className="font-semibold text-forest">{message}</p>}

      <form
        onSubmit={save}
        className="space-y-6 rounded-[0.45rem] border-2 border-border bg-surface p-5"
      >
        <fieldset>
          <legend className="text-xl font-semibold text-forest-deep">
            Counties you practise in
          </legend>
          <p className="mt-1 text-base text-muted">
            New dossiers are routed automatically to advocates covering the
            counties where the estate&apos;s land sits. Select none and you will
            only see the open queue.
          </p>
          <p className="mt-2 text-base font-semibold text-forest">
            {counties.length} selected
          </p>
          <div className="mt-3 grid max-h-72 gap-1 overflow-y-auto rounded-[0.35rem] border border-border p-3 sm:grid-cols-2 lg:grid-cols-3">
            {KENYA_COUNTIES.map((county) => (
              <label
                key={county}
                className="flex min-h-10 items-center gap-2 text-base"
              >
                <input
                  type="checkbox"
                  className="h-5 w-5"
                  checked={counties.includes(county)}
                  onChange={() => toggleCounty(county)}
                />
                {county}
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <label className="field-label" htmlFor="max">
            Max concurrent cases
          </label>
          <input
            id="max"
            className="field"
            type="number"
            min={1}
            max={100}
            value={maxCases}
            onChange={(event) => setMaxCases(event.target.value)}
            placeholder="No limit"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="ooo">
            Out of office until
          </label>
          <input
            id="ooo"
            className="field"
            type="datetime-local"
            value={oooUntil}
            onChange={(event) => setOooUntil(event.target.value)}
          />
          <p className="mt-1 text-base text-muted">
            While out of office you are skipped by automated routing.
          </p>
        </div>
        <div>
          <label className="field-label" htmlFor="note">
            Availability note
          </label>
          <textarea
            id="note"
            className="field min-h-[5rem]"
            maxLength={500}
            value={oooNote}
            onChange={(event) => setOooNote(event.target.value)}
          />
        </div>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </button>
      </form>
    </div>
  );
}
