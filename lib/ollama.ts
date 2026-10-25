const URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
export const MODEL = process.env.OLLAMA_MODEL ?? "gemma3:4b";
const VISION = process.env.OLLAMA_VISION_MODEL ?? MODEL; // the image model to prefer

type Model = { name: string; size: number };
let last = { at: 0, models: null as Model[] | null };

// Installed models, or null when Ollama isn't running. Cached for a few seconds.
async function models() {
  if (Date.now() - last.at < 5000) return last.models;
  let list: Model[] | null = null;
  try {
    const r = await fetch(`${URL}/api/tags`, { signal: AbortSignal.timeout(1500) });
    if (r.ok) list = ((await r.json()).models ?? []).map((m: Model) => ({ name: m.name, size: m.size ?? 0 }));
  } catch {}
  last = { at: Date.now(), models: list };
  return list;
}

export async function ollamaUp() {
  return (await models()) !== null;
}

// Which models can see images, asked once per model (Ollama lists "vision" in its capabilities).
const canSee = new Map<string, boolean>();
// Models that said they can see images but failed to load (e.g. too new or too old for this Ollama).
const broken = new Set<string>();

async function hasVision(name: string) {
  if (!canSee.has(name)) {
    try {
      const r = await fetch(`${URL}/api/show`, { method: "POST", body: JSON.stringify({ model: name }), signal: AbortSignal.timeout(3000) });
      const caps: string[] = r.ok ? ((await r.json()).capabilities ?? []) : [];
      canSee.set(name, caps.includes("vision"));
    } catch {
      return false;
    }
  }
  return canSee.get(name)!;
}

// The model used to read images: OLLAMA_VISION_MODEL (OLLAMA_MODEL by default) if working, otherwise the smallest
// installed model that can see images. Null when there's none.
export async function visionModel() {
  const list = await models();
  if (!list) return null;
  const ordered = [...list].sort((a, b) =>
    Number(!!VISION && b.name.startsWith(VISION)) - Number(!!VISION && a.name.startsWith(VISION)) || a.size - b.size);
  for (const m of ordered) {
    if (!broken.has(m.name) && (await hasVision(m.name))) return m.name;
  }
  return null;
}

export function markBroken(name: string) {
  broken.add(name);
}

// Keep the model in memory between calls, so only the first one waits for it to load.
const KEEP = "30m";
let warmed = 0;

// Load the model ahead of time (it can take several seconds), at most every few minutes.
export function warm() {
  if (Date.now() - warmed < 5 * 60_000) return;
  warmed = Date.now();
  fetch(`${URL}/api/generate`, { method: "POST", body: JSON.stringify({ model: MODEL, keep_alive: KEEP }), signal: AbortSignal.timeout(60000) }).catch(() => {});
}

// maxTokens stops a long answer early, which is most of the wait with a small local model.
type Opts = { model?: string; images?: string[]; timeoutMs?: number; maxTokens?: number };

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
      body: JSON.stringify({ model: opts.model ?? MODEL, messages, format: schema, stream: false, keep_alive: KEEP, options: { temperature: 0, ...(opts.maxTokens ? { num_predict: opts.maxTokens } : {}) } }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 60000),
    });
    if (!r.ok) throw new Error(`ollama ${r.status}: ${(await r.text()).slice(0, 300)}`);
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

// A plain-text answer (no JSON), e.g. a vision model describing an image.
// The first call can be slow while Ollama loads a large model, so the timeout is generous.
export async function chatText(model: string, prompt: string, images?: string[]) {
  const r = await fetch(`${URL}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model, messages: [{ role: "user", content: prompt, ...(images ? { images } : {}) }], stream: false, keep_alive: KEEP, options: { temperature: 0 } }),
    signal: AbortSignal.timeout(240000),
  });
  if (!r.ok) throw new Error(`ollama ${model} ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const text = (await r.json())?.message?.content;
  if (typeof text !== "string" || !text.trim()) throw new Error(`ollama ${model}: empty answer`);
  return text.trim();
}
