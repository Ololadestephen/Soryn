import type { Metadata } from "next";
import { JournalScreen } from "../../../components/guest/JournalScreen";

export const metadata: Metadata = { title: "My journal · Chog Déjà Vu" };

export default function JournalPage() {
  return <JournalScreen />;
}
