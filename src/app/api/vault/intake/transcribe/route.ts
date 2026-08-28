import { NextResponse } from "next/server";
import { requireVaultAccess } from "@/lib/vault-access";
import { audioExtension, baseMimeType } from "@/lib/audio";
import { getGroqApiKey, groqTranscribeAudio } from "@/lib/intake/groq";

const MAX_ANSWER_BYTES = 8 * 1024 * 1024;

export async function POST(request: Request) {
  const access = await requireVaultAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const apiKey = await getGroqApiKey();
  if (!apiKey) {
    return NextResponse.json({ text: null, engine: "browser" }, { status: 200 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "No recording uploaded." }, { status: 400 });
  }
  if (file.size > MAX_ANSWER_BYTES) {
    return NextResponse.json(
      { error: "Recording too long. Please speak a shorter answer." },
      { status: 400 },
    );
  }

  const mimeType = baseMimeType(file.type || "audio/webm") || "audio/webm";
  const filename = `amani-answer${audioExtension(mimeType)}`;
  const language = form.get("locale") === "sw" ? "sw" : "en";
  const text = await groqTranscribeAudio({
    apiKey,
    bytes: await file.arrayBuffer(),
    filename,
    mimeType,
    language,
  });

  return NextResponse.json({
    text: text || "",
    engine: text ? "whisper" : "browser",
  });
}
