import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Draw a line between two projects: { fromId, toId }. Drawing the same line again returns the one that's there.
export async function POST(req: Request) {
  const { fromId, toId } = await req.json().catch(() => ({}));
  if (typeof fromId !== "string" || typeof toId !== "string" || fromId === toId) return NextResponse.json({ error: "bad link" }, { status: 400 });
  const existing = await db.projectLink.findFirst({ where: { OR: [{ fromId, toId }, { fromId: toId, toId: fromId }] } });
  if (existing) return NextResponse.json(existing);
  try {
    return NextResponse.json(await db.projectLink.create({ data: { fromId, toId } }));
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}
