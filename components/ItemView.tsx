"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Category, useInbox } from "@/lib/useInbox";
import { CloseIcon, OpenIcon, RefreshIcon, TrashIcon } from "./Icons";
import { Menu, fromUrl } from "./Inbox";

type Inbox = ReturnType<typeof useInbox>;
type Full = {
  id: string; kind: string; text: string; url: string | null; title: string | null; summary: string | null;
  fileName: string | null; mime: string | null; extracted: string | null; category: Category | null;
  overview: string | null; overviewBy: string | null; notes: string | null; sortedBy: string;
  aiTries: number; image: string | null; project: { id: string; title: string; color: string | null } | null;
};
type ProjectChoice = { id: string; title: string; color: string | null };

// The project chip in the tray: link the item to a project, or take it out of one.
function ProjectPick({ item, onPicked }: { item: Full; onPicked: (project: ProjectChoice | null) => void }) {
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<ProjectChoice[]>([]);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    fetch("/api/projects", { cache: "no-store" }).then((r) => r.json()).then(setProjects).catch(() => {});
    const away = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);
  const pick = (p: ProjectChoice | null) => { setOpen(false); onPicked(p); };
  return (
    <span className="pick-cat" ref={ref}>
      <button className="chip" onClick={() => setOpen(!open)} aria-label="Change project" aria-expanded={open}>
        {item.project && <span className="dot square" style={{ background: item.project.color ?? "var(--muted)" }} />}
        {item.project?.title ?? "No project"}
      </button>
      {open && (
        <div className="menu">
          {projects.map((p) => (
            <button key={p.id} className={p.id === item.project?.id ? "on" : ""} onClick={() => pick(p)}>
              <span className="dot square" style={{ background: p.color ?? "var(--muted)" }} />{p.title}
            </button>
          ))}
          <button className={item.project ? "" : "on"} onClick={() => pick(null)}>No project</button>
        </div>
      )}
    </span>
  );
}

function youtubeId(url: string) {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1) || null;
    if (/(^|\.)youtube\.com$/.test(u.hostname)) return u.searchParams.get("v") ?? u.pathname.match(/\/(shorts|embed|live)\/([\w-]+)/)?.[2] ?? null;
  } catch {}
  return null;
}

