import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyOtp } from "@/lib/auth/otp";
import { normalizeKenyanPhone } from "@/lib/auth/phone";
import {
  createSessionToken,
  setSessionCookie,
} from "@/lib/auth/session";
import { ensureAdminUser } from "@/lib/db/store";
import { isOpsAdminPhone } from "@/lib/secure-docs/access";

const bodySchema = z.object({
  phone: z.string().min(9),
  code: z.string().min(4).max(8),
  fullName: z.string().optional(),
});

/** Ops desk login — not linked from the public site. Phone must be in OPS_ADMIN_PHONES. */
export async function POST(request: Request) {
  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const phone = normalizeKenyanPhone(parsed.data.phone);
    if (!phone) {
      return NextResponse.json(
        { error: "Use a valid Kenyan number (+2547…)." },
        { status: 400 },
      );
    }

    if (!isOpsAdminPhone(phone)) {
      return NextResponse.json(
        { error: "This number is not authorised for the operations desk." },
        { status: 403 },
      );
    }

    const result = await verifyOtp(phone, parsed.data.code, "login");
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const user = await ensureAdminUser({
      phone,
      fullName: parsed.data.fullName?.trim() || "ShambaTrust Ops",
    });

    const token = await createSessionToken({
      userId: user.id,
      phone: user.phone,
      role: "admin",
      fullName: user.fullName,
    });
    await setSessionCookie(token);

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        phone: user.phone,
        fullName: user.fullName,
        role: user.role,
      },
      redirectTo: "/ops",
    });
  } catch {
    return NextResponse.json({ error: "Could not verify code." }, { status: 500 });
  }
}
