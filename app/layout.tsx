import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./mobile.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: "#101116",
};

export const metadata: Metadata = {
  title: "Mercato Multivers — Le talent se négocie.",
  description: "Recrutez des légendes. Composez votre équipe. Remportez les duels. Un jeu de mercato multivers entre amis.",
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
    <html lang="fr">
      <body className="antialiased">{children}</body>
    </html>
  );
}
