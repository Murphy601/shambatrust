import { readSession, type SessionPayload } from "@/lib/auth/session";

export async function requireAdvocateAccess(): Promise<
  | { ok: true; session: SessionPayload }
  | { ok: false; status: number; error: string }
> {
  const session = await readSession();
  if (!session) {
    return { ok: false, status: 401, error: "Sign in required." };
  }
  if (session.role !== "advocate") {
    return {
      ok: false,
      status: 403,
      error: "Advocate access only. Sign in with an advocate account.",
    };
  }
  return { ok: true, session };
}
