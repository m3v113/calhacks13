import { NextResponse } from "next/server";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

// Rename a section, or save the text of a notes section.
export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (typeof body.title === "string" && body.title.trim()) data.title = body.title.trim().slice(0, 40);
  if (typeof body.notes === "string") data.notes = body.notes.slice(0, 50_000);
  try {
    return NextResponse.json(await db.section.update({ where: { id }, data }));
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  await db.section.delete({ where: { id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
