"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { useInbox, type Item } from "@/lib/useInbox";
import { names } from "@/lib/names";
import { citationsHtml, host, richText, splitList } from "@/lib/format";
import type { Kind } from "@/lib/useProjects";
import ItemView from "./ItemView";
import Writing from "./Writing";
import Swatches from "./Swatches";
import { useDismiss } from "./Projects";
import InboxPicker, { itemName } from "./InboxPicker";
import Scouts, { type ScoutDraft } from "./Scouts";
import Mic from "./Mic";
import { DuePicker } from "./Due";
import { BackIcon, CheckIcon, CloseIcon, GripIcon, PlusIcon, RefreshIcon, ScoutIcon, SparkIcon, TrashIcon, UploadIcon, WidthIcon } from "./Icons";

type Task = { id: string; text: string; detail: string | null; proposed: boolean; done: boolean; dueDate: string | null; dueTime: string | null; priority: number | null };
type Section = { id: string; type: string; title: string; span: number; notes: string | null; proposed: boolean; tasks: Task[] };
type Linked = { id: string; title: string; color: string | null; items: Item[] };
type Project = {
  id: string; title: string; goal: string | null; color: string | null; kind: Kind; planning: boolean;
  sections: Section[]; items: Item[]; linked: Linked[];
};
type Side = "left" | "right" | "top" | "bottom";
type Inbox = ReturnType<typeof useInbox>;

const TYPES = [{ type: "writing", label: "Writing" }, { type: "tasks", label: "Tasks" }, { type: "assistant", label: "AI" }];

// Full-width sections take a row each. Halves between them go into two columns that stack on their own
// (first, third, … on the left; second, fourth, … on the right), so a short half never leaves a gap
// under it. A half with no other half next to it is shown full width.
type Band = { wide: Section } | { cols: [Section[], Section[]] };
function layout(sections: Section[]) {
  const bands: Band[] = [];
  const alone = new Set<string>();
  let run: Section[] = [];
  const flush = () => {
    if (run.length === 1) { bands.push({ wide: run[0] }); alone.add(run[0].id); }
    else if (run.length) bands.push({ cols: [run.filter((_, i) => i % 2 === 0), run.filter((_, i) => i % 2 === 1)] });
    run = [];
  };
  for (const s of sections) {
    if (s.span === 2) { flush(); bands.push({ wide: s }); } else run.push(s);
  }
  flush();
  return { bands, alone };
}

const api = (url: string, method: string, body?: object) =>
  fetch(url, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });


