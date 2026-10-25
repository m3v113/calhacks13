"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Kind, Line, ProjectCard, Side, Suggestion, useProjects } from "@/lib/useProjects";
import type { Item, useInbox } from "@/lib/useInbox";
import { DRAG } from "./Inbox";
import Swatches from "./Swatches";
import InboxPicker, { itemName } from "./InboxPicker";
import { names } from "@/lib/names";
import { CloseIcon, EditIcon, GripIcon, LockIcon, MoreIcon, PlusIcon, TrashIcon } from "./Icons";

type Projects = ReturnType<typeof useProjects>;
type View = { x: number; y: number; z: number };
export type Draft = { from: string; side: Side; x: number; y: number; near: string[]; to: string | null };

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

// Dark or light text, whichever reads better on a color.
export function inkOn(color: string | null) {
  const m = color?.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return "var(--ink)";
  const [r, g, b] = m.slice(1).map((h) => parseInt(h, 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.6 ? "#1d1d1f" : "#ffffff";
}

const SIDES = ["top", "right", "bottom", "left"] as const;

// A project card on the Hub canvas, filled with the project's color. Drag to move it, click to open it,
// drop an inbox item on it to add it, drag its corner to resize it, and drag a circle on its edge to
// another card to link them. ⋯ renames, recolors, or deletes it.
export function Card({ project, projects, view, draft, onConnect }: {
  project: ProjectCard; projects: Projects; view: View; draft: Draft | null; onConnect: (id: string, side: Side, e: React.PointerEvent) => void;
}) {
  const router = useRouter();
  const drag = useRef<{ x: number; y: number; moved: boolean; resize: boolean } | null>(null);
  const [over, setOver] = useState(false);
  const [pulse, setPulse] = useState(false);
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(project.title);
  const menuRef = useDismiss<HTMLDivElement>(menu, () => setMenu(false));
  useEffect(() => setTitle(project.title), [project.title]);

  const start = (resize: boolean) => (e: React.PointerEvent) => {
    if (e.button !== 0 || renaming) return;
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
  const end = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.moved) projects.save(project.id, d.resize ? { cardW: project.cardW, cardH: project.cardH } : { canvasX: project.canvasX, canvasY: project.canvasY });
    else if (!d.resize) router.push(`/p/${project.id}`);
  };
  const rename = () => {
    setRenaming(false);
    const t = title.trim();
    if (!t) setTitle(project.title);
    else if (t !== project.title) projects.save(project.id, { title: t });
  };

  // While a line is being drawn, cards near its end show their circles, and the one under it lights up.
  const near = !!draft && draft.from !== project.id && draft.near.includes(project.id);
  const target = !!draft && draft.to === project.id;
  const ink = inkOn(project.color);
  const stop = (e: React.PointerEvent) => e.stopPropagation();

  return (
    <div
      className={`card ${over ? "over" : ""} ${pulse ? "pulse" : ""} ${near ? "near" : ""} ${target ? "target" : ""} ${draft?.from === project.id ? "source" : ""}`}
      data-card={project.id}
      style={{ left: project.canvasX, top: project.canvasY, width: project.cardW, height: project.cardH, background: project.color ?? "var(--surface)", color: ink }}
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
      {renaming ? (
        <input className="card-title" autoFocus value={title} aria-label="Project name" onPointerDown={stop}
          onChange={(e) => setTitle(e.target.value)} onBlur={rename}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") { setTitle(project.title); setRenaming(false); } }} />
      ) : (
        <div className="card-title">{project.title}</div>
      )}
      <div className={`card-more ${menu ? "shown" : ""}`} ref={menuRef} onPointerDown={stop}>
        <button aria-label="Edit project" aria-expanded={menu} onClick={() => setMenu(!menu)}><MoreIcon /></button>
        {menu && (
          <div className="menu card-menu">
            <button onClick={() => { setMenu(false); setRenaming(true); }}><EditIcon />Rename</button>
            <Swatches value={project.color} onPick={(color) => projects.save(project.id, { color })} />
            <button className="danger" onClick={() => {
              setMenu(false);
              if (confirm(`Delete "${project.title}"? Its Project Dump goes back to the ${names.inbox}.`)) projects.remove(project.id);
            }}><TrashIcon />Delete</button>
          </div>
        )}
      </div>
      {SIDES.map((side) => (
        <span key={side} className={`connect ${side}`} aria-label="Drag to another project to link them"
          onPointerDown={(e) => { e.stopPropagation(); onConnect(project.id, side, e); }} />
      ))}
      {/* Its moves bubble up to the card's handlers. */}
      <span className="resize" aria-label="Resize" onPointerDown={start(true)} />
    </div>
  );
}

const center = (p: ProjectCard) => ({ x: p.canvasX + p.cardW / 2, y: p.canvasY + p.cardH / 2 });
// The circle in the middle of a card's side.
export const anchor = (p: ProjectCard, side: Side) => ({
  x: p.canvasX + (side === "left" ? 0 : side === "right" ? p.cardW : p.cardW / 2),
  y: p.canvasY + (side === "top" ? 0 : side === "bottom" ? p.cardH : p.cardH / 2),
});
// The side of a card that faces a point: lines drawn before sides were saved use it, and so does the card a line is dropped on.
export function facing(p: ProjectCard, x: number, y: number): Side {
  const c = center(p);
  const dx = (x - c.x) / p.cardW, dy = (y - c.y) / p.cardH;
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "bottom" : "top");
}

