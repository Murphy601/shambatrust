import { NextResponse } from "next/server";
import { z } from "zod";
import { requireVaultAccess } from "@/lib/vault-access";
import { getGroqApiKey, groqSpeak } from "@/lib/intake/groq";
import { GROQ_TTS_MAX_CHARS } from "@/lib/intake/prompt";

const schema = z.object({
  text: z.string().min(1).max(400),
});

export async function POST(request: Request) {
  const access = await requireVaultAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Nothing to read." }, { status: 400 });
  }

  const apiKey = await getGroqApiKey();
  if (!apiKey) {
    return NextResponse.json({ error: "Voice not configured." }, { status: 503 });
  }

  const audio = await groqSpeak({
    apiKey,
    text: parsed.data.text.slice(0, GROQ_TTS_MAX_CHARS),
  });
  if (!audio) {
    return NextResponse.json({ error: "Could not speak." }, { status: 502 });
  }

  return new NextResponse(new Uint8Array(audio), {
    headers: {
      "Content-Type": "audio/wav",
      "Cache-Control": "no-store",
    },
  });
}
