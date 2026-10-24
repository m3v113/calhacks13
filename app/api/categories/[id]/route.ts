import { NextResponse, after } from "next/server";
import { db, cleanName } from "@/lib/db";
import { COLORS } from "@/lib/colors";
import { sortItem } from "@/lib/sort";

// Rename or recolor a category.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const data: { name?: string; color?: string; auto?: boolean } = {};
  if (typeof body.name === "string") {
    const name = cleanName(body.name);
    if (!name) return NextResponse.json({ error: "bad name" }, { status: 400 });
    const all = await db.category.findMany({ select: { id: true, name: true } });
    if (all.some((c) => c.id !== id && c.name.toLowerCase() === name.toLowerCase())) {
      return NextResponse.json({ error: "name taken" }, { status: 409 });
    }
    Object.assign(data, { name, auto: false });
  }
  if (typeof body.color === "string" && COLORS.includes(body.color)) data.color = body.color;
  try {
    return NextResponse.json(await db.category.update({ where: { id }, data }));
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}

// Delete a category. Its items are sorted again (by the AI, or by rules when it's off).
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const items = await db.item.findMany({ where: { categoryId: id }, select: { id: true } });
  await db.item.updateMany({ where: { categoryId: id }, data: { categoryId: null, sortedBy: "pending" } });
  await db.category.delete({ where: { id } }).catch(() => {});
  after(async () => { for (const i of items) await sortItem(i.id); });
  return NextResponse.json({ ok: true });
}
