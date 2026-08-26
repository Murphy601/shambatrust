"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLocale } from "@/components/locale-provider";
import { vaultCopy } from "@/lib/vault-copy";

const links = [
  { href: "/vault", key: "vault" as const },
  { href: "/vault/assets", key: "assets" as const },
  { href: "/vault/heirs", key: "heirs" as const },
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
    <div className="min-h-screen">
      <header className="border-b border-border bg-surface">
        <div className="section flex flex-wrap items-center justify-between gap-3 py-4">
          <div>
            <Link
              href="/vault"
              className="brand-font text-2xl font-semibold text-forest-deep"
            >
              ShambaTrust
            </Link>
            <p className="mt-1 text-base text-muted">
              {t.welcome}, <span className="font-semibold text-ink">{fullName}</span>
              {" · "}
              <span className="font-semibold text-forest">
                {asAgent ? t.agentBadge : t.ownerBadge}
              </span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={toggleLocale}
              className="min-h-11 rounded-[0.35rem] border-2 border-border bg-surface px-3 text-base font-semibold"
            >
              {locale === "en" ? "Kiswahili" : "English"}
            </button>
            <button
              type="button"
              onClick={logout}
              className="btn btn-secondary-dark min-h-11"
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
                    ? "bg-forest text-white"
                    : "border border-border bg-bg text-ink"
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
