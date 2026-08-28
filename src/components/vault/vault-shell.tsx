"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLocale } from "@/components/locale-provider";
import { vaultCopy } from "@/lib/vault-copy";

const links = [
          { href: "/vault", key: "vault" as const },
          { href: "/vault/assets", key: "assets" as const },
          { href: "/vault/heirs", key: "heirs" as const },
          { href: "/vault/houses", key: "houses" as const },
          { href: "/vault/will", key: "will" as const },
          { href: "/vault/trust", key: "trust" as const },
          { href: "/vault/wishes", key: "wishes" as const },
          { href: "/vault/diaspora", key: "diaspora" as const },
          { href: "/vault/governance", key: "governance" as const },
          { href: "/vault/testament", key: "testament" as const },
  { href: "/vault/agent", key: "agent" as const },
  { href: "/vault/review", key: "review" as const },
  { href: "/vault/execution", key: "execution" as const },
  { href: "/vault/succession", key: "succession" as const },
  { href: "/vault/released", key: "released" as const },
];

export function VaultShell({
  children,
  fullName,
  asAgent,
}: {
  children: React.ReactNode;
  fullName: string;
  asAgent: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { locale, toggleLocale } = useLocale();
  const t = vaultCopy(locale);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <header className="border-b border-[#0B1D3A] bg-[#0B1D3A] text-white print:hidden">
        <div className="section flex flex-wrap items-center justify-between gap-3 py-4">
          <div>
            <Link
              href="/vault"
              className="brand-font text-2xl font-semibold text-white"
            >
              ShambaTrust
            </Link>
            <p className="mt-1 text-base text-slate-300">
              {t.welcome}, <span className="font-semibold text-white">{fullName}</span>
              {" · "}
              <span className="font-semibold text-[#D4AF37]">
                {asAgent ? t.agentBadge : t.ownerBadge}
              </span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
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
              className="min-h-11 rounded-[0.35rem] border border-white/25 px-4 text-base font-semibold text-white hover:border-[#D4AF37]"
            >
              {t.logout}
            </button>
          </div>
        </div>
        <nav className="section flex gap-2 overflow-x-auto pb-3">
          {links.map((link) => {
            const active =
              link.href === "/vault"
                ? pathname === "/vault"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`whitespace-nowrap rounded-[0.35rem] px-3 py-2 text-base font-semibold ${
                  active
                    ? "bg-[#1E5631] text-white"
                    : "border border-white/20 bg-[#0B1D3A] text-slate-100 hover:border-[#D4AF37]"
                }`}
              >
                {t[link.key]}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="section py-8">{children}</main>
    </div>
  );
}
