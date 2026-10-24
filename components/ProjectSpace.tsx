"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useInbox, type Item } from "@/lib/useInbox";
import type { Kind } from "@/lib/useProjects";
import ItemView from "./ItemView";
import Writing from "./Writing";
import Swatches from "./Swatches";
import { KindSwitch, useDismiss } from "./Projects";
import { fromUrl } from "./Inbox";
import { BackIcon, CheckIcon, CloseIcon, PlusIcon, TrashIcon, UploadIcon, WidthIcon } from "./Icons";

type Task = { id: string; text: string; detail: string | null; proposed: boolean; done: boolean };
type Section = { id: string; type: string; title: string; span: number; notes: string | null; tasks: Task[] };
type Linked = { id: string; title: string; color: string | null; items: Item[] };
type Project = {
  id: string; title: string; goal: string | null; color: string | null; kind: Kind; planning: boolean;
  sections: Section[]; items: Item[]; linked: Linked[];
};
type Side = "left" | "right" | "top" | "bottom";
type Inbox = ReturnType<typeof useInbox>;

const TYPES = [{ type: "writing", label: "Writing" }, { type: "tasks", label: "Tasks" }];

const api = (url: string, method: string, body?: object) =>
  fetch(url, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });

const itemName = (i: Item) => i.title ?? i.fileName ?? (i.url && fromUrl(i.url)) ?? i.url ?? i.text;

// A one-line input that saves when you press Enter or leave it.
function Line({ value, onSave, className, label }: { value: string; onSave: (v: string) => void; className?: string; label: string }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  const save = () => { const t = v.trim(); if (!t) setV(value); else if (t !== value) onSave(t); };
  return (
    <input className={className} value={v} aria-label={label} onChange={(e) => setV(e.target.value)} onBlur={save}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") { setV(value); e.currentTarget.blur(); } }} />
  );
}

