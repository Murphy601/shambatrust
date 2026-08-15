import { SignJWT, jwtVerify } from "jose";

function getSecret(): Uint8Array {
  const secret =
    process.env.AUTH_SECRET || "shambatrust-dev-secret-change-me-in-production";
  return new TextEncoder().encode(secret);
}

/** Short-lived signed token — works across Next.js route isolates (unlike in-memory Maps). */
export async function issueViewToken(userId: string): Promise<string> {
  return new SignJWT({ purpose: "doc_view", userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(getSecret());
}

export async function validateViewToken(
  token: string,
  userId: string,
): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return (
      payload.purpose === "doc_view" && String(payload.userId) === userId
    );
  } catch {
    return false;
  }
}
