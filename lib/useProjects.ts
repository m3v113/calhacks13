"use client";
import { useCallback, useEffect, useState } from "react";

export type ProjectCard = { id: string; title: string; color: string | null; canvasX: number; canvasY: number; count: number };
export type Suggestion = { title: string; sections: { type: string; title: string }[]; by: "ai" | "template" };

const json = (body: object) => ({ headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

// The projects on the Hub.
export function useProjects() {
  const [projects, setProjects] = useState<ProjectCard[]>([]);

  const load = useCallback(async () => {
    try { setProjects(await (await fetch("/api/projects", { cache: "no-store" })).json()); } catch {}
  }, []);
  useEffect(() => {
    load();
    window.addEventListener("focus", load);
    return () => window.removeEventListener("focus", load);
  }, [load]);

  const suggest = useCallback(async (goal: string): Promise<Suggestion | null> => {
    const r = await fetch("/api/projects/suggest", { method: "POST", ...json({ goal }) });
    return r.ok ? r.json() : null;
  }, []);

  const create = useCallback(async (goal: string, s: Suggestion, x: number, y: number) => {
    const r = await fetch("/api/projects", { method: "POST", ...json({ goal, title: s.title, sections: s.sections, x, y }) });
    if (r.ok) { const p = await r.json(); setProjects((ps) => [...ps, p]); return p as ProjectCard; }
    return null;
  }, []);

  const move = useCallback((id: string, canvasX: number, canvasY: number) => {
    setProjects((ps) => ps.map((p) => (p.id === id ? { ...p, canvasX, canvasY } : p)));
  }, []);
  const place = useCallback((id: string, canvasX: number, canvasY: number) => {
    fetch(`/api/projects/${id}`, { method: "PATCH", ...json({ canvasX, canvasY }) });
  }, []);

  // Link an inbox item to a project.
  const link = useCallback(async (itemId: string, projectId: string | null) => {
    await fetch(`/api/items/${itemId}`, { method: "PATCH", ...json({ projectId }) });
    load();
  }, [load]);

  return { projects, load, suggest, create, move, place, link };
}
