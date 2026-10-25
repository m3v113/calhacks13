"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { DueChip, isLate, type Due } from "./Due";
import { CheckIcon } from "./Icons";

type Entry = Due & { kind: "item" | "task"; id: string; text: string; color: string | null; project: { id: string; title: string; color: string | null } | null };

const day = (offset: number) => { const d = new Date(); d.setDate(d.getDate() + offset); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const GROUPS: { name: string; test: (e: Entry) => boolean }[] = [
  { name: "Late", test: (e) => isLate(e) },
  { name: "Today", test: (e) => e.dueDate === day(0) },
  { name: "Tomorrow", test: (e) => e.dueDate === day(1) },
  { name: "Later", test: (e) => !!e.dueDate && e.dueDate > day(1) },
  { name: "No date", test: (e) => !e.dueDate },
];

// The Tasks bar: Brain Dump items and project tasks with a date, time, or priority, soonest first.
export default function Agenda({ onOpen }: { onOpen: (id: string) => void }) {
  const [list, setList] = useState<Entry[] | null>(null);
  const load = useCallback(async () => {
    const r = await fetch("/api/agenda", { cache: "no-store" }).catch(() => null);
    if (r?.ok) setList(await r.json());
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);
  const check = (e: Entry) => {
    setList((l) => l?.filter((x) => x.id !== e.id) ?? l);
    fetch(`/api/${e.kind === "item" ? "items" : "tasks"}/${e.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ done: true }) });
  };
  if (!list) return null;
  if (!list.length) return <p className="muted agenda-none">Give a Brain Dump item or a project task a date or priority, and it shows here.</p>;
  return (
    <div className="agenda">
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
                      <DueChip due={e} />
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
