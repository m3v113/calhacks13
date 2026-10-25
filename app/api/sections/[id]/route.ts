import { NextResponse } from "next/server";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

// Rename a section, change its width (span 1 or 2), save its text, or keep one the AI made ({ proposed: false }).
export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (typeof body.title === "string" && body.title.trim()) data.title = body.title.trim().slice(0, 40);
  if (typeof body.notes === "string") data.notes = body.notes.slice(0, 200_000);
  if (body.span === 1 || body.span === 2) data.span = body.span;
  if (body.proposed === false) data.proposed = false;
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
