import type { Metadata } from "next";
import { CharacterScreen } from "../../../components/CharacterScreen";

export const metadata: Metadata = { title: "My Chog · Soryn" };

export default function CharacterPage() {
  return <CharacterScreen />;
}
