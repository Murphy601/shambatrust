import { NextResponse } from "next/server";
import { z } from "zod";
import { requireVaultAccess } from "@/lib/vault-access";
import { vaultContentLocked } from "@/lib/vault-lock";
import { findUserById, listAssets, listBeneficiaries } from "@/lib/db/store";
import { detectSwahili, mergeIntakeDraft, parseOcrText, sanitizeDraft } from "@/lib/intake/extract";
import { getGroqApiKey, groqIntakeTurn } from "@/lib/intake/groq";
import { seedIntakeDraft } from "@/lib/intake/seed";
import {
  guidedTurn,
  intakeStepFromDraft,
  isReadyToSubmit,
  openingGreeting,
} from "@/lib/intake/fallback";
import type { IntakeChatMessage } from "@/lib/intake/types";

const schema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(4000),
      }),
    )
    .max(24)
    .default([]),
  draft: z.unknown().optional(),
  locale: z.enum(["en", "sw"]).optional(),
  ocrText: z.string().max(8000).optional(),
});

export async function GET(request: Request) {
  const access = await requireVaultAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  const localeParam = new URL(request.url).searchParams.get("locale");
  const [owner, assets, beneficiaries] = await Promise.all([
    findUserById(access.vault.ownerId),
    listAssets(access.vault.id),
    listBeneficiaries(access.vault.id),
  ]);
  const locale =
    localeParam === "sw" || localeParam === "en"
      ? localeParam
      : owner?.locale === "sw"
        ? "sw"
        : "en";
  const draft = seedIntakeDraft({
    owner,
    vault: access.vault,
    assets,
    beneficiaries,
  });
  const groqConfigured = Boolean(await getGroqApiKey());
  return NextResponse.json({
    draft,
    greeting: openingGreeting(locale),
    step: intakeStepFromDraft(draft),
    readyToSubmit: isReadyToSubmit(draft) && intakeStepFromDraft(draft) === 5,
    groqConfigured,
    locked: vaultContentLocked(access.vault),
    asAgent: access.asAgent,
    locale,
  });
}

export async function POST(request: Request) {
  const access = await requireVaultAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Check the message." }, { status: 400 });
  }
  const locale = parsed.data.locale === "sw" ? "sw" : "en";
  const lastUser = [...parsed.data.messages]
    .reverse()
    .find((m) => m.role === "user");
  const utterance = lastUser?.content || "";
  let draft = sanitizeDraft(parsed.data.draft);
  if (parsed.data.ocrText) {
    draft = mergeIntakeDraft(draft, parseOcrText(parsed.data.ocrText));
  }

  const guided = guidedTurn({
    draft,
    utterance,
    ocrText: parsed.data.ocrText,
    locale: detectSwahili(utterance) ? "sw" : locale,
  });

  const apiKey = await getGroqApiKey();
  if (apiKey) {
    const groq = await groqIntakeTurn({
      draft: guided.draft,
      messages: parsed.data.messages as IntakeChatMessage[],
      locale: detectSwahili(utterance) ? "sw" : locale,
      apiKey,
    });
    if (groq) {
      const merged = mergeIntakeDraft(guided.draft, groq.draftPatch);
      return NextResponse.json({
        reply: groq.reply,
        draft: merged,
        step: intakeStepFromDraft(merged),
        readyToSubmit: groq.readyToSubmit || isReadyToSubmit(merged),
        engine: "groq",
      });
    }
  }

  return NextResponse.json(guided);
}
