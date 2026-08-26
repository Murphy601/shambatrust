"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useLocale } from "@/components/locale-provider";
import { advocateCopy } from "@/lib/advocate-copy";

export function AdvocateShell({
  children,
  fullName,
}: {
  children: React.ReactNode;
  fullName: string;
}) {
  const { locale, toggleLocale } = useLocale();
  const t = advocateCopy(locale);
  const router = useRouter();
  const [ooo, setOoo] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/advocate/profile");
      if (!res.ok) return;
      const json = await res.json();
      const until = json.profile?.advocateOooUntil;
      setOoo(Boolean(until && new Date(until).getTime() > Date.now()));
    })();
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/advocate/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-[#F1F5F9] text-[#0F172A]">
      <header className="border-b border-[#0F172A] bg-[#0F172A] text-white">
        <div className="section flex flex-wrap items-center justify-between gap-3 py-4">
          <div>
            <Link
              href="/advocate"
              className="brand-font text-2xl font-semibold text-white"
            >
              ShambaTrust · {t.portalTitle}
            </Link>
            <p className="mt-1 text-base text-slate-300">
              {t.welcome},{" "}
              <span className="font-semibold text-white">{fullName}</span>
              {ooo ? (
                <span className="ml-2 rounded bg-amber-400/20 px-2 py-0.5 text-sm font-semibold text-amber-300">
                  OOO
                </span>
              ) : null}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/advocate/queue" className="rounded bg-[#0284C7] px-4 py-2 text-base font-semibold text-white">
              Queue
            </Link>
            <Link
              href="/advocate/calendar"
              className="rounded border border-white/25 px-4 py-2 text-base font-semibold text-white"
            >
              Calendar
            </Link>
            <Link
              href="/advocate/succession"
              className="rounded border border-white/25 px-4 py-2 text-base font-semibold text-white"
            >
              Succession
            </Link>
            <Link
              href="/advocate/profile"
              className="rounded border border-white/25 px-4 py-2 text-base font-semibold text-white"
            >
              Profile
            </Link>
            <button
              type="button"
              onClick={toggleLocale}
              className="min-h-11 rounded-[0.35rem] border border-white/25 px-3 text-base font-semibold text-white"
            >
              {locale === "en" ? "Kiswahili" : "English"}
            </button>
            <button
              type="button"
              onClick={logout}
              className="min-h-11 rounded-[0.35rem] border border-white/25 px-4 text-base font-semibold text-white"
            >
              {t.logout}
            </button>
          </div>
        </div>
      </header>
      <main className="section py-8">{children}</main>
    </div>
  );
}
