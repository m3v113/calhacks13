"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Kind, Line, ProjectCard, Suggestion, useProjects } from "@/lib/useProjects";
import { DRAG } from "./Inbox";
import Swatches from "./Swatches";
import { CloseIcon, PlusIcon, TrashIcon } from "./Icons";

type Projects = ReturnType<typeof useProjects>;
type View = { x: number; y: number; z: number };

// Closes a popover when you click outside it or press Escape.
export function useDismiss<T extends HTMLElement>(open: boolean, close: () => void) {
  const ref = useRef<T>(null);
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && closeRef.current();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);
  return ref;
}

// Space or Auto.
export function KindSwitch({ value, onChange }: { value: Kind; onChange: (k: Kind) => void }) {
  return (
    <div className="kind-switch" role="radiogroup" aria-label="Kind of project">
      {(["space", "auto"] as const).map((k) => (
        <button key={k} role="radio" aria-checked={value === k} className={value === k ? "on" : ""} onClick={() => onChange(k)}>
          {k === "space" ? "Space" : "Auto"}
        </button>
      ))}
    </div>
  );
}

// A project card on the Hub canvas. Drag to move it, click to open it, drop an inbox item on it to add it,
// drag its corner to resize it, and drag the dot on its right edge to another card to link them.
export function Card({ project, projects, view, onConnect }: {
  project: ProjectCard; projects: Projects; view: View; onConnect: (id: string, e: React.PointerEvent) => void;
}) {
  const router = useRouter();
  const drag = useRef<{ x: number; y: number; moved: boolean; resize: boolean } | null>(null);
  const [over, setOver] = useState(false);
  const [pulse, setPulse] = useState(false);
  const [coloring, setColoring] = useState(false);
  const [title, setTitle] = useState(project.title);
  const colorRef = useDismiss<HTMLDivElement>(coloring, () => setColoring(false));
  useEffect(() => setTitle(project.title), [project.title]);

  const start = (resize: boolean) => (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, moved: false, resize };
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.x) / view.z;
    const dy = (e.clientY - d.y) / view.z;
    if (!d.moved && Math.hypot(dx, dy) < 3) return;
    d.moved = true;
    d.x = e.clientX; d.y = e.clientY;
    if (d.resize) projects.change(project.id, { cardW: Math.max(180, project.cardW + dx), cardH: Math.max(72, project.cardH + dy) });
    else projects.change(project.id, { canvasX: project.canvasX + dx, canvasY: project.canvasY + dy });
  };
  const end = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.moved) {
      projects.save(project.id, d.resize ? { cardW: project.cardW, cardH: project.cardH } : { canvasX: project.canvasX, canvasY: project.canvasY });
    } else if (!d.resize && !(e.target as HTMLElement).closest("input, button, .menu")) {
      router.push(`/p/${project.id}`);
    }
  };
  const rename = () => {
    const t = title.trim();
    if (!t) setTitle(project.title);
    else if (t !== project.title) projects.save(project.id, { title: t });
  };

  return (
    <div
      className={`card ${over ? "over" : ""} ${pulse ? "pulse" : ""}`} data-card={project.id}
      style={{ left: project.canvasX, top: project.canvasY, width: project.cardW, height: project.cardH }}
      onPointerDown={start(false)} onPointerMove={move} onPointerUp={end}
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
      }}
    >
      <div className="card-top">
        <div className="card-color" ref={colorRef}>
          <button className="dot square" style={{ background: project.color ?? "var(--muted)" }} aria-label="Color"
            onPointerDown={(e) => e.stopPropagation()} onClick={() => setColoring(!coloring)} />
          {coloring && (
            <div className="menu swatch-menu" onPointerDown={(e) => e.stopPropagation()}>
              <Swatches value={project.color} onPick={(color) => { projects.save(project.id, { color }); setColoring(false); }} />
            </div>
          )}
        </div>
        <input className="card-title" value={title} aria-label="Project name" onPointerDown={(e) => e.stopPropagation()}
          onChange={(e) => setTitle(e.target.value)} onBlur={rename}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") { setTitle(project.title); e.currentTarget.blur(); } }} />
      </div>
      <span className="card-kind">{project.kind === "auto" ? "Auto" : "Space"}</span>
      <span className="connect" aria-label="Drag to another project to link them" onPointerDown={(e) => { e.stopPropagation(); onConnect(project.id, e); }} />
      {/* Its moves bubble up to the card's handlers. */}
      <span className="resize" aria-label="Resize" onPointerDown={start(true)} />
    </div>
  );
}

const center = (p: ProjectCard) => ({ x: p.canvasX + p.cardW / 2, y: p.canvasY + p.cardH / 2 });

