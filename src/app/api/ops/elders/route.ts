import { NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/secure-docs/access";
import { getLatestVaultBinder, searchEldersVaults } from "@/lib/db/store";

export async function GET(request: Request) {
  const access = await requireAdminAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  const q = new URL(request.url).searchParams.get("q") || "";
  const results = await searchEldersVaults(q);
  const enriched = await Promise.all(
    results.map(async ({ user, vault }) => {
      const binder = vault ? await getLatestVaultBinder(vault.id) : null;
      return {
        id: user.id,
        fullName: user.fullName,
        phone: user.phone,
        createdAt: user.createdAt,
        vaultId: vault?.id || null,
        vaultStatus: vault?.status || null,
        packageTier: vault?.packageTier || null,
        forceLocked: vault?.forceLocked || false,
        opsNotes: vault?.opsNotes || "",
        amendmentOpen: vault?.amendmentOpen || false,
        binderStatus: binder?.status || null,
        binderVersion: binder?.version || null,
      };
    }),
  );
  return NextResponse.json({ results: enriched });
}
