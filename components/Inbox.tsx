"use client";
import { useEffect, useRef, useState } from "react";
import type { Category, Item, useInbox } from "@/lib/useInbox";
import { DocIcon, ImageIcon, LinkIcon, NoteIcon, PlusIcon, TrashIcon } from "./Icons";
import ItemView from "./ItemView";

type Inbox = ReturnType<typeof useInbox>;

// Category filter: a list on the Inbox page, chips in the Hub panel.
export function Categories({ inbox, selected, onSelect, chips }: { inbox: Inbox; selected: string | null; onSelect: (id: string | null) => void; chips?: boolean }) {
  const shown = inbox.categories.filter((c) => c.count > 0 || c.id === selected);
  const total = inbox.items.length;
  return (
    <ul className={chips ? "chips" : "cats"}>
      <li>
        <button className={selected === null ? "on" : ""} onClick={() => onSelect(null)}>
          <span className="dot" style={{ background: "var(--ink)" }} />
          <span className="name">All</span>
          {!chips && <span className="count">{total}</span>}
        </button>
      </li>
      {shown.map((c) => (
        <li key={c.id}>
          <button className={selected === c.id ? "on" : ""} onClick={() => onSelect(c.id)}>
            <span className="dot" style={{ background: c.color }} />
            <span className="name">{c.name}</span>
            {!chips && <span className="count">{c.count}</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}

const ADD: { kind: "note" | "link" | "image" | "document"; label: string; Icon: () => React.JSX.Element; accept?: string }[] = [
  { kind: "note", label: "Note", Icon: NoteIcon },
  { kind: "link", label: "Link", Icon: LinkIcon },
  { kind: "image", label: "Image", Icon: ImageIcon, accept: "image/*" },
  { kind: "document", label: "Document", Icon: DocIcon, accept: ".pdf,.txt,.md,.csv,.json,.doc,.docx,.rtf,.pages,application/pdf,text/*" },
];

// The capture box (with the + menu) and the item list.
export function InboxList({ inbox, selected }: { inbox: Inbox; selected: string | null }) {
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"note" | "link">("note");
  const [adding, setAdding] = useState(false);
  const [dropping, setDropping] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const addMenu = useRef<HTMLDivElement>(null);
  const byId = new Map(inbox.categories.map((c) => [c.id, c]));
  const items = selected ? inbox.items.filter((i) => i.categoryId === selected) : inbox.items;

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);

  useEffect(() => {
    if (!adding) return;
    const away = (e: MouseEvent) => addMenu.current && !addMenu.current.contains(e.target as Node) && setAdding(false);
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [adding]);

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    setText("");
    setMode("note");
    inbox.add(t, mode);
  };

  const choose = (kind: (typeof ADD)[number]["kind"]) => {
    setAdding(false);
    if (kind === "note" || kind === "link") {
      setMode(kind);
      box.current?.focus();
      return;
    }
    const input = picker.current!;
    input.accept = ADD.find((a) => a.kind === kind)!.accept!;
    input.click();
  };

  const files = (list: FileList | null) => {
    const fs = Array.from(list ?? []);
    if (fs.length) inbox.upload(fs);
  };

  return (
    <div
      className={dropping ? "dropping" : ""}
      onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setDropping(true); } }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropping(false); }}
      onDrop={(e) => { e.preventDefault(); setDropping(false); files(e.dataTransfer.files); }}
    >
      <div className="capture">
        <div className="add" ref={addMenu}>
          <button className={`plus ${adding ? "on" : ""}`} onClick={() => setAdding(!adding)} aria-label="Add" aria-expanded={adding}>
            <PlusIcon />
          </button>
          {adding && (
            <div className="menu left">
              {ADD.map(({ kind, label, Icon }) => (
                <button key={kind} onClick={() => choose(kind)}><Icon />{label}</button>
              ))}
            </div>
          )}
        </div>
        <textarea
          ref={box}
          rows={1}
          value={text}
          placeholder={mode === "link" ? "Paste a link" : "Write a note"}
          aria-label={mode === "link" ? "Add a link" : "Add a note"}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => !text && setMode("note")}
          onPaste={(e) => { if (e.clipboardData.files.length) { e.preventDefault(); files(e.clipboardData.files); } }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <input ref={picker} type="file" multiple hidden onChange={(e) => { files(e.target.files); e.target.value = ""; }} />
      </div>
      <ul className="items">
        {items.map((i) => (
          <Row key={i.id} item={i} category={i.categoryId ? byId.get(i.categoryId) : undefined} inbox={inbox} showCat={!selected} onOpen={() => setViewing(i.id)} />
        ))}
      </ul>
      {viewing && <ItemView id={viewing} inbox={inbox} onClose={() => setViewing(null)} />}
    </div>
  );
}

