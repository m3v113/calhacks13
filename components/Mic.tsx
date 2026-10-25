"use client";
import { useRef, useState } from "react";
import { MicIcon, StopIcon } from "./Icons";

// Press to record, press again to stop. The recording is turned into text by Cartesia, and only then sent.
export default function Mic({ onText }: { onText: (text: string) => void }) {
  const [state, setState] = useState<"idle" | "recording" | "working">("idle");
  const [note, setNote] = useState<string | null>(null);
  const rec = useRef<MediaRecorder | null>(null);

  const say = (t: string) => { setNote(t); setTimeout(() => setNote(null), 5000); };
  const start = async () => {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return say("The mic is blocked. Allow it in the browser.");
    }
    const chunks: Blob[] = [];
    const r = new MediaRecorder(stream);
    r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    r.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      setState("working");
      const type = r.mimeType || "audio/webm";
      const form = new FormData();
      form.append("file", new Blob(chunks, { type }), `voice.${type.includes("mp4") ? "mp4" : type.includes("ogg") ? "ogg" : "webm"}`);
      try {
        const res = await fetch("/api/transcribe", { method: "POST", body: form });
        const j = await res.json();
        if (!res.ok) say(j.error ?? "Couldn't transcribe that.");
        else if (j.text) onText(j.text);
        else say("Didn't catch anything.");
      } catch {
        say("Couldn't transcribe that.");
      }
      setState("idle");
    };
    rec.current = r;
    r.start();
    setState("recording");
  };

  return (
    <span className="mic">
      <button className={`icon small ${state}`} disabled={state === "working"} aria-label={state === "recording" ? "Stop recording" : "Record a note"}
        data-tip={state === "recording" ? "Stop" : "Speak"} onClick={() => (state === "recording" ? rec.current?.stop() : start())}>
        {state === "recording" ? <StopIcon /> : <MicIcon />}
      </button>
      {note && <span className="mic-note">{note}</span>}
    </span>
  );
}
