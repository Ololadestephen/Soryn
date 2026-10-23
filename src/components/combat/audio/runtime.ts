/** One streaming music element across client navigation; never tied to combat frames. */
export class GameMusic {
  private audio: HTMLAudioElement | null = null;
  private activated = false;
  private pending: Promise<void> | null = null;
  private state = { enabled: true, volume: 0.3 };
  private serverState = this.state;
  private listeners = new Set<() => void>();
  get enabled() {
    return this.state.enabled;
  }
  get volume() {
    return this.state.volume;
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  snapshot = () => {
    this.preferences();
    return this.state;
  };
  serverSnapshot = () => this.serverState;
  private preferencesLoaded = false;
  preferences() {
    if (this.preferencesLoaded || typeof window === "undefined") return;
    this.preferencesLoaded = true;
    try {
      const stored = JSON.parse(
        localStorage.getItem("chog-combat-audio/1") ?? "null",
      );
      let enabled = this.enabled,
        volume = this.volume;
      if (typeof stored?.enabled === "boolean") enabled = stored.enabled;
      if (typeof stored?.volume === "number" && Number.isFinite(stored.volume))
        volume = Math.max(0, Math.min(1, stored.volume));
      this.state = { enabled, volume };
    } catch {
      /* Storage failure leaves local controls usable. */
    }
  }
  set(enabled: boolean, volume = this.volume) {
    this.state = {
      enabled,
      volume: Number.isFinite(volume)
        ? Math.max(0, Math.min(1, volume))
        : this.volume,
    };
    if (this.audio) {
      this.audio.volume = this.volume;
      if (!enabled) this.audio.pause();
    }
    try {
      localStorage.setItem(
        "chog-combat-audio/1",
        JSON.stringify({ enabled, volume: this.volume }),
      );
    } catch {
      /* Private browsing may deny storage. */
    }
    this.listeners.forEach((listener) => listener());
  }
  bind(audio: HTMLAudioElement) {
    this.audio?.pause();
    this.audio = audio;
    this.preferences();
    audio.volume = this.volume;
    return () => {
      audio.pause();
      if (this.audio === audio) this.audio = null;
    };
  }
  /** Invoked from a player gesture, never from combat event playback. */
  activate() {
    this.activated = true;
    this.resume();
  }
  suspend() {
    this.audio?.pause();
  }
  resume() {
    const audio = this.audio;
    if (
      !audio ||
      !this.activated ||
      !this.enabled ||
      this.pending ||
      document.visibilityState === "hidden" ||
      !audio.paused
    )
      return;
    this.pending = audio
      .play()
      .then(() => {
        if (
          this.audio !== audio ||
          !this.enabled ||
          document.visibilityState === "hidden"
        )
          audio.pause();
      })
      .catch(() => {
        // Autoplay denial or an unavailable track never blocks gameplay. A gesture can retry.
      })
      .finally(() => {
        this.pending = null;
      });
  }
}
export const gameMusic = new GameMusic();
