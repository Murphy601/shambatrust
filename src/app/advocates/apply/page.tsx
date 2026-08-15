"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { useLocale } from "@/components/locale-provider";

type Uploaded = { documentName: string; documentPath: string } | null;

export default function AdvocateApplyPage() {
  const { locale } = useLocale();
  const sw = locale === "sw";

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [lskNumber, setLskNumber] = useState("");
  const [officeAddress, setOfficeAddress] = useState("");
  const [lawFirm, setLawFirm] = useState("");
  const [organization, setOrganization] = useState("");
  const [idFront, setIdFront] = useState<Uploaded>(null);
  const [idBack, setIdBack] = useState<Uploaded>(null);
  const [lskCert, setLskCert] = useState<Uploaded>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function uploadSlot(
    slot: string,
    file: File | null,
    setter: (u: Uploaded) => void,
  ) {
    if (!file) return;
    setError(null);
    const body = new FormData();
    body.append("file", file);
    body.append("slot", slot);
    const res = await fetch("/api/advocates/apply/upload", {
      method: "POST",
      body,
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Upload failed");
      return;
    }
    setter({ documentName: data.documentName, documentPath: data.documentPath });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!idFront || !idBack || !lskCert) {
      setError(
        sw
          ? "Pakia kitambulisho (mbele na nyuma) na cheti cha LSK."
          : "Upload ID front, ID back, and LSK certificate.",
      );
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/advocates/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          phone,
          email,
          lskNumber,
          officeAddress,
          lawFirm,
          organization,
          idFrontName: idFront.documentName,
          idFrontPath: idFront.documentPath,
          idBackName: idBack.documentName,
          idBackPath: idBack.documentPath,
          lskCertName: lskCert.documentName,
          lskCertPath: lskCert.documentPath,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submit failed");
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <SiteHeader />
      <main className="section py-10 sm:py-14">
        <div className="mx-auto max-w-2xl">
          <p className="text-sm font-bold uppercase tracking-[0.14em] text-brass">
            {sw ? "Timu ya mawakili" : "Partner advocates"}
          </p>
          <h1 className="brand-font mt-2 text-4xl font-semibold text-forest-deep sm:text-5xl">
            {sw ? "Jiunge kama wakili" : "Join as a partner advocate"}
          </h1>
          <p className="mt-4 text-lg text-muted">
            {sw
              ? "Wasilisha maombi yako. Timu yetu itakagua, kisha utapata kiungo cha lango la mawakili ikiwa utaidhinishwa."
              : "Submit your credentials. Our ops team reviews applications, then sends you the advocate portal link if approved."}
          </p>

          {done ? (
            <div className="mt-8 rounded-[0.45rem] border-2 border-forest bg-surface p-6">
              <h2 className="text-2xl font-semibold text-forest-deep">
                {sw ? "Ombi limetumwa" : "Application received"}
              </h2>
              <p className="mt-3 text-lg text-muted">
                {sw
                  ? "Tutawasiliana kwa WhatsApp / barua pepe baada ya ukaguzi (imeidhinishwa, imekataliwa, au tunahitaji maelezo zaidi)."
                  : "We will contact you on WhatsApp / email after review (approved, rejected, or we need more information)."}
              </p>
              <Link href="/" className="btn btn-primary mt-6">
                {sw ? "Rudi nyumbani" : "Back home"}
              </Link>
            </div>
          ) : (
            <form
              onSubmit={submit}
              className="mt-8 space-y-5 rounded-[0.45rem] border-2 border-border bg-surface p-5 sm:p-7"
            >
              <div>
                <label className="field-label" htmlFor="fullName">
                  {sw ? "Jina kamili *" : "Full name *"}
                </label>
                <input
                  id="fullName"
                  className="field"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="field-label" htmlFor="phone">
                    {sw ? "Simu *" : "Phone *"}
                  </label>
                  <input
                    id="phone"
                    className="field"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0712 345 678"
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="email">
                    Email *
                  </label>
                  <input
                    id="email"
                    type="email"
                    className="field"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="field-label" htmlFor="lsk">
                  {sw ? "Nambari ya LSK *" : "LSK practising number *"}
                </label>
                <input
                  id="lsk"
                  className="field"
                  required
                  value={lskNumber}
                  onChange={(e) => setLskNumber(e.target.value)}
                  placeholder="P.105/XXXX/XX"
                />
              </div>

              <div className="space-y-3 border-t border-border pt-5">
                <p className="text-base font-semibold text-ink">
                  {sw ? "Nyaraka (lazima)" : "Required documents"}
                </p>
                <UploadRow
                  label={sw ? "Kitambulisho — mbele *" : "National ID — front *"}
                  fileName={idFront?.documentName}
                  onFile={(f) => void uploadSlot("idFront", f, setIdFront)}
                />
                <UploadRow
                  label={sw ? "Kitambulisho — nyuma *" : "National ID — back *"}
                  fileName={idBack?.documentName}
                  onFile={(f) => void uploadSlot("idBack", f, setIdBack)}
                />
                <UploadRow
                  label={sw ? "Cheti cha LSK *" : "LSK practising certificate *"}
                  fileName={lskCert?.documentName}
                  onFile={(f) => void uploadSlot("lskCert", f, setLskCert)}
                />
              </div>

              <div className="space-y-4 border-t border-border pt-5">
                <p className="text-base font-semibold text-ink">
                  {sw ? "Si lazima" : "Optional"}
                </p>
                <div>
                  <label className="field-label" htmlFor="office">
                    {sw ? "Anwani ya ofisi" : "Office address"}
                  </label>
                  <input
                    id="office"
                    className="field"
                    value={officeAddress}
                    onChange={(e) => setOfficeAddress(e.target.value)}
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="firm">
                    {sw ? "Kampuni ya sheria" : "Law firm"}
                  </label>
                  <input
                    id="firm"
                    className="field"
                    value={lawFirm}
                    onChange={(e) => setLawFirm(e.target.value)}
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="org">
                    {sw ? "Shirika" : "Organization"}
                  </label>
                  <input
                    id="org"
                    className="field"
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                  />
                </div>
              </div>

              {error && (
                <p className="text-base font-medium text-[var(--danger)]">{error}</p>
              )}
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading
                  ? "…"
                  : sw
                    ? "Wasilisha ombi"
                    : "Submit application"}
              </button>
              <p className="text-sm text-muted">
                {sw ? "Tayari umeidhinishwa?" : "Already approved?"}{" "}
                <Link href="/advocate/login" className="font-semibold text-forest underline">
                  {sw ? "Ingia lango la mawakili" : "Advocate portal login"}
                </Link>
              </p>
            </form>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function UploadRow({
  label,
  fileName,
  onFile,
}: {
  label: string;
  fileName?: string;
  onFile: (file: File | null) => void;
}) {
  return (
    <div>
      <label className="field-label">{label}</label>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="field"
        onChange={(e) => onFile(e.target.files?.[0] || null)}
      />
      {fileName && (
        <p className="mt-1 text-sm text-forest">Uploaded: {fileName}</p>
      )}
    </div>
  );
}
