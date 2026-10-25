"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ScoutResult } from "@/lib/scouts";
import { guessKind, type ScoutKind } from "@/lib/scoutKind";
import { CheckIcon, PlusIcon, RefreshIcon, TrashIcon } from "./Icons";

type Scout = { id: string; kind: ScoutKind; brief: string; status: string; note: string | null; result: ScoutResult | null };
export type ScoutDraft = { brief: string; n: number };

const KINDS: { kind: ScoutKind; label: string }[] = [{ kind: "find", label: "Find" }, { kind: "answer", label: "Answer" }, { kind: "turn", label: "Turn into" }];
const BUSY = ["searching", "reading", "thinking"];
const PLACEHOLDER: Record<ScoutKind, string> = {
  find: "52-inch fan with a light under $200",
  answer: "How do I balance a wobbly fan?",
  turn: "APA citations for my sources",
};

const api = (url: string, method: string, body?: object) =>
  fetch(url, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const host = (link: string) => { try { return new URL(link).hostname.replace(/^www\./, ""); } catch { return link; } };

// The pages an answer actually cites, in order.
const cited = (r: Extract<ScoutResult, { kind: "answer" }>) =>
  r.pages.filter((p) => p.link && r.points.some((pt) => pt.sources.includes(p.n)));

// What a Scout found, as a section for the project: tasks become a Tasks section, the rest Writing.
function asSection(s: Scout): { type: string; title: string; notes?: string; tasks?: string[] } | null {
  const r = s.result;
  if (!r) return null;
  const title = (s.brief[0].toUpperCase() + s.brief.slice(1)).slice(0, 40);
  if (r.kind === "answer") {
    const used = cited(r);
    const links = used.length ? `<p><strong>Sources</strong></p><ul>${used.map((p) => `<li><p><a href="${esc(p.link)}">${esc(p.title)}</a></p></li>`).join("")}</ul>` : "";
    const cite = (ns: number[]) => ns.map((n) => r.pages[n - 1] && ` <a href="${esc(r.pages[n - 1].link)}">[${n}]</a>`).join("");
    return { type: "writing", title, notes: r.points.map((p) => `<p>${esc(p.text)}${cite(p.sources)}</p>`).join("") + links };
  }
  if (r.kind === "find") {
    const row = (o: (typeof r.options)[number]) =>
      `<li><p><a href="${esc(o.link)}">${esc(o.name)}</a>${r.fields.map((f, i) => (o.values[i] ? ` · ${esc(f)}: ${esc(o.values[i])}` : "")).join("")}. ${esc(o.why)}</p></li>`;
    return { type: "writing", title, notes: `<ul>${r.options.map(row).join("")}</ul>` };
  }
  if (r.into === "tasks") return { type: "tasks", title: r.title, tasks: r.items };
  const items = r.into === "table" ? r.rows.map((row) => row.map((c, i) => `${r.columns[i] ? `${r.columns[i]}: ` : ""}${c}`).join(" · ")) : r.items;
  return { type: "writing", title: r.title, notes: `<ul>${items.map((t) => `<li><p>${esc(t)}</p></li>`).join("")}</ul>` };
}

// The Scouts panel: write a brief, pick the kind (guessed for you), and Run. Each Scout shows its
// progress, then what it found, which you can add to the project.
export default function Scouts({ projectId, draft, onAdded }: { projectId: string; draft: ScoutDraft | null; onAdded: () => void }) {
  const [scouts, setScouts] = useState<Scout[]>([]);
  const [writing, setWriting] = useState(false);
  const [brief, setBrief] = useState("");
  const [kind, setKind] = useState<ScoutKind | null>(null); // null: follow the guess
  const [open, setOpen] = useState<string | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const box = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/projects/${projectId}/scouts`, { cache: "no-store" });
    if (r.ok) setScouts(await r.json());
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  // Check back while a Scout is running.
  const busy = scouts.some((s) => BUSY.includes(s.status));
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(load, 1500);
    return () => clearInterval(t);
  }, [busy, load]);

  // A task sent from the project opens a new brief with its text.
  useEffect(() => {
    if (!draft) return;
    setBrief(draft.brief); setKind(null); setWriting(true);
    setTimeout(() => { box.current?.focus(); box.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, 0);
  }, [draft]);

  const chosen = kind ?? guessKind(brief);
  const run = async () => {
    const b = brief.trim();
    if (!b) return;
    const r = await api(`/api/projects/${projectId}/scouts`, "POST", { brief: b, kind: chosen });
    if (!r.ok) return;
    const s: Scout = await r.json();
    setScouts([s, ...scouts]); setOpen(s.id);
    setWriting(false); setBrief(""); setKind(null);
  };
  const rerun = async (s: Scout) => {
    setScouts(scouts.map((x) => (x.id === s.id ? { ...x, status: "searching", note: "Starting" } : x)));
    setOpen(s.id);
    await api(`/api/scouts/${s.id}`, "PATCH", { run: true });
    load();
  };
  const remove = (s: Scout) => { setScouts(scouts.filter((x) => x.id !== s.id)); api(`/api/scouts/${s.id}`, "DELETE"); };
  const mark = (key: string) => setSaved((cur) => new Set(cur).add(key));
  const addSection = async (s: Scout) => {
    const sec = asSection(s);
    if (!sec) return;
    mark(`${s.id}:section`);
    await api(`/api/projects/${projectId}/sections`, "POST", sec);
    onAdded();
  };
  const saveLink = async (key: string, link: string) => {
    mark(key);
    await api("/api/items", "POST", { text: link, projectId });
    onAdded();
  };

  return (
    <div className="scout-panel">
      <div className="scout-head">
        <div className="label">Scouts</div>
        {!writing && <button className="icon small" aria-label="New Scout" data-tip="New Scout" onClick={() => { setWriting(true); setTimeout(() => box.current?.focus(), 0); }}><PlusIcon /></button>}
      </div>

      {writing && (
        <div className="scout-new">
          <textarea ref={box} rows={3} value={brief} aria-label="What should the Scout do?" placeholder={PLACEHOLDER[chosen]}
            onChange={(e) => setBrief(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); run(); } if (e.key === "Escape") setWriting(false); }} />
          <div className="kind-switch" role="radiogroup" aria-label="Kind of Scout">
            {KINDS.map((k) => (
              <button key={k.kind} role="radio" aria-checked={chosen === k.kind} className={chosen === k.kind ? "on" : ""} onClick={() => setKind(k.kind)}>{k.label}</button>
            ))}
          </div>
          <div className="scout-actions">
            <button onClick={() => { setWriting(false); setBrief(""); setKind(null); }}>Cancel</button>
            <button className="primary" disabled={!brief.trim()} onClick={run} data-tip={chosen === "turn" ? "Reads your sources" : "Up to 3 searches and 6 pages"}>Run</button>
          </div>
        </div>
      )}

      {!writing && !scouts.length && <p className="muted scout-empty">Find options, answer a question, or turn your sources into tasks or citations.</p>}

      <ul className="scout-list">
        {scouts.map((s) => {
          const shown = open === s.id || (open === null && s === scouts[0]);
          const running = BUSY.includes(s.status);
          return (
            <li key={s.id} className={`scout ${s.status}`}>
              <div className="scout-top">
                <button className="scout-brief" aria-expanded={shown} onClick={() => setOpen(shown ? "" : s.id)}>
                  <span className="scout-kind">{KINDS.find((k) => k.kind === s.kind)?.label}</span>
                  <span className="name">{s.brief}</span>
                </button>
                {!running && <button className="icon small fade" aria-label="Run again" data-tip="Run again" onClick={() => rerun(s)}><RefreshIcon /></button>}
                <button className="icon small fade" aria-label="Delete Scout" data-tip="Delete" onClick={() => remove(s)}><TrashIcon /></button>
              </div>
              {running && <div className="pending-lines scout-progress"><span /><em>{s.note ?? "Working"}…</em></div>}
              {s.status === "failed" && <p className="scout-note">{s.note}</p>}
              {shown && !running && s.result && <Result scout={s} saved={saved} onSaveLink={saveLink} onAdd={() => addSection(s)} />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Result({ scout, saved, onSaveLink, onAdd }: {
  scout: Scout; saved: Set<string>; onSaveLink: (key: string, link: string) => void; onAdd: () => void;
}) {
  const r = scout.result!;
  const added = saved.has(`${scout.id}:section`);
  const cite = (ns: number[]) => ns.map((n) => r.pages[n - 1] && (
    <a key={n} className="cite" href={r.pages[n - 1].link} target="_blank" rel="noreferrer" title={r.pages[n - 1].title}>{n}</a>
  ));
  return (
    <div className="scout-result">
      {r.kind === "find" && (
        <ul className="scout-options">
          {r.options.map((o, i) => {
            const key = `${scout.id}:${i}`;
            return (
              <li key={key}>
                <div className="opt-top">
                  <a href={o.link} target="_blank" rel="noreferrer" className="opt-name">{o.name}</a>
                  <button className="icon small" aria-label={`Save ${o.name} to Sources`} data-tip="Save to Sources" disabled={saved.has(key)} onClick={() => onSaveLink(key, o.link)}>
                    {saved.has(key) ? <CheckIcon /> : <PlusIcon />}
                  </button>
                </div>
                <div className="opt-values">{r.fields.map((f, j) => o.values[j] && <span key={f}>{f}: {o.values[j]}</span>)}</div>
                <div className="opt-why">{o.why} <span className="opt-host">{host(o.link)}</span></div>
              </li>
            );
          })}
        </ul>
      )}
      {r.kind === "answer" && (
        <div className="scout-answer">
          {r.points.map((p, i) => <p key={i}>{p.text}{cite(p.sources)}</p>)}
          {r.local && <p className="scout-note">From the local AI only, not the web.</p>}
        </div>
      )}
      {r.kind === "turn" && (
        r.into === "table" && r.columns.length ? (
          <div className="scout-table">
            <table>
              <thead><tr>{r.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
              <tbody>{r.rows.map((row, i) => <tr key={i}>{row.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
            </table>
          </div>
        ) : (
          <ul className="scout-items">{r.items.map((t, i) => <li key={i}>{t}</li>)}</ul>
        )
      )}
      {r.kind === "answer" && cited(r).length > 0 && (
        <ul className="scout-pages">
          {cited(r).map((p) => <li key={p.n}><a href={p.link} target="_blank" rel="noreferrer"><span className="cite">{p.n}</span> {p.title}</a></li>)}
        </ul>
      )}
      {r.skipped > 0 && <p className="scout-note">Skipped {r.skipped} {r.skipped === 1 ? "page that" : "pages that"} couldn't be read.</p>}
      <button className="scout-add" disabled={added} onClick={onAdd}>
        {added ? <><CheckIcon />Added</> : <><PlusIcon />{r.kind === "turn" && r.into === "tasks" ? "Add as tasks" : "Add to project"}</>}
      </button>
    </div>
  );
}

