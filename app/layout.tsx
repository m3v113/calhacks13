import type { Metadata } from "next";
import { names } from "@/lib/names";
import "./globals.css";

export const metadata: Metadata = { title: names.app };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
