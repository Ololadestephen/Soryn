import { GameSoundtrack } from "../components/combat/audio/GameSoundtrack";
import type { Metadata } from "next";
import { WalletSession } from "../components/auth/WalletSession";
import "./globals.css";
import "./layout.css";
import "./landing.css";
import "./play.css";
import "./results.css";
import "./museum.css";
import "./journal.css";
import "./identity.css";
import "./mychog.css";
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
import "./match.css";
import "./holder-access.css";
import "./story-journey.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_ORIGIN ?? "http://127.0.0.1:3000"),
  title: "Soryn · Creature battles",
  description:
    "Soryn is a browser tactical creature battler. Find a public match, challenge a friend, play the story, or practice. Four-starter Practice needs no wallet. Holder access unlocks Story and multiplayer.",
  openGraph: {
    title: "Soryn",
    description:
      "Public best-of-three battles, private challenges, and The Fractured Sanctuary. Soryn fiction, not official Monad or Chog canon.",
    images: [{ url: "/brand/soryn-icon-512.png" }],
  },
  icons: {
    icon: [
      { url: "/favicon.ico?v=soryn-1", sizes: "16x16 32x32 48x48" },
      { url: "/brand/soryn-icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/soryn-icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    apple: "/brand/soryn-icon-180.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <GameSoundtrack />
        <WalletSession>{children}</WalletSession>
      </body>
    </html>
  );
}
