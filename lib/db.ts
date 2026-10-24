import { PrismaClient } from "@prisma/client";
import { PALETTE, STARTER_COLORS } from "./colors";

const g = globalThis as unknown as { prisma?: PrismaClient };
export const db = g.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") g.prisma = db;

// Starter categories; the AI adds more when nothing fits.
const STARTERS = Object.entries(STARTER_COLORS).map(([name, color]) => ({ name, color }));

let seeded = false;
export async function ensureSeed() {
  if (seeded) return;
  if ((await db.category.count()) === 0) {
    await db.category.createMany({ data: STARTERS.map((c) => ({ ...c, auto: false })) });
  }
  seeded = true;
}

export async function nextColor() {
  const used = new Set((await db.category.findMany({ select: { color: true } })).map((c) => c.color));
  return PALETTE.find((c) => !used.has(c)) ?? PALETTE[(await db.category.count()) % PALETTE.length];
}

// Finds a category by name (any case), or creates it.
export async function categoryByName(raw: string, auto: boolean) {
  const name = cleanName(raw);
  if (!name) return null;
  const all = await db.category.findMany();
  const hit = all.find((c) => c.name.toLowerCase() === name.toLowerCase());
  if (hit) return hit;
  return db.category.create({ data: { name, color: await nextColor(), auto } });
}

export function cleanName(raw: string) {
  const s = raw.replace(/[^\p{L}\p{N} &'-]/gu, "").replace(/\s+/g, " ").trim().slice(0, 24);
  return s ? s[0].toUpperCase() + s.slice(1) : "";
}
