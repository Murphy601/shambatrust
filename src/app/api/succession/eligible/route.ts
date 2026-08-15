import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth/session";
import { phonesEqual } from "@/lib/auth/phone";
import { findUserById, readDb } from "@/lib/db/store";

/** Sealed vaults this phone may file succession against (trustee / heir / agent). */
export async function GET() {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const db = await readDb();
  const phone = session.phone;
  const eligible: Array<{
    vaultId: string;
    ownerName: string;
    status: string;
    reason: string;
  }> = [];

  for (const vault of db.vaults) {
    if (vault.status !== "sealed") continue;
    if (vault.ownerId === session.userId) continue;

    const plan = db.executionPlans.find((p) => p.vaultId === vault.id);
    const asTrustee = plan?.trustees.some((t) => phonesEqual(t.phone, phone));
    const asHeir = db.beneficiaries.some(
      (b) => b.vaultId === vault.id && phonesEqual(b.phone, phone),
    );
    const asAgent = db.agentLinks.some(
      (l) =>
        l.vaultId === vault.id &&
        l.status === "active" &&
        (l.agentUserId === session.userId || phonesEqual(l.agentPhone, phone)),
    );

    if (!asTrustee && !asHeir && !asAgent) continue;

    const owner = await findUserById(vault.ownerId);
    eligible.push({
      vaultId: vault.id,
      ownerName: owner?.fullName || "Vault owner",
      status: vault.status,
      reason: asTrustee ? "trustee" : asHeir ? "heir" : "agent",
    });
  }

  return NextResponse.json({ vaults: eligible });
}
