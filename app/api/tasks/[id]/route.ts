import { NextResponse } from "next/server";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

// Check off or reword a task.
export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (typeof body.done === "boolean") data.done = body.done;
  if (typeof body.text === "string" && body.text.trim()) data.text = body.text.trim().slice(0, 500);
  try {
    return NextResponse.json(await db.task.update({ where: { id }, data }));
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  await db.task.delete({ where: { id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
