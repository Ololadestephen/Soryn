import type { Page } from "@playwright/test";

interface AudioCaptureResult {
  bytes: number[];
  startedAt: number;
  trace: { path: string; at: number }[];
  contexts: number;
}
declare global {
  interface Window {
    chogAudioQA: {
      finish: () => Promise<AudioCaptureResult>;
      trace: { path: string; at: number }[];
      contexts: number;
    };
  }
}

/** Captures the actual Web Audio output graph for QA, not a synthetic audio overlay. */
export async function installAudioCapture(page: Page) {
  await page.addInitScript(() => {
    const trace: { path: string; at: number }[] = [],
      chunks: Blob[] = [];
    let recorder: MediaRecorder | null = null,
      startedAt = 0;
    const connect = AudioNode.prototype.connect;
    Object.defineProperty(AudioNode.prototype, "connect", {
      value: function (
        this: AudioNode,
        destination: AudioNode,
        ...rest: unknown[]
      ) {
        const result = Reflect.apply(connect, this, [destination, ...rest]);
        if (destination === this.context.destination && !recorder) {
          const context = this.context as AudioContext,
            sink = context.createMediaStreamDestination();
          Reflect.apply(connect, this, [sink]);
          recorder = new MediaRecorder(sink.stream, {
            mimeType: "audio/webm;codecs=opus",
          });
          recorder.ondataavailable = (event) => {
            if (event.data.size) chunks.push(event.data);
          };
          startedAt = Date.now();
          window.chogAudioQA.contexts++;
          recorder.start(250);
        }
        return result;
      },
    });
    const play = HTMLMediaElement.prototype.play;
    const sources = new WeakMap<HTMLMediaElement, AudioContext>();
    HTMLMediaElement.prototype.play = function () {
      if (
        this instanceof HTMLAudioElement &&
        this.hasAttribute("data-game-soundtrack")
      ) {
        let context = sources.get(this);
        if (!context) {
          context = new AudioContext();
          context.createMediaElementSource(this).connect(context.destination);
          sources.set(this, context);
        }
        void context.resume();
        trace.push({ path: new URL(this.src).pathname, at: Date.now() });
      }
      return play.call(this);
    };
    window.chogAudioQA = {
      trace,
      contexts: 0,
      finish: async () => {
        const active = recorder;
        if (active)
          await new Promise<void>((resolve) => {
            active.onstop = () => resolve();
            active.stop();
          });
        return {
          bytes: [
            ...new Uint8Array(
              await new Blob(chunks, { type: "audio/webm" }).arrayBuffer(),
            ),
          ],
          startedAt,
          trace,
          contexts: window.chogAudioQA.contexts,
        };
      },
    };
  });
}