// A project: Scouts on the left, its sections in a grid you can rearrange. Everything saves as you go.
export default function ProjectSpace({ id }: { id: string }) {
  const router = useRouter();
  const inbox = useInbox();
  const [project, setProject] = useState<Project | null>(null);
  const [missing, setMissing] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const [coloring, setColoring] = useState(false);
  const [adding, setAdding] = useState(false);
  // Moving a section: which one, where the pointer is, and where it would land.
  const [moving, setMoving] = useState<{ id: string; dx: number; dy: number } | null>(null);
  const [target, setTarget] = useState<{ id: string; side: Side } | null>(null);
  const grid = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/projects/${id}`, { cache: "no-store" });
    if (r.ok) setProject(await r.json());
    else if (r.status === 404) setMissing(true);
  }, [id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (project) document.title = project.title; }, [project?.title]); // eslint-disable-line react-hooks/exhaustive-deps

  // While the AI writes the steps of an Auto project, check back every few seconds.
  const planning = !!project?.planning;
  useEffect(() => {
    if (!planning) return;
    const t = setInterval(load, 2500);
    return () => clearInterval(t);
  }, [planning, load]);

  const colorRef = useDismiss<HTMLDivElement>(coloring, () => setColoring(false));
  const addRef = useDismiss<HTMLDivElement>(adding, () => setAdding(false));

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
  const patchSection = (sid: string, c: Partial<Section>) => { setSection(sid, (s) => ({ ...s, ...c })); api(`/api/sections/${sid}`, "PATCH", c); };

  const addSection = async (type: string, label: string) => {
    setAdding(false);
    const n = project.sections.filter((s) => s.title === label || s.title.startsWith(`${label} `)).length;
    const r = await api(`/api/projects/${id}/sections`, "POST", { type, title: n ? `${label} ${n + 1}` : label });
    if (r.ok) { const s = await r.json(); update({ sections: [...project.sections, s] }); }
  };
  const removeSection = (s: Section) => {
    const full = s.tasks.length > 0 || !!s.notes?.trim();
    if (full && !confirm(`Delete "${s.title}" and what's in it?`)) return;
    update({ sections: project.sections.filter((x) => x.id !== s.id) });
    api(`/api/sections/${s.id}`, "DELETE");
  };
  const remove = () => {
    if (!confirm(`Delete "${project.title}"? Its sources stay in the inbox.`)) return;
    api(`/api/projects/${id}`, "DELETE").then(() => router.push("/"));
  };
  const setKind = (kind: Kind) => {
    update({ kind });
    save({ kind }).then(() => { if (kind === "auto") load(); });
  };

  // Drop a section on the edge of another: left or right puts them side by side, top or bottom stacks them.
  const place = (from: string, to: string, side: Side) => {
    const list = [...project.sections];
    const moved = list.splice(list.findIndex((s) => s.id === from), 1)[0];
    const j = list.findIndex((s) => s.id === to);
    if (!moved || j < 0) return;
    list.splice(side === "left" || side === "top" ? j : j + 1, 0, moved);
    const halves = side === "left" || side === "right";
    const next = list.map((s) => (halves && (s.id === from || s.id === to) ? { ...s, span: 1 } : s));
    update({ sections: next });
    save({ order: next.map((s) => s.id) });
    if (halves) for (const sid of [from, to]) if (project.sections.find((s) => s.id === sid)?.span !== 1) api(`/api/sections/${sid}`, "PATCH", { span: 1 });
  };

  // Moving uses pointer events, so it works the same in every browser. A press that doesn't move is a normal click.
  const startMove = (sid: string) => (e: React.PointerEvent) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest("button")) return;
    const x0 = e.clientX, y0 = e.clientY;
    let started = false;
    let over: { id: string; side: Side } | null = null;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - x0, dy = ev.clientY - y0;
      if (!started) {
        if (Math.hypot(dx, dy) < 5) return;
        started = true;
        (document.activeElement as HTMLElement | null)?.blur();
        window.getSelection()?.removeAllRanges();
        document.body.classList.add("moving");
      }
      ev.preventDefault();
      setMoving({ id: sid, dx, dy });
      const el = (document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null)?.closest<HTMLElement>("[data-section]");
      const to = el?.dataset.section;
      if (!el || !to || to === sid) { over = null; setTarget(null); return; }
      const r = el.getBoundingClientRect();
      const fx = (ev.clientX - r.left) / r.width, fy = (ev.clientY - r.top) / r.height;
      // The nearest edge, measured as a share of the section's width or height.
      const edges: [Side, number][] = [["left", fx], ["right", 1 - fx], ["top", fy], ["bottom", 1 - fy]];
      const side = edges.sort((a, b) => a[1] - b[1])[0][0];
      over = { id: to, side };
      setTarget(over);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.classList.remove("moving");
      setMoving(null);
      setTarget(null);
      if (started && over) place(sid, over.id, over.side);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

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
              <Swatches value={project.color} onPick={(color) => { update({ color }); save({ color }); setColoring(false); }} />
            </div>
          )}
        </div>
        <Line className="space-title" label="Project name" value={project.title} onSave={(title) => { update({ title }); save({ title }); }} />
        <KindSwitch value={project.kind} onChange={setKind} />
        <button className="icon" aria-label="Delete project" data-tip="Delete project" onClick={remove}><TrashIcon /></button>
      </header>

      <div className="space-cols">
        <aside className="side-tray scouts">
          <div className="label">Scouts</div>
          <p className="muted">Coming soon.</p>
        </aside>

        <main className="sections" ref={grid}>
          {project.sections.map((s) => (
            <section key={s.id} data-section={s.id}
              className={`section ${s.span === 2 ? "wide" : ""} ${moving?.id === s.id ? "lifted" : ""} ${target?.id === s.id ? `drop-${target.side}` : ""}`}
              style={moving?.id === s.id ? { transform: `translate(${moving.dx}px, ${moving.dy}px)` } : undefined}
            >
              <div className="section-top" onPointerDown={startMove(s.id)}>
                <Line className="section-title" label="Section name" value={s.title} onSave={(title) => patchSection(s.id, { title })} />
                <button className="icon small fade" aria-label={s.span === 2 ? "Half width" : "Full width"} data-tip={s.span === 2 ? "Half width" : "Full width"}
                  onClick={() => patchSection(s.id, { span: s.span === 2 ? 1 : 2 })}><WidthIcon /></button>
                {s.type !== "sources" && (
                  <button className="icon small fade" aria-label={`Delete ${s.title}`} data-tip="Delete section" onClick={() => removeSection(s)}><TrashIcon /></button>
                )}
              </div>
              {s.type === "tasks" && <Tasks section={s} setSection={setSection} planning={planning && s.id === project.sections.find((x) => x.type === "tasks")?.id} />}
              {s.type === "writing" && <Writing label={s.title} value={s.notes ?? ""} onSave={(notes) => patchSection(s.id, { notes })} />}
              {s.type === "sources" && <Sources project={project} inbox={inbox} reload={load} onOpen={setViewing} update={update} />}
            </section>
          ))}
        </main>
      </div>

      <div className="add-section" ref={addRef}>
        <button className="chip" aria-expanded={adding} onClick={() => setAdding(!adding)}><PlusIcon />Section</button>
        {adding && (
          <div className="menu left">
            {TYPES.map((t) => <button key={t.type} onClick={() => addSection(t.type, t.label)}>{t.label}</button>)}
          </div>
        )}
      </div>

      {viewing && <ItemView id={viewing} inbox={inbox} onClose={() => { setViewing(null); load(); }} />}
    </div>
  );
}

