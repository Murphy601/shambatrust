"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export function OpsShell({
  children,
  fullName,
}: {
  children: React.ReactNode;
  fullName: string;
}) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/ops/login");
    router.refresh();
  }

  const links = [
    ["/ops", "Overview"],
    ["/ops/elders", "Elders"],
    ["/ops/billing", "Billing"],
    ["/ops/title-lookups", "Titles"],
    ["/ops/advocates", "Applications"],
    ["/ops/advocates-crm", "CRM"],
    ["/ops/succession", "Succession"],
    ["/ops/retention", "Retention"],
    ["/ops/activity", "Activity"],
  ] as const;

  return (
    <div className="min-h-screen bg-[#0f1411] text-[#f4f1ea]">
      <header className="border-b border-[#3d4a40] bg-[#121a16]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#d4a574]">
              Internal · Phase 6
            </p>
            <Link href="/ops" className="text-2xl font-semibold text-[#e8efe9]">
              ShambaTrust Ops
            </Link>
            <p className="mt-1 text-sm text-[#9aa89c]">
              Desk: <span className="font-semibold text-[#e8efe9]">{fullName}</span>
            </p>
          </div>
          <nav className="flex flex-wrap gap-2">
            {links.map(([href, label]) => (
              <Link
                key={href}
                href={href}
                className="rounded border border-[#3d4a40] px-3 py-2 text-sm font-semibold hover:border-[#d4a574]"
              >
                {label}
              </Link>
            ))}
            <button
              type="button"
              onClick={logout}
              className="rounded bg-[#2f5d45] px-3 py-2 text-sm font-semibold text-white"
            >
              Sign out
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
