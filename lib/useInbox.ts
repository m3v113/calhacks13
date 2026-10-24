"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export type Category = { id: string; name: string; color: string; count: number };
export type Item = {
  id: string;
  text: string;
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
      setAi((await (await fetch("/api/status", { cache: "no-store" })).json()).ai);
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

  const add = useCallback(async (text: string) => {
    const temp: Item = { id: `tmp-${Date.now()}`, text, url: null, title: null, categoryId: null, sortedBy: "pending", createdAt: new Date().toISOString() };
    setItems((xs) => [temp, ...xs]);
    await fetch("/api/items", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) });
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

  return { categories, items, ai, add, setCategory, newCategory, archive };
}
