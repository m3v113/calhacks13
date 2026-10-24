"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useInbox, type Item } from "@/lib/useInbox";
import { PALETTE } from "@/lib/colors";
import ItemView, { Field } from "./ItemView";
import { fromUrl } from "./Inbox";
import { BackIcon, CheckIcon, CloseIcon, GripIcon, PlusIcon, RefreshIcon, TrashIcon } from "./Icons";

type Task = { id: string; text: string; done: boolean };
type Section = { id: string; type: string; title: string; notes: string | null; tasks: Task[] };
type Project = {
  id: string; title: string; goal: string | null; color: string | null;
  overview: string | null; overviewBy: string | null; sections: Section[]; items: Item[];
};

const SECTION = "application/x-section";
const TYPES = [
  { type: "tasks", label: "Tasks" },
  { type: "notes", label: "Notes" },
  { type: "items", label: "Items" },
  { type: "providers", label: "Help nearby" },
];

const api = (url: string, method: string, body?: object) =>
  fetch(url, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });

const itemName = (i: Item) => i.title ?? i.fileName ?? (i.url && fromUrl(i.url)) ?? i.url ?? i.text;

// Closes a popover when you click outside it or press Escape.
function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && close();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open, close]);
  return ref;
}

// A one-line input that saves when you press Enter or leave it.
function Line({ value, onSave, className, label, placeholder }: { value: string; onSave: (v: string) => void; className?: string; label: string; placeholder?: string }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  const save = () => { const t = v.trim(); if (!t) setV(value); else if (t !== value) onSave(t); };
  return (
    <input className={className} value={v} aria-label={label} placeholder={placeholder} onChange={(e) => setV(e.target.value)} onBlur={save}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") { setV(value); e.currentTarget.blur(); } }} />
  );
}

