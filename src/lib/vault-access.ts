import { readSession } from "@/lib/auth/session";
import { getVaultForUser } from "@/lib/db/store";
import type { Vault } from "@/lib/db/types";
import type { SessionPayload } from "@/lib/auth/session";

export async function requireVaultAccess(): Promise<
  | { ok: true; session: SessionPayload; vault: Vault; asAgent: boolean }
  | { ok: false; status: number; error: string }
> {
  const session = await readSession();
  if (!session) return { ok: false, status: 401, error: "Sign in required." };

  const access = await getVaultForUser(session.userId);
  if (!access) {
    return {
      ok: false,
      status: 404,
      error: "No vault found. Sign in as the elder owner, or accept an Agent invite.",
    };
  }

  return {
    ok: true,
    session,
    vault: access.vault,
    asAgent: access.asAgent,
  };
}
