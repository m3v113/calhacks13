import type { Metadata } from "next";
import InboxPage from "@/components/InboxPage";
import { names } from "@/lib/names";

export const metadata: Metadata = { title: names.inbox };

export default function Page() {
  return <InboxPage />;
}
