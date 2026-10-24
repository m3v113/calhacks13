import { NextResponse } from "next/server";
import { db, categoryByName } from "@/lib/db";

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
