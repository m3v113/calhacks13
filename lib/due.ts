// Deadlines and priority, shared by Pantry items and project tasks.
export const PRIORITIES = [{ n: 1, label: "High" }, { n: 2, label: "Medium" }, { n: 3, label: "Low" }] as const;

// Only well-formed values are saved; null clears one. Anything else leaves it as it is.
export function dueFields(body: Record<string, unknown>) {
  const data: Record<string, unknown> = {};
  if (body.dueDate === null || (typeof body.dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.dueDate))) data.dueDate = body.dueDate || null;
  if (body.dueTime === null || (typeof body.dueTime === "string" && /^\d{2}:\d{2}$/.test(body.dueTime))) data.dueTime = body.dueTime || null;
  if (body.priority === null || body.priority === 1 || body.priority === 2 || body.priority === 3) data.priority = body.priority;
  return data;
}

// "Due: 2026-10-27" at the end of a task the AI wrote becomes its date.
export function dueFromText(text: string) {
  const m = text.match(/^(.*?)[\s.,;(]*\bdue:?\s*(\d{4}-\d{2}-\d{2})\)?\.?\s*$/i);
  return m ? { text: m[1].trim(), dueDate: m[2] } : { text, dueDate: null };
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

// A typed date, as "YYYY-MM-DD": "today", "tomorrow", "fri", "next fri", "in 3 days", "10/27", "10/27/2026",
// "oct 27", "27 oct", or "2026-10-27". A date without a year is the next one to come. Null when it can't be read.
export function parseDate(text: string, now = new Date()): string | null {
  const t = text.trim().toLowerCase().replace(/[.,]/g, " ").replace(/\s+/g, " ");
  if (!t) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const plus = (n: number) => { const d = new Date(today); d.setDate(d.getDate() + n); return iso(d); };
  if (/^(today|tod|now)$/.test(t)) return plus(0);
  if (/^(tomorrow|tmr|tmrw|tom|tomorow)$/.test(t)) return plus(1);
  let m = t.match(/^in (\d{1,3}) (day|days|week|weeks)$/) ?? t.match(/^(\d{1,3}) ?(d|w)$/);
  if (m) return plus(Number(m[1]) * (m[2].startsWith("w") ? 7 : 1));
  m = t.match(/^(next |this )?([a-z]+)$/);
  const day = m ? DAYS.findIndex((d) => m![2].startsWith(d) && m![2].length >= 3) : -1;
  if (m && day >= 0) {
    const ahead = (day - today.getDay() + 7) % 7;
    return plus(m[1] === "next " ? ahead || 7 : ahead);
  }
  const make = (y: number | null, mo: number, d: number) => {
    if (mo < 0 || mo > 11 || d < 1 || d > 31) return null;
    let date = new Date(y ?? today.getFullYear(), mo, d);
    if (date.getMonth() !== mo) return null;
    if (y === null && date < today) date = new Date(today.getFullYear() + 1, mo, d);
    return iso(date);
  };
  const year = (y?: string) => (y ? (y.length === 2 ? 2000 + Number(y) : Number(y)) : null);
  if ((m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) return make(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if ((m = t.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2}|\d{4}))?$/))) return make(year(m[3]), Number(m[1]) - 1, Number(m[2]));
  const month = (w: string) => (w.length >= 3 ? MONTHS.findIndex((x) => w.startsWith(x)) : -1);
  if ((m = t.match(/^([a-z]+) (\d{1,2})(?:st|nd|rd|th)?(?: (\d{4}))?$/)) && month(m[1]) >= 0) return make(year(m[3]), month(m[1]), Number(m[2]));
  if ((m = t.match(/^(\d{1,2})(?:st|nd|rd|th)? ([a-z]+)(?: (\d{4}))?$/)) && month(m[2]) >= 0) return make(year(m[3]), month(m[2]), Number(m[1]));
  return null;
}

// Times to pick from: every half hour, "HH:MM".
export const TIMES = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);
