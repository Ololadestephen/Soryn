import type { Metadata } from "next";
import { JournalScreen } from "../../../components/guest/JournalScreen";

export const metadata: Metadata = { title: "Archived journal · Soryn" };

export default function JournalPage() {
  return <JournalScreen />;
}
