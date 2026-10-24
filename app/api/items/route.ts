import { NextResponse, after } from "next/server";
import { db, ensureSeed } from "@/lib/db";
import { firstUrl } from "@/lib/link";
import { MAX_BYTES, extractText, saveUpload } from "@/lib/files";
import { sortItem, sweep } from "@/lib/sort";

// The whole inbox: categories (with counts) and items that aren't archived.
export async function GET() {
  await ensureSeed();
  const [categories, items] = await Promise.all([
    db.category.findMany({ orderBy: { createdAt: "asc" }, include: { _count: { select: { items: { where: { archived: false } } } } } }),
    db.item.findMany({ where: { archived: false }, orderBy: { createdAt: "desc" }, take: 500, omit: { extracted: true } }),
  ]);
  after(sweep);
  return NextResponse.json({
    categories: categories.map(({ _count, ...c }) => ({ ...c, count: _count.items })),
    items,
  });
}

// Add a note or link (JSON: { text, kind?, projectId? }) or a file (form data: file, projectId?).
// With a projectId, the item is also one of that project's sources.
export async function POST(req: Request) {
  if ((req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "no file" }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "too big" }, { status: 413 });
    const mime = file.type || "application/octet-stream";
    const filePath = await saveUpload(file);
    const kind = mime.startsWith("image/") ? "image" : "document";
    const extracted = kind === "document" ? await extractText(filePath, mime, file.name) : null;
    const item = await db.item.create({ data: { kind, text: file.name, fileName: file.name, filePath, mime, extracted, projectId: await projectOf(form?.get("projectId")) } });
    after(() => sortItem(item.id));
    return NextResponse.json(item, { status: 201 });
  }

  const { text, kind, projectId } = await req.json().catch(() => ({}));
  const clean = typeof text === "string" ? text.trim().slice(0, 10_000) : "";
  if (!clean) return NextResponse.json({ error: "empty" }, { status: 400 });
  const url = firstUrl(clean);
  // Typing makes a note; a bare link (or one added as a link) makes a link.
  const isLink = url !== null && (kind === "link" || clean === url);
  const item = await db.item.create({ data: { kind: isLink ? "link" : "note", text: clean, url, projectId: await projectOf(projectId) } });
  after(() => sortItem(item.id));
  return NextResponse.json(item, { status: 201 });
}

// A project id from the request, if that project exists.
async function projectOf(id: unknown) {
  if (typeof id !== "string" || !id) return null;
  return (await db.project.findUnique({ where: { id }, select: { id: true } }))?.id ?? null;
}
