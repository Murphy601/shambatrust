import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeKenyanPhone } from "@/lib/auth/phone";
import { findUserByIdentifier } from "@/lib/db/store";

const bodySchema = z.object({
  phone: z.string().optional(),
  email: z.string().optional(),
});

/** Check whether a phone or email already has an account (for login vs signup). */
export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const phoneRaw = parsed.data.phone?.trim() || "";
    const emailRaw = parsed.data.email?.trim() || "";
    if (!phoneRaw && !emailRaw) {
      return NextResponse.json(
        { error: "Enter a phone number or email." },
        { status: 400 },
      );
    }

    if (phoneRaw) {
      const phone = normalizeKenyanPhone(phoneRaw);
      if (!phone) {
        return NextResponse.json(
          { error: "Use a valid Kenyan number (+2547…)." },
          { status: 400 },
        );
      }
    }

    const user = await findUserByIdentifier({
      phone: phoneRaw || null,
      email: emailRaw || null,
    });

    if (!user) {
      return NextResponse.json({
        exists: false,
        needsSignup: true,
      });
    }

    if (user.role === "advocate") {
      return NextResponse.json({
        exists: true,
        role: user.role,
        redirectHint: "/advocate/login",
        needsSignup: false,
      });
    }

    return NextResponse.json({
      exists: true,
      role: user.role,
      profileComplete: user.profileComplete,
      needsSignup: !user.profileComplete,
      /** Masked phone so UI can confirm OTP destination without exposing full number on email login */
      phoneHint: maskPhone(user.phone),
    });
  } catch {
    return NextResponse.json({ error: "Lookup failed." }, { status: 500 });
  }
}

function maskPhone(phone: string): string {
  if (phone.length < 6) return phone;
  return `${phone.slice(0, 4)}••••${phone.slice(-3)}`;
}
