"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const oldSections: Record<string, string> = {
  "#adventure": "/play",
  "#museum": "/museum",
  "#journal": "/journal",
  "#character": "/character",
};

export function LegacySections() {
  const router = useRouter();
  useEffect(() => {
    const followBookmark = () => {
      const destination = oldSections[location.hash];
      if (destination) router.replace(destination);
    };
    followBookmark();
    window.addEventListener("hashchange", followBookmark);
    return () => window.removeEventListener("hashchange", followBookmark);
  }, [router]);
  return null;
}
