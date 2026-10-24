"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export type Category = { id: string; name: string; color: string; count: number };
export type Item = {
  id: string;
  kind: string; // "note" | "link" | "image" | "document"
  text: string;
  fileName: string | null;
  mime: string | null;
  summary: string | null;
  url: string | null;
  title: string | null;
  categoryId: string | null;
  sortedBy: string;
  createdAt: string;
};

// Shared inbox state for the Inbox page and the Hub panel.
export function useInbox() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [ai, setAi] = useState<boolean | null>(null);
  const [vision, setVision] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const load = useCallback(async () => {
    clearTimeout(timer.current);
    try {
      const r = await fetch("/api/items", { cache: "no-store" });
      const data = await r.json();
      setCategories(data.categories);
      setItems(data.items);
      // Poll quickly while something is still sorting, slowly otherwise.
      const waiting = data.items.some((i: Item) => i.sortedBy === "pending");
      timer.current = setTimeout(load, waiting ? 1200 : 15000);
    } catch {
      timer.current = setTimeout(load, 5000);
    }
  }, []);

  const loadStatus = useCallback(async () => {
    try {
      const s = await (await fetch("/api/status", { cache: "no-store" })).json();
      setAi(s.ai);
      setVision(s.vision);
    } catch {
      setAi(null);
    }
  }, []);

  useEffect(() => {
    load();
    loadStatus();
    const s = setInterval(loadStatus, 10000);
    const onFocus = () => { load(); loadStatus(); };
    window.addEventListener("focus", onFocus);
    return () => { clearTimeout(timer.current); clearInterval(s); window.removeEventListener("focus", onFocus); };
  }, [load, loadStatus]);

  const placeholder = (kind: string, text: string, fileName: string | null = null): Item => ({
    id: `tmp-${Math.random()}`, kind, text, fileName, mime: null, summary: null, url: null, title: null,
    categoryId: null, sortedBy: "pending", createdAt: new Date().toISOString(),
  });

  const add = useCallback(async (text: string, kind: "note" | "link" = "note") => {
    setItems((xs) => [placeholder(kind, text), ...xs]);
    await fetch("/api/items", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, kind }) });
    load();
  }, [load]);

  const upload = useCallback(async (files: File[]) => {
    setItems((xs) => [...files.map((f) => placeholder(f.type.startsWith("image/") ? "image" : "document", f.name, f.name)), ...xs]);
    await Promise.all(files.map((f) => {
      const form = new FormData();
      form.append("file", f);
      return fetch("/api/items", { method: "POST", body: form });
    }));
    load();
  }, [load]);

  const patch = useCallback(async (id: string, body: object) => {
    await fetch(`/api/items/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    load();
  }, [load]);

  const setCategory = useCallback((id: string, categoryId: string) => {
    setItems((xs) => xs.map((i) => (i.id === id ? { ...i, categoryId, sortedBy: "user" } : i)));
    return patch(id, { categoryId });
  }, [patch]);

  const newCategory = useCallback((id: string, categoryName: string) => patch(id, { categoryName }), [patch]);

  const archive = useCallback((id: string) => {
    setItems((xs) => xs.filter((i) => i.id !== id));
    return patch(id, { archived: true });
  }, [patch]);

  const remove = useCallback(async (id: string) => {
    setItems((xs) => xs.filter((i) => i.id !== id));
    await fetch(`/api/items/${id}`, { method: "DELETE" });
    load();
  }, [load]);

  return { categories, items, ai, vision, add, upload, setCategory, newCategory, archive, remove, refresh: load };
}
