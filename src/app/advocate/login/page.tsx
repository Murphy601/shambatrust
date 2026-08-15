"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export default function AdvocateLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [lskNumber, setLskNumber] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function requestCode(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
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
      const res = await fetch("/api/advocate/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code, lskNumber }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      router.push("/advocate");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not verify");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0c1210] px-4 text-[#f4f1ea]">
      <div className="w-full max-w-md rounded border border-[#3d4a40] bg-[#121a16] p-6 shadow-[0_0_0_1px_rgba(212,165,116,0.12)]">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#d4a574]">
          Partner advocate portal
        </p>
        <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight">
          ShambaTrust Advocates
        </h1>
        <p className="mt-2 text-sm text-[#9aa89c]">
          Approved LSK advocates only. Phone OTP + practising number.
        </p>

        {step === "phone" ? (
          <form onSubmit={requestCode} className="mt-6 space-y-3">
            <label className="block text-sm font-semibold">
              Phone
              <input
                className="mt-1 w-full rounded border border-[#3d4a40] bg-[#0f1411] px-3 py-3 text-base"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+2547…"
                required
              />
            </label>
            {error && <p className="text-sm text-[#e07a5f]">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded bg-[#2f5d45] px-3 py-3 font-semibold text-white"
            >
              {loading ? "…" : "Send code"}
            </button>
          </form>
        ) : (
          <form onSubmit={verify} className="mt-6 space-y-3">
            {devCode && (
              <p className="rounded border border-[#d4a574]/40 bg-[#d4a574]/10 px-3 py-2 text-sm">
                Dev code: <strong className="tracking-widest">{devCode}</strong>
              </p>
            )}
            <label className="block text-sm font-semibold">
              6-digit code
              <input
                className="mt-1 w-full rounded border border-[#3d4a40] bg-[#0f1411] px-3 py-3 text-base tracking-[0.3em]"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                maxLength={6}
                required
              />
            </label>
            <label className="block text-sm font-semibold">
              LSK practising number
              <input
                className="mt-1 w-full rounded border border-[#3d4a40] bg-[#0f1411] px-3 py-3 text-base"
                value={lskNumber}
                onChange={(e) => setLskNumber(e.target.value)}
                placeholder="P.105/XXXX/XX"
                required
              />
            </label>
            {error && <p className="text-sm text-[#e07a5f]">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded bg-[#2f5d45] px-3 py-3 font-semibold text-white"
            >
              {loading ? "…" : "Enter advocate portal"}
            </button>
            <button
              type="button"
              className="w-full text-sm text-[#9aa89c] underline"
              onClick={() => {
                setStep("phone");
                setCode("");
                setError(null);
              }}
            >
              Change phone
            </button>
          </form>
        )}

        <p className="mt-6 text-sm text-[#9aa89c]">
          Not approved yet?{" "}
          <Link href="/advocates/apply" className="font-semibold text-[#d4a574] underline">
            Apply to join
          </Link>
        </p>
      </div>
    </div>
  );
}
