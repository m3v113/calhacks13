"use client";
import { useState } from "react";
import { useInbox } from "@/lib/useInbox";
import { Categories, InboxList } from "./Inbox";
import Nav from "./Nav";

export default function InboxPage() {
  const inbox = useInbox();
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <div className="page">
      <aside className="side">
        <Nav ai={inbox.ai} />
        <Categories inbox={inbox} selected={selected} onSelect={setSelected} />
      </aside>
      <main className="main">
        <div className="column">
          <InboxList inbox={inbox} selected={selected} />
        </div>
      </main>
    </div>
  );
}
