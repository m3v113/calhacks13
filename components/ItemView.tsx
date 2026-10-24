"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Category, useInbox } from "@/lib/useInbox";
import { CloseIcon, OpenIcon, RefreshIcon, TrashIcon } from "./Icons";

type Inbox = ReturnType<typeof useInbox>;
type Full = {
  id: string; kind: string; text: string; url: string | null; title: string | null; summary: string | null;
  fileName: string | null; mime: string | null; extracted: string | null; category: Category | null;
  overview: string | null; overviewBy: string | null; notes: string | null; sortedBy: string;
};

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
function Field({ value, onSave, className, placeholder, label }: {
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

// The tray view: content and summary on the left, your notes on the right. Everything saves as you type.
export default function ItemView({ id, inbox, onClose }: { id: string; inbox: Inbox; onClose: () => void }) {
  const [item, setItem] = useState<Full | null>(null);

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
  const waiting = !!item && !item.overview && inbox.ai === true
    && !(item.kind === "link" && !item.title) && !(item.kind === "image" && !inbox.vision);
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(load, 2500);
    return () => clearInterval(t);
  }, [waiting, load]);

  const save = async (body: object) => {
    const r = await fetch(`/api/items/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (r.ok) {
      const next = await r.json();
      setItem((cur) => (cur ? { ...cur, ...next, category: cur.category } : cur));
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
          {item?.category && (
            <span className="chip"><span className="dot" style={{ background: item.category.color }} />{item.category.name}</span>
          )}
          <span className="grow" />
          {item && (
            <button className="icon" data-tip="Delete" aria-label="Delete" onClick={() => { inbox.remove(item.id); onClose(); }}><TrashIcon /></button>
          )}
          <button className="icon" data-tip="Close" aria-label="Close" onClick={onClose}><CloseIcon /></button>
        </div>
        {item && (
          <div className="tray-cols">
            <section className="tray-main">
              <Field className="tray-title" label="Title" placeholder="Title" value={item.title ?? ""} onSave={(title) => save({ title })} />

              {item.kind === "note" && <Field className="tray-text" label="Note" value={item.text} onSave={(text) => save({ text })} />}

              {item.kind === "link" && item.url && (
                <>
                  {yt && (
                    <iframe className="video" src={`https://www.youtube-nocookie.com/embed/${yt}`} title={item.title ?? "Video"}
                      allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
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

              <div className="label">
                Summary
                <button className="icon small" data-tip="Write a new summary" aria-label="Write a new summary"
                  onClick={() => { setItem({ ...item, overview: null, overviewBy: null }); save({ summarize: true }); }}>
                  <RefreshIcon />
                </button>
              </div>
              {!waiting
                ? <Field className="tray-summary" label="Summary" placeholder="Write a summary" value={item.overview ?? ""} onSave={(overview) => save({ overview })} />
                : <div className="tray-summary pending-lines" aria-label="Writing a summary"><span /><span /><span /></div>}
            </section>

            <section className="tray-notes">
              <div className="label">Notes</div>
              <Field className="notes" label="Notes" placeholder="Add your notes" value={item.notes ?? ""} onSave={(notes) => save({ notes })} />
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
