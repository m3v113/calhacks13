import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { COLORS } from "@/lib/colors";

type Ctx = { params: Promise<{ id: string }> };

// Recolor a line.
export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const { color } = await req.json().catch(() => ({}));
  if (typeof color !== "string" || !COLORS.includes(color)) return NextResponse.json({ error: "bad color" }, { status: 400 });
  try {
    return NextResponse.json(await db.projectLink.update({ where: { id }, data: { color } }));
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  await db.projectLink.delete({ where: { id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
