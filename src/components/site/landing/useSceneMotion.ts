import { useEffect, type RefObject } from "react";

/** Visibility owns only the brief environment fade; scrolling and text never move. */
export function bindSceneMotion(element: HTMLElement) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let visible = true;
  const update = () => {
    element.dataset.motion =
      visible && !document.hidden && !reduced.matches ? "on" : "off";
  };
  const observer = new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    update();
  });
  observer.observe(element);
  document.addEventListener("visibilitychange", update);
  reduced.addEventListener("change", update);
  update();
  return () => {
    observer.disconnect();
    document.removeEventListener("visibilitychange", update);
    reduced.removeEventListener("change", update);
  };
}
export function useSceneMotion(root: RefObject<HTMLElement | null>) {
  useEffect(
    () => (root.current ? bindSceneMotion(root.current) : undefined),
    [root],
  );
}
