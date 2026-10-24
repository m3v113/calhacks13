"use client";
import { useEffect, useState } from "react";
import type { Category, useInbox } from "@/lib/useInbox";
import { CloseIcon, OpenIcon, TrashIcon } from "./Icons";

type Inbox = ReturnType<typeof useInbox>;
type Full = {
  id: string; kind: string; text: string; url: string | null; title: string | null; summary: string | null;
  fileName: string | null; mime: string | null; extracted: string | null; category: Category | null;
};

function youtubeId(url: string) {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1) || null;
    if (/(^|\.)youtube\.com$/.test(u.hostname)) return u.searchParams.get("v") ?? u.pathname.match(/\/(shorts|embed|live)\/([\w-]+)/)?.[2] ?? null;
  } catch {}
  return null;
}

// The full view of one item, opened by clicking it.
export default function ItemView({ id, inbox, onClose }: { id: string; inbox: Inbox; onClose: () => void }) {
  const [item, setItem] = useState<Full | null>(null);

  useEffect(() => {
    let live = true;
    fetch(`/api/items/${id}`).then((r) => (r.ok ? r.json() : null)).then((v) => live && setItem(v));
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    return () => { live = false; document.removeEventListener("keydown", esc); };
  }, [id, onClose]);

  const file = item && (item.kind === "image" || item.kind === "document") ? `/api/files/${item.id}` : null;
  const open = item?.url ?? file;
  const yt = item?.url ? youtubeId(item.url) : null;
  const pdf = item?.kind === "document" && (item.mime === "application/pdf" || /\.pdf$/i.test(item.fileName ?? ""));

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={item?.title ?? "Item"}>
        <div className="sheet-top">
          {item?.category && (
            <span className="chip"><span className="dot" style={{ background: item.category.color }} />{item.category.name}</span>
          )}
          <span className="grow" />
          {open && <a className="icon" href={open} target="_blank" rel="noreferrer" data-tip="Open" aria-label="Open"><OpenIcon /></a>}
          {item && (
            <button className="icon" data-tip="Delete" aria-label="Delete" onClick={() => { inbox.remove(item.id); onClose(); }}><TrashIcon /></button>
          )}
          <button className="icon" data-tip="Close" aria-label="Close" onClick={onClose}><CloseIcon /></button>
        </div>
        {item && (
          <div className="sheet-body">
            {item.title && <h2>{item.title}</h2>}
            {item.kind === "note" && <p className="full">{item.text}</p>}
            {item.kind === "link" && (
              <>
                {yt && (
                  <iframe className="video" src={`https://www.youtube-nocookie.com/embed/${yt}`} title={item.title ?? "Video"}
                    allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                )}
                {item.summary && <p className="muted">{item.summary}</p>}
                {item.text !== item.url && <p className="full">{item.text}</p>}
                <a className="muted link" href={item.url ?? "#"} target="_blank" rel="noreferrer">{item.url}</a>
              </>
            )}
            {item.kind === "image" && <img className="media" src={file!} alt={item.title ?? ""} />}
            {item.kind === "document" && (pdf
              ? <iframe className="doc" src={file!} title={item.fileName ?? "Document"} />
              : item.extracted ? <pre className="full">{item.extracted}</pre> : <p className="muted">{item.fileName}</p>)}
          </div>
        )}
      </div>
    </div>
  );
}
