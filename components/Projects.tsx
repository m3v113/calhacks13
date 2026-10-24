"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ProjectCard, Suggestion, useProjects } from "@/lib/useProjects";
import { DRAG } from "./Inbox";
import { CloseIcon, PlusIcon } from "./Icons";

type Projects = ReturnType<typeof useProjects>;
type View = { x: number; y: number; z: number };

// A project card on the Hub canvas. Drag to move it; click to open it; drop an inbox item on it to link it.
export function Card({ project, projects, view, onLinked }: { project: ProjectCard; projects: Projects; view: View; onLinked: () => void }) {
  const router = useRouter();
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const [over, setOver] = useState(false);
  const [pulse, setPulse] = useState(false);

  return (
    <div
      className={`card ${over ? "over" : ""} ${pulse ? "pulse" : ""}`}
      style={{ left: project.canvasX, top: project.canvasY }}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { x: e.clientX, y: e.clientY, moved: false };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        const dx = (e.clientX - d.x) / view.z;
        const dy = (e.clientY - d.y) / view.z;
        if (!d.moved && Math.hypot(dx, dy) < 3) return;
        d.moved = true;
        d.x = e.clientX; d.y = e.clientY;
        projects.move(project.id, project.canvasX + dx, project.canvasY + dy);
      }}
      onPointerUp={() => {
        const d = drag.current;
        drag.current = null;
        if (!d) return;
        if (d.moved) projects.place(project.id, project.canvasX, project.canvasY);
        else router.push(`/p/${project.id}`);
      }}
      onDragOver={(e) => { if (e.dataTransfer.types.includes(DRAG)) { e.preventDefault(); setOver(true); } }}
      onDragLeave={() => setOver(false)}
      onDrop={async (e) => {
        e.preventDefault();
        setOver(false);
        const item = e.dataTransfer.getData(DRAG);
        if (!item) return;
        await projects.link(item, project.id);
        setPulse(true);
        setTimeout(() => setPulse(false), 600);
        onLinked();
      }}
    >
      <span className="dot square" style={{ background: project.color ?? "var(--muted)" }} />
      <span className="name">{project.title}</span>
      {project.count > 0 && <span className="count">{project.count}</span>}
    </div>
  );
}

// "+" on the Hub: one sentence → a suggested title and sections → review → create.
export function NewProject({ projects, at }: { projects: Projects; at: () => { x: number; y: number } }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [goal, setGoal] = useState("");
  const [busy, setBusy] = useState(false);
  const [s, setS] = useState<Suggestion | null>(null);
  const box = useRef<HTMLDivElement>(null);

  const reset = () => { setOpen(false); setGoal(""); setS(null); setBusy(false); };
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && reset();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [open]);

  const ask = async () => {
    if (!goal.trim() || busy) return;
    setBusy(true);
    setS(await projects.suggest(goal.trim()));
    setBusy(false);
  };
  const create = async () => {
    if (!s || !s.title.trim() || busy) return;
    setBusy(true);
    const { x, y } = at();
    const p = await projects.create(goal.trim(), s, x, y);
    reset();
    if (p) router.push(`/p/${p.id}`);
  };

  if (!open) {
    return <button className="new-project" onClick={() => setOpen(true)} aria-label="New project" data-tip="New project"><PlusIcon /></button>;
  }
  return (
    <div className="new-project-box" ref={box}>
      {!s ? (
        <input autoFocus value={goal} placeholder="What's the project?" aria-label="What's the project?" disabled={busy}
          onChange={(e) => setGoal(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ask()} />
      ) : (
        <>
          <input className="title" autoFocus value={s.title} aria-label="Project name" onChange={(e) => setS({ ...s, title: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && create()} />
          <div className="chips">
            {s.sections.map((sec, i) => (
              <span key={i} className="chip">
                {sec.title}
                <button aria-label={`Remove ${sec.title}`} onClick={() => setS({ ...s, sections: s.sections.filter((_, j) => j !== i) })}><CloseIcon /></button>
              </span>
            ))}
          </div>
        </>
      )}
      {busy && <div className="pending-lines"><span /></div>}
      <div className="actions">
        <button onClick={reset}>Cancel</button>
        {s ? <button className="primary" onClick={create} disabled={busy}>Create</button>
          : <button className="primary" onClick={ask} disabled={busy || !goal.trim()}>Next</button>}
      </div>
    </div>
  );
}
