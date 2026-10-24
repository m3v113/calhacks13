const URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
export const MODEL = process.env.OLLAMA_MODEL ?? "llama3.2:3b";

let last = { at: 0, up: false };

// Is Ollama running? Cached for a few seconds so polling stays cheap.
export async function ollamaUp() {
  if (Date.now() - last.at < 5000) return last.up;
  let up = false;
  try {
    const r = await fetch(`${URL}/api/tags`, { signal: AbortSignal.timeout(1500) });
    up = r.ok;
  } catch {}
  last = { at: Date.now(), up };
  return up;
}

// One chat call that must return JSON matching `schema`. Retries once on bad JSON.
export async function chatJSON<T>(system: string, user: string, schema: object, check: (v: unknown) => v is T): Promise<T> {
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const messages = [
      { role: "system", content: system },
      { role: "user", content: attempt === 0 ? user : `${user}\n\nYour last answer was invalid (${lastError}). Reply with JSON only.` },
    ];
    const r = await fetch(`${URL}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, messages, format: schema, stream: false, options: { temperature: 0 } }),
      signal: AbortSignal.timeout(30000),
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
