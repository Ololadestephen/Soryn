import { useCallback, useRef, useSyncExternalStore } from "react";

/** Observe native image state, including a failure before hydration attached events. */
export function useImageFailure() {
  const ref = useRef<HTMLImageElement>(null);
  const failure = useRef(false);
  const subscribe = useCallback((notify: () => void) => {
    const image = ref.current;
    if (!image) return () => {};
    const update = () => {
      failure.current = image.complete && image.naturalWidth === 0;
      notify();
    };
    image.addEventListener("load", update);
    image.addEventListener("error", update);
    update();
    return () => {
      image.removeEventListener("load", update);
      image.removeEventListener("error", update);
    };
  }, []);
  const failed = useSyncExternalStore(
    subscribe,
    () => failure.current,
    () => false,
  );
  return { ref, failed };
}