// The lines between linked projects, under the cards. Click one to recolor or remove it.
export function Lines({ projects, draft }: { projects: Projects; draft: Draft | null }) {
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
          const p = anchor(a, l.fromSide ?? facing(a, center(b).x, center(b).y));
          const q = anchor(b, l.toSide ?? facing(b, center(a).x, center(a).y));
          return (
            <g key={l.id}>
              <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={l.color ?? "var(--muted)"} strokeWidth={3} strokeLinecap="round" />
              <line className="hit" x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke="transparent" strokeWidth={16}
                onPointerDown={(e) => e.stopPropagation()} onClick={(e) => {
                  // Open the menu where the line was clicked (in canvas coordinates).
                  const svg = (e.currentTarget.ownerSVGElement as SVGSVGElement).getScreenCTM();
                  const pt = svg ? new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.inverse()) : { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
                  setOpen({ id: l.id, x: pt.x, y: pt.y });
                }} />
            </g>
          );
        })}
        {from && <line x1={anchor(from, draft.side).x} y1={anchor(from, draft.side).y} x2={draft.x} y2={draft.y} stroke="var(--muted)" strokeWidth={3} strokeDasharray="6 6" strokeLinecap="round" />}
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

const KIND_TEXT: Record<Kind, string> = {
  space: "A workspace you set up: writing, tasks, and sources, arranged your way.",
  auto: "The AI lays it out for you: what to know, what to get, and what to do. Give it anything that helps.",
};

// Space or Auto, with a line on what each one means.
function KindSwitch({ value, onChange }: { value: Kind; onChange: (k: Kind) => void }) {
  return (
    <div className="kind">
      <div className="kind-switch" role="radiogroup" aria-label="Kind of project">
        {(["space", "auto"] as const).map((k) => (
          <button key={k} role="radio" aria-checked={value === k} className={value === k ? "on" : ""} onClick={() => onChange(k)}>
            {k === "space" ? "Space" : "Auto"}
          </button>
        ))}
      </div>
      <p className="kind-text">{KIND_TEXT[value]}</p>
    </div>
  );
}

const TYPES = [{ type: "writing", label: "Writing" }, { type: "tasks", label: "Tasks" }, { type: "assistant", label: "AI" }];

