import { NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/secure-docs/access";
import {
  findUserById,
  getVaultById,
  listAllTitleLookups,
} from "@/lib/db/store";

export async function GET() {
  const access = await requireAdminAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  const lookups = await listAllTitleLookups();
  const enriched = await Promise.all(
    lookups.map(async (l) => {
      const requester = await findUserById(l.requestedByUserId);
      const vault = await getVaultById(l.vaultId);
      const owner = vault ? await findUserById(vault.ownerId) : null;
      return {
        ...l,
        requesterName: requester?.fullName || l.requestedByUserId,
        requesterRole: requester?.role || null,
        ownerName: owner?.fullName || null,
      };
    }),
  );
  const totalKes = enriched.reduce((s, l) => s + l.costKes, 0);
  return NextResponse.json({ lookups: enriched, totalKes });
}
