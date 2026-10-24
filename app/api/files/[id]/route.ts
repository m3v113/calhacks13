import { readFile } from "node:fs/promises";
import { db } from "@/lib/db";
import { fullPath } from "@/lib/files";

// Serves an uploaded file (for thumbnails and opening it).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await db.item.findUnique({ where: { id } });
  if (!item?.filePath) return new Response("Not found", { status: 404 });
  try {
    const body = await readFile(fullPath(item.filePath));
    return new Response(new Uint8Array(body), {
      headers: {
        // Never render an uploaded page as HTML.
        "content-type": /html|xml|javascript/.test(item.mime ?? "") ? "text/plain; charset=utf-8" : (item.mime ?? "application/octet-stream"),
        "content-disposition": `inline; filename="${encodeURIComponent(item.fileName ?? "file")}"`,
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
