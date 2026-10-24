import { NextResponse, after } from "next/server";
import { db, ensureSeed } from "@/lib/db";
import { firstUrl } from "@/lib/link";
import { sortItem, sweep } from "@/lib/sort";

// The whole inbox: categories (with counts) and items that aren't archived.
export async function GET() {
  await ensureSeed();
  const [categories, items] = await Promise.all([
    db.category.findMany({ orderBy: { createdAt: "asc" }, include: { _count: { select: { items: { where: { archived: false } } } } } }),
    db.item.findMany({ where: { archived: false }, orderBy: { createdAt: "desc" }, take: 500 }),
  ]);
  after(sweep);
  return NextResponse.json({
    categories: categories.map(({ _count, ...c }) => ({ ...c, count: _count.items })),
    items,
  });
}

export async function POST(req: Request) {
  const { text } = await req.json().catch(() => ({}));
  const clean = typeof text === "string" ? text.trim().slice(0, 10_000) : "";
  if (!clean) return NextResponse.json({ error: "empty" }, { status: 400 });
  const item = await db.item.create({ data: { text: clean, url: firstUrl(clean) } });
  after(() => sortItem(item.id));
  return NextResponse.json(item, { status: 201 });
}
