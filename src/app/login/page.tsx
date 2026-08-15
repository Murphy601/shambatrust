"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { useLocale } from "@/components/locale-provider";
import { vaultCopy } from "@/lib/vault-copy";

function LoginForm() {
  const { locale } = useLocale();
  const t = vaultCopy(locale);
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") || "/vault";
  const sw = locale === "sw";

  const [step, setStep] = useState<"identifier" | "code">("identifier");
  const [identifier, setIdentifier] = useState("");
  const [resolvedPhone, setResolvedPhone] = useState("");
  const [phoneHint, setPhoneHint] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function parseIdentifier(raw: string): { phone?: string; email?: string } {
    const value = raw.trim();
    if (value.includes("@")) return { email: value };
    return { phone: value };
  }

  async function requestCode(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const body = parseIdentifier(identifier);
      const res = await fetch("/api/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, mode: "login" }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.redirectHint === "/signup") {
          throw new Error(
            sw
              ? "Hakuna akaunti. Unda akaunti kwanza."
              : "No account found. Create one to get started.",
          );
        }
        throw new Error(data.error || "Failed");
      }
      setResolvedPhone(data.phone || "");
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
      const body = parseIdentifier(identifier);
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "login",
          ...body,
          phone: body.phone || resolvedPhone || undefined,
          code,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      const dest =
        data.redirectTo ||
        (data.user?.role === "advocate" ? "/advocate" : next);
      router.push(dest);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not verify");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <Link
        href="/"
        className="text-base font-semibold text-forest underline-offset-4 hover:underline"
      >
        ← {t.backHome}
      </Link>
      <h1 className="mt-6 text-3xl font-semibold text-forest-deep sm:text-4xl">
        {t.loginTitle}
      </h1>
      <p className="mt-3 text-lg text-muted">{t.loginSubtitle}</p>

      {step === "identifier" ? (
        <form
          onSubmit={requestCode}
          className="mt-8 space-y-4 rounded-[0.45rem] border-2 border-border bg-surface p-5 sm:p-7"
        >
          <div>
            <label className="field-label" htmlFor="identifier">
              {t.loginIdentifierLabel}
            </label>
            <input
              id="identifier"
              className="field"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder={t.loginIdentifierPlaceholder}
              autoComplete="username"
              required
            />
            <p className="mt-2 text-sm text-muted">{t.loginIdentifierHint}</p>
          </div>
          <p className="text-base text-muted">
            {sw ? "Mpya?" : "New here?"}{" "}
            <Link href="/signup" className="font-semibold text-forest underline">
              {sw ? "Unda akaunti" : "Create an account"}
            </Link>
          </p>
          <p className="text-base text-muted">
            {sw ? "Wakili?" : "Advocate?"}{" "}
            <Link href="/advocates/apply" className="font-semibold text-forest underline">
              {sw ? "Omba kujiunga" : "Apply to join"}
            </Link>
            {" · "}
            <Link href="/advocate/login" className="font-semibold text-forest underline">
              {sw ? "Ingia lango" : "Portal login"}
            </Link>
          </p>
          {error && (
            <p className="text-base font-medium text-[var(--danger)]">
              {error}{" "}
              {error.toLowerCase().includes("account") ||
              error.toLowerCase().includes("akaunti") ? (
                <Link href="/signup" className="underline">
                  {sw ? "Unda akaunti" : "Sign up"}
                </Link>
              ) : null}
            </p>
          )}
          <button type="submit" className="btn btn-primary w-full" disabled={loading}>
            {loading ? "…" : t.sendCode}
          </button>
        </form>
      ) : (
        <form
          onSubmit={verify}
          className="mt-8 space-y-4 rounded-[0.45rem] border-2 border-border bg-surface p-5 sm:p-7"
        >
          {phoneHint && (
            <p className="text-base text-muted">
              {sw ? "Msimbo umetumwa kwa" : "Code sent to"}{" "}
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
            {loading ? "…" : t.verify}
          </button>
          <button
            type="button"
            className="btn btn-secondary-dark w-full"
            onClick={() => {
              setStep("identifier");
              setCode("");
              setDevCode(null);
              setError(null);
            }}
          >
            {sw ? "Badilisha" : "Change"}
          </button>
        </form>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="site-shell min-h-screen py-10">
      <div className="section">
        <Suspense fallback={<p className="text-lg">Loading…</p>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
