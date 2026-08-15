import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth/session";
import { getVaultForUser } from "@/lib/db/store";

export async function GET() {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  const access = await getVaultForUser(session.userId);
  return NextResponse.json({
    user: session,
    vault: access
      ? {
          id: access.vault.id,
          status: access.vault.status,
          packageTier: access.vault.packageTier,
          asAgent: access.asAgent,
        }
      : null,
  });
}
