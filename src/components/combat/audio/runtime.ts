import type { BattleView } from "../../../domain/combat/contracts";
import type { SoundCue } from "../../../domain/combat/presentation/feel";

const common: SoundCue[] = [
  "select",
  "confirm",
  "impact",
  "block",
  "brace",
  "counter",
  "heal",
  "energy",
  "knockout",
  "victory",
  "defeat",
  "draw",
];
class CombatAudio {
  private context: AudioContext | null = null;
  private gain: GainNode | null = null;
  private buffers = new Map<SoundCue, AudioBuffer | null>();
  private loading = new Map<SoundCue, Promise<void>>();
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
    this.state = { enabled, volume: Math.max(0, Math.min(1, volume)) };
    if (this.gain) this.gain.gain.value = this.enabled ? this.volume : 0;
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
  /** Called synchronously from an actual selection/confirmation/settings interaction only. */
  activate() {
    this.preferences();
    if (!this.enabled || typeof window === "undefined" || !window.AudioContext)
      return;
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.gain = this.context.createGain();
        this.gain.gain.value = this.volume;
        this.gain.connect(this.context.destination);
      }
      void this.context.resume().catch(() => undefined);
      void this.prepareCues(["select", "confirm"]);
    } catch {
      /* Unsupported or denied audio cannot block combat. */
    }
  }
  private load(cue: SoundCue) {
    if (!this.context || this.buffers.has(cue)) return Promise.resolve();
    const prior = this.loading.get(cue);
    if (prior) return prior;
    const context = this.context;
    const operation = (async () => {
      try {
        const reply = await fetch(`/combat/audio/${cue}.wav`, {
          signal: AbortSignal.timeout(3500),
        });
        if (!reply.ok) throw new Error("Sound unavailable");
        const buffer = await context.decodeAudioData(await reply.arrayBuffer());
        this.buffers.set(cue, buffer);
      } catch {
        this.buffers.set(cue, null);
      } finally {
        this.loading.delete(cue);
      }
    })();
    this.loading.set(cue, operation);
    return operation;
  }
  private async prepareCues(cues: SoundCue[]) {
    await Promise.all(cues.map((cue) => this.load(cue)));
  }
  async prepare(battle: BattleView) {
    if (!this.context || !this.enabled) return;
    await this.prepareCues([
      ...common,
      `special-${battle.snapshot.player.id}`,
      `special-${battle.snapshot.opponent.id}`,
    ]);
  }
  ui(cue: "select" | "confirm") {
    this.activate();
    void this.load(cue).then(() => this.play(cue));
  }
  play(cue: SoundCue) {
    const buffer = this.buffers.get(cue);
    if (
      !this.enabled ||
      !buffer ||
      !this.context ||
      !this.gain ||
      this.context.state !== "running"
    )
      return;
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.gain);
    source.onended = () => source.disconnect();
    source.start();
  }
}
export const combatAudio = new CombatAudio();
