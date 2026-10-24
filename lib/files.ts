import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

// Uploads live next to the database, in data/uploads/.
export const UPLOADS = path.join(process.cwd(), "data", "uploads");
export const MAX_BYTES = 25 * 1024 * 1024;

const TEXT = /\.(txt|md|markdown|csv|json|html?)$/i;

export async function saveUpload(file: File) {
  await mkdir(UPLOADS, { recursive: true });
  const safe = file.name.replace(/[^\w.-]+/g, "_").slice(-80) || "file";
  const name = `${randomUUID()}-${safe}`;
  await writeFile(path.join(UPLOADS, name), Buffer.from(await file.arrayBuffer()));
  return name;
}

export function fullPath(name: string) {
  // Only files directly inside data/uploads/ can be read.
  return path.join(UPLOADS, path.basename(name));
}

// Pulls readable text out of a document, for sorting and titles.
export async function extractText(name: string, mime: string, original: string) {
  const buf = await readFile(fullPath(name));
  try {
    if (mime === "application/pdf" || /\.pdf$/i.test(original)) {
      const { extractText: pdfText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(buf));
      const { text } = await pdfText(pdf, { mergePages: true });
      return String(text).slice(0, 20_000);
    }
    if (mime.startsWith("text/") || TEXT.test(original)) return buf.toString("utf8").slice(0, 20_000);
  } catch (e) {
    console.warn("[files] could not read text:", (e as Error).message);
  }
  return null;
}

export async function asBase64(name: string) {
  return (await readFile(fullPath(name))).toString("base64");
}
