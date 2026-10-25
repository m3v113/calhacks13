"use client";
import { useState } from "react";
import { PRIORITIES } from "@/lib/due";
import { useDismiss } from "./Projects";
import { CalendarIcon } from "./Icons";

export type Due = { dueDate: string | null; dueTime: string | null; priority: number | null };

const today = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
export const isLate = (d: Due) => !!d.dueDate && d.dueDate < today();

// "Today 5 PM", "Tomorrow", "Oct 28".
export function dueLabel(d: Due) {
  const t = today();
  const day = !d.dueDate ? "" : d.dueDate === t ? "Today" : d.dueDate === addDays(t, 1) ? "Tomorrow"
    : new Date(`${d.dueDate}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const time = d.dueTime ? new Date(`2000-01-01T${d.dueTime}`).toLocaleTimeString(undefined, { hour: "numeric", minute: d.dueTime.endsWith(":00") ? undefined : "2-digit" }) : "";
  return [day, time].filter(Boolean).join(" ");
}

// The date and priority, small, next to an item or task.
export function DueChip({ due }: { due: Due }) {
  const label = dueLabel(due);
  if (!label && !due.priority) return null;
  return (
    <span className={`due ${isLate(due) ? "late" : ""}`}>
      {due.priority && <span className={`prio p${due.priority}`} aria-label={`${PRIORITIES[due.priority - 1].label} priority`} />}
      {label}
    </span>
  );
}

// Set a date, time, and priority. Shows the chip once one is set, a calendar icon before.
export function DuePicker({ due, onChange, className }: { due: Due; onChange: (d: Partial<Due>) => void; className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss<HTMLSpanElement>(open, () => setOpen(false));
  const set = dueLabel(due) || due.priority;
  return (
    <span className={`due-pick ${className ?? ""}`} ref={ref}>
      <button className={set ? "due-btn" : "icon small fade"} aria-label="Date and priority" data-tip={set ? undefined : "Date and priority"} aria-expanded={open} onClick={() => setOpen(!open)}>
        {set ? <DueChip due={due} /> : <CalendarIcon />}
      </button>
      {open && (
        <div className="menu due-menu">
          <input type="date" aria-label="Date" value={due.dueDate ?? ""} onChange={(e) => onChange({ dueDate: e.target.value || null })} />
          <input type="time" aria-label="Time" value={due.dueTime ?? ""} onChange={(e) => onChange({ dueTime: e.target.value || null })} />
          <div className="due-prios" role="radiogroup" aria-label="Priority">
            {PRIORITIES.map((p) => (
              <button key={p.n} role="radio" aria-checked={due.priority === p.n} className={due.priority === p.n ? "on" : ""}
                onClick={() => onChange({ priority: due.priority === p.n ? null : p.n })}><span className={`prio p${p.n}`} />{p.label}</button>
            ))}
          </div>
          {set && <button className="due-clear" onClick={() => { onChange({ dueDate: null, dueTime: null, priority: null }); setOpen(false); }}>Clear</button>}
        </div>
      )}
    </span>
  );
}
