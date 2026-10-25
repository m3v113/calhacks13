"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { DuePicker, isLate, type Due } from "./Due";
import { CheckIcon, PlusIcon } from "./Icons";

type Entry = Due & { kind: "item" | "task"; id: string; text: string; color: string | null; project: { id: string; title: string; color: string | null } | null };

const day = (offset: number) => { const d = new Date(); d.setDate(d.getDate() + offset); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const GROUPS: { name: string; test: (e: Entry) => boolean }[] = [
  { name: "Late", test: (e) => isLate(e) },
  { name: "Today", test: (e) => e.dueDate === day(0) },
  { name: "Tomorrow", test: (e) => e.dueDate === day(1) },
  { name: "Later", test: (e) => !!e.dueDate && e.dueDate > day(1) },
  { name: "No date", test: (e) => !e.dueDate },
];

const NONE: Due = { dueDate: null, dueTime: null, priority: null };
const send = (url: string, method: string, body: object) =>
  fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

// The Tasks bar: Pantry items and project tasks with a date, time, or priority, soonest first.
// A task added here goes to the Pantry, due today unless you pick a date.
export default function Agenda({ onOpen }: { onOpen: (id: string) => void }) {
  const [list, setList] = useState<Entry[] | null>(null);
  const [text, setText] = useState("");
  const [due, setDue] = useState<Due>(NONE);
  // Only the newest load counts, so an answer that comes back late can't undo a change made since.
  const seq = useRef(0);
  const load = useCallback(async () => {
    const n = ++seq.current;
    const r = await fetch("/api/agenda", { cache: "no-store" }).catch(() => null);
    const list = r?.ok ? await r.json() : null;
    if (list && n === seq.current) setList(list);
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);
  const url = (e: Entry) => `/api/${e.kind === "item" ? "items" : "tasks"}/${e.id}`;
  const check = (e: Entry) => {
    seq.current++;
    setList((l) => l?.filter((x) => x.id !== e.id) ?? l);
    send(url(e), "PATCH", { done: true });
  };
  const change = (e: Entry, d: Partial<Due>) => {
    seq.current++;
    setList((l) => l?.map((x) => (x.id === e.id ? { ...x, ...d } : x)) ?? l);
    send(url(e), "PATCH", d).then(load);
  };
  const add = async () => {
    const t = text.trim();
    if (!t) return;
    setText("");
    setDue(NONE);
    await send("/api/items", "POST", { text: t, ...due, dueDate: due.dueDate ?? day(0) });
    load();
  };
  if (!list) return null;
  return (
    <div className="agenda">
      <div className="add-task agenda-add">
        <PlusIcon />
        <input value={text} placeholder="Add a task" aria-label="Add a task" onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) add(); if (e.key === "Escape") setText(""); }} />
        <DuePicker due={due} onChange={(d) => setDue({ ...due, ...d })} />
      </div>
      {!list.length && <p className="muted agenda-none">Give a Pantry item or a project task a date or priority, and it shows here.</p>}
      {GROUPS.map((g) => {
        const rows = list.filter(g.test);
        return rows.length > 0 && (
          <div key={g.name} className="agenda-group">
            <div className="pick-head">{g.name}</div>
            <ul>
              {rows.map((e) => (
                <li key={e.id}>
                  <button className="check" aria-label="Mark done" onClick={() => check(e)}><CheckIcon /></button>
                  <div className="agenda-body">
                    {e.kind === "item" ? <button className="agenda-text" onClick={() => onOpen(e.id)}>{e.text}</button>
                      : <Link className="agenda-text" href={`/p/${e.project?.id}`}>{e.text}</Link>}
                    <div className="agenda-meta">
                      <DuePicker due={e} onChange={(d) => change(e, d)} />
                      {e.project && <span className="agenda-project"><span className="dot square" style={{ background: e.project.color ?? "var(--muted)" }} />{e.project.title}</span>}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
