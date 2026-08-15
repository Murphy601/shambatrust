"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { useLocale } from "@/components/locale-provider";
import { KENYA_COUNTIES } from "@/lib/kenya-counties";
import { vaultCopy } from "@/lib/vault-copy";

type Uploaded = { documentName: string; documentPath: string } | null;
type Step = "contact" | "id" | "profile" | "code";

function SignupForm() {
  const { locale } = useLocale();
  const t = vaultCopy(locale);
  const router = useRouter();
  const search = useSearchParams();
  const sw = locale === "sw";

  const [step, setStep] = useState<Step>("contact");
  const [phone, setPhone] = useState(search.get("phone") || "");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"elder" | "agent">("elder");
  const [idFront, setIdFront] = useState<Uploaded>(null);
  const [idBack, setIdBack] = useState<Uploaded>(null);
  const [fullName, setFullName] = useState("");
  const [address, setAddress] = useState("");
  const [county, setCounty] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [phoneHint, setPhoneHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function uploadSlot(
    slot: string,
    file: File | null,
    setter: (u: Uploaded) => void,
  ) {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("slot", slot);
      const res = await fetch("/api/auth/signup/upload", {
        method: "POST",
        body,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Upload failed");
        return;
      }
      setter({ documentName: data.documentName, documentPath: data.documentPath });
    } finally {
      setUploading(false);
    }
  }

  function goContactNext(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!phone.trim()) {
      setError(sw ? "Weka nambari ya simu." : "Enter your phone number.");
      return;
    }
    if (role === "elder") setStep("id");
    else setStep("profile");
  }

  function goIdNext(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!idFront || !idBack) {
      setError(
        sw
          ? "Pakia kitambulisho mbele na nyuma."
          : "Upload both sides of your national ID.",
      );
      return;
    }
    setStep("profile");
  }

  async function requestCode(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!fullName.trim() || !address.trim() || !county.trim()) {
      setError(
        sw
          ? "Jaza jina, anwani, na kaunti."
          : "Fill in your name, address, and county.",
      );
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "signup",
          phone,
          email: email.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.redirectHint === "/login") {
          throw new Error(
            sw
              ? "Akaunti ipo. Ingia badala yake."
              : "Account already exists. Sign in instead.",
          );
        }
        throw new Error(data.error || "Failed");
      }
      setPhoneHint(data.phoneHint || null);
      setDevCode(data.devCode || null);
      setStep("code");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send code");
    } finally {
      setLoading(false);
    }
  }

  async function verify(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "signup",
          phone,
          email: email.trim() || "",
          code,
          fullName,
          role,
          address,
          county,
          idFrontName: idFront?.documentName,
          idFrontPath: idFront?.documentPath,
          idBackName: idBack?.documentName,
          idBackPath: idBack?.documentPath,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      router.push(data.redirectTo || "/vault");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not verify");
    } finally {
      setLoading(false);
    }
  }

  const steps: Step[] =
    role === "elder"
      ? ["contact", "id", "profile", "code"]
      : ["contact", "profile", "code"];
  const stepIndex = steps.indexOf(step);

  return (
    <div className="mx-auto max-w-lg">
      <Link
        href="/"
        className="text-base font-semibold text-forest underline-offset-4 hover:underline"
      >
        ← {t.backHome}
      </Link>
      <h1 className="mt-6 text-3xl font-semibold text-forest-deep sm:text-4xl">
        {t.signupTitle}
      </h1>
      <p className="mt-3 text-lg text-muted">{t.signupSubtitle}</p>

      <p className="mt-4 text-sm font-semibold text-muted">
        {sw ? "Hatua" : "Step"} {Math.max(stepIndex + 1, 1)} / {steps.length}
      </p>

      {step === "contact" && (
        <form
          onSubmit={goContactNext}
          className="mt-6 space-y-4 rounded-[0.45rem] border-2 border-border bg-surface p-5 sm:p-7"
        >
          <div>
            <label className="field-label" htmlFor="phone">
              {t.phoneLabel}
            </label>
            <input
              id="phone"
              className="field"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+2547…"
              inputMode="tel"
              required
            />
          </div>
          <div>
            <label className="field-label" htmlFor="email">
              {t.emailLabel}{" "}
              <span className="font-normal text-muted">({t.optional})</span>
            </label>
            <input
              id="email"
              type="email"
              className="field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              autoComplete="email"
            />
            <p className="mt-2 text-sm text-muted">{t.emailHint}</p>
          </div>
          <fieldset>
            <legend className="field-label">{t.roleLabel}</legend>
            <div className="grid gap-2">
              <label className="flex min-h-12 items-center gap-3 rounded-[0.35rem] border-2 border-border px-3">
                <input
                  type="radio"
                  name="role"
                  checked={role === "elder"}
                  onChange={() => setRole("elder")}
                />
                <span className="font-semibold">{t.roleElder}</span>
              </label>
              <label className="flex min-h-12 items-center gap-3 rounded-[0.35rem] border-2 border-border px-3">
                <input
                  type="radio"
                  name="role"
                  checked={role === "agent"}
                  onChange={() => setRole("agent")}
                />
                <span className="font-semibold">{t.roleAgent}</span>
              </label>
            </div>
          </fieldset>
          <p className="text-base text-muted">
            {sw ? "Tayari una akaunti?" : "Already have an account?"}{" "}
            <Link href="/login" className="font-semibold text-forest underline">
              {sw ? "Ingia" : "Sign in"}
            </Link>
          </p>
          {error && <p className="text-base font-medium text-[var(--danger)]">{error}</p>}
          <button type="submit" className="btn btn-primary w-full">
            {sw ? "Endelea" : "Continue"}
          </button>
        </form>
      )}

      {step === "id" && (
        <form
          onSubmit={goIdNext}
          className="mt-6 space-y-4 rounded-[0.45rem] border-2 border-border bg-surface p-5 sm:p-7"
        >
          <p className="text-base text-muted">{t.signupIdHint}</p>
          <div>
            <label className="field-label" htmlFor="idFront">
              {t.idFrontLabel}
            </label>
            <input
              id="idFront"
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="field"
              onChange={(e) =>
                void uploadSlot("id-front", e.target.files?.[0] || null, setIdFront)
              }
            />
            {idFront && (
              <p className="mt-1 text-sm font-medium text-forest">{idFront.documentName}</p>
            )}
          </div>
          <div>
            <label className="field-label" htmlFor="idBack">
              {t.idBackLabel}
            </label>
            <input
              id="idBack"
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="field"
              onChange={(e) =>
                void uploadSlot("id-back", e.target.files?.[0] || null, setIdBack)
              }
            />
            {idBack && (
              <p className="mt-1 text-sm font-medium text-forest">{idBack.documentName}</p>
            )}
          </div>
          {error && <p className="text-base font-medium text-[var(--danger)]">{error}</p>}
          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={uploading}
          >
            {uploading ? "…" : sw ? "Endelea" : "Continue"}
          </button>
          <button
            type="button"
            className="btn btn-secondary-dark w-full"
            onClick={() => {
              setStep("contact");
              setError(null);
            }}
          >
            {sw ? "Rudi" : "Back"}
          </button>
        </form>
      )}

      {step === "profile" && (
        <form
          onSubmit={requestCode}
          className="mt-6 space-y-4 rounded-[0.45rem] border-2 border-border bg-surface p-5 sm:p-7"
        >
          <div>
            <label className="field-label" htmlFor="fullName">
              {t.nameLabel}
            </label>
            <input
              id="fullName"
              className="field"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
              required
            />
          </div>
          <div>
            <label className="field-label" htmlFor="address">
              {t.addressLabel}
            </label>
            <textarea
              id="address"
              className="field min-h-24"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={t.addressPlaceholder}
              required
            />
          </div>
          <div>
            <label className="field-label" htmlFor="county">
              {t.countyLabel}
            </label>
            <select
              id="county"
              className="field"
              value={county}
              onChange={(e) => setCounty(e.target.value)}
              required
            >
              <option value="">{sw ? "Chagua kaunti" : "Select county"}</option>
              {KENYA_COUNTIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          {error && <p className="text-base font-medium text-[var(--danger)]">{error}</p>}
          <button type="submit" className="btn btn-primary w-full" disabled={loading}>
            {loading ? "…" : t.sendCode}
          </button>
          <button
            type="button"
            className="btn btn-secondary-dark w-full"
            onClick={() => {
              setStep(role === "elder" ? "id" : "contact");
              setError(null);
            }}
          >
            {sw ? "Rudi" : "Back"}
          </button>
        </form>
      )}

      {step === "code" && (
        <form
          onSubmit={verify}
          className="mt-6 space-y-4 rounded-[0.45rem] border-2 border-border bg-surface p-5 sm:p-7"
        >
          {phoneHint && (
            <p className="text-base text-muted">
              {sw ? "Thibitisha nambari" : "Verify phone"}{" "}
              <span className="font-semibold text-soil">{phoneHint}</span>
            </p>
          )}
          {devCode && (
            <p className="rounded-[0.35rem] border-2 border-brass bg-[color-mix(in_srgb,var(--brass)_12%,white)] px-4 py-3 text-lg font-semibold text-soil">
              {t.devHint}: <span className="tracking-widest">{devCode}</span>
            </p>
          )}
          <div>
            <label className="field-label" htmlFor="code">
              {t.codeLabel}
            </label>
            <input
              id="code"
              className="field tracking-[0.35em]"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              maxLength={6}
              required
            />
          </div>
          {error && <p className="text-base font-medium text-[var(--danger)]">{error}</p>}
          <button type="submit" className="btn btn-primary w-full" disabled={loading}>
            {loading ? "…" : t.signupVerify}
          </button>
          <button
            type="button"
            className="btn btn-secondary-dark w-full"
            onClick={() => {
              setStep("profile");
              setCode("");
              setDevCode(null);
              setError(null);
            }}
          >
            {sw ? "Rudi" : "Back"}
          </button>
        </form>
      )}
    </div>
  );
}

export default function SignupPage() {
  return (
    <div className="site-shell min-h-screen py-10">
      <div className="section">
        <Suspense fallback={<p className="text-lg">Loading…</p>}>
          <SignupForm />
        </Suspense>
      </div>
    </div>
  );
}
