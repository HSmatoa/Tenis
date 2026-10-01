import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tenis Cheb · Demo turnaje",
  description: "Soukromé demo turnaje čtyřher — registrace, pavouk a výsledky.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="cs">
      <body className="antialiased">{children}</body>
    </html>
  );
}