// A project: its summary on the left, its sections in the middle. Everything saves as you go.
export default function ProjectSpace({ id }: { id: string }) {
  const router = useRouter();
  const inbox = useInbox();
  const [project, setProject] = useState<Project | null>(null);
  const [missing, setMissing] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const [coloring, setColoring] = useState(false);
  const [adding, setAdding] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [gaveUp, setGaveUp] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(`/api/projects/${id}`, { cache: "no-store" });
    if (r.ok) setProject(await r.json());
    else if (r.status === 404) setMissing(true);
  }, [id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (project) document.title = project.title; }, [project?.title]); // eslint-disable-line react-hooks/exhaustive-deps

  const closeColor = useCallback(() => setColoring(false), []);
  const closeAdd = useCallback(() => setAdding(false), []);
  const colorRef = useDismiss(coloring, closeColor);
  const addRef = useDismiss(adding, closeAdd);

  // While the AI writes the summary, check back every few seconds. Stop after a while and let you write one.
  const waiting = !!project && !project.overview && !project.overviewBy && inbox.ai === true && !gaveUp;
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(load, 2500);
    const s = setTimeout(() => setGaveUp(true), 90000);
    return () => { clearInterval(t); clearTimeout(s); };
  }, [waiting, load]);

  if (missing) {
    return (
      <div className="space">
        <header className="space-top"><Link href="/" className="icon" aria-label="Hub" data-tip="Hub"><BackIcon /></Link></header>
        <p className="space-gone">This project was deleted.</p>
      </div>
    );
  }
  if (!project) return <div className="space" />;

  const update = (change: Partial<Project>) => setProject((p) => (p ? { ...p, ...change } : p));
  const save = (body: object) => api(`/api/projects/${id}`, "PATCH", body);
  const setSection = (sid: string, change: (s: Section) => Section) =>
    setProject((p) => (p ? { ...p, sections: p.sections.map((s) => (s.id === sid ? change(s) : s)) } : p));

  const addSection = async (type: string, title: string) => {
    setAdding(false);
    const r = await api(`/api/projects/${id}/sections`, "POST", { type, title });
    if (r.ok) { const s = await r.json(); update({ sections: [...project.sections, s] }); }
  };
  const removeSection = (s: Section) => {
    const full = s.tasks.length > 0 || !!s.notes?.trim();
    if (full && !confirm(`Delete "${s.title}" and what's in it?`)) return;
    update({ sections: project.sections.filter((x) => x.id !== s.id) });
    api(`/api/sections/${s.id}`, "DELETE");
  };
  const move = (from: string, to: string) => {
    const list = [...project.sections];
    const i = list.findIndex((s) => s.id === from);
    const j = list.findIndex((s) => s.id === to);
    if (i < 0 || j < 0 || i === j) return;
    list.splice(j, 0, list.splice(i, 1)[0]);
    update({ sections: list });
    save({ order: list.map((s) => s.id) });
  };
  const remove = () => {
    if (!confirm(`Delete "${project.title}"? Its items stay in the inbox.`)) return;
    api(`/api/projects/${id}`, "DELETE").then(() => router.push("/"));
  };
  const unlink = (itemId: string) => {
    update({ items: project.items.filter((i) => i.id !== itemId) });
    api(`/api/items/${itemId}`, "PATCH", { projectId: null }).then(inbox.refresh);
  };
  const link = (item: Item) => {
    update({ items: [item, ...project.items] });
    api(`/api/items/${item.id}`, "PATCH", { projectId: id }).then(inbox.refresh);
  };

  const noSummary = inbox.ai === false ? "Local AI is off. You can write a summary here." : "Write a summary";

  return (
    <div className="space">
      <header className="space-top">
        <Link href="/" className="icon" aria-label="Hub" data-tip="Hub"><BackIcon /></Link>
        <div className="space-color" ref={colorRef}>
          <button className="icon" aria-label="Color" aria-expanded={coloring} onClick={() => setColoring(!coloring)}>
            <span className="dot square" style={{ background: project.color ?? "var(--muted)" }} />
          </button>
          {coloring && (
            <div className="menu swatch-menu">
              <div className="swatches">
                {PALETTE.map((c) => (
                  <button key={c} className={c === project.color ? "on" : ""} style={{ background: c }} aria-label={c}
                    onClick={() => { update({ color: c }); save({ color: c }); setColoring(false); }} />
                ))}
              </div>
            </div>
          )}
        </div>
        <Line className="space-title" label="Project name" value={project.title} onSave={(title) => { update({ title }); save({ title }); }} />
        <button className="icon" aria-label="Delete project" data-tip="Delete project" onClick={remove}><TrashIcon /></button>
      </header>

      <div className="space-cols">
        <section className="side-tray space-summary">
          <div className="label">
            Summary
            <button className="icon small" data-tip="Write a new summary" aria-label="Write a new summary"
              onClick={() => { update({ overview: null, overviewBy: null }); setGaveUp(false); save({ summarize: true }); }}>
              <RefreshIcon />
            </button>
          </div>
          {!waiting
            ? <Field className="tray-summary" label="Summary" placeholder={noSummary} value={project.overview ?? ""}
                onSave={(overview) => { update({ overview, overviewBy: overview.trim() ? "user" : null }); save({ overview }); }} />
            : <div className="tray-summary pending-lines" aria-label="Writing a summary"><span /><span /><span /></div>}
        </section>

        <main className="sections">
          {project.sections.map((s) => (
            <section key={s.id} className={`section ${over === s.id && dragging !== s.id ? "over" : ""} ${dragging === s.id ? "lifted" : ""}`}
              onDragOver={(e) => { if (e.dataTransfer.types.includes(SECTION)) { e.preventDefault(); setOver(s.id); } }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver((o) => (o === s.id ? null : o)); }}
              onDrop={(e) => { e.preventDefault(); setOver(null); const from = e.dataTransfer.getData(SECTION); if (from) move(from, s.id); }}
            >
              <div className="section-top">
                <span className="grip" draggable aria-label="Drag to reorder"
                  onDragStart={(e) => {
                    e.dataTransfer.setData(SECTION, s.id);
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setDragImage(e.currentTarget.closest(".section")!, 20, 20);
                    setDragging(s.id);
                  }}
                  onDragEnd={() => { setDragging(null); setOver(null); }}>
                  <GripIcon />
                </span>
                <Line className="section-title" label="Section name" value={s.title}
                  onSave={(title) => { setSection(s.id, (x) => ({ ...x, title })); api(`/api/sections/${s.id}`, "PATCH", { title }); }} />
                <button className="icon small fade" aria-label={`Delete ${s.title}`} data-tip="Delete section" onClick={() => removeSection(s)}><TrashIcon /></button>
              </div>
              {s.type === "tasks" && <Tasks section={s} setSection={setSection} />}
              {s.type === "notes" && (
                <Field className="section-notes" label={s.title} placeholder="Write here" value={s.notes ?? ""}
                  onSave={(notes) => { setSection(s.id, (x) => ({ ...x, notes })); api(`/api/sections/${s.id}`, "PATCH", { notes }); }} />
              )}
              {s.type === "items" && (
                <Linked items={project.items} inbox={inbox} projectId={id} onOpen={setViewing} onUnlink={unlink} onLink={link} />
              )}
              {s.type === "providers" && <p className="muted">Finding help nearby is coming soon.</p>}
            </section>
          ))}

          <div className="add-section" ref={addRef}>
            <button className="chip" aria-expanded={adding} onClick={() => setAdding(!adding)}><PlusIcon />Section</button>
            {adding && (
              <div className="menu left">
                {TYPES.map((t) => <button key={t.type} onClick={() => addSection(t.type, t.label)}>{t.label}</button>)}
              </div>
            )}
          </div>
        </main>
      </div>

      {viewing && <ItemView id={viewing} inbox={inbox} onClose={() => { setViewing(null); load(); }} />}
    </div>
  );
}

