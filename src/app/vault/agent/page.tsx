"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useLocale } from "@/components/locale-provider";
import { vaultCopy } from "@/lib/vault-copy";
import { formatPhoneDisplay } from "@/lib/auth/phone";
import type { AgentLink } from "@/lib/db/types";

export default function AgentPage() {
  const { locale } = useLocale();
  const t = vaultCopy(locale);
  const [agents, setAgents] = useState<AgentLink[]>([]);
  const [phone, setPhone] = useState("");
  const [asAgent, setAsAgent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/vault/agent");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not load agents");
      return;
    }
    setAgents(data.agents);
    setAsAgent(Boolean(data.asAgent));
  }

  useEffect(() => {
    void load();
  }, []);

  async function invite(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    const res = await fetch("/api/vault/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentPhone: phone }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Invite failed");
      return;
    }
    setPhone("");
    setMessage(
      locale === "sw"
        ? "Mwaliko umetumwa. Msaidizi aingie kwa nambari hiyo."
        : "Invite saved. Your helper should sign in with that phone number.",
    );
    await load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-forest-deep">{t.agent}</h1>
        <p className="mt-2 max-w-2xl text-lg text-muted">{t.inviteHint}</p>
      </div>

      {asAgent && (
        <p className="rounded-[0.35rem] border-2 border-brass bg-[color-mix(in_srgb,var(--brass)_10%,white)] px-4 py-3 text-lg font-semibold text-soil">
          {locale === "sw"
            ? "Unafanya kazi kama wakala. Mabadiliko ya warithi yanahitaji OTP ya mzee."
            : "You are in Agent Mode. Heir/allocation changes require the elder’s OTP."}
        </p>
      )}

      {error && <p className="text-base font-medium text-[var(--danger)]">{error}</p>}
      {message && <p className="text-base font-medium text-forest">{message}</p>}

      {!asAgent && (
        <form
          onSubmit={invite}
          className="space-y-4 rounded-[0.45rem] border-2 border-border bg-surface p-5 sm:p-7"
        >
          <h2 className="text-2xl font-semibold text-forest-deep">{t.inviteAgent}</h2>
          <div>
            <label className="field-label" htmlFor="agentPhone">
              {locale === "sw" ? "Simu ya msaidizi" : "Helper phone number"}
            </label>
            <input
              id="agentPhone"
              className="field"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+2547…"
              inputMode="tel"
            />
          </div>
          <button type="submit" className="btn btn-primary">
            {t.inviteAgent}
          </button>
        </form>
      )}

      <section className="rounded-[0.45rem] border-2 border-border bg-surface p-5 sm:p-7">
        <h2 className="text-2xl font-semibold text-forest-deep">
          {locale === "sw" ? "Washiriki" : "Linked helpers"}
        </h2>
        {agents.length === 0 ? (
          <p className="mt-3 text-lg text-muted">
            {locale === "sw" ? "Hakuna mwaliko bado." : "No invites yet."}
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {agents.map((agent) => (
              <li
                key={agent.id}
                className="flex flex-wrap items-center justify-between gap-2 border-l-4 border-forest pl-3"
              >
                <span className="text-lg font-semibold text-ink">
                  {formatPhoneDisplay(agent.agentPhone)}
                </span>
                <span className="text-base font-semibold capitalize text-brass">
                  {agent.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
