import { redirect } from "next/navigation";
import { Landing } from "../components/site/Landing";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ challenge?: string | string[] }>;
}) {
  const { challenge } = await searchParams;
  if (typeof challenge === "string")
    redirect(`/play?challenge=${encodeURIComponent(challenge)}`);
  return <Landing />;
}