function host(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

// A textarea that grows with its text and saves a moment after you stop typing (and when you leave it).
export function Field({ value, onSave, className, placeholder, label }: {
  value: string; onSave: (v: string) => void; className?: string; placeholder?: string; label: string;
}) {
  const [v, setV] = useState(value);
  const ref = useRef<HTMLTextAreaElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const saved = useRef(value);
  useEffect(() => { if (document.activeElement !== ref.current) { setV(value); saved.current = value; } }, [value]);
  useEffect(() => {
    const el = ref.current;
    if (el) { el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; }
  }, [v]);
  const save = (next: string) => {
    clearTimeout(timer.current);
    if (next !== saved.current) { saved.current = next; onSave(next); }
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <textarea
      ref={ref} rows={1} className={className} value={v} placeholder={placeholder} aria-label={label}
      onChange={(e) => { const next = e.target.value; setV(next); clearTimeout(timer.current); timer.current = setTimeout(() => save(next), 700); }}
      onBlur={() => save(v)}
    />
  );
}

// The tray view: the summary on the left, the item in the middle, your notes on the right. Everything saves as you type.
export default function ItemView({ id, inbox, onClose }: { id: string; inbox: Inbox; onClose: () => void }) {
  const [item, setItem] = useState<Full | null>(null);
  const [picking, setPicking] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(`/api/items/${id}`, { cache: "no-store" });
    if (r.ok) setItem(await r.json());
  }, [id]);

  useEffect(() => {
    load();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [load, onClose]);

  // While the AI is writing the summary, check back every couple of seconds. It can't write one for a link
  // whose page couldn't be read, or for an image when no image model is installed.
  const unread = item?.kind === "link" && !item.title;
  const blind = item?.kind === "image" && !inbox.vision;
  const gaveUp = !!item && item.aiTries >= 3;
  const waiting = !!item && !item.overview && inbox.ai === true && !unread && !blind && !gaveUp;
  // When there's no summary and none is coming, say why.
  const noSummary = unread ? "This page couldn't be read, so there's no summary. You can write one here."
    : blind ? "No image model is installed, so there's no summary yet. You can write one here."
    : gaveUp ? "The AI couldn't write a summary for this. Write one here, or press ↻ to try again."
    : inbox.ai === false ? "Local AI is off. The summary is written once it's back, or you can write one here."
    : "Write a summary";
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    setSlow(false);
    if (!waiting) return;
    const t = setInterval(load, 2500);
    const s = setTimeout(() => setSlow(true), 45000);
    return () => { clearInterval(t); clearTimeout(s); };
  }, [waiting, load]);

  const save = async (body: object) => {
    const r = await fetch(`/api/items/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (r.ok) {
      const next = await r.json();
      setItem((cur) => (cur ? { ...cur, ...next, category: cur.category, project: cur.project } : cur));
      inbox.refresh();
    }
  };

  const file = item && (item.kind === "image" || item.kind === "document") ? `/api/files/${item.id}` : null;
  const yt = item?.url ? youtubeId(item.url) : null;
  const pdf = item?.kind === "document" && (item.mime === "application/pdf" || /\.pdf$/i.test(item.fileName ?? ""));

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="tray" role="dialog" aria-modal="true" aria-label={item?.title ?? "Item"}>
        <div className="tray-top">
          {item && (
            <span className="pick-cat">
              <button className="chip" onClick={() => setPicking(!picking)} aria-label="Change category" aria-expanded={picking}>
                <span className="dot" style={{ background: item.category?.color ?? "var(--line)" }} />{item.category?.name ?? "Sorting…"}
              </button>
              {picking && <Menu inbox={inbox} item={{ id: item.id, categoryId: item.category?.id ?? null }} onClose={() => setPicking(false)} onPicked={load} />}
            </span>
          )}
          {item && (
            <ProjectPick item={item} onPicked={(project) => { setItem({ ...item, project }); save({ projectId: project?.id ?? null }); }} />
          )}
          <span className="grow" />
          {item && (
            <button className="icon" data-tip="Delete" aria-label="Delete" onClick={() => { inbox.remove(item.id); onClose(); }}><TrashIcon /></button>
          )}
          <button className="icon" data-tip="Close" aria-label="Close" onClick={onClose}><CloseIcon /></button>
        </div>
        {item && (
          <div className="tray-cols">
            <section className="side-tray tray-summary-side">
              <div className="label">
                Summary
                <button className="icon small" data-tip="Write a new summary" aria-label="Write a new summary"
                  onClick={() => { setItem({ ...item, overview: null, overviewBy: null, aiTries: 0 }); save({ summarize: true }); }}>
                  <RefreshIcon />
                </button>
              </div>
              {!waiting
                ? <Field className="tray-summary" label="Summary" placeholder={noSummary} value={item.overview ?? ""} onSave={(overview) => save({ overview })} />
                : <div className="tray-summary pending-lines" aria-label="Writing a summary"><span /><span /><span /><em>{slow ? "Still writing. Long items can take a few minutes, and it'll say so if it can't." : "Writing a summary…"}</em></div>}
            </section>

            <section className="tray-main">
              <Field className="tray-title" label="Title" placeholder={(item.url && fromUrl(item.url)) || "Title"} value={item.title ?? ""} onSave={(title) => save({ title })} />

              {item.kind === "note" && <Field className="tray-text" label="Note" placeholder="Write a note" value={item.text} onSave={(text) => save({ text })} />}

              {item.kind === "link" && item.url && (
                <>
                  {yt && (
                    <iframe className="video" src={`https://www.youtube-nocookie.com/embed/${yt}`} title={item.title ?? "Video"}
                      allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                  )}
                  {!yt && (item.image || item.summary) && (
                    <a className="preview" href={item.url} target="_blank" rel="noreferrer">
                      {item.image && <img src={item.image} alt="" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = "none"; }} />}
                      {item.summary && <span>{item.summary}</span>}
                    </a>
                  )}
                  <a className="source" href={item.url} target="_blank" rel="noreferrer"><OpenIcon />{host(item.url)}</a>
                </>
              )}

              {item.kind === "image" && file && (
                <a href={file} target="_blank" rel="noreferrer" className="media-link"><img className="media" src={file} alt={item.title ?? ""} /></a>
              )}

              {item.kind === "document" && file && (
                <>
                  {pdf ? <iframe className="doc" src={file} title={item.fileName ?? "Document"} />
                    : item.extracted ? <pre className="tray-text doc-text">{item.extracted}</pre> : null}
                  <a className="source" href={file} target="_blank" rel="noreferrer"><OpenIcon />{item.fileName}</a>
                </>
              )}
            </section>

            <section className="side-tray tray-notes">
              <div className="label">Notes</div>
              <Field className="notes" label="Notes" placeholder="Add your notes" value={item.notes ?? ""} onSave={(notes) => save({ notes })} />
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
