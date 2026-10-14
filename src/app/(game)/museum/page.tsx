import type { Metadata } from "next";
import { MuseumScreen } from "../../../components/guest/MuseumScreen";

export const metadata: Metadata = { title: "The museum · Chog Déjà Vu" };

export default function MuseumPage() {
  return <MuseumScreen />;
}
