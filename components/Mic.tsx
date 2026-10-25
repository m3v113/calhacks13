"use client";
import { useRef, useState } from "react";
import { MicIcon, StopIcon } from "./Icons";

// How often the words so far are sent to be written out, so you can see it's listening.
const PIECE_MS = 3000;

// Press to record, press again to stop. Cartesia turns the recording into text a few seconds at a time:
// each piece is passed to onText as it comes back, and onDone runs once the last one is in.
export default function Mic({ onStart, onText, onDone }: { onStart?: () => void; onText: (text: string) => void; onDone?: () => void }) {
  const [state, setState] = useState<"idle" | "recording" | "working">("idle");
  const [note, setNote] = useState<string | null>(null);
  const stop = useRef<() => void>(() => {});

  const say = (t: string) => { setNote(t); setTimeout(() => setNote(null), 5000); };
  const start = async () => {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return say("The mic is blocked. Allow it in the browser.");
    }
    let stopping = false;
    let failed = false;
    let rec: MediaRecorder;
    let timer: ReturnType<typeof setTimeout>;
    // Pieces are written out in order, one after another.
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
          else if (j.text) onText(j.text);
        } catch {
          failed = true;
          say("Couldn't transcribe that.");
        }
      });
    };
    // Each piece is its own recording, so it can be read on its own.
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
          queue.then(() => { setState("idle"); onDone?.(); });
        }
      };
      rec.start();
      timer = setTimeout(() => rec.state === "recording" && rec.stop(), PIECE_MS);
    };
    stop.current = () => { stopping = true; clearTimeout(timer); if (rec.state === "recording") rec.stop(); };
    onStart?.();
    piece();
    setState("recording");
  };

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
