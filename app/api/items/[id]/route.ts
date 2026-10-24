import { NextResponse } from "next/server";
import { unlink } from "node:fs/promises";
import { db, categoryByName } from "@/lib/db";
import { fullPath } from "@/lib/files";

// Change an item's category (existing id or a new name), or archive it.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const data: { categoryId?: string; sortedBy?: string; archived?: boolean } = {};

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

  try {
    return NextResponse.json(await db.item.update({ where: { id }, data }));
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
