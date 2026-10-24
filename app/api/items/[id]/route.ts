import { NextResponse, after } from "next/server";
import { unlink } from "node:fs/promises";
import { db, categoryByName } from "@/lib/db";
import { fullPath } from "@/lib/files";
import { sortItem } from "@/lib/sort";

const text = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : undefined);

// Edit an item: its category (existing id or a new name), title, note text, summary, or your notes.
// { summarize: true } asks the AI for a fresh summary.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  let resort = false;

  if (typeof body.categoryId === "string") {
    data.categoryId = body.categoryId;
    data.sortedBy = "user";
  } else if (typeof body.categoryName === "string") {
    const c = await categoryByName(body.categoryName, false);
    if (!c) return NextResponse.json({ error: "bad name" }, { status: 400 });
    data.categoryId = c.id;
    data.sortedBy = "user";
  }
  if (typeof body.archived === "boolean") data.archived = body.archived;

  const title = text(body.title, 200);
  if (title !== undefined) Object.assign(data, title.trim() ? { title: title.trim(), titleBy: "user" } : { title: null, titleBy: null });
  const notes = text(body.notes, 50_000);
  if (notes !== undefined) data.notes = notes;
  const overview = text(body.overview, 5_000);
  if (overview !== undefined) Object.assign(data, overview.trim() ? { overview, overviewBy: "user" } : { overview: null, overviewBy: null });
  if (body.summarize === true) {
    Object.assign(data, { overview: null, overviewBy: null });
    resort = true;
  }
  const note = text(body.text, 10_000);
  if (note !== undefined && note.trim()) {
    data.text = note;
    // A changed note gets a fresh summary, unless you wrote the summary yourself.
    const current = await db.item.findUnique({ where: { id }, select: { overviewBy: true, text: true } });
    if (current && current.text !== note && current.overviewBy !== "user") {
      Object.assign(data, { overview: null, overviewBy: null });
      resort = true;
    }
  }

  try {
    const item = await db.item.update({ where: { id }, data });
    if (resort) after(() => sortItem(id));
    return NextResponse.json(item);
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}

// One item with everything, for the full view.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await db.item.findUnique({ where: { id }, include: { category: true } });
  return item ? NextResponse.json(item) : NextResponse.json({ error: "not found" }, { status: 404 });
}

// Deletes an item for good, along with its uploaded file.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await db.item.findUnique({ where: { id } });
  if (!item) return NextResponse.json({ error: "not found" }, { status: 404 });
  await db.item.delete({ where: { id } });
  if (item.filePath) await unlink(fullPath(item.filePath)).catch(() => {});
  return NextResponse.json({ ok: true });
}
