"use client";
import { useRef, useState } from "react";
import { MicIcon, StopIcon } from "./Icons";

const VERSION = "2026-08-14";
// Without a live connection, the recording is sent in pieces this long instead.
const PIECE_MS = 3000;

// Press to record, press again to stop. The mic streams to Cartesia (Ink 2), which sends the words back as
// you speak: onChange gets the box's text with them added after what was already there. onDone gets what
// was said once the last words are in; `fresh` says whether the box was empty when you started.
export default function Mic({ value, onChange, onDone }: { value: string; onChange: (text: string) => void; onDone?: (said: string, fresh: boolean) => void }) {
  const [state, setState] = useState<"idle" | "recording" | "working">("idle");
  const [note, setNote] = useState<string | null>(null);
  const stop = useRef<() => void>(() => {});

  const say = (t: string) => { setNote(t); setTimeout(() => setNote(null), 5000); };
  const start = async () => {
    const base = value.trim();
    const show = (said: string) => onChange(base && said ? `${base} ${said}` : base || said);
    const finish = (said: string) => { setState("idle"); onDone?.(said.trim(), !base); };
    const [stream, token] = await Promise.all([
      navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } }).catch(() => null),
      fetch("/api/transcribe/token", { method: "POST" }).then(async (r) => ({ status: r.status, ...(await r.json()) })).catch(() => ({ status: 0 })),
    ]);
    if (!stream) return say("The mic is blocked. Allow it in the browser.");
    if (token.status === 503) { stream.getTracks().forEach((t) => t.stop()); return say(token.error); }
    setState("recording");
    if (token.token) live(stream, token.token, show, finish, () => pieces(stream, show, finish));
    else pieces(stream, show, finish);
  };

  // Live: raw 16-bit audio goes to Cartesia over a WebSocket, and each turn's words come back as they're heard.
  function live(stream: MediaStream, token: string, show: (s: string) => void, finish: (s: string) => void, fallback: () => void) {
    let ctx: AudioContext;
    try { ctx = new AudioContext({ sampleRate: 16000 }); } catch { ctx = new AudioContext(); }
    const url = `wss://api.cartesia.ai/stt/turns/websocket?model=ink-2&encoding=pcm_s16le&sample_rate=${ctx.sampleRate}&cartesia_version=${VERSION}&access_token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(url);
    ws.binaryType = "arraybuffer";
    const turns: string[] = [];
    let current = "";
    let opened = false;
    let ended = false;
    const waiting: ArrayBuffer[] = [];
    const said = () => [...turns, current].filter(Boolean).join(" ");

    const source = ctx.createMediaStreamSource(stream);
    const proc = ctx.createScriptProcessor(2048, 1, 1);
    proc.onaudioprocess = (e) => {
      const f = e.inputBuffer.getChannelData(0);
      const pcm = new Int16Array(f.length);
      for (let i = 0; i < f.length; i++) pcm[i] = Math.max(-1, Math.min(1, f[i])) * 0x7fff;
      if (ws.readyState === WebSocket.OPEN) ws.send(pcm.buffer);
      else if (ws.readyState === WebSocket.CONNECTING) waiting.push(pcm.buffer);
    };
    source.connect(proc);
    proc.connect(ctx.destination);
    const release = () => { proc.disconnect(); source.disconnect(); ctx.close().catch(() => {}); };
    const done = () => {
      if (ended) return;
      ended = true;
      release();
      stream.getTracks().forEach((t) => t.stop());
      finish(said());
    };

    ws.onopen = () => { opened = true; waiting.splice(0).forEach((b) => ws.send(b)); };
    ws.onmessage = (m) => {
      let e: { type?: string; transcript?: string; message?: string };
      try { e = JSON.parse(String(m.data)); } catch { return; }
      if (e.type === "turn.update" || e.type === "turn.eager_end") current = e.transcript ?? current;
      else if (e.type === "turn.end") { if (e.transcript?.trim()) turns.push(e.transcript.trim()); current = ""; }
      else if (e.type === "error") { console.warn("[voice]", e.message); say("Couldn't transcribe that."); }
      else return;
      show(said());
    };
    // If the live connection can't open (an older key, a blocked network), the recording is sent in pieces instead.
    ws.onclose = () => { if (!opened && !ended) { ended = true; release(); fallback(); } else done(); };
    stop.current = () => {
      setState("working");
      release();
      stream.getTracks().forEach((t) => t.stop());
      // Close asks Cartesia to finish the audio it has, then it closes the connection.
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "close" }));
      else ws.close();
      setTimeout(() => { ws.close(); done(); }, 4000);
    };
  }

  // In pieces: each piece is its own recording, sent to Cartesia (Ink-Whisper) in order.
  function pieces(stream: MediaStream, show: (s: string) => void, finish: (s: string) => void) {
    let stopping = false;
    let failed = false;
    let rec: MediaRecorder;
    let timer: ReturnType<typeof setTimeout>;
    const heard: string[] = [];
    let queue = Promise.resolve();
    const send = (blob: Blob) => {
      queue = queue.then(async () => {
        if (failed || blob.size < 2000) return; // too short to hold a word
        const form = new FormData();
        form.append("file", blob, `voice.${blob.type.includes("mp4") ? "mp4" : blob.type.includes("ogg") ? "ogg" : "webm"}`);
        try {
          const res = await fetch("/api/transcribe", { method: "POST", body: form });
          const j = await res.json();
          if (!res.ok) { failed = true; say(j.error ?? "Couldn't transcribe that."); }
          else if (j.text) { heard.push(j.text); show(heard.join(" ")); }
        } catch {
          failed = true;
          say("Couldn't transcribe that.");
        }
      });
    };
    const piece = () => {
      const chunks: Blob[] = [];
      rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = () => {
        send(new Blob(chunks, { type: rec.mimeType || "audio/webm" }));
        if (!stopping) piece();
        else {
          stream.getTracks().forEach((t) => t.stop());
          setState("working");
          queue.then(() => finish(heard.join(" ")));
        }
      };
      rec.start();
      timer = setTimeout(() => rec.state === "recording" && rec.stop(), PIECE_MS);
    };
    stop.current = () => { stopping = true; clearTimeout(timer); if (rec.state === "recording") rec.stop(); };
    piece();
  }

  return (
    <span className="mic">
      <button className={`icon small ${state}`} disabled={state === "working"} aria-label={state === "recording" ? "Stop recording" : "Record a note"}
        data-tip={state === "recording" ? "Stop" : "Speak"} onClick={() => (state === "recording" ? stop.current() : start())}>
        {state === "recording" ? <StopIcon /> : <MicIcon />}
      </button>
      {note && <span className="mic-note">{note}</span>}
    </span>
  );
}