// The lines between linked projects, under the cards. Click one to recolor or remove it.
export function Lines({ projects, draft }: { projects: Projects; draft: { from: string; x: number; y: number } | null }) {
  const [open, setOpen] = useState<{ id: string; x: number; y: number } | null>(null);
  const ref = useDismiss<HTMLDivElement>(!!open, () => setOpen(null));
  const byId = new Map(projects.projects.map((p) => [p.id, p]));
  const from = draft && byId.get(draft.from);
  const line = open && projects.lines.find((l) => l.id === open.id);
  return (
    <>
      <svg className="lines" width="1" height="1">
        {projects.lines.map((l: Line) => {
          const a = byId.get(l.fromId), b = byId.get(l.toId);
          if (!a || !b) return null;
          const p = center(a), q = center(b);
          const color = l.color ?? "var(--muted)";
          return (
            <g key={l.id}>
              <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={color} strokeWidth={3} strokeLinecap="round" />
              <line className="hit" x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke="transparent" strokeWidth={16}
                onPointerDown={(e) => e.stopPropagation()} onClick={() => setOpen({ id: l.id, x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 })} />
            </g>
          );
        })}
        {from && <line x1={center(from).x} y1={center(from).y} x2={draft.x} y2={draft.y} stroke="var(--muted)" strokeWidth={3} strokeDasharray="6 6" strokeLinecap="round" />}
      </svg>
      {open && line && (
        <div className="menu line-menu" ref={ref} style={{ left: open.x, top: open.y }} onPointerDown={(e) => e.stopPropagation()}>
          <Swatches value={line.color} onPick={(c) => { projects.recolorLine(line.id, c); setOpen(null); }} />
          <button className="danger" onClick={() => { projects.removeLine(line.id); setOpen(null); }}><TrashIcon />Remove link</button>
        </div>
      )}
    </>
  );
}

const TYPES = [{ type: "writing", label: "Writing" }, { type: "tasks", label: "Tasks" }];

// "+" on the Hub: one sentence → a suggested name, kind, and sections → review → create.
export function NewProject({ projects, at }: { projects: Projects; at: () => { x: number; y: number } }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [goal, setGoal] = useState("");
  const [busy, setBusy] = useState(false);
  const [s, setS] = useState<Suggestion | null>(null);
  const [adding, setAdding] = useState(false);
  const addRef = useDismiss<HTMLDivElement>(adding, () => setAdding(false));

  const reset = () => { setOpen(false); setGoal(""); setS(null); setBusy(false); };
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && !adding && reset();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [open, adding]);

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
  const setSection = (i: number, c: Partial<Suggestion["sections"][number]>) =>
    s && setS({ ...s, sections: s.sections.map((x, j) => (j === i ? { ...x, ...c } : x)) });
  const addSection = (type: string, label: string) => {
    if (!s) return;
    const n = s.sections.filter((x) => x.title === label || x.title.startsWith(`${label} `)).length;
    // New sections go before Sources, which stays last.
    const at = s.sections.findIndex((x) => x.type === "sources");
    const list = [...s.sections];
    list.splice(at < 0 ? list.length : at, 0, { type, title: n ? `${label} ${n + 1}` : label });
    setS({ ...s, sections: list });
    setAdding(false);
  };

  if (!open) {
    return <button className="new-project" onClick={() => setOpen(true)} aria-label="New project" data-tip="New project"><PlusIcon /></button>;
  }
  return (
    <div className="new-project-box" onPointerDown={(e) => e.stopPropagation()}>
      {!s ? (
        <input autoFocus value={goal} placeholder="What's the project?" aria-label="What's the project?" disabled={busy}
          onChange={(e) => setGoal(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ask()} />
      ) : (
        <>
          <div className="np-head">
            <input className="title" autoFocus value={s.title} aria-label="Project name" onChange={(e) => setS({ ...s, title: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && create()} />
            <KindSwitch value={s.kind} onChange={(kind) => setS({ ...s, kind })} />
          </div>
          <ul className="np-sections">
            {s.sections.map((sec, i) => (
              <li key={i}>
                {sec.type === "sources" ? <span className="np-type">Sources</span> : (
                  <select className="np-type" value={sec.type} aria-label="Section type" onChange={(e) => setSection(i, { type: e.target.value })}>
                    {TYPES.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}
                  </select>
                )}
                <input value={sec.title} aria-label="Section name" onChange={(e) => setSection(i, { title: e.target.value })} />
                {sec.type !== "sources" && (
                  <button aria-label={`Remove ${sec.title}`} onClick={() => setS({ ...s, sections: s.sections.filter((_, j) => j !== i) })}><CloseIcon /></button>
                )}
              </li>
            ))}
          </ul>
          <div className="np-add" ref={addRef}>
            <button className="np-add-btn" aria-expanded={adding} onClick={() => setAdding(!adding)}><PlusIcon />Section</button>
            {adding && (
              <div className="menu left">
                {TYPES.map((t) => <button key={t.type} onClick={() => addSection(t.type, t.label)}>{t.label}</button>)}
              </div>
            )}
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
