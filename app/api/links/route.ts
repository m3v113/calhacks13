import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const SIDES = ["top", "right", "bottom", "left"];

// Draw a line between two projects: { fromId, toId, fromSide?, toSide? }, from one card's circle to the other's.
// Drawing the same line again moves it to the new circles.
export async function POST(req: Request) {
  const { fromId, toId, fromSide, toSide } = await req.json().catch(() => ({}));
  if (typeof fromId !== "string" || typeof toId !== "string" || fromId === toId) return NextResponse.json({ error: "bad link" }, { status: 400 });
  const sides = { fromSide: SIDES.includes(fromSide) ? fromSide : null, toSide: SIDES.includes(toSide) ? toSide : null };
  const existing = await db.projectLink.findFirst({ where: { OR: [{ fromId, toId }, { fromId: toId, toId: fromId }] } });
  if (existing) {
    // Stored the way round it was first drawn, so the sides swap when it's drawn back the other way.
    const data = existing.fromId === fromId ? sides : { fromSide: sides.toSide, toSide: sides.fromSide };
    return NextResponse.json(await db.projectLink.update({ where: { id: existing.id }, data }));
  }
  try {
    return NextResponse.json(await db.projectLink.create({ data: { fromId, toId, ...sides } }));
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}
