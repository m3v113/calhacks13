"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { names } from "@/lib/names";
import { HubIcon, InboxIcon, MoonIcon, SunIcon, SystemIcon } from "./Icons";

type Theme = "system" | "light" | "dark";
const NEXT: Record<Theme, Theme> = { system: "light", light: "dark", dark: "system" };
const LABEL: Record<Theme, string> = { system: "Theme: match Mac", light: "Theme: light", dark: "Theme: dark" };

// Cycles system → light → dark. "System" follows the Mac's appearance setting.
function ThemeButton() {
  const [theme, setTheme] = useState<Theme>("system");
  useEffect(() => {
    try {
      const t = localStorage.getItem("theme");
      if (t === "light" || t === "dark") setTheme(t);
    } catch {}
  }, []);
  const change = () => {
    const t = NEXT[theme];
    setTheme(t);
    if (t === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = t;
    try { localStorage.setItem("theme", t); } catch {}
  };
  const Icon = theme === "light" ? SunIcon : theme === "dark" ? MoonIcon : SystemIcon;
  return (
    <button className="theme" onClick={change} data-tip={LABEL[theme]} aria-label={LABEL[theme]}>
      <Icon />
    </button>
  );
}

export default function Nav({ ai, vision }: { ai: boolean | null; vision?: boolean }) {
  const path = usePathname();
  const status = ai === null ? "Checking local AI…"
    : !ai ? "Local AI is off (Ollama isn't running)"
    : vision ? "Local AI is on" : "Local AI is on · no image model";
  return (
    <nav className="nav">
      <Link href="/" className={path === "/" ? "on" : ""} data-tip={names.hub} aria-label={names.hub}><HubIcon /></Link>
      <Link href="/inbox" className={path === "/inbox" ? "on" : ""} data-tip={names.inbox} aria-label={names.inbox}><InboxIcon /></Link>
      <ThemeButton />
      <span className={`status ${ai === null ? "" : ai ? "ai" : "rules"}`} data-tip={status} tabIndex={0} aria-label={status} />
    </nav>
  );
}