// A one-line field that saves when you press Enter or leave it. `wrap` lets long text run onto more lines.
function Line({ value, onSave, className, label, wrap }: { value: string; onSave: (v: string) => void; className?: string; label: string; wrap?: boolean }) {
  const [v, setV] = useState(value);
  const area = useRef<HTMLTextAreaElement>(null);
  useEffect(() => setV(value), [value]);
  useEffect(() => { const el = area.current; if (el) { el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; } }, [v]);
  const save = () => { const t = v.trim(); if (!t) setV(value); else if (t !== value) onSave(t); };
  const keys = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); }
    if (e.key === "Escape") { setV(value); e.currentTarget.blur(); }
  };
  return wrap
    ? <textarea ref={area} rows={1} className={className} value={v} aria-label={label} onChange={(e) => setV(e.target.value)} onBlur={save} onKeyDown={keys} />
    : <input className={className} value={v} aria-label={label} onChange={(e) => setV(e.target.value)} onBlur={save} onKeyDown={keys} />;
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
  const [scoutDraft, setScoutDraft] = useState<ScoutDraft | null>(null);
  const [more, setMore] = useState<{ id: string; busy: boolean; note: string | null } | null>(null);
  const grid = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/projects/${id}`, { cache: "no-store" });
    if (r.ok) setProject(await r.json());
    else if (r.status === 404) setMissing(true);
  }, [id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (project) document.title = project.title; }, [project?.title]); // eslint-disable-line react-hooks/exhaustive-deps

  // While the AI builds an Auto project, check back every few seconds.
  // A new Auto project with nothing but its Project Dump is still being laid out, too.
  const planning = !!project?.planning;
  const waiting = planning || (project?.kind === "auto" && project.sections.every((s) => s.type === "sources"));
  useEffect(() => {
    if (!waiting) return;
    let n = 0;
    const t = setInterval(() => { if (++n > 120) clearInterval(t); else load(); }, 2500);
    return () => clearInterval(t);
  }, [waiting, load]);

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
  const { bands, alone } = layout(project.sections);

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
  const toScout = (brief: string, taskId?: string) => setScoutDraft((d) => ({ brief, taskId, n: (d?.n ?? 0) + 1 }));
  const link = (item: Item) => {
    if (project.items.some((i) => i.id === item.id)) return;
    update({ items: [item, ...project.items] });
    api(`/api/items/${item.id}`, "PATCH", { projectId: project.id }).then(() => { load(); inbox.refresh(); });
  };
  const unlink = (itemId: string) => {
    update({ items: project.items.filter((i) => i.id !== itemId) });
    api(`/api/items/${itemId}`, "PATCH", { projectId: null }).then(inbox.refresh);
  };
  // More resources: the next page of the search. Only when you press the button, since searches are paid.
  const moreResources = async (s: Section) => {
    setMore({ id: s.id, busy: true, note: null });
    const r = await api(`/api/sections/${s.id}/more`, "POST");
    const j = r.ok ? await r.json() : { note: "Couldn't get more. Try again." };
    if (j.notes) setSection(s.id, (x) => ({ ...x, notes: j.notes }));
    setMore({ id: s.id, busy: false, note: j.note });
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
    for (const s of next) if (project.sections.find((x) => x.id === s.id)?.span !== s.span) api(`/api/sections/${s.id}`, "PATCH", { span: s.span });
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

  const renderSection = (s: Section) => (
            <section key={s.id} data-section={s.id}
              className={`section ${s.span === 2 || alone.has(s.id) ? "wide" : ""} ${moving?.id === s.id ? "lifted" : ""} ${target?.id === s.id ? `drop-${target.side}` : ""}`}
              style={moving?.id === s.id ? { transform: `translate(${moving.dx}px, ${moving.dy}px)` } : undefined}
            >
              <div className="section-top" onPointerDown={startMove(s.id)}>
                <span className="grip" aria-hidden="true"><GripIcon /></span>
                <Line className="section-title" label="Section name" value={s.title} onSave={(title) => patchSection(s.id, { title })} />
                {s.type === "resources" && (
                  <button className="icon small fade" aria-label="More resources" data-tip="More" disabled={more?.id === s.id && more.busy}
                    onClick={() => moreResources(s)}><RefreshIcon /></button>
                )}
                {!(alone.has(s.id) && s.span === 1) && (
                  <button className="icon small fade" aria-label={s.span === 2 ? "Half width" : "Full width"} data-tip={s.span === 2 ? "Half width" : "Full width"}
                    onClick={() => patchSection(s.id, { span: s.span === 2 ? 1 : 2 })}><WidthIcon /></button>
                )}
                {s.type !== "sources" && s.type !== "resources" && (
                  <button className="icon small fade" aria-label={`Delete ${s.title}`} data-tip="Delete section" onClick={() => removeSection(s)}><TrashIcon /></button>
                )}
              </div>
              {s.type === "tasks" && <Tasks section={s} setSection={setSection} onScout={toScout} planning={planning && s.id === project.sections.find((x) => x.type === "tasks")?.id} />}
              {s.type === "step" && (
                <>
                  <Writing label={`${s.title}: how to`} value={s.notes ?? ""} onSave={(notes) => patchSection(s.id, { notes })} />
                  <Tasks section={s} setSection={setSection} onScout={toScout} planning={false} />
                </>
              )}
              {s.type === "writing" && <Writing label={s.title} value={s.notes ?? ""} onSave={(notes) => patchSection(s.id, { notes })} />}
              {s.type === "sources" && <Sources project={project} inbox={inbox} reload={load} onOpen={setViewing} link={link} unlink={unlink} />}
              {s.type === "resources" && <Resources section={s} busy={more?.id === s.id && more.busy} note={more?.id === s.id ? more.note : null}
                onChange={(notes) => patchSection(s.id, { notes })}
                onMove={(h) => api("/api/items", "POST", { text: h.link, title: h.title, summary: h.description || h.title, projectId: id }).then(load)} />}
              {s.type === "assistant" && <Assistant section={s} setSection={setSection} projectId={id} onAdded={load} />}
            </section>
  );

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
        <button className="icon" aria-label="Delete project" data-tip="Delete project" onClick={remove}><TrashIcon /></button>
      </header>

      <div className="space-cols">
        <aside className="side-tray scouts">
          <Scouts projectId={id} draft={scoutDraft} onAdded={() => { load(); inbox.refresh(); }} />
        </aside>

        <main className="sections" ref={grid}>
          {planning && (
            <section className="section wide planning">
              <div className="pending-lines" aria-label="Writing the steps"><span /><span /><span /><em>Working out the steps…</em></div>
            </section>
          )}
          {bands.map((band) => ("wide" in band
            ? <Fragment key={band.wide.id}>{renderSection(band.wide)}</Fragment>
            : (
              <div key={band.cols[0][0].id} className="band">
                {band.cols.map((col, i) => <div key={i} className="band-col">{col.map(renderSection)}</div>)}
              </div>
            )))}
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

function Tasks({ section, setSection, planning, onScout }: {
  section: Section; setSection: (id: string, change: (s: Section) => Section) => void; planning: boolean; onScout: (brief: string, taskId: string) => void;
}) {
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
          <button className="check" aria-label={t.done ? "Mark not done" : "Mark done"} aria-pressed={t.done} onClick={() => change(t.id, { done: !t.done })}>{t.done && <CheckIcon />}</button>
          <div className="task-body">
            <Line wrap className="task-text" label="Task" value={t.text} onSave={(text) => change(t.id, { text })} />
            {t.detail && <div className="task-detail">{t.detail}</div>}
          </div>
          <DuePicker due={t} onChange={(d) => change(t.id, d)} />
          <button className="icon small fade" aria-label="Send to Scouts" data-tip="Send to Scouts" onClick={() => onScout(t.text, t.id)}><ScoutIcon /></button>
          <button className="icon small fade" aria-label="Delete task" onClick={() => remove(t.id)}><CloseIcon /></button>
        </li>
      ))}
      {planning && <li className="pending-lines" aria-label="Writing steps"><span /><span /><span /></li>}
      <li className="add-task">
        <PlusIcon />
        <input value={text} placeholder="Add a task" aria-label="Add a task" onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) add(); if (e.key === "Escape") setText(""); }} />
      </li>
    </ul>
  );
}

function SourceRow({ item, color, onOpen, onRemove }: { item: Item; color?: string; onOpen: () => void; onRemove?: () => void }) {
  const pending = item.sortedBy === "pending";
  return (
    <li onClick={(e) => { if (!(e.target as HTMLElement).closest("button")) onOpen(); }}>
      <span className={`dot ${pending ? "pending" : ""}`} style={pending ? undefined : { background: color || "var(--line)" }} />
      <span className="name">{itemName(item)}</span>
      {onRemove && <button className="icon small fade" aria-label={`Back to ${names.inbox}`} data-tip={`Back to ${names.inbox}`} onClick={onRemove}><CloseIcon /></button>}
    </li>
  );
}

// The Project Dump: this project's own items sorted by category, the ones of linked projects, a box to add
// new ones (they stay in this project), and a picker to move items over from the main Brain Dump.
function Sources({ project, inbox, reload, onOpen, link, unlink }: {
  project: Project; inbox: Inbox; reload: () => void; onOpen: (id: string) => void; link: (item: Item) => void; unlink: (id: string) => void;
}) {
  const [text, setText] = useState("");
  const [picking, setPicking] = useState(false);
  const [up, setUp] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const ref = useDismiss<HTMLDivElement>(picking, () => setPicking(false));
  const color = new Map(inbox.categories.map((c) => [c.id, c.color]));
  const mine = new Set(project.items.map((i) => i.id));
  // Grouped like the main Brain Dump: one group per category, in the same order, then anything not sorted yet.
  const groups = [
    ...inbox.categories.map((c) => ({ id: c.id, name: c.name, items: project.items.filter((i) => i.categoryId === c.id) })),
    { id: "none", name: "", items: project.items.filter((i) => !i.categoryId || !color.has(i.categoryId)) },
  ].filter((g) => g.items.length);

  // Poll while a new source is still being sorted, so its title shows up.
  const sorting = project.items.some((i) => i.sortedBy === "pending");
  useEffect(() => {
    if (!sorting) return;
    const t = setInterval(reload, 1500);
    return () => clearInterval(t);
  }, [sorting, reload]);

  const add = async (t = text.trim()) => {
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

  return (
    <div className="brain">
      {groups.map((g) => (
        <div key={g.id} className="brain-group">
          {g.name && <div className="pick-head">{g.name}</div>}
          <ul className="linked">
            {g.items.map((i) => (
              <SourceRow key={i.id} item={i} color={i.categoryId ? color.get(i.categoryId) : undefined} onOpen={() => onOpen(i.id)} onRemove={() => unlink(i.id)} />
            ))}
          </ul>
        </div>
      ))}
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
        <Mic value={text} onChange={setText} onDone={(said, fresh) => { if (fresh) add(said); }} />
        <button className="icon small" aria-label="Upload a file" data-tip="Upload" onClick={() => picker.current?.click()}><UploadIcon /></button>
        <input ref={picker} type="file" multiple hidden onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
        <div className="add-linked" ref={ref}>
          <button className="from-inbox" aria-expanded={picking}
            onClick={(e) => { setUp(e.currentTarget.getBoundingClientRect().bottom + 400 > window.innerHeight); setPicking(!picking); }}>From {names.inbox}</button>
          {picking && <InboxPicker inbox={inbox} up={up} exclude={mine} onPick={(i) => link(i)} />}
        </div>
      </div>
    </div>
  );
}

type Hit = { title: string; link: string; description: string };

// Resources: pages to read, with what each one offers. The refresh button above adds more. Each page can be
// moved to the Project Dump (its summary comes along, so the page isn't read again) or removed.
function Resources({ section, busy, note, onChange, onMove }: {
  section: Section; busy: boolean; note: string | null; onChange: (notes: string) => void; onMove: (h: Hit) => void;
}) {
  let data: { hits: Hit[]; gone?: string[] } = { hits: [] };
  try { data = JSON.parse(section.notes ?? ""); } catch {}
  const hits = data.hits ?? [];
  // Removed and moved pages are remembered, so More doesn't bring them back.
  const drop = (h: Hit) => onChange(JSON.stringify({ ...data, hits: hits.filter((x) => x.link !== h.link), gone: [...(data.gone ?? []), h.link] }));
  return (
    <>
      <ul className="resources">
        {hits.map((h) => (
          <li key={h.link}>
            <a href={h.link} target="_blank" rel="noreferrer">
              <span className="res-title">{h.title}</span>
              {h.description && <span className="res-about">{h.description}</span>}
              <span className="res-host">{host(h.link)}</span>
            </a>
            <div className="res-actions">
              <button className="icon small" aria-label={`Move to ${names.projectDump}`} data-tip={`Move to ${names.projectDump}`} onClick={() => { onMove(h); drop(h); }}><PlusIcon /></button>
              <button className="icon small" aria-label="Remove" data-tip="Remove" onClick={() => drop(h)}><CloseIcon /></button>
            </div>
          </li>
        ))}
      </ul>
      {busy && <div className="pending-lines" aria-label="Finding more"><span /><span /></div>}
      {note && <p className="muted">{note}</p>}
    </>
  );
}

type Ask = { q: string; into: "answer" | "tasks" | "citations" | "rewrite"; title: string; reply: string; items: string[]; at: string };
const ASK_EXAMPLES = ["Make tasks for this project", "Make my Introduction sound formal", "Make APA citations for my sources"];

// The AI section: ask about what's in the project. Answers stay here (newest first); you can add one to the project.
function Assistant({ section, setSection, projectId, onAdded }: {
  section: Section; setSection: (id: string, change: (s: Section) => Section) => void; projectId: string; onAdded: () => void;
}) {
  const [q, setQ] = useState("");
  const [asking, setAsking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const box = useRef<HTMLTextAreaElement>(null);
  let asks: Ask[] = [];
  try { asks = JSON.parse(section.notes ?? "").asks ?? []; } catch {}
  useEffect(() => { const el = box.current; if (el) { el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; } }, [q]);

  const send = async () => {
    const t = q.trim();
    if (!t || asking) return;
    setAsking(t); setError(null); setQ("");
    const r = await api(`/api/sections/${section.id}/ask`, "POST", { q: t }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setAsking(null);
    if (r?.ok) { setSection(section.id, (s) => ({ ...s, notes: JSON.stringify({ asks: j.asks }) })); setOpen(j.asks[0]?.at ?? null); }
    else { setError(j.error ?? "Something went wrong. Ask again."); setQ(t); }
  };
  const remove = async (a: Ask) => {
    setSection(section.id, (s) => ({ ...s, notes: JSON.stringify({ asks: asks.filter((x) => x.at !== a.at) }) }));
    api(`/api/sections/${section.id}/ask?at=${encodeURIComponent(a.at)}`, "DELETE");
  };
  const add = async (a: Ask) => {
    setAdded((cur) => new Set(cur).add(a.at));
    const paras = (t: string) => t.split(/\n\s*\n/).map((p) => `<p>${richText(p.trim())}</p>`).join("");
    // Answers saved before lists were split keep the list in the reply.
    const tasks = a.items.length ? a.items : splitList(a.reply);
    const body = a.into === "tasks" ? { type: "tasks", title: a.title, tasks }
      : { type: "writing", title: a.title, notes: a.into === "citations" ? citationsHtml(a.items) : `${paras(a.reply)}${a.items.length ? `<ul>${a.items.map((t) => `<li><p>${richText(t)}</p></li>`).join("")}</ul>` : ""}` };
    await api(`/api/projects/${projectId}/sections`, "POST", body);
    onAdded();
  };

  return (
    <div className="assistant">
      <div className="ask-box">
        <SparkIcon />
        <textarea ref={box} rows={1} value={q} aria-label="Ask the AI" placeholder={ASK_EXAMPLES[asks.length % ASK_EXAMPLES.length]}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }} />
      </div>
      {error && <p className="muted">{error}</p>}
      {asking && (
        <div className="ask">
          <div className="ask-q"><span className="name">{asking}</span></div>
          <div className="pending-lines"><span /><em>Thinking…</em></div>
        </div>
      )}
      {asks.map((a, i) => {
        const shown = open === a.at || (open === null && i === 0 && !asking);
        return (
          <div key={a.at} className="ask">
            <div className="ask-q">
              <button className="name" aria-expanded={shown} onClick={() => setOpen(shown ? "" : a.at)}>{a.q}</button>
              <button className="icon small fade" aria-label="Delete" onClick={() => remove(a)}><CloseIcon /></button>
            </div>
            {shown && (
              <div className="ask-a">
                {a.reply && a.reply.split(/\n\s*\n/).map((p, j) => <p key={j} dangerouslySetInnerHTML={{ __html: richText(p.trim()) }} />)}
                {a.into === "citations"
                  ? <div className="citations">{a.items.map((t, j) => <p key={j} dangerouslySetInnerHTML={{ __html: richText(t) }} />)}</div>
                  : a.items.length > 0 && <ul>{a.items.map((t, j) => <li key={j} dangerouslySetInnerHTML={{ __html: richText(t) }} />)}</ul>}
                <button className="scout-add" disabled={added.has(a.at)} onClick={() => add(a)}>
                  {added.has(a.at) ? <><CheckIcon />Added</> : <><PlusIcon />{a.into === "tasks" ? "Add as tasks" : "Add to project"}</>}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
