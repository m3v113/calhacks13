"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { names } from "@/lib/names";
import { HubIcon, InboxIcon } from "./Icons";

export default function Nav({ ai }: { ai: boolean | null }) {
  const path = usePathname();
  return (
    <nav className="nav">
      <Link href="/" className={path === "/" ? "on" : ""} title={names.hub} aria-label={names.hub}><HubIcon /></Link>
      <Link href="/inbox" className={path === "/inbox" ? "on" : ""} title={names.inbox} aria-label={names.inbox}><InboxIcon /></Link>
      <span className={`status ${ai === null ? "" : ai ? "ai" : "rules"}`} title={ai ? "Local AI on" : "Local AI off"} />
    </nav>
  );
}
