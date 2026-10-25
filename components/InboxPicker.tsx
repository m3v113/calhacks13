"use client";
import { useState } from "react";
import type { Item, useInbox } from "@/lib/useInbox";
import { fromUrl } from "./Inbox";

export const itemName = (i: Item) => i.title ?? i.fileName ?? (i.url && fromUrl(i.url)) ?? i.url ?? i.text;

// Pick an item from the inbox: search, filter by category, results grouped by category.
export default function InboxPicker({ inbox, exclude, onPick, up, inline }: {
  inbox: ReturnType<typeof useInbox>; exclude: Set<string>; onPick: (item: Item) => void; up?: boolean; inline?: boolean;
}) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const needle = q.trim().toLowerCase();
  const choices = inbox.items.filter((i) => !exclude.has(i.id) && !i.id.startsWith("tmp-") && (!cat || i.categoryId === cat)
    && (!needle || [i.title, i.text, i.fileName, i.url].join(" ").toLowerCase().includes(needle)));
  const groups = inbox.categories.map((c) => ({ c, items: choices.filter((i) => i.categoryId === c.id) })).filter((g) => g.items.length);
  return (
    <div className={`menu pick-items ${up ? "up" : ""} ${inline ? "inline" : ""}`}>
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
            <button key={i.id} onClick={() => onPick(i)}>
              <span className="dot" style={{ background: c.color }} />
              <span className="name">{itemName(i)}</span>
            </button>
          ))}
        </div>
      ))}
      {!groups.length && <p className="muted pick-none">Nothing found</p>}
    </div>
  );
}
