import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = { title: "Galaxy Bets — Galaxy Originals", description: "Premium demo-credit Galaxy Originals gaming platform." };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><AuthProvider><AppShell>{children}</AppShell></AuthProvider></body></html>;
}
