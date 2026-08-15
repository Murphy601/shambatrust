import { NextResponse } from "next/server";
import { z } from "zod";
import { issueOtp, isDevAuthMode } from "@/lib/auth/otp";
import { normalizeKenyanPhone } from "@/lib/auth/phone";
import {
  findUserByEmail,
  findUserByIdentifier,
  findUserByPhone,
} from "@/lib/db/store";

const bodySchema = z.object({
  phone: z.string().optional(),
  email: z.string().optional(),
  /** login = existing account only; signup = new phone must not exist */
  mode: z.enum(["login", "signup"]).optional(),
  purpose: z.enum(["login", "elder_confirm", "succession_confirm"]).optional(),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const mode = parsed.data.mode; // undefined = legacy phone OTP (ops / advocate / succession)
    const phoneRaw = parsed.data.phone?.trim() || "";
    const emailRaw = parsed.data.email?.trim().toLowerCase() || "";

    if (!phoneRaw && !emailRaw) {
      return NextResponse.json(
        { error: "Enter a phone number or email." },
        { status: 400 },
      );
    }

    let phone: string | null = null;

    if (mode === "signup") {
      if (!phoneRaw) {
        return NextResponse.json(
          { error: "Phone number is required to create an account." },
          { status: 400 },
        );
      }
      phone = normalizeKenyanPhone(phoneRaw);
      if (!phone) {
        return NextResponse.json(
          { error: "Use a valid Kenyan number (+2547…)." },
          { status: 400 },
        );
      }
      const existing = await findUserByPhone(phone);
      if (existing) {
        return NextResponse.json(
          {
            error: "This phone already has an account. Sign in instead.",
            redirectHint: "/login",
          },
          { status: 409 },
        );
      }
      if (emailRaw) {
        const emailTaken = await findUserByEmail(emailRaw);
        if (emailTaken) {
          return NextResponse.json(
            { error: "That email is already registered. Sign in instead." },
            { status: 409 },
          );
        }
      }
    } else if (mode === "login") {
      const user = await findUserByIdentifier({
        phone: phoneRaw || null,
        email: emailRaw || null,
      });
      if (!user) {
        return NextResponse.json(
          {
            error: "No account found. Create one to get started.",
            redirectHint: "/signup",
          },
          { status: 404 },
        );
      }
      phone = user.phone;
    } else {
      // Legacy: phone required, no account check (ops bootstrap, advocate portal, etc.)
      if (!phoneRaw) {
        return NextResponse.json(
          { error: "Phone number is required." },
          { status: 400 },
        );
      }
      phone = normalizeKenyanPhone(phoneRaw);
      if (!phone) {
        return NextResponse.json(
          { error: "Use a valid Kenyan number (+2547…)." },
          { status: 400 },
        );
      }
    }

    if (!phone) {
      return NextResponse.json(
        { error: "Could not resolve phone for OTP." },
        { status: 400 },
      );
    }

    const purpose = parsed.data.purpose || "login";
    const { code, expiresAt } = await issueOtp(phone, purpose);

    const payload: Record<string, unknown> = {
      ok: true,
      phone,
      phoneHint: `${phone.slice(0, 4)}••••${phone.slice(-3)}`,
      expiresAt,
      message: isDevAuthMode()
        ? "Dev mode: use the code shown below (SMS provider not connected yet)."
        : "A 6-digit code was sent to your phone.",
    };

    if (isDevAuthMode()) {
      payload.devCode = code;
    }

    return NextResponse.json(payload);
  } catch {
    return NextResponse.json({ error: "Could not send code." }, { status: 500 });
  }
}
