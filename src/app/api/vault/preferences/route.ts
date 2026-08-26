import { NextResponse } from "next/server";
import { z } from "zod";
import { readSession } from "@/lib/auth/session";
import { findUserById, updateUserPreferences } from "@/lib/db/store";
import { SPOKEN_LANGUAGE_CODES } from "@/lib/languages";

const schema = z.object({
  locale: z.enum(["en", "sw"]).optional(),
  preferredLanguage: z
    .enum(SPOKEN_LANGUAGE_CODES as [string, ...string[]])
    .optional(),
  audioGuidance: z.boolean().optional(),
});

export async function GET() {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const user = await findUserById(session.userId);
  if (!user) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }
  return NextResponse.json({
    preferences: {
      locale: user.locale,
      preferredLanguage: user.preferredLanguage,
      audioGuidance: user.audioGuidance,
    },
  });
}

export async function PATCH(request: Request) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Check the language settings." },
      { status: 400 },
    );
  }

  const user = await updateUserPreferences({
    userId: session.userId,
    locale: parsed.data.locale,
    preferredLanguage: parsed.data.preferredLanguage as
      | (typeof SPOKEN_LANGUAGE_CODES)[number]
      | undefined,
    audioGuidance: parsed.data.audioGuidance,
  });
  if (!user) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  return NextResponse.json({
    preferences: {
      locale: user.locale,
      preferredLanguage: user.preferredLanguage,
      audioGuidance: user.audioGuidance,
    },
  });
}
