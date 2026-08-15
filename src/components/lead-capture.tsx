"use client";

import { useState, type FormEvent } from "react";
import { useLocale } from "@/components/locale-provider";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

export function LeadCapture() {
  const { t, locale } = useLocale();
  const [submitted, setSubmitted] = useState(false);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "").trim();
    const phone = String(form.get("phone") || "").trim();
    const county = String(form.get("county") || "").trim();
    const language = String(form.get("language") || "").trim();
    const message = String(form.get("message") || "").trim();

    const composed =
      locale === "sw"
        ? `Habari ShambaTrust,\nJina: ${name}\nSimu: ${phone}\nKaunti: ${county}\nLugha: ${language}\nUjumbe: ${message || "—"}`
        : `Hello ShambaTrust,\nName: ${name}\nPhone: ${phone}\nCounty: ${county}\nLanguage: ${language}\nMessage: ${message || "—"}`;

    setSubmitted(true);
    window.open(buildWhatsAppUrl(composed), "_blank", "noopener,noreferrer");
  }

  const quickWhatsApp =
    locale === "sw"
      ? "Habari ShambaTrust, ningependa kuanza kulinda urithi wa familia yangu."
      : "Hello ShambaTrust, I would like to start protecting my family's legacy.";

  return (
    <section
      id="contact"
      className="border-t border-border bg-bg-deep/80 py-16 sm:py-20"
      aria-labelledby="contact-title"
    >
      <div className="section grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <h2
            id="contact-title"
            className="text-3xl font-semibold text-forest-deep sm:text-4xl"
          >
            {t.lead.title}
          </h2>
          <p className="mt-3 max-w-xl text-lg text-muted">{t.lead.subtitle}</p>

          <a
            href={buildWhatsAppUrl(quickWhatsApp)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-whatsapp mt-8"
          >
            {t.lead.whatsapp}
          </a>
          <p className="mt-3 text-base text-muted">{t.lead.whatsappHint}</p>
        </div>

        <form
          onSubmit={onSubmit}
          className="rounded-[0.45rem] border-2 border-border bg-surface p-5 sm:p-7"
        >
          <div className="space-y-4">
            <div>
              <label className="field-label" htmlFor="name">
                {t.lead.name}
              </label>
              <input
                id="name"
                name="name"
                required
                autoComplete="name"
                className="field"
              />
            </div>
            <div>
              <label className="field-label" htmlFor="phone">
                {t.lead.phone}
              </label>
              <input
                id="phone"
                name="phone"
                required
                inputMode="tel"
                autoComplete="tel"
                placeholder="+2547…"
                className="field"
              />
            </div>
            <div>
              <label className="field-label" htmlFor="county">
                {t.lead.county}
              </label>
              <select id="county" name="county" required className="field">
                <option value="">—</option>
                {t.lead.counties.map((county) => (
                  <option key={county} value={county}>
                    {county}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="language">
                {t.lead.language}
              </label>
              <select id="language" name="language" required className="field">
                <option value="English">English</option>
                <option value="Kiswahili">Kiswahili</option>
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="message">
                {t.lead.message}
              </label>
              <textarea
                id="message"
                name="message"
                rows={3}
                className="field min-h-[6rem]"
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary mt-6 w-full">
            {t.lead.submit}
          </button>

          {submitted && (
            <p className="mt-4 text-base font-medium text-forest" role="status">
              {t.lead.success}
            </p>
          )}
        </form>
      </div>
    </section>
  );
}