function host(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function Row({ item, category, inbox, showCat, onOpen }: { item: Item; category?: Category; inbox: Inbox; showCat: boolean; onOpen: () => void }) {
  const [open, setOpen] = useState(false);
  const pending = item.sortedBy === "pending" || item.id.startsWith("tmp-");
  const file = item.kind === "image" || item.kind === "document";
  const text = item.text.replace(/\n\s*\n/g, "\n");
  // Show the title once there is one, with the note, link, or file name underneath.
  const heading = item.title ?? (file ? item.fileName : null);
  const showText = item.kind === "note" && item.sortedBy !== "sure" && (!heading || heading !== text);

  return (
    <li className={`item ${pending ? "" : "openable"}`} onClick={(e) => {
      // Clicking the row opens it; clicks on its buttons, links, and menu don't.
      if (pending || (e.target as HTMLElement).closest("button, a, input, .menu")) return;
      onOpen();
    }}>
      <button className="pick" onClick={() => !pending && setOpen(!open)} aria-label="Change category">
        <span className={`dot ${pending ? "pending" : ""}`} style={pending ? undefined : { background: category?.color ?? "var(--line)" }} />
      </button>
      <div className="body">
        {heading && <div className="title">{heading}</div>}
        {showText && <div className={heading ? "text sub" : "text"}>{text}</div>}
        {item.kind === "link" && !heading && <div className="text">{item.url ?? text}</div>}
        {item.url && <a className="host" href={item.url} target="_blank" rel="noreferrer">{host(item.url)}</a>}
        {item.kind === "document" && !pending && item.title !== item.fileName && (
          <a className="host" href={`/api/files/${item.id}`} target="_blank" rel="noreferrer">{item.fileName}</a>
        )}
      </div>
      {item.kind === "image" && !item.id.startsWith("tmp-") && (
        <span className="thumb"><img src={`/api/files/${item.id}`} alt="" /></span>
      )}
      {showCat && category && !pending && (
        <button className="cat" onClick={() => setOpen(!open)}>{category.name}</button>
      )}
      {!pending && <button className="delete" onClick={() => inbox.remove(item.id)} aria-label="Delete" data-tip="Delete"><TrashIcon /></button>}
      {open && <Menu inbox={inbox} item={item} onClose={() => setOpen(false)} />}
    </li>
  );
}

function Menu({ inbox, item, onClose }: { inbox: Inbox; item: Item; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [name, setName] = useState("");

  useEffect(() => {
    const away = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && onClose();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    setTimeout(() => document.addEventListener("mousedown", away));
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [onClose]);

  return (
    <div className="menu" ref={ref}>
      {inbox.categories.map((c) => (
        <button key={c.id} className={c.id === item.categoryId ? "on" : ""} onClick={() => { inbox.setCategory(item.id, c.id); onClose(); }}>
          <span className="dot" style={{ background: c.color }} />
          {c.name}
        </button>
      ))}
      <input
        value={name}
        placeholder="New"
        aria-label="New category"
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && name.trim()) {
            inbox.newCategory(item.id, name.trim());
            onClose();
          }
        }}
      />
    </div>
  );
}
