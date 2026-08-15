"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { useLocale } from "@/components/locale-provider";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

export default function HelpParentPage() {
  const { locale } = useLocale();
  const sw = locale === "sw";
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: name,
        phone,
        locale,
        source: "referral",
        notes: "Help my parent set up a vault",
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed");
      return;
    }
    setDone(true);
  }

  const wa = buildWhatsAppUrl(
    sw
      ? "Habari ShambaTrust, ningependa kusaidia mzazi wangu kufungua Hifadhi ya Shamba."
      : "Hello ShambaTrust, I want to help my parent set up a Shamba Vault.",
  );

  return (
    <>
      <SiteHeader />
      <main className="section py-14">
        <div className="mx-auto max-w-xl">
          <h1 className="brand-font text-4xl font-semibold text-forest-deep">
            {sw ? "Saidia mzazi wako" : "Help your parent set up"}
          </h1>
          <p className="mt-4 text-lg text-muted">
            {sw
              ? "Jiandikishe kama msaidizi wa familia (Agent Mode) baada ya mzee kukuialika — au tuachie namba yako."
              : "You can become a family helper (Agent Mode) after the elder invites your phone — or leave your number and we’ll guide you."}
          </p>
          {done ? (
            <p className="mt-8 text-lg text-forest">
              {sw ? "Tumepokea. Tutawasiliana." : "Got it. We’ll follow up."}
            </p>
          ) : (
            <form onSubmit={submit} className="mt-8 space-y-4">
              <input
                className="field"
                placeholder={sw ? "Jina lako" : "Your name"}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <input
                className="field"
                required
                placeholder="07…"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              {error && <p className="text-[var(--danger)]">{error}</p>}
              <button type="submit" className="btn btn-primary">
                {sw ? "Tuma" : "Submit"}
              </button>
            </form>
          )}
          <a href={wa} className="btn btn-whatsapp mt-4 inline-flex" target="_blank" rel="noreferrer">
            WhatsApp
          </a>
          <p className="mt-6">
            <Link href="/login" className="font-semibold text-forest underline">
              {sw ? "Fungua Vault / Agent login" : "Vault / Agent login"}
            </Link>
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
