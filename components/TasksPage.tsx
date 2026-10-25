"use client";
import { useState } from "react";
import { useInbox } from "@/lib/useInbox";
import Agenda from "./Agenda";
import ItemView from "./ItemView";
import Nav from "./Nav";
import { names } from "@/lib/names";

// The Tasks bar on its own page: everything with a date, time, or priority, from the Pantry and every project.
export default function TasksPage() {
  const inbox = useInbox();
  const [viewing, setViewing] = useState<string | null>(null);
  return (
    <div className="page">
      <aside className="side">
        <Nav ai={inbox.ai} vision={inbox.vision} />
      </aside>
      <main className="main">
        <div className="column">
          <h1 className="heading">{names.tasks}</h1>
          <Agenda onOpen={setViewing} />
        </div>
      </main>
      {viewing && <ItemView id={viewing} inbox={inbox} onClose={() => setViewing(null)} />}
    </div>
  );
}
