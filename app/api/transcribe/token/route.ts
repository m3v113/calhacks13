import { NextResponse } from "next/server";

// A short-lived Cartesia token that can only transcribe, so the browser can stream the mic to Cartesia
// directly (and see the words as you speak) without ever seeing the API key.
export async function POST() {
  const key = process.env.CARTESIA_API_KEY;
  if (!key) return NextResponse.json({ error: "Add CARTESIA_API_KEY to .env to use the mic." }, { status: 503 });
  try {
    const r = await fetch("https://api.cartesia.ai/access-token", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "cartesia-version": "2026-08-14", "content-type": "application/json" },
      body: JSON.stringify({ grants: { stt: true }, expires_in: 600 }),
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) {
      console.warn(`[voice] Cartesia token: HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`);
      return NextResponse.json({ error: r.status === 401 ? "Cartesia refused the API key." : "Couldn't start the mic." }, { status: 502 });
    }
    const j = await r.json();
    return typeof j?.token === "string" ? NextResponse.json({ token: j.token }) : NextResponse.json({ error: "Couldn't start the mic." }, { status: 502 });
  } catch (e) {
    console.warn("[voice] token failed:", (e as Error).message);
    return NextResponse.json({ error: "Couldn't reach Cartesia. Try again." }, { status: 502 });
  }
}
