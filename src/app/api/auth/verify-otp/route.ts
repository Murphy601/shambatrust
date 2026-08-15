import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyOtp } from "@/lib/auth/otp";
import { normalizeKenyanPhone } from "@/lib/auth/phone";
import {
  createSessionToken,
  setSessionCookie,
} from "@/lib/auth/session";
import {
  activateAgentLinksForUser,
  createUser,
  findUserByEmail,
  findUserByIdentifier,
  findUserByPhone,
} from "@/lib/db/store";

const loginSchema = z.object({
  mode: z.literal("login").optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  code: z.string().min(4).max(8),
});

const signupSchema = z.object({
  mode: z.literal("signup"),
  phone: z.string().min(9),
  code: z.string().min(4).max(8),
  email: z.union([z.string().email(), z.literal("")]).optional(),
  fullName: z.string().min(2),
  role: z.enum(["elder", "agent"]).optional(),
  address: z.string().min(3),
  county: z.string().min(2),
  idFrontName: z.string().min(1).optional(),
  idFrontPath: z.string().min(1).optional(),
  idBackName: z.string().min(1).optional(),
  idBackPath: z.string().min(1).optional(),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const isSignup = json?.mode === "signup";

    if (isSignup) {
      return handleSignup(json);
    }
    return handleLogin(json);
  } catch (e) {
    const message =
      e instanceof Error && e.message.includes("email")
        ? e.message
        : "Could not verify code.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function handleLogin(json: unknown) {
  const parsed = loginSchema.safeParse(json);
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

  let user = await findUserByIdentifier({
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

  const result = await verifyOtp(user.phone, parsed.data.code, "login");
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // Re-fetch after OTP in case of concurrent updates
  user = (await findUserByPhone(user.phone)) || user;

  if (user.role === "advocate") {
    return NextResponse.json(
      {
        error:
          "Advocates sign in at the advocate portal with phone OTP and LSK number.",
        redirectHint: "/advocate/login",
      },
      { status: 403 },
    );
  }

  if (!user.profileComplete && (user.role === "elder" || user.role === "agent")) {
    return NextResponse.json(
      {
        error: "Finish creating your account first.",
        redirectHint: "/signup",
      },
      { status: 403 },
    );
  }

  if (user.role !== "admin") {
    await activateAgentLinksForUser(user);
    user = (await findUserByPhone(user.phone)) || user;
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
    redirectTo: user.role === "admin" ? "/ops" : "/vault",
  });
}

async function handleSignup(json: unknown) {
  const parsed = signupSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Fill in all required signup details." },
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

  const role = parsed.data.role || "elder";
  if (role === "elder") {
    if (
      !parsed.data.idFrontName ||
      !parsed.data.idFrontPath ||
      !parsed.data.idBackName ||
      !parsed.data.idBackPath
    ) {
      return NextResponse.json(
        { error: "Upload both sides of your national ID." },
        { status: 400 },
      );
    }
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

  const email = parsed.data.email?.trim().toLowerCase() || null;
  if (email) {
    const emailTaken = await findUserByEmail(email);
    if (emailTaken) {
      return NextResponse.json(
        { error: "That email is already registered. Sign in instead." },
        { status: 409 },
      );
    }
  }

  const result = await verifyOtp(phone, parsed.data.code, "login");
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  let user;
  try {
    user = await createUser({
      phone,
      email,
      fullName: parsed.data.fullName.trim(),
      role,
      address: parsed.data.address.trim(),
      county: parsed.data.county.trim(),
      idFrontName: parsed.data.idFrontName || null,
      idFrontPath: parsed.data.idFrontPath || null,
      idBackName: parsed.data.idBackName || null,
      idBackPath: parsed.data.idBackPath || null,
      profileComplete: true,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not create account." },
      { status: 400 },
    );
  }

  if (user.role !== "admin") {
    await activateAgentLinksForUser(user);
    user = (await findUserByPhone(phone)) || user;
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
    redirectTo: "/vault",
  });
}
