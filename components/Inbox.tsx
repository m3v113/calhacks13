"use client";
import { useEffect, useRef, useState } from "react";
import type { Category, Item, useInbox } from "@/lib/useInbox";
import { DocIcon, ImageIcon, LinkIcon, MoreIcon, NoteIcon, PlusIcon, TrashIcon } from "./Icons";
import { COLORS } from "@/lib/colors";
import ItemView from "./ItemView";

type Inbox = ReturnType<typeof useInbox>;

const DRAG = "application/x-inbox-item";

// Category filter: a list on the Inbox page, chips in the Hub panel. Drop an item on one to move it there.
export function Categories({ inbox, selected, onSelect, chips }: { inbox: Inbox; selected: string | null; onSelect: (id: string | null) => void; chips?: boolean }) {
  const [over, setOver] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  // The list shows every category, so a new one has a place to drop things into. The chips only show the ones in use.
  const shown = chips ? inbox.categories.filter((c) => c.count > 0 || c.id === selected) : inbox.categories;
  const total = inbox.items.length;
  const drop = (id: string) => ({
    onDragOver: (e: React.DragEvent) => { if (e.dataTransfer.types.includes(DRAG)) { e.preventDefault(); setOver(id); } },
    onDragLeave: () => setOver((o) => (o === id ? null : o)),
    onDrop: (e: React.DragEvent) => { e.preventDefault(); setOver(null); const item = e.dataTransfer.getData(DRAG); if (item) inbox.setCategory(item, id); },
  });
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
        <li key={c.id} className={chips ? undefined : "cat"}>
          <button className={`${selected === c.id ? "on" : ""} ${over === c.id ? "over" : ""}`} onClick={() => onSelect(c.id)} {...drop(c.id)}>
            <span className="dot" style={{ background: c.color }} />
            <span className="name">{c.name}</span>
            {!chips && <span className="count">{c.count || ""}</span>}
          </button>
          {!chips && (
            <button className={`more ${editing === c.id ? "shown" : ""}`} aria-label={`Edit ${c.name}`} onClick={() => setEditing(editing === c.id ? null : c.id)}>
              <MoreIcon />
            </button>
          )}
          {editing === c.id && (
            <EditCategory category={c} inbox={inbox} onClose={() => setEditing(null)}
              onDeleted={() => { if (selected === c.id) onSelect(null); }} />
          )}
        </li>
      ))}
      {!chips && (
        <li className="new-cat">
          <PlusIcon />
          <input
            value={name}
            placeholder="New"
            aria-label="New category"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim()) { inbox.createCategory(name.trim()); setName(""); }
              if (e.key === "Escape") { setName(""); e.currentTarget.blur(); }
            }}
          />
        </li>
      )}
    </ul>
  );
}

// Rename, recolor, or delete a category.
function EditCategory({ category, inbox, onClose, onDeleted }: { category: Category; inbox: Inbox; onClose: () => void; onDeleted: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [name, setName] = useState(category.name);
  const [taken, setTaken] = useState(false);

  useEffect(() => {
    const away = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && onClose();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    setTimeout(() => document.addEventListener("mousedown", away));
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [onClose]);

  const rename = async () => {
    const next = name.trim();
    if (!next || next === category.name) return onClose();
    if (await inbox.editCategory(category.id, { name: next })) onClose();
    else setTaken(true);
  };

  return (
    <div className="menu edit-cat" ref={ref}>
      <input className="rename" value={name} aria-label="Category name" autoFocus
        onChange={(e) => { setName(e.target.value); setTaken(false); }}
        onKeyDown={(e) => e.key === "Enter" && rename()} onBlur={() => name.trim() !== category.name && rename()} />
      {taken && <div className="taken">That name is taken</div>}
      <div className="swatches">
        {COLORS.map((color) => (
          <button key={color} className={color === category.color ? "on" : ""} style={{ background: color }} aria-label={`Color ${color}`}
            onClick={() => inbox.editCategory(category.id, { color })} />
        ))}
      </div>
      <button className="danger" onClick={() => { inbox.deleteCategory(category.id); onDeleted(); onClose(); }}>
        <TrashIcon />Delete
      </button>
    </div>
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

// A readable name from a link's address while its page hasn't been read,
// e.g. ".../recipe/20144/banana-banana-bread/" → "Banana banana bread".
export function fromUrl(url: string) {
  try {
    const part = new URL(url).pathname.split("/").filter((p) => /[a-z]/i.test(p) && /[-_]/.test(p)).pop();
    if (!part) return null;
    const words = decodeURIComponent(part).replace(/\.[a-z]+$/i, "").replace(/[-_]+/g, " ").trim();
    return words ? words[0].toUpperCase() + words.slice(1) : null;
  } catch {
    return null;
  }
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
    <li className={`item ${pending ? "" : "openable"}`} draggable={!pending}
      onDragStart={(e) => { e.dataTransfer.setData(DRAG, item.id); e.dataTransfer.effectAllowed = "move"; }}
      onClick={(e) => {
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
        {item.kind === "link" && !heading && <div className="text">{(item.url && fromUrl(item.url)) ?? item.url ?? text}</div>}
        {item.url && <div className="host">{host(item.url)}</div>}
        {item.kind === "document" && !pending && item.title !== item.fileName && <div className="host">{item.fileName}</div>}
      </div>
      {item.kind === "image" && !item.id.startsWith("tmp-") && (
        <span className="thumb"><img src={`/api/files/${item.id}`} alt="" /></span>
      )}
      {/* Right column: delete on top, the category under it, lined up from row to row. */}
      <div className="aside">
        {!pending && <button className="delete" onClick={() => inbox.remove(item.id)} aria-label="Delete" data-tip="Delete"><TrashIcon /></button>}
        {showCat && category && !pending && (
          <button className="cat" onClick={() => setOpen(!open)}>{category.name}</button>
        )}
      </div>
      {open && <Menu inbox={inbox} item={item} onClose={() => setOpen(false)} />}
    </li>
  );
}

export function Menu({ inbox, item, onClose, onPicked }: { inbox: Inbox; item: Pick<Item, "id" | "categoryId">; onClose: () => void; onPicked?: () => void }) {
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
        <button key={c.id} className={c.id === item.categoryId ? "on" : ""} onClick={() => { inbox.setCategory(item.id, c.id).then(onPicked); onClose(); }}>
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
            inbox.newCategory(item.id, name.trim()).then(onPicked);
            onClose();
          }
        }}
      />
    </div>
  );
}
