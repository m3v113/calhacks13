import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const DATED = [{ dueDate: { not: null } }, { dueTime: { not: null } }, { priority: { not: null } }];
const PROJECT = { select: { id: true, title: true, color: true } };

const DONE_SHOWN = 10;

// The Tasks bar: every Pantry item and project task that has a date, time, or priority and isn't done,
// soonest first (ones without a date go last, by priority), then the last few checked off (done: true).
export async function GET() {
  const doneWhere = { done: true, doneAt: { not: null }, OR: DATED };
  const [items, tasks, doneItems, doneTasks] = await Promise.all([
    db.item.findMany({ where: { archived: false, done: false, OR: DATED }, include: { project: PROJECT, category: { select: { color: true } } }, omit: { extracted: true } }),
    db.task.findMany({ where: { done: false, OR: DATED }, include: { section: { select: { project: PROJECT } } } }),
    db.item.findMany({ where: { archived: false, ...doneWhere }, orderBy: { doneAt: "desc" }, take: DONE_SHOWN, include: { project: PROJECT, category: { select: { color: true } } }, omit: { extracted: true } }),
    db.task.findMany({ where: doneWhere, orderBy: { doneAt: "desc" }, take: DONE_SHOWN, include: { section: { select: { project: PROJECT } } } }),
  ]);
  type I = (typeof items)[number];
  type T = (typeof tasks)[number];
  const item = (i: I) => ({
    kind: "item" as const, id: i.id, text: i.title ?? i.fileName ?? i.text, dueDate: i.dueDate, dueTime: i.dueTime, priority: i.priority,
    project: i.project, color: i.category?.color ?? null, done: i.done, doneAt: i.doneAt,
  });
  const task = (t: T) => ({
    kind: "task" as const, id: t.id, text: t.text, dueDate: t.dueDate, dueTime: t.dueTime, priority: t.priority,
    project: t.section.project, color: null, done: t.done, doneAt: t.doneAt,
  });
  const list = [...items.map(item), ...tasks.map(task)];
  const key = (x: (typeof list)[number]) => `${x.dueDate ?? "9999-99-99"} ${x.dueTime ?? "99:99"} ${x.priority ?? 9}`;
  list.sort((a, b) => key(a).localeCompare(key(b)));
  const done = [...doneItems.map(item), ...doneTasks.map(task)]
    .sort((a, b) => (b.doneAt?.getTime() ?? 0) - (a.doneAt?.getTime() ?? 0)).slice(0, DONE_SHOWN);
  return NextResponse.json([...list, ...done]);
}
