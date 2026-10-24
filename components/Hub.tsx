"use client";
import { useEffect, useRef, useState } from "react";
import { useInbox } from "@/lib/useInbox";
import { useProjects } from "@/lib/useProjects";
import { Card, Lines, NewProject } from "./Projects";
import { Categories, InboxList } from "./Inbox";
import { PanelIcon } from "./Icons";
import Nav from "./Nav";
import { names } from "@/lib/names";

type View = { x: number; y: number; z: number };
const GRID = 24;
const KEY = "hub.view";

function stored<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function store(key: string, v: unknown) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch {}
}

export default function Hub() {
  const inbox = useInbox();
  const projects = useProjects();
  const [selected, setSelected] = useState<string | null>(null);
  const [panel, setPanel] = useState(true);
  const [view, setView] = useState<View>({ x: 0, y: 0, z: 1 });
  const [dragging, setDragging] = useState(false);
  const canvas = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  // A line being drawn from a card to another one, in canvas coordinates.
  const [draft, setDraft] = useState<{ from: string; x: number; y: number } | null>(null);

  const toCanvas = (clientX: number, clientY: number) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: (clientX - r.left - view.x) / view.z, y: (clientY - r.top - view.y) / view.z };
  };
  const connect = (from: string, e: React.PointerEvent) => {
    setDraft({ from, ...toCanvas(e.clientX, e.clientY) });
    const move = (ev: PointerEvent) => setDraft({ from, ...toCanvas(ev.clientX, ev.clientY) });
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setDraft(null);
      const to = (document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null)?.closest<HTMLElement>("[data-card]")?.dataset.card;
      if (to && to !== from) projects.connect(from, to);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  useEffect(() => {
    setView(stored(KEY, { x: 0, y: 0, z: 1 }));
    setPanel(stored("hub.panel", true));
  }, []);
  useEffect(() => store(KEY, view), [view]);
  useEffect(() => store("hub.panel", panel), [panel]);

  // Trackpad: two fingers pan, pinch (ctrl + wheel) zooms around the cursor.
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const r = el.getBoundingClientRect();
        const px = e.clientX - r.left;
        const py = e.clientY - r.top;
        setView((v) => {
          const z = Math.min(4, Math.max(0.2, v.z * Math.exp(-e.deltaY * 0.01)));
          return { z, x: px - ((px - v.x) * z) / v.z, y: py - ((py - v.y) * z) / v.z };
        });
      } else {
        setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const s = GRID * view.z;
  return (
    <div className="hub">
      <div
        ref={canvas}
        className={`canvas ${dragging ? "dragging" : ""}`}
        style={{
          backgroundImage: `radial-gradient(var(--grid) ${Math.max(1, 1.3 * view.z)}px, transparent 0)`,
          backgroundSize: `${s}px ${s}px`,
          backgroundPosition: `${view.x}px ${view.y}px`,
        }}
        onPointerDown={(e) => {
          if (e.target !== e.currentTarget || e.button !== 0) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY };
          setDragging(true);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          const dx = e.clientX - d.x;
          const dy = e.clientY - d.y;
          drag.current = { x: e.clientX, y: e.clientY };
          setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
        }}
        onPointerUp={() => { drag.current = null; setDragging(false); }}
        onPointerCancel={() => { drag.current = null; setDragging(false); }}
      >
        <div className="float"><Nav ai={inbox.ai} vision={inbox.vision} /></div>
        <div className="layer" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.z})` }}>
          <Lines projects={projects} draft={draft} />
          {projects.projects.map((p) => <Card key={p.id} project={p} projects={projects} view={view} onConnect={connect} />)}
        </div>
        {/* New cards go near the middle of what's on screen, nudged so they don't stack exactly. */}
        <NewProject projects={projects} at={() => {
          const r = canvas.current!.getBoundingClientRect();
          const n = projects.projects.length;
          return { x: (r.width / 2 - view.x) / view.z - 130 + (n % 5) * 24, y: (r.height / 2 - view.y) / view.z - 60 + (n % 5) * 24 };
        }} />
      </div>
      <button className="toggle" onClick={() => setPanel(!panel)} aria-label={panel ? "Hide inbox" : "Show inbox"}>
        <PanelIcon />
      </button>
      {panel && (
        <aside className="panel">
          <h2 className="heading">{names.inbox}</h2>
          <Categories inbox={inbox} selected={selected} onSelect={setSelected} chips />
          <InboxList inbox={inbox} selected={selected} />
        </aside>
      )}
    </div>
  );
}
