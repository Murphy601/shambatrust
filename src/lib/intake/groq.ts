import { getCloudflareContext } from "@opennextjs/cloudflare";
import { amaniSystemPrompt, GROQ_CHAT_URL, GROQ_MODEL } from "@/lib/intake/prompt";
import type { IntakeChatMessage, IntakeDraft } from "@/lib/intake/types";

export async function getGroqApiKey(): Promise<string> {
  const fromProcess = process.env.GROQ_API_KEY?.trim();
  if (fromProcess) return fromProcess;
  try {
    const { env } = await getCloudflareContext({ async: true });
    const fromEnv = (env as { GROQ_API_KEY?: string } | undefined)?.GROQ_API_KEY;
    if (typeof fromEnv === "string" && fromEnv.trim()) return fromEnv.trim();
  } catch {
    // No Worker request context (build / local file db).
  }
  return "";
}

type GroqJson = {
  reply?: unknown;
  draft?: unknown;
  readyToSubmit?: unknown;
};

function stripFences(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  return (fenced?.[1] || trimmed).trim();
}

export async function groqIntakeTurn(input: {
  draft: IntakeDraft;
  messages: IntakeChatMessage[];
  locale: "en" | "sw";
  apiKey: string;
}): Promise<{ reply: string; draftPatch: Partial<IntakeDraft>; readyToSubmit: boolean } | null> {
  const history = input.messages.slice(-12).map((message) => ({
    role: message.role,
    content: message.content.slice(0, 2000),
  }));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(GROQ_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.2,
        max_tokens: 400,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: amaniSystemPrompt(input.draft, input.locale) },
          ...history,
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = JSON.parse(stripFences(content)) as GroqJson;
    const reply = typeof parsed.reply === "string" ? parsed.reply.trim() : "";
    if (!reply) return null;
    const draftPatch =
      parsed.draft && typeof parsed.draft === "object"
        ? (parsed.draft as Partial<IntakeDraft>)
        : {};
    return {
      reply: reply.slice(0, 600),
      draftPatch,
      readyToSubmit: parsed.readyToSubmit === true,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