// "+" on the Hub: one sentence → a suggested name and kind → for a Space, its sections (reorder, rename,
// retype, add); for Auto, what the AI should start from → create.
export function NewProject({ projects, inbox, at }: { projects: Projects; inbox: ReturnType<typeof useInbox>; at: () => { x: number; y: number } }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [goal, setGoal] = useState("");
  const [busy, setBusy] = useState(false);
  const [s, setS] = useState<Suggestion | null>(null);
  const [context, setContext] = useState("");
  const [picked, setPicked] = useState<Item[]>([]);
  const [picking, setPicking] = useState(false);
  const [dragging, setDragging] = useState<number | null>(null);
  const list = useRef<HTMLUListElement>(null);
  const pickRef = useDismiss<HTMLDivElement>(picking, () => setPicking(false));

  const reset = () => { setOpen(false); setGoal(""); setS(null); setBusy(false); setContext(""); setPicked([]); setPicking(false); };
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && !picking && reset();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [open, picking]);

  const ask = async () => {
    if (!goal.trim() || busy) return;
    setBusy(true);
    const got = await projects.suggest(goal.trim());
    setS(got && { ...got, sections: got.sections.map((x) => ({ ...x, key: Math.random().toString(36).slice(2) })) });
    setBusy(false);
  };
  const create = async () => {
    if (!s || !s.title.trim() || busy) return;
    setBusy(true);
    const { x, y } = at();
    const p = await projects.create(goal.trim(), s, x, y, { context, itemIds: picked.map((i) => i.id) });
    reset();
    if (p) router.push(`/p/${p.id}`);
  };
  const setSection = (i: number, c: Partial<Suggestion["sections"][number]>) =>
    s && setS({ ...s, sections: s.sections.map((x, j) => (j === i ? { ...x, ...c } : x)) });
  const addSection = (type: string, label: string) => {
    if (!s) return;
    const n = s.sections.filter((x) => x.title === label || x.title.startsWith(`${label} `)).length;
    const at = s.sections.findIndex((x) => x.type === "sources");
    const next = [...s.sections];
    next.splice(at < 0 ? next.length : at, 0, { type, title: n ? `${label} ${n + 1}` : label, key: Math.random().toString(36).slice(2) });
    setS({ ...s, sections: next });
  };

  // Drag a section by its dots to put it somewhere else in the list.
  const startMove = (i: number) => (e: React.PointerEvent) => {
    if (!s) return;
    e.preventDefault();
    let from = i;
    let order = s.sections;
    setDragging(from);
    const move = (ev: PointerEvent) => {
      const rows = Array.from(list.current?.children ?? []) as HTMLElement[];
      // The Project Dump always stays last.
      const last = order.findIndex((x) => x.type === "sources");
      const to = Math.min(rows.filter((r, j) => j !== from && r.getBoundingClientRect().top + r.offsetHeight / 2 < ev.clientY).length, last < 0 ? order.length - 1 : last - 1);
      if (to === from) return;
      const next = [...order];
      next.splice(to, 0, next.splice(from, 1)[0]);
      order = next;
      from = to;
      setDragging(to);
      setS((cur) => (cur ? { ...cur, sections: next } : cur));
    };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); setDragging(null); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
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
          <input className="title" autoFocus value={s.title} aria-label="Project name" onChange={(e) => setS({ ...s, title: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && create()} />
          <KindSwitch value={s.kind} onChange={(kind) => setS({ ...s, kind })} />
          {s.kind === "space" ? (
            <>
              <ul className="np-sections" ref={list}>
                {s.sections.map((sec, i) => sec.type === "sources" ? (
                  // The Project Dump: always there, so it's shown apart, not as a section to edit.
                  <li key={sec.key ?? i} className="np-dump">
                    <span className="np-lock" aria-hidden="true"><LockIcon /></span>
                    <span className="np-dump-name">{names.projectDump}</span>
                    <span className="np-dump-text">This project&apos;s own links, notes, and files</span>
                  </li>
                ) : (
                  <li key={sec.key ?? i} className={dragging === i ? "lifted" : ""}>
                    <span className="np-grip" aria-label="Drag to reorder" onPointerDown={startMove(i)}><GripIcon /></span>
                    {sec.type === "sources" ? <span className="np-type">{names.projectDump}</span> : (
                      <select className="np-type" value={sec.type} aria-label="Section type" onChange={(e) => setSection(i, { type: e.target.value })}>
                        {TYPES.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}
                      </select>
                    )}
                    <input value={sec.title} aria-label="Section name" onChange={(e) => setSection(i, { title: e.target.value })} />
                    {sec.type === "sources"
                      ? <span className="np-lock" aria-label={`Every project has a ${names.projectDump}`} data-tip={`Every project has a ${names.projectDump}`}><LockIcon /></span>
                      : <button aria-label={`Remove ${sec.title}`} onClick={() => setS({ ...s, sections: s.sections.filter((_, j) => j !== i) })}><CloseIcon /></button>}
                  </li>
                ))}
              </ul>
              <div className="np-add">
                {TYPES.map((t) => <button key={t.type} onClick={() => addSection(t.type, t.label)}><PlusIcon />{t.label}</button>)}
              </div>
              <p className="kind-text">Writing is formatted text, like an outline or an essay&apos;s parts. Tasks is a checklist. AI answers requests about the project, like making tasks or citations.</p>
            </>
          ) : (
            <div className="np-start">
              <textarea value={context} rows={3} aria-label="What the AI should know"
                placeholder="Links, notes, or anything the AI should know (optional)" onChange={(e) => setContext(e.target.value)} />
              {picked.length > 0 && (
                <div className="np-picked">
                  {picked.map((i) => (
                    <span key={i.id} className="chip">{itemName(i)}
                      <button aria-label={`Remove ${itemName(i)}`} onClick={() => setPicked(picked.filter((x) => x.id !== i.id))}><CloseIcon /></button>
                    </span>
                  ))}
                </div>
              )}
              <div className="np-add" ref={pickRef}>
                <button aria-expanded={picking} onClick={() => setPicking(!picking)}><PlusIcon />From {names.inbox}</button>
                {picking && <InboxPicker inbox={inbox} inline exclude={new Set(picked.map((i) => i.id))} onPick={(i) => setPicked([...picked, i])} />}
              </div>
            </div>
          )}
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
