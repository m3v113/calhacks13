"use client";
import { useCallback, useEffect, useState } from "react";

export type Kind = "space" | "auto";
export type ProjectCard = { id: string; title: string; color: string | null; kind: Kind; canvasX: number; canvasY: number; cardW: number; cardH: number };
export type Line = { id: string; fromId: string; toId: string; color: string | null };
export type SectionDraft = { type: string; title: string; key?: string }; // key: only for lists on screen
export type Suggestion = { title: string; kind: Kind; sections: SectionDraft[]; by: "ai" | "template" };

const json = (body: object) => ({ headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

// The projects on the Hub and the lines between them.
export function useProjects() {
  const [projects, setProjects] = useState<ProjectCard[]>([]);
  const [lines, setLines] = useState<Line[]>([]);

  const load = useCallback(async () => {
    try {
      const data = await (await fetch("/api/projects", { cache: "no-store" })).json();
      setProjects(data.projects);
      setLines(data.links);
    } catch {}
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

  // Auto projects send what the AI should start from instead of sections.
  const create = useCallback(async (goal: string, s: Suggestion, x: number, y: number, start?: { context: string; itemIds: string[] }) => {
    const body = s.kind === "auto" ? { goal, title: s.title, kind: s.kind, x, y, ...start } : { goal, title: s.title, kind: s.kind, sections: s.sections, x, y };
    const r = await fetch("/api/projects", { method: "POST", ...json(body) });
    if (r.ok) { const p = await r.json(); setProjects((ps) => [...ps, p]); return p as ProjectCard; }
    return null;
  }, []);

  // Change a card on screen right away (while dragging or resizing); save() stores it.
  const change = useCallback((id: string, c: Partial<ProjectCard>) => {
    setProjects((ps) => ps.map((p) => (p.id === id ? { ...p, ...c } : p)));
  }, []);
  const save = useCallback((id: string, c: Partial<ProjectCard>) => {
    setProjects((ps) => ps.map((p) => (p.id === id ? { ...p, ...c } : p)));
    fetch(`/api/projects/${id}`, { method: "PATCH", ...json(c) });
  }, []);

  const remove = useCallback((id: string) => {
    setProjects((ps) => ps.filter((p) => p.id !== id));
    setLines((ls) => ls.filter((l) => l.fromId !== id && l.toId !== id));
    fetch(`/api/projects/${id}`, { method: "DELETE" });
  }, []);

  // Add an inbox item to a project's sources.
  const link = useCallback(async (itemId: string, projectId: string | null) => {
    await fetch(`/api/items/${itemId}`, { method: "PATCH", ...json({ projectId }) });
    load();
  }, [load]);

  const connect = useCallback(async (fromId: string, toId: string) => {
    const r = await fetch("/api/links", { method: "POST", ...json({ fromId, toId }) });
    if (r.ok) { const l: Line = await r.json(); setLines((ls) => (ls.some((x) => x.id === l.id) ? ls : [...ls, l])); }
  }, []);
  const recolorLine = useCallback((id: string, color: string) => {
    setLines((ls) => ls.map((l) => (l.id === id ? { ...l, color } : l)));
    fetch(`/api/links/${id}`, { method: "PATCH", ...json({ color }) });
  }, []);
  const removeLine = useCallback((id: string) => {
    setLines((ls) => ls.filter((l) => l.id !== id));
    fetch(`/api/links/${id}`, { method: "DELETE" });
  }, []);

  return { projects, lines, load, suggest, create, change, save, remove, link, connect, recolorLine, removeLine };
}
