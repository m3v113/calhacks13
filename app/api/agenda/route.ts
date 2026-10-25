import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const DATED = [{ dueDate: { not: null } }, { dueTime: { not: null } }, { priority: { not: null } }];
const PROJECT = { select: { id: true, title: true, color: true } };

// The Tasks bar: every Pantry item and project task that has a date, time, or priority and isn't done.
// Soonest first; ones without a date go last, by priority.
export async function GET() {
  const [items, tasks] = await Promise.all([
    db.item.findMany({ where: { archived: false, done: false, OR: DATED }, include: { project: PROJECT, category: { select: { color: true } } }, omit: { extracted: true } }),
    db.task.findMany({ where: { done: false, OR: DATED }, include: { section: { select: { project: PROJECT } } } }),
  ]);
  const list = [
    ...items.map((i) => ({
      kind: "item" as const, id: i.id, text: i.title ?? i.fileName ?? i.text, dueDate: i.dueDate, dueTime: i.dueTime, priority: i.priority,
      project: i.project, color: i.category?.color ?? null,
    })),
    ...tasks.map((t) => ({
      kind: "task" as const, id: t.id, text: t.text, dueDate: t.dueDate, dueTime: t.dueTime, priority: t.priority,
      project: t.section.project, color: null,
    })),
  ];
  const key = (x: (typeof list)[number]) => `${x.dueDate ?? "9999-99-99"} ${x.dueTime ?? "99:99"} ${x.priority ?? 9}`;
  list.sort((a, b) => key(a).localeCompare(key(b)));
  return NextResponse.json(list);
}
