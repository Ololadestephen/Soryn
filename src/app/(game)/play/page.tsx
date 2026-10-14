import type { Metadata } from "next";
import { PlayScreen } from "../../../components/guest/PlayScreen";

export const metadata: Metadata = { title: "Play · Chog Déjà Vu" };

export default async function PlayPage({
  searchParams,
}: {
  searchParams: Promise<{ challenge?: string | string[] }>;
}) {
  const { challenge } = await searchParams;
  return (
    <PlayScreen challenge={typeof challenge === "string" ? challenge : null} />
  );
}
