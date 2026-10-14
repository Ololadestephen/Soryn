export type HeroPlaybackState = {
  ready: boolean;
  playing: boolean;
  failed: boolean;
};
type Connection = EventTarget & { saveData?: boolean };
const enhancementDelayMs = 1500;
/** Independent decorative-media lifecycle; it never gates navigation. */
class HeroPlayback {
  private reduced = matchMedia("(prefers-reduced-motion: reduce)");
  private connection = (navigator as Navigator & { connection?: Connection })
    .connection;
  private source = matchMedia("(max-width:700px)").matches
    ? "/hero/sanctuary-motion-v3-mobile.mp4"
    : "/hero/sanctuary-motion-v3-desktop.mp4";
  private visible = true;
  private eligible = false;
  private disposed = false;
  private navigating = false;
  private ready = false;
  private failed = false;
  private generation = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private observer: IntersectionObserver;
  constructor(
    private video: HTMLVideoElement,
    root: HTMLElement,
    private report: (state: HeroPlaybackState) => void,
  ) {
    this.observer = new IntersectionObserver(
      ([entry]) => {
        this.visible = entry.isIntersecting;
        this.synchronize();
      },
      { threshold: 0.05 },
    );
    this.observer.observe(root);
    if (document.readyState === "complete") this.schedule();
    else window.addEventListener("load", this.schedule, { once: true });
    document.addEventListener("visibilitychange", this.synchronize);
    document.addEventListener("click", this.navigate, true);
    this.reduced.addEventListener("change", this.preferences);
    this.connection?.addEventListener("change", this.preferences);
    video.addEventListener("error", this.error);
  }
  private publish() {
    this.report({
      ready: this.ready,
      playing: !this.video.paused && !this.failed,
      failed: this.failed,
    });
  }
  private allowed() {
    return (
      !this.disposed &&
      !this.navigating &&
      this.visible &&
      !document.hidden &&
      !this.reduced.matches &&
      !this.connection?.saveData
    );
  }
  private pause() {
    this.generation++;
    this.video.pause();
    this.publish();
  }
  private clear() {
    this.pause();
    this.video.removeAttribute("src");
    this.video.load();
    this.ready = false;
    this.publish();
  }
  private async play() {
    if (!this.eligible || !this.allowed()) return;
    const attempt = ++this.generation;
    if (!this.video.getAttribute("src")) this.video.src = this.source;
    try {
      await this.video.play();
      if (attempt !== this.generation || !this.allowed()) {
        if (!this.allowed()) this.video.pause();
        return;
      }
      const frame = () => {
        if (attempt === this.generation && this.allowed()) {
          this.ready = true;
          this.failed = false;
          this.publish();
        }
      };
      if (this.video.requestVideoFrameCallback)
        this.video.requestVideoFrameCallback(frame);
      else if (this.video.readyState >= 2) frame();
    } catch {
      if (attempt === this.generation && !this.disposed) {
        this.failed = true;
        this.ready = false;
        this.publish();
      }
    }
  }
  private synchronize = () => {
    if (this.allowed()) void this.play();
    else this.pause();
  };
  private preferences = () => {
    if (this.reduced.matches || this.connection?.saveData) this.clear();
    else this.synchronize();
  };
  private schedule = () => {
    this.timer = setTimeout(() => {
      this.eligible = true;
      this.synchronize();
    }, enhancementDelayMs);
  };
  private error = () => {
    this.failed = true;
    this.ready = false;
    this.pause();
  };
  private navigate = (event: MouseEvent) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    const link = (event.target as Element).closest<HTMLAnchorElement>("a");
    if (
      !link ||
      link.hasAttribute("download") ||
      (link.target && link.target !== "_self")
    )
      return;
    const current = new URL(window.location.href);
    const destination = new URL(link.href, current);
    // Same-page links and a new tab leave this hero mounted and playing.
    if (
      destination.origin !== current.origin ||
      destination.pathname === current.pathname
    )
      return;
    this.navigating = true;
    this.clear();
  };
  dispose() {
    this.disposed = true;
    clearTimeout(this.timer);
    window.removeEventListener("load", this.schedule);
    document.removeEventListener("visibilitychange", this.synchronize);
    document.removeEventListener("click", this.navigate, true);
    this.reduced.removeEventListener("change", this.preferences);
    this.connection?.removeEventListener("change", this.preferences);
    this.video.removeEventListener("error", this.error);
    this.observer.disconnect();
    this.generation++;
    this.video.pause();
    this.video.removeAttribute("src");
    this.video.load();
  }
}
export function bindHeroPlayback(
  video: HTMLVideoElement,
  root: HTMLElement,
  report: (state: HeroPlaybackState) => void,
) {
  return new HeroPlayback(video, root, report);
}
