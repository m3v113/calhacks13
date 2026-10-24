"use client";
import { useEffect, useRef, useState } from "react";
import type { Category, Item, useInbox } from "@/lib/useInbox";

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

// The capture box and the item list.
export function InboxList({ inbox, selected }: { inbox: Inbox; selected: string | null }) {
  const [text, setText] = useState("");
  const box = useRef<HTMLTextAreaElement>(null);
  const byId = new Map(inbox.categories.map((c) => [c.id, c]));
  const items = selected ? inbox.items.filter((i) => i.categoryId === selected) : inbox.items;

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [text]);

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    setText("");
    inbox.add(t);
  };

  return (
    <>
      <textarea
        ref={box}
        className="capture"
        rows={1}
        value={text}
        placeholder="Add anything"
        aria-label="Add to inbox"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
          }
        }}
      />
      <ul className="items">
        {items.map((i) => (
          <Row key={i.id} item={i} category={i.categoryId ? byId.get(i.categoryId) : undefined} inbox={inbox} showCat={!selected} />
        ))}
      </ul>
    </>
  );
}

function host(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function Row({ item, category, inbox, showCat }: { item: Item; category?: Category; inbox: Inbox; showCat: boolean }) {
  const [open, setOpen] = useState(false);
  const pending = item.sortedBy === "pending" || item.id.startsWith("tmp-");
  const main = item.title ?? item.text.replace(/\n\s*\n/g, "\n");

  return (
    <li className="item">
      <button className="pick" onClick={() => !pending && setOpen(!open)} aria-label="Change category">
        <span className={`dot ${pending ? "pending" : ""}`} style={pending ? undefined : { background: category?.color ?? "var(--line)" }} />
      </button>
      <div className="body">
        <div className="text">{main}</div>
        {item.url && <a className="host" href={item.url} target="_blank" rel="noreferrer">{host(item.url)}</a>}
      </div>
      {showCat && category && !pending && (
        <button className="cat" onClick={() => setOpen(!open)}>{category.name}</button>
      )}
      {!pending && <button className="done" onClick={() => inbox.archive(item.id)} aria-label="Archive" title="Archive" />}
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
