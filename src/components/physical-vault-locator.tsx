"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function PhysicalVaultLocator({
  initialLocation,
  initialContactName,
  initialContactPhone,
  initialMedical,
  hasCard,
  locale,
}: {
  initialLocation: string;
  initialContactName: string;
  initialContactPhone: string;
  initialMedical: string;
  hasCard: boolean;
  locale: "en" | "sw";
}) {
  const sw = locale === "sw";
  const router = useRouter();
  const [location, setLocation] = useState(initialLocation);
  const [contactName, setContactName] = useState(initialContactName);
  const [contactPhone, setContactPhone] = useState(initialContactPhone);
  const [medical, setMedical] = useState(initialMedical);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function save(event: FormEvent, rotate = false) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/vault/locator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          physicalDocumentLocation: location,
          emergencyPrimaryContactName: contactName,
          emergencyPrimaryContactPhone: contactPhone,
          emergencyMedicalNotes: medical,
          rotateEmergencyCard: rotate,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Could not save");
        return;
      }
      setMessage(sw ? "Mahali pa nyaraka pamehifadhiwa." : "Document location saved.");
      router.refresh();
      if (rotate) {
        window.location.href = "/vault/emergency-card";
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={(e) => void save(e)} className="space-y-3">
      <label className="field-label" htmlFor="phys">
        {sw ? "Mahali pa nyaraka halisi" : "Physical document location"}
      </label>
      <input
        id="phys"
        className="field"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        placeholder={
          sw
            ? "mf. Sanduku la kijani chini ya kitanda / KCB Westlands"
            : "e.g. Green metal box under the bed / KCB Westlands safe"
        }
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor="ecn">
            {sw ? "Mtu wa dharura" : "Emergency contact"}
          </label>
          <input
            id="ecn"
            className="field"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="ecp">
            {sw ? "Simu ya dharura" : "Emergency phone"}
          </label>
          <input
            id="ecp"
            className="field"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
          />
        </div>
      </div>
      <label className="field-label" htmlFor="med">
        {sw ? "Maelekezo ya matibabu (fupi)" : "Medical directives (short)"}
      </label>
      <textarea
        id="med"
        className="field min-h-[5rem]"
        value={medical}
        onChange={(e) => setMedical(e.target.value)}
        placeholder={
          sw
            ? "Alergies, hospitali, dawa, matakwa ya matibabu"
            : "Allergies, hospital, medicines, medical wishes"
        }
      />
      {error && <p className="text-[var(--danger)]">{error}</p>}
      {message && <p className="font-semibold text-forest">{message}</p>}
      <div className="flex flex-wrap gap-3">
        <button type="submit" className="btn btn-secondary-dark" disabled={loading}>
          {loading ? "…" : sw ? "Hifadhi" : "Save location"}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={loading}
          onClick={(e) => void save(e, true)}
        >
          {hasCard
            ? sw
              ? "Chapisha kadi ya dharura"
              : "Print emergency card"
            : sw
              ? "Tengeneza kadi ya QR"
              : "Create QR pocket card"}
        </button>
        {hasCard && (
          <Link href="/vault/emergency-card" className="btn btn-secondary-dark">
            {sw ? "Fungua kadi" : "Open card"}
          </Link>
        )}
      </div>
    </form>
  );
}
