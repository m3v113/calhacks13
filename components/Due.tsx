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

// Set a date, time, and priority. Shows the chip once one is set, a calendar icon before (or always, with `icon`).
// While the menu is open it keeps its own copy, so a slow save or a refresh can't undo what you just picked,
// and every change sends all three together.
export function DuePicker({ due, onChange, className, icon }: { due: Due; onChange: (d: Due) => void; className?: string; icon?: boolean }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Due>(due);
  const ref = useDismiss<HTMLSpanElement>(open, () => setOpen(false));
  const shown = open ? draft : due;
  const set = dueLabel(shown) || shown.priority;
  const pick = (d: Partial<Due>) => {
    const next = { ...draft, ...d };
    if (next.dueDate === draft.dueDate && next.dueTime === draft.dueTime && next.priority === draft.priority) return;
    setDraft(next);
    onChange(next);
  };
  // Typed dates and times are read again when you leave the field, in case the browser didn't report the change.
  const read = (e: React.SyntheticEvent<HTMLInputElement>, key: "dueDate" | "dueTime") => pick({ [key]: e.currentTarget.value || null });
  return (
    <span className={`due-pick ${className ?? ""}`} ref={ref}>
      <button className={set && !icon ? "due-btn" : `icon small ${set && !icon ? "" : "fade"}`} aria-label="Date and priority" data-tip={set && !icon ? undefined : "Date and priority"}
        aria-expanded={open} onClick={() => { if (!open) setDraft({ dueDate: due.dueDate, dueTime: due.dueTime, priority: due.priority }); setOpen(!open); }}>
        {set && !icon ? <DueChip due={shown} /> : <CalendarIcon />}
      </button>
      {open && (
        <div className="menu due-menu">
          <input type="date" aria-label="Date" value={draft.dueDate ?? ""} onChange={(e) => read(e, "dueDate")} onBlur={(e) => read(e, "dueDate")} />
          <input type="time" aria-label="Time" value={draft.dueTime ?? ""} onChange={(e) => read(e, "dueTime")} onBlur={(e) => read(e, "dueTime")} />
          <div className="due-prios" role="radiogroup" aria-label="Priority">
            {PRIORITIES.map((p) => (
              <button key={p.n} role="radio" aria-checked={draft.priority === p.n} className={draft.priority === p.n ? "on" : ""}
                onClick={() => pick({ priority: draft.priority === p.n ? null : p.n })}><span className={`prio p${p.n}`} />{p.label}</button>
            ))}
          </div>
          {set && <button className="due-clear" onClick={() => { pick({ dueDate: null, dueTime: null, priority: null }); setOpen(false); }}>Clear</button>}
        </div>
      )}
    </span>
  );
}
