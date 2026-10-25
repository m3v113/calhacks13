// Deadlines and priority, shared by Brain Dump items and project tasks.
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
