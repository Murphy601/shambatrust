"use client";

import { useMemo, useState } from "react";
import { LandingPhoto } from "@/components/landing-photo";
import { useLocale } from "@/components/locale-provider";
import { type AnswerValue, scoreAnswers } from "@/lib/audit";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

type Props = {
  compact?: boolean;
};

export function FamilyPeaceAudit({ compact = false }: Props) {
  const { t, locale } = useLocale();
  const questions = t.audit.questions;
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerValue[]>([]);
  const [finished, setFinished] = useState(false);

  const result = useMemo(
    () => (finished ? scoreAnswers(answers) : null),
    [answers, finished],
  );

  function choose(value: AnswerValue) {
    const next = [...answers.slice(0, index), value];
    setAnswers(next);

    if (index >= questions.length - 1) {
      setFinished(true);
      return;
    }
    setIndex(index + 1);
  }

  function restart() {
    setStarted(false);
    setIndex(0);
    setAnswers([]);
    setFinished(false);
  }

  const whatsappMessage = useMemo(() => {
    if (!result) return "";
    const label = t.audit.results[result.level].label;
    if (locale === "sw") {
      return `Habari ShambaTrust, nimekamilisha Ukaguzi wa Amani ya Familia. Alama yangu: ${label} (${result.percent}%). Ningependa kulinda urithi wangu.`;
    }
    return `Hello ShambaTrust, I completed the Family Peace Audit. My score: ${label} (${result.percent}%). I want to secure my legacy.`;
  }, [locale, result, t.audit.results]);

  return (
    <section
      id="audit"
      className={compact ? "py-8" : "py-16 sm:py-20"}
      aria-labelledby="audit-title"
    >
      <div className="section">
        <div className="max-w-3xl">
          <h2
            id="audit-title"
            className="text-3xl font-semibold text-forest-deep sm:text-4xl"
          >
            {t.audit.title}
          </h2>
          <p className="mt-3 text-lg text-muted">{t.audit.subtitle}</p>
        </div>

        <div
          className={
            compact
              ? "mt-8"
              : "mt-8 grid items-start gap-8 lg:grid-cols-[1.1fr_0.9fr]"
          }
        >
          {!compact ? (
            <LandingPhoto
              src="/landing/family-trust.png"
              alt={
                locale === "sw"
                  ? "Familia ya shamba la chai imeketi mezani nyumbani, wakiangalia karatasi pamoja"
                  : "Tea-estate family gathered around a homestead table, reviewing papers together"
              }
              className="min-h-[18rem] lg:min-h-[26rem]"
            />
          ) : null}
        <div className="rounded-[0.45rem] border-2 border-border bg-surface p-5 sm:p-8">
          {!started && !finished && (
            <div>
              <p className="text-lg text-ink">
                {locale === "sw"
                  ? "Itachukua takriban dakika 2. Majibu yako yanakaa kwenye kifaa chako hadi uamue kuwasiliana nasi."
                  : "Takes about 2 minutes. Your answers stay on this device until you choose to contact us."}
              </p>
              <button
                type="button"
                className="btn btn-primary mt-6"
                onClick={() => setStarted(true)}
              >
                {t.audit.start}
              </button>
            </div>
          )}

          {started && !finished && (
            <div key={index} className="audit-step">
              <p className="text-base font-semibold text-brass">
                {t.audit.questionOf} {index + 1} {t.audit.of}{" "}
                {questions.length}
              </p>
              <h3 className="mt-3 text-2xl font-semibold text-forest-deep sm:text-[1.75rem]">
                {questions[index].text}
              </h3>

              <div className="mt-6 grid gap-3">
                {(
                  [
                    ["yes", t.audit.answers.yes],
                    ["partly", t.audit.answers.partly],
                    ["no", t.audit.answers.no],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => choose(value)}
                    className="min-h-14 rounded-[0.35rem] border-2 border-border bg-bg px-4 text-left text-lg font-semibold text-ink transition-colors hover:border-forest hover:bg-[color-mix(in_srgb,var(--forest)_8%,white)]"
                  >
                    {label}
                  </button>
                ))}
              </div>

              {index > 0 && (
                <button
                  type="button"
                  className="mt-5 text-base font-semibold text-forest underline-offset-4 hover:underline"
                  onClick={() => setIndex((i) => Math.max(0, i - 1))}
                >
                  {t.audit.back}
                </button>
              )}
            </div>
          )}

          {finished && result && (
            <div className="audit-step">
              <p
                className="text-base font-semibold uppercase tracking-wide"
                style={{
                  color:
                    result.level === "low"
                      ? "var(--success)"
                      : result.level === "medium"
                        ? "var(--warning)"
                        : "var(--danger)",
                }}
              >
                {t.audit.results[result.level].label}
              </p>
              <p className="brand-font mt-2 text-5xl font-semibold text-forest-deep">
                {result.percent}%
              </p>
              <p className="mt-4 max-w-2xl text-lg text-ink">
                {t.audit.results[result.level].message}
              </p>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <a href="/login" className="btn btn-primary">
                  {locale === "sw" ? "Fungua hifadhi yangu" : "Open my vault"}
                </a>
                <a
                  href={buildWhatsAppUrl(whatsappMessage)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-whatsapp"
                >
                  {t.audit.cta}
                </a>
                <a href="#contact" className="btn btn-secondary-dark">
                  {t.audit.ctaForm}
                </a>
                <button
                  type="button"
                  onClick={restart}
                  className="btn btn-secondary-dark"
                >
                  {t.audit.restart}
                </button>
              </div>
            </div>
          )}
        </div>
        </div>
      </div>
    </section>
  );
}
