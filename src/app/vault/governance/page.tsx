"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { PlatformDisclaimer } from "@/components/platform-disclaimer";
import { useLocale } from "@/components/locale-provider";
import type {
  Beneficiary,
  BuyoutOffer,
  ConsensusProposal,
  ConsensusProposalKind,
  ExecutionPlan,
} from "@/lib/db/types";

export default function FamilyGovernancePage() {
  const { locale } = useLocale();
  const sw = locale === "sw";
  const [proposals, setProposals] = useState<ConsensusProposal[]>([]);
  const [buyouts, setBuyouts] = useState<BuyoutOffer[]>([]);
  const [heirs, setHeirs] = useState<Beneficiary[]>([]);
  const [plan, setPlan] = useState<ExecutionPlan | null>(null);
  const [kind, setKind] = useState<ConsensusProposalKind>("amend_trust");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [sellerId, setSellerId] = useState("");
  const [sharePercent, setSharePercent] = useState("25");
  const [asking, setAsking] = useState("");
  const [respondHeir, setRespondHeir] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/vault/governance");
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Could not load");
      return;
    }
    setProposals(json.proposals || []);
    setBuyouts(json.buyouts || []);
    setHeirs(json.heirs || []);
    setPlan(json.plan || null);
    if (!sellerId && json.heirs?.[0]) setSellerId(json.heirs[0].id);
    if (!respondHeir && json.heirs?.[1]) setRespondHeir(json.heirs[1].id);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function post(body: Record<string, unknown>) {
    setError(null);
    setMessage(null);
    const res = await fetch("/api/vault/governance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Request failed");
      return;
    }
    setMessage(sw ? "Imehifadhiwa." : "Saved.");
    await load();
  }

  async function propose(event: FormEvent) {
    event.preventDefault();
    await post({
      action: "propose",
      kind,
      title,
      summary,
      payload:
        kind === "liquidate_share"
          ? {
              sellerBeneficiaryId: sellerId,
              sharePercent: Number(sharePercent) || 0,
              askingPriceKes: Number(asking) || 0,
            }
          : {},
    });
  }

  async function openBuyout(event: FormEvent) {
    event.preventDefault();
    await post({
      action: "buyout",
      sellerBeneficiaryId: sellerId,
      sharePercent: Number(sharePercent) || 0,
      askingPriceKes: Number(asking) || 0,
    });
  }

  const enforcer = plan?.enforcer;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-forest-deep">
          {sw ? "Utawala wa familia" : "Family governance & co-sign"}
        </h1>
        <p className="mt-2 text-lg text-muted">
          {sw
            ? "Enforcer, idhini maradufu, na haki ya kwanza ya kununua hisa ndani ya familia — kabla ardhi haijauzwa nje."
            : "An independent Enforcer, dual-signature approvals, and a first-right-of-refusal buyout keep family land inside the family."}
        </p>
      </div>
      <PlatformDisclaimer sw={sw} />
      {error && <p className="text-[var(--danger)]">{error}</p>}
      {message && <p className="font-semibold text-forest">{message}</p>}

      <section className="rounded-[0.45rem] border-2 border-border bg-surface p-5 sm:p-7">
        <h2 className="text-2xl font-semibold text-forest-deep">
          {sw ? "Jukumu la Enforcer" : "Trustee Enforcer"}
        </h2>
        <p className="mt-2 text-base text-muted">
          {sw
            ? "Mpatanishi huru anayevunja mkwamo kati ya wateule au warithi."
            : "An independent mediator or advocate who breaks deadlocks between co-trustees or joint heirs (Trust Administration Law)."}
        </p>
        {enforcer ? (
          <p className="mt-3 text-lg text-ink">
            {enforcer.fullName}
            {enforcer.organization ? ` · ${enforcer.organization}` : ""}
            {enforcer.phone ? ` · ${enforcer.phone}` : ""}
          </p>
        ) : (
          <p className="mt-3 text-base text-muted">
            {sw ? "Bado hajawekwa." : "Not appointed yet."}{" "}
            <Link href="/vault/execution" className="font-semibold text-forest underline">
              {sw ? "Weka kwenye utekelezaji" : "Appoint on Execution"}
            </Link>
            {" · "}
            <Link href="/vault/trust" className="font-semibold text-forest underline">
              {sw ? "au rasimu ya amana" : "or the trust draft"}
            </Link>
          </p>
        )}
        <p className="mt-2 text-base text-muted">
          {sw ? "Sahihi zinazohitajika" : "Co-signatures required"}:{" "}
          <span className="font-semibold">{plan?.minCoSignApprovals || 2}</span>
        </p>
      </section>

      <form
        onSubmit={propose}
        className="space-y-4 rounded-[0.45rem] border-2 border-border bg-surface p-5 sm:p-7"
      >
        <h2 className="text-2xl font-semibold text-forest-deep">
          {sw ? "Injini ya makubaliano" : "Family consensus engine"}
        </h2>
        <p className="text-base text-muted">
          {sw
            ? "Marekebisho ya amana, uhamisho, au kuuza hisa hayajaandikwa mpaka watu wawili waidhinishe."
            : "Trust amendments, asset transfers, and share liquidations are not logged until two designated family representatives approve."}
        </p>
        <label className="field-label" htmlFor="kind">{sw ? "Aina" : "Action type"}</label>
        <select
          id="kind"
          className="field"
          value={kind}
          onChange={(e) => setKind(e.target.value as ConsensusProposalKind)}
        >
          <option value="amend_trust">{sw ? "Marekebisho ya amana" : "Trust amendment"}</option>
          <option value="liquidate_share">{sw ? "Kuuza hisa" : "Liquidate a share"}</option>
          <option value="transfer_asset">{sw ? "Kuhamisha shamba" : "Transfer an asset"}</option>
          <option value="execute_amendment">{sw ? "Kutekeleza marekebisho" : "Execute amendment"}</option>
        </select>
        <label className="field-label" htmlFor="pt">{sw ? "Kichwa" : "Proposal title"}</label>
        <input
          id="pt"
          className="field"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={sw ? "mf. Marekebisho ya amana ya Muiruri" : "e.g. Amend Muiruri land trust"}
        />
        <textarea
          className="field min-h-[5rem]"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder={sw ? "Maelezo" : "What must the family agree on?"}
        />
        <button type="submit" className="btn btn-primary">
          {sw ? "Pendekeza" : "Open for co-sign"}
        </button>
      </form>

      <ul className="space-y-4">
        {proposals.map((p) => (
          <li key={p.id} className="rounded-[0.45rem] border-2 border-border bg-surface p-5">
            <p className="text-lg font-semibold capitalize text-forest-deep">
              {p.kind.replace(/_/g, " ")} · {p.status}
            </p>
            <p className="mt-1 text-ink">{p.title}</p>
            {p.summary ? <p className="mt-1 text-muted">{p.summary}</p> : null}
            <p className="mt-2 text-base text-muted">
              {p.signatures.length}/{p.requiredApprovals}{" "}
              {sw ? "sahihi" : "signatures"}
              {p.signatures.length
                ? ` · ${p.signatures.map((s) => s.signerName).join(", ")}`
                : ""}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {p.status === "open" && (
                <>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => void post({ action: "sign", proposalId: p.id })}
                  >
                    {sw ? "Tia sahihi" : "Co-sign"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary-dark"
                    onClick={() => void post({ action: "reject", proposalId: p.id })}
                  >
                    {sw ? "Kataa" : "Reject"}
                  </button>
                </>
              )}
              {p.status === "approved" && (
                <button
                  type="button"
                  className="btn btn-brass"
                  onClick={() => void post({ action: "execute", proposalId: p.id })}
                >
                  {sw ? "Andika kitendo" : "Log the action"}
                </button>
              )}
            </div>
          </li>
        ))}
        {proposals.length === 0 && (
          <li className="text-muted">{sw ? "Hakuna mapendekezo bado." : "No proposals yet."}</li>
        )}
      </ul>

      <form
        onSubmit={openBuyout}
        className="space-y-4 rounded-[0.45rem] border-2 border-brass bg-surface p-5 sm:p-7"
      >
        <h2 className="text-2xl font-semibold text-forest-deep">
          {sw ? "Haki ya kwanza ya kununua" : "First right of refusal"}
        </h2>
        <p className="text-base text-muted">
          {sw
            ? "Mrithi anayetaka kuuza hisa yake lazima kwanza awape ndugu nafasi ya kununua ndani ya siku 14."
            : "If an heir wants to liquidate a share of family land, other family members may buy internally before any outside sale."}
        </p>
        <label className="field-label" htmlFor="seller">{sw ? "Anayeuzia" : "Selling heir"}</label>
        <select id="seller" className="field" value={sellerId} onChange={(e) => setSellerId(e.target.value)}>
          {heirs.map((h) => (
            <option key={h.id} value={h.id}>
              {h.fullName}
            </option>
          ))}
        </select>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="pct">{sw ? "Hisa %" : "Share %"}</label>
            <input id="pct" className="field" value={sharePercent} onChange={(e) => setSharePercent(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="ask">{sw ? "Bei (KES)" : "Asking price (KES)"}</label>
            <input id="ask" className="field" value={asking} onChange={(e) => setAsking(e.target.value)} required />
          </div>
        </div>
        <button type="submit" className="btn btn-primary" disabled={!sellerId}>
          {sw ? "Fungua dirisha la familia" : "Open family buyout window"}
        </button>
      </form>

      <ul className="space-y-4">
        {buyouts.map((o) => (
          <li key={o.id} className="rounded-[0.45rem] border-2 border-border bg-surface p-5">
            <p className="text-lg font-semibold capitalize text-forest-deep">
              {o.sharePercent}% · KES {o.askingPriceKes.toLocaleString()} · {o.status.replace(/_/g, " ")}
            </p>
            <p className="mt-1 text-muted">
              {sw ? "Dirisha linaisha" : "Window ends"} {new Date(o.windowEndsAt).toLocaleString()}
            </p>
            {o.status === "open" && (
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <select
                  className="field max-w-xs"
                  value={respondHeir}
                  onChange={(e) => setRespondHeir(e.target.value)}
                >
                  {heirs
                    .filter((h) => h.id !== o.sellerBeneficiaryId)
                    .map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.fullName}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() =>
                    void post({
                      action: "respond",
                      offerId: o.id,
                      beneficiaryId: respondHeir,
                      decision: "accept",
                      offerKes: o.askingPriceKes,
                    })
                  }
                >
                  {sw ? "Nunua ndani" : "Family buys"}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary-dark"
                  onClick={() =>
                    void post({
                      action: "respond",
                      offerId: o.id,
                      beneficiaryId: respondHeir,
                      decision: "decline",
                    })
                  }
                >
                  {sw ? "Kataa" : "Decline"}
                </button>
              </div>
            )}
            {o.responses.length > 0 && (
              <ul className="mt-3 text-base text-muted">
                {o.responses.map((r) => (
                  <li key={`${r.beneficiaryId}-${r.createdAt}`}>
                    {r.responderName}: {r.decision}
                    {r.offerKes != null ? ` · KES ${r.offerKes.toLocaleString()}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
