import { useEffect, useRef, useState, useSyncExternalStore } from "react";
const subscribe = () => () => {};
const readySnapshot = () => true;
const serverSnapshot = () => false;
/** Defers large media, never section text or navigation. */
export function useReveal(rootMargin = "100px") {
  const root = useRef<HTMLElement>(null);
  const [revealed, setRevealed] = useState(false);
  const ready = useSyncExternalStore(subscribe, readySnapshot, serverSnapshot);
  useEffect(() => {
    if (!root.current || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(root.current);
    return () => observer.disconnect();
  }, [rootMargin]);
  return { root, revealed, ready, reveal: () => setRevealed(true) };
}
