import { NextResponse, after } from "next/server";
import { db, ensureSeed } from "@/lib/db";
import { firstUrl } from "@/lib/link";
import { MAX_BYTES, extractText, saveUpload } from "@/lib/files";
import { sortItem, sweep } from "@/lib/sort";
import { dueFields } from "@/lib/due";

// The Pantry: categories (with counts) and items that aren't archived. Items in a project live in that
// project's own Pantry, so they aren't listed here; the main one holds what's still to be sorted into projects.
export async function GET() {
  await ensureSeed();
  const where = { archived: false, projectId: null };
  const [categories, items] = await Promise.all([
    db.category.findMany({ orderBy: { createdAt: "asc" }, include: { _count: { select: { items: { where } } } } }),
    db.item.findMany({ where, orderBy: { createdAt: "desc" }, take: 500, omit: { extracted: true } }),
  ]);
  after(sweep);
  return NextResponse.json({
    categories: categories.map(({ _count, ...c }) => ({ ...c, count: _count.items })),
    items,
  });
}

// Add a note or link (JSON: { text, kind?, projectId?, dueDate?, dueTime?, priority? }) or a file (form data: file, projectId?).
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

  const body = await req.json().catch(() => ({}));
  const { text, kind, projectId, title, summary } = body;
  const clean = typeof text === "string" ? text.trim().slice(0, 10_000) : "";
  if (!clean) return NextResponse.json({ error: "empty" }, { status: 400 });
  const url = firstUrl(clean);
  // Typing makes a note; a bare link (or one added as a link) makes a link.
  const isLink = url !== null && (kind === "link" || clean === url);
  // A link saved from Resources or a Scout comes with its title and summary, so its page isn't read again.
  const given = isLink && typeof title === "string" && title.trim() && typeof summary === "string" && summary.trim()
    ? { title: title.trim().slice(0, 200), titleBy: "user", summary: summary.trim().slice(0, 1200), overview: summary.trim().slice(0, 1200), overviewBy: "user" }
    : {};
  const item = await db.item.create({ data: { kind: isLink ? "link" : "note", text: clean, url, projectId: await projectOf(projectId), ...given, ...dueFields(body) } });
  after(() => sortItem(item.id));
  return NextResponse.json(item, { status: 201 });
}

// A project id from the request, if that project exists.
async function projectOf(id: unknown) {
  if (typeof id !== "string" || !id) return null;
  return (await db.project.findUnique({ where: { id }, select: { id: true } }))?.id ?? null;
}
