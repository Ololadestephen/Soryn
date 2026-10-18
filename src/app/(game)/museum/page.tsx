import type { Metadata } from "next";
import { MuseumScreen } from "../../../components/guest/MuseumScreen";

export const metadata: Metadata = { title: "Archived museum · Soryn" };

export default function MuseumPage() {
  return <MuseumScreen />;
}