function Tasks({ section, setSection, planning }: { section: Section; setSection: (id: string, change: (s: Section) => Section) => void; planning: boolean }) {
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
  const proposed = section.tasks.filter((t) => t.proposed);
  return (
    <ul className="tasks">
      {section.tasks.map((t) => (
        <li key={t.id} className={`${t.done ? "done" : ""} ${t.proposed ? "proposed" : ""}`}>
          {t.proposed
            ? <button className="check keep" aria-label="Keep this step" data-tip="Keep" onClick={() => change(t.id, { proposed: false })}><CheckIcon /></button>
            : <button className="check" aria-label={t.done ? "Mark not done" : "Mark done"} aria-pressed={t.done} onClick={() => change(t.id, { done: !t.done })}>{t.done && <CheckIcon />}</button>}
          <div className="task-body">
            <Line className="task-text" label="Task" value={t.text} onSave={(text) => change(t.id, { text })} />
            {t.detail && <div className="task-detail">{t.detail}</div>}
          </div>
          <button className={`icon small ${t.proposed ? "" : "fade"}`} aria-label={t.proposed ? "Remove this step" : "Delete task"} onClick={() => remove(t.id)}><CloseIcon /></button>
        </li>
      ))}
      {planning && <li className="pending-lines" aria-label="Writing steps"><span /><span /><span /></li>}
      {proposed.length > 1 && (
        <li><button className="keep-all" onClick={() => proposed.forEach((t) => change(t.id, { proposed: false }))}>Keep all {proposed.length}</button></li>
      )}
      <li className="add-task">
        <PlusIcon />
        <input value={text} placeholder="Add a task" aria-label="Add a task" onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) add(); if (e.key === "Escape") setText(""); }} />
      </li>
    </ul>
  );
}

function SourceRow({ item, color, onOpen, onRemove }: { item: Item; color?: string; onOpen: () => void; onRemove?: () => void }) {
  return (
    <li onClick={(e) => { if (!(e.target as HTMLElement).closest("button")) onOpen(); }}>
      <span className={`dot ${item.sortedBy === "pending" ? "pending" : ""}`} style={item.sortedBy === "pending" ? undefined : { background: color || "var(--line)" }} />
      <span className="name">{itemName(item)}</span>
      {onRemove && <button className="icon small fade" aria-label="Remove from project" onClick={onRemove}><CloseIcon /></button>}
    </li>
  );
}