function Tasks({ section, setSection }: { section: Section; setSection: (id: string, change: (s: Section) => Section) => void }) {
  const [text, setText] = useState("");
  const change = (tid: string, c: Partial<Task>) => {
    setSection(section.id, (s) => ({ ...s, tasks: s.tasks.map((t) => (t.id === tid ? { ...t, ...c } : t)) }));
    api(`/api/tasks/${tid}`, "PATCH", c);
  };
  const remove = (tid: string) => {
    setSection(section.id, (s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== tid) }));
    api(`/api/tasks/${tid}`, "DELETE");
  };
  const add = async () => {
    const t = text.trim();
    if (!t) return;
    setText("");
    const r = await api(`/api/sections/${section.id}/tasks`, "POST", { text: t });
    if (r.ok) { const task = await r.json(); setSection(section.id, (s) => ({ ...s, tasks: [...s.tasks, task] })); }
  };
  return (
    <ul className="tasks">
      {section.tasks.map((t) => (
        <li key={t.id} className={t.done ? "done" : ""}>
          <button className="check" aria-label={t.done ? "Mark not done" : "Mark done"} aria-pressed={t.done} onClick={() => change(t.id, { done: !t.done })}>
            {t.done && <CheckIcon />}
          </button>
          <Line className="task-text" label="Task" value={t.text} onSave={(text) => change(t.id, { text })} />
          <button className="icon small fade" aria-label="Delete task" onClick={() => remove(t.id)}><CloseIcon /></button>
        </li>
      ))}
      <li className="add-task">
        <PlusIcon />
        <input value={text} placeholder="Add a task" aria-label="Add a task" onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) add(); if (e.key === "Escape") setText(""); }} />
      </li>
    </ul>
  );
}

// Inbox items linked to the project. Click one to open it; add more from the inbox.
function Linked({ items, inbox, projectId, onOpen, onUnlink, onLink }: {
  items: Item[]; inbox: ReturnType<typeof useInbox>; projectId: string;
  onOpen: (id: string) => void; onUnlink: (id: string) => void; onLink: (item: Item) => void;
}) {
  const [picking, setPicking] = useState(false);
  const [q, setQ] = useState("");
  const close = useCallback(() => { setPicking(false); setQ(""); }, []);
  const ref = useDismiss(picking, close);
  const color = new Map(inbox.categories.map((c) => [c.id, c.color]));
  const linked = new Set(items.map((i) => i.id));
  const choices = inbox.items
    .filter((i) => !linked.has(i.id) && i.projectId !== projectId && !i.id.startsWith("tmp-"))
    .filter((i) => !q.trim() || [i.title, i.text, i.fileName, i.url].join(" ").toLowerCase().includes(q.trim().toLowerCase()))
    .slice(0, 30);
  return (
    <>
      <ul className="linked">
        {items.map((i) => (
          <li key={i.id} onClick={(e) => { if (!(e.target as HTMLElement).closest("button")) onOpen(i.id); }}>
            <span className="dot" style={{ background: (i.categoryId && color.get(i.categoryId)) || "var(--line)" }} />
            <span className="name">{itemName(i)}</span>
            <button className="icon small fade" aria-label="Remove from project" onClick={() => onUnlink(i.id)}><CloseIcon /></button>
          </li>
        ))}
      </ul>
      <div className="add-linked" ref={ref}>
        <button className="add-task" aria-expanded={picking} onClick={() => setPicking(!picking)}><PlusIcon />Add from inbox</button>
        {picking && (
          <div className="menu left pick-items">
            <input autoFocus value={q} placeholder="Search" aria-label="Search the inbox" onChange={(e) => setQ(e.target.value)} />
            {choices.map((i) => (
              <button key={i.id} onClick={() => { onLink(i); close(); }}>
                <span className="dot" style={{ background: (i.categoryId && color.get(i.categoryId)) || "var(--line)" }} />
                <span className="name">{itemName(i)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
