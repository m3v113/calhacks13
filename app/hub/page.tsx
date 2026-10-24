import type { Metadata } from "next";
import Hub from "@/components/Hub";
import { names } from "@/lib/names";

export const metadata: Metadata = { title: names.hub };

export default function Page() {
  return <Hub />;
}
