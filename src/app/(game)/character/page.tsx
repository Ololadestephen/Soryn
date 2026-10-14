import type { Metadata } from "next";
import { CharacterScreen } from "../../../components/CharacterScreen";

export const metadata: Metadata = { title: "My Chog · Chog Déjà Vu" };

export default function CharacterPage() {
  return <CharacterScreen />;
}
