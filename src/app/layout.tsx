import type { Metadata } from "next";
import "./globals.css";
import "./layout.css";
import "./landing.css";
import "./play.css";
import "./results.css";
import "./museum.css";
import "./journal.css";
import "./identity.css";
import "./characters.css";
import "./combat-selection.css";
import "./combat-arena.css";
import "./combat-effects.css";
import "./combat.css";
import "./combat-moves.css";
import "./battle-stage.css";
import "./battle-controls.css";
import "./battle-overlays.css";
import "./battle-responsive.css";
import "./battle-companions.css";
import "./rendered-presentation.css";
import "./arena-feel.css";
import "./arena-setup.css";
import "./arena-feedback.css";
import "./pvp.css";

export const metadata: Metadata = {
  title: "Chog Déjà Vu · Creature battles",
  description:
    "Turn-based creature battles. Choose your fighter, time your defence and unleash your companion. Four free starters. No wallet required.",
  icons: {
    icon: [
      { url: "/brand/emblem.svg", type: "image/svg+xml" },
      { url: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/brand/icon-180.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