// The project's sources: its own items, the ones of linked projects, a box to add new ones
// (which go to the inbox too), and a picker for items already in the inbox.
function Sources({ project, inbox, reload, onOpen, update }: {
  project: Project; inbox: Inbox; reload: () => void; onOpen: (id: string) => void; update: (c: Partial<Project>) => void;
}) {
  const [text, setText] = useState("");
  const [picking, setPicking] = useState(false);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [up, setUp] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const ref = useDismiss<HTMLDivElement>(picking, () => { setPicking(false); setQ(""); setCat(null); });
  const color = new Map(inbox.categories.map((c) => [c.id, c.color]));
  const mine = new Set(project.items.map((i) => i.id));

  // Poll while a new source is still being sorted, so its title shows up.
  const sorting = project.items.some((i) => i.sortedBy === "pending");
  useEffect(() => {
    if (!sorting) return;
    const t = setInterval(reload, 1500);
    return () => clearInterval(t);
  }, [sorting, reload]);

  const add = async () => {
    const t = text.trim();
    if (!t) return;
    setText("");
    await api("/api/items", "POST", { text: t, projectId: project.id });
    reload(); inbox.refresh();
  };
  const upload = async (files: FileList | null) => {
    await Promise.all(Array.from(files ?? []).map((f) => {
      const form = new FormData();
      form.append("file", f);
      form.append("projectId", project.id);
      return fetch("/api/items", { method: "POST", body: form });
    }));
    reload(); inbox.refresh();
  };
  const link = (item: Item) => {
    update({ items: [item, ...project.items] });
    api(`/api/items/${item.id}`, "PATCH", { projectId: project.id }).then(() => { reload(); inbox.refresh(); });
  };
  const unlink = (itemId: string) => {
    update({ items: project.items.filter((i) => i.id !== itemId) });
    api(`/api/items/${itemId}`, "PATCH", { projectId: null }).then(inbox.refresh);
  };

  const needle = q.trim().toLowerCase();
  const choices = inbox.items.filter((i) => !mine.has(i.id) && !i.id.startsWith("tmp-") && (!cat || i.categoryId === cat)
    && (!needle || [i.title, i.text, i.fileName, i.url].join(" ").toLowerCase().includes(needle)));
  const groups = inbox.categories.map((c) => ({ c, items: choices.filter((i) => i.categoryId === c.id) })).filter((g) => g.items.length);

  return (
    <>
      <ul className="linked">
        {project.items.map((i) => (
          <SourceRow key={i.id} item={i} color={i.categoryId ? color.get(i.categoryId) : undefined} onOpen={() => onOpen(i.id)} onRemove={() => unlink(i.id)} />
        ))}
      </ul>
      {project.linked.filter((l) => l.items.length).map((l) => (
        <div key={l.id} className="from-linked">
          <div className="from-label"><span className="dot square" style={{ background: l.color ?? "var(--muted)" }} />{l.title}</div>
          <ul className="linked">
            {l.items.map((i) => <SourceRow key={i.id} item={i} color={i.categoryId ? color.get(i.categoryId) : undefined} onOpen={() => onOpen(i.id)} />)}
          </ul>
        </div>
      ))}
      <div className="add-source">
        <PlusIcon />
        <input value={text} placeholder="Paste a link or write a note" aria-label="Add a source"
          onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) add(); }}
          onPaste={(e) => { if (e.clipboardData.files.length) { e.preventDefault(); upload(e.clipboardData.files); } }} />
        <button className="icon small" aria-label="Upload a file" data-tip="Upload" onClick={() => picker.current?.click()}><UploadIcon /></button>
        <input ref={picker} type="file" multiple hidden onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
        <div className="add-linked" ref={ref}>
          <button className="from-inbox" aria-expanded={picking}
            onClick={(e) => { setUp(e.currentTarget.getBoundingClientRect().bottom + 400 > window.innerHeight); setPicking(!picking); }}>From inbox</button>
          {picking && (
            <div className={`menu pick-items ${up ? "up" : ""}`}>
              <input autoFocus value={q} placeholder="Search" aria-label="Search the inbox" onChange={(e) => setQ(e.target.value)} />
              <div className="pick-cats">
                <button className={cat === null ? "on" : ""} onClick={() => setCat(null)}>All</button>
                {inbox.categories.filter((c) => c.count > 0).map((c) => (
                  <button key={c.id} className={cat === c.id ? "on" : ""} onClick={() => setCat(cat === c.id ? null : c.id)}>
                    <span className="dot" style={{ background: c.color }} />{c.name}
                  </button>
                ))}
              </div>
              {groups.map(({ c, items }) => (
                <div key={c.id} className="pick-group">
                  <div className="pick-head">{c.name}</div>
                  {items.map((i) => (
                    <button key={i.id} onClick={() => link(i)}>
                      <span className="dot" style={{ background: c.color }} />
                      <span className="name">{itemName(i)}</span>
                    </button>
                  ))}
                </div>
              ))}
              {!groups.length && <p className="muted pick-none">Nothing found</p>}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
