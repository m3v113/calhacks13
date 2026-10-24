const URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
export const MODEL = process.env.OLLAMA_MODEL ?? "llama3.2:3b";
const VISION = process.env.OLLAMA_VISION_MODEL ?? "llama3.2-vision";

let last = { at: 0, models: null as string[] | null };

// Installed model names, or null when Ollama isn't running. Cached for a few seconds.
async function models() {
  if (Date.now() - last.at < 5000) return last.models;
  let list: string[] | null = null;
  try {
    const r = await fetch(`${URL}/api/tags`, { signal: AbortSignal.timeout(1500) });
    if (r.ok) list = ((await r.json()).models ?? []).map((m: { name: string }) => m.name);
  } catch {}
  last = { at: Date.now(), models: list };
  return list;
}

export async function ollamaUp() {
  return (await models()) !== null;
}

// The vision model, if one is installed (used to read images).
export async function visionModel() {
  const list = await models();
  return list?.find((n) => n.startsWith(VISION)) ?? list?.find((n) => /vision|llava/.test(n)) ?? null;
}

type Opts = { model?: string; images?: string[] };

// One chat call that must return JSON matching `schema`. Retries once on bad JSON.
export async function chatJSON<T>(system: string, user: string, schema: object, check: (v: unknown) => v is T, opts: Opts = {}): Promise<T> {
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const content = attempt === 0 ? user : `${user}\n\nYour last answer was invalid (${lastError}). Reply with JSON only.`;
    const messages = [
      { role: "system", content: system },
      { role: "user", content, ...(opts.images ? { images: opts.images } : {}) },
    ];
    const r = await fetch(`${URL}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: opts.model ?? MODEL, messages, format: schema, stream: false, options: { temperature: 0 } }),
      signal: AbortSignal.timeout(opts.images ? 90000 : 30000),
    });
    if (!r.ok) throw new Error(`ollama ${r.status}`);
    const body = await r.json();
    try {
      const v = JSON.parse(body?.message?.content ?? "");
      if (check(v)) return v;
      lastError = "wrong shape";
    } catch {
      lastError = "not JSON";
    }
  }
  throw new Error(`ollama: ${lastError}`);
}
