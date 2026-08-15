import { readSession, type SessionPayload } from "@/lib/auth/session";
import { isOpsAdminPhone } from "@/lib/secure-docs/access";

export async function requireOpsAccess(): Promise<
  | { ok: true; session: SessionPayload }
  | { ok: false; status: number; error: string }
> {
  const session = await readSession();
  if (!session) {
    return { ok: false, status: 401, error: "Sign in required." };
  }
  if (session.role !== "admin" || !isOpsAdminPhone(session.phone)) {
    return {
      ok: false,
      status: 403,
      error: "Operations desk access only.",
    };
  }
  return { ok: true, session };
}
