import type { AiProvider } from "../app/settings";

export type AiChatRole = "user" | "assistant";

export type AiChatMessage = { role: AiChatRole; content: string };

export type AiChatSendInput = {
  provider: Exclude<AiProvider, "off">;
  model: string;
  apiKey: string;
  backendUrl: string;
  system: string;
  messages: AiChatMessage[];
  /**
   * Nur sinnvoll bei provider `google`: aktiviert Gemini „Grounding mit Google Suche“ (REST: `tools` mit `google_search`).
   * Proxy-Backends müssen dieses Feld ggf. an die Gemini-API weitergeben.
   */
  geminiGoogleSearchGrounding?: boolean;
};

export class AiChatSendError extends Error {
  constructor(
    message: string,
    public readonly code: "NO_KEY" | "HTTP" | "NETWORK" | "PARSE" | "EMPTY" | "PROXY"
  ) {
    super(message);
    this.name = "AiChatSendError";
  }
}

type ProxyPayload = {
  provider: Exclude<AiProvider, "off">;
  model: string;
  system: string;
  messages: AiChatMessage[];
  geminiGoogleSearchGrounding?: boolean;
};

async function sendViaProxy(url: string, bearerOrEmpty: string, body: ProxyPayload): Promise<string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = bearerOrEmpty.trim();
  if (token) headers.Authorization = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  } catch {
    throw new AiChatSendError("network", "NETWORK");
  }
  const raw = await res.text();
  if (!res.ok) throw new AiChatSendError(raw.slice(0, 500) || res.statusText, "HTTP");
  let data: unknown;
  try {
    data = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new AiChatSendError("proxy json", "PROXY");
  }
  const o = data as Record<string, unknown>;
  if (typeof o.text === "string" && o.text.length > 0) return o.text;
  if (typeof o.content === "string" && o.content.length > 0) return o.content;
  if (typeof o.message === "string") return o.message;
  throw new AiChatSendError("proxy shape", "PROXY");
}

function geminiContents(messages: AiChatMessage[]): { role: string; parts: { text: string }[] }[] {
  return messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }]
  }));
}

/** Nur der Kurzname (z. B. gemini-1.5-flash) — die URL enthält bereits `models/…`. */
export function normalizeGeminiModelId(raw: string): string {
  const fallback = "gemini-1.5-flash";
  let s = raw.normalize("NFKC").trim().replace(/^\uFEFF/, "");
  if (!s) return fallback;
  const fromUrl = /\/models\/([^:?#/]+)/i.exec(s);
  if (fromUrl?.[1]) s = fromUrl[1];
  else if (/^models\//i.test(s)) s = s.replace(/^models\//i, "").trim();
  s = s.split(/[\s,;|]+/)[0]?.trim() ?? "";
  s = s.replace(/^\/+|\/+$/g, "");
  if (!s) return fallback;
  const cleaned = s.replace(/[^a-zA-Z0-9._-]/g, "");
  return cleaned || fallback;
}

async function sendGemini(
  model: string,
  apiKey: string,
  system: string,
  messages: AiChatMessage[],
  options?: { googleSearchGrounding?: boolean }
): Promise<string> {
  const mid = normalizeGeminiModelId(model);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(mid)}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;
  const body: Record<string, unknown> = {
    contents: geminiContents(messages),
    generationConfig: { temperature: 0.6, maxOutputTokens: 8192 }
  };
  if (system.trim()) {
    body.systemInstruction = { parts: [{ text: system.trim() }] };
  }
  if (options?.googleSearchGrounding) {
    body.tools = [{ google_search: {} }];
  }
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  } catch {
    throw new AiChatSendError("network", "NETWORK");
  }
  const raw = await res.text();
  if (!res.ok) throw new AiChatSendError(raw.slice(0, 800) || res.statusText, "HTTP");
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new AiChatSendError("parse", "PARSE");
  }
  const cand = (data as { candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[] }).candidates?.[0];
  const text = cand?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text.trim()) {
    const reason = cand?.finishReason ?? "unknown";
    throw new AiChatSendError(`empty (${reason})`, "EMPTY");
  }
  return text.trim();
}

async function sendAnthropic(model: string, apiKey: string, system: string, messages: AiChatMessage[]): Promise<string> {
  const url = "https://api.anthropic.com/v1/messages";
  const body = {
    model: model.trim() || "claude-sonnet-4-20250514",
    max_tokens: 8192,
    system: system.trim() || undefined,
    messages: messages.map((m) => ({ role: m.role, content: m.content }))
  };
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey.trim(),
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify(body)
    });
  } catch {
    throw new AiChatSendError("network", "NETWORK");
  }
  const raw = await res.text();
  if (!res.ok) throw new AiChatSendError(raw.slice(0, 800) || res.statusText, "HTTP");
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new AiChatSendError("parse", "PARSE");
  }
  const blocks = (data as { content?: { type?: string; text?: string }[] }).content;
  const text = blocks?.filter((b) => b.type === "text").map((b) => b.text ?? "").join("\n") ?? "";
  if (!text.trim()) throw new AiChatSendError("empty", "EMPTY");
  return text.trim();
}

async function sendOpenAi(model: string, apiKey: string, system: string, messages: AiChatMessage[]): Promise<string> {
  const url = "https://api.openai.com/v1/chat/completions";
  const openaiMessages = [
    ...(system.trim() ? [{ role: "system" as const, content: system.trim() }] : []),
    ...messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))
  ];
  const body = {
    model: model.trim() || "gpt-4o-mini",
    messages: openaiMessages,
    temperature: 0.6,
    max_tokens: 8192
  };
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey.trim()}`
      },
      body: JSON.stringify(body)
    });
  } catch {
    throw new AiChatSendError("network", "NETWORK");
  }
  const raw = await res.text();
  if (!res.ok) throw new AiChatSendError(raw.slice(0, 800) || res.statusText, "HTTP");
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new AiChatSendError("parse", "PARSE");
  }
  const text = (data as { choices?: { message?: { content?: string } }[] }).choices?.[0]?.message?.content ?? "";
  if (!text.trim()) throw new AiChatSendError("empty", "EMPTY");
  return text.trim();
}

/** Eine Assistentenantwort holen. Nutzt optional einen Proxy (Backend-URL), sonst direkte Provider-API (Google im Browser oft ok; Anthropic/OpenAI können wegen CORS scheitern). */
export async function sendAiChatAssistantReply(input: AiChatSendInput): Promise<string> {
  const key = input.apiKey.trim();
  const backend = input.backendUrl.trim();
  if (!backend && !key) {
    throw new AiChatSendError("no key", "NO_KEY");
  }
  const payload: ProxyPayload = {
    provider: input.provider,
    model: input.model.trim(),
    system: input.system,
    messages: input.messages,
    ...(input.geminiGoogleSearchGrounding ? { geminiGoogleSearchGrounding: true } : {})
  };
  if (backend) {
    return sendViaProxy(backend, key, payload);
  }

  switch (input.provider) {
    case "google":
      return sendGemini(input.model, key, input.system, input.messages, {
        googleSearchGrounding: Boolean(input.geminiGoogleSearchGrounding)
      });
    case "anthropic":
      return sendAnthropic(input.model, key, input.system, input.messages);
    case "openai":
      return sendOpenAi(input.model, key, input.system, input.messages);
    default:
      throw new AiChatSendError("provider", "HTTP");
  }
}
