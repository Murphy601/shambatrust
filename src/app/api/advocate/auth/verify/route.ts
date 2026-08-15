import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyOtp } from "@/lib/auth/otp";
import { normalizeKenyanPhone } from "@/lib/auth/phone";
import {
  createSessionToken,
  setSessionCookie,
} from "@/lib/auth/session";
import { findApprovedAdvocate } from "@/lib/db/store";

const schema = z.object({
  phone: z.string().min(9),
  code: z.string().min(4).max(8),
  lskNumber: z.string().min(3),
});

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Phone, code, and LSK practising number are required." },
        { status: 400 },
      );
    }

    const phone = normalizeKenyanPhone(parsed.data.phone);
    if (!phone) {
      return NextResponse.json(
        { error: "Use a valid Kenyan number (+2547…)." },
        { status: 400 },
      );
    }

    const otp = await verifyOtp(phone, parsed.data.code, "login");
    if (!otp.ok) {
      return NextResponse.json({ error: otp.error }, { status: 400 });
    }

    const user = await findApprovedAdvocate(phone, parsed.data.lskNumber);
    if (!user) {
      return NextResponse.json(
        {
          error:
            "This number is not authorised for the advocate portal. Apply on the public site, or wait for admin approval.",
        },
        { status: 403 },
      );
    }

    const token = await createSessionToken({
      userId: user.id,
      phone: user.phone,
      role: user.role,
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
      redirectTo: "/advocate",
    });
  } catch {
    return NextResponse.json({ error: "Could not verify." }, { status: 500 });
  }
}
