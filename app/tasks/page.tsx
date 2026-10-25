import type { Metadata } from "next";
import TasksPage from "@/components/TasksPage";
import { names } from "@/lib/names";

export const metadata: Metadata = { title: names.tasks };

export default function Page() {
  return <TasksPage />;
}
