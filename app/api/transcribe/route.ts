import { NextResponse } from "next/server";

// Speech to text with Cartesia (Ink-Whisper). Only runs when you press the mic, and only the recording is sent.
export async function POST(req: Request) {
  const key = process.env.CARTESIA_API_KEY;
  if (!key) return NextResponse.json({ error: "Add CARTESIA_API_KEY to .env to use the mic." }, { status: 503 });
  const form = await req.formData().catch(() => null);
  const audio = form?.get("file");
  if (!(audio instanceof Blob) || !audio.size) return NextResponse.json({ error: "no audio" }, { status: 400 });
  const out = new FormData();
  out.append("file", audio, (audio as File).name || "voice.webm");
  out.append("model", "ink-whisper");
  out.append("language", "en");
  try {
    const r = await fetch("https://api.cartesia.ai/stt", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "cartesia-version": "2026-08-14" },
      body: out,
      signal: AbortSignal.timeout(60000),
    });
    if (!r.ok) {
      console.warn(`[voice] Cartesia said HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`);
      return NextResponse.json({ error: r.status === 401 ? "Cartesia refused the API key." : "Couldn't transcribe that. Try again." }, { status: 502 });
    }
    const j = await r.json();
    return NextResponse.json({ text: typeof j?.text === "string" ? j.text.trim() : "" });
  } catch (e) {
    console.warn("[voice] transcribe failed:", (e as Error).message);
    return NextResponse.json({ error: "Couldn't reach Cartesia. Try again." }, { status: 502 });
  }
}
