import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getWorkerEnv } from "@/lib/cf-env";
import { amaniSystemPrompt, GROQ_CHAT_URL, GROQ_MODEL } from "@/lib/intake/prompt";
import type { IntakeChatMessage, IntakeDraft } from "@/lib/intake/types";

function readKey(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function getGroqApiKey(): Promise<string> {
  // Prefer the live Worker env (secrets added after deploy still appear here).
  try {
    const { env } = await getCloudflareContext({ async: true });
    const fromCtx = readKey((env as { GROQ_API_KEY?: string } | undefined)?.GROQ_API_KEY);
    if (fromCtx) return fromCtx;
  } catch {
    // No request context (build / local file db).
  }
  const fromBinding = readKey((await getWorkerEnv()).GROQ_API_KEY);
  if (fromBinding) return fromBinding;
  // Dynamic lookup so the build cannot inline an empty key.
  const fromProcess = readKey(
    (process.env as Record<string, string | undefined>)["GROQ_API_KEY"],
  );
  return fromProcess;
}

type GroqJson = {
  reply?: unknown;
  draft?: unknown;
  readyToSubmit?: unknown;
};

function extractJsonObject(raw: string): GroqJson | null {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] || trimmed).trim();
  try {
    return JSON.parse(candidate) as GroqJson;
  } catch {
    const match = candidate.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as GroqJson;
    } catch {
      return null;
    }
  }
}

async function groqRequest(
  apiKey: string,
  body: Record<string, unknown>,
  signal: AbortSignal,
): Promise<{ ok: boolean; status: number; content: string }> {
  const res = await fetch(GROQ_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal,
  });
  let content = "";
  try {
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    };
    content = json.choices?.[0]?.message?.content || json.error?.message || "";
  } catch {
    content = "";
  }
  return { ok: res.ok, status: res.status, content };
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
  const timer = setTimeout(() => controller.abort(), 20_000);
  const payload = {
    model: GROQ_MODEL,
    temperature: 0.2,
    max_tokens: 400,
    max_completion_tokens: 400,
    messages: [
      { role: "system", content: amaniSystemPrompt(input.draft, input.locale) },
      ...history,
    ],
  };
  try {
    let result = await groqRequest(
      input.apiKey,
      { ...payload, response_format: { type: "json_object" } },
      controller.signal,
    );
    if (!result.ok && result.status === 400) {
      result = await groqRequest(input.apiKey, payload, controller.signal);
    }
    if (!result.ok || !result.content) {
      console.warn(
        JSON.stringify({
          event: "groq_failed",
          status: result.status,
          hasContent: Boolean(result.content),
        }),
      );
      return null;
    }
    const parsed = extractJsonObject(result.content);
    if (parsed) {
      const reply = typeof parsed.reply === "string" ? parsed.reply.trim() : "";
      const draftPatch =
        parsed.draft && typeof parsed.draft === "object"
          ? (parsed.draft as Partial<IntakeDraft>)
          : {};
      if (reply) {
        return {
          reply: reply.slice(0, 600),
          draftPatch,
          readyToSubmit: parsed.readyToSubmit === true,
        };
      }
    }
    const plain = result.content.replace(/```[\s\S]*$/g, "").trim();
    if (plain) {
      return { reply: plain.slice(0, 600), draftPatch: {}, readyToSubmit: false };
    }
    return null;
  } catch (error) {
    console.warn(
      JSON.stringify({
        event: "groq_error",
        name: error instanceof Error ? error.name : "unknown",
      }),
    );
    return null;
  } finally {
    clearTimeout(timer);
  }
}
