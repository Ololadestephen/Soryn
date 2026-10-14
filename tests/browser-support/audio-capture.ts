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
    const names = new WeakMap<ArrayBuffer, string>(),
      buffers = new WeakMap<AudioBuffer, string>();
    const trace: { path: string; at: number }[] = [],
      chunks: Blob[] = [];
    let recorder: MediaRecorder | null = null,
      startedAt = 0;
    const originalBuffer = Response.prototype.arrayBuffer;
    Response.prototype.arrayBuffer = async function () {
      const bytes = await originalBuffer.call(this);
      if (this.url.includes("/combat/audio/"))
        names.set(bytes, new URL(this.url).pathname);
      return bytes;
    };
    const decode = AudioContext.prototype.decodeAudioData;
    Object.defineProperty(AudioContext.prototype, "decodeAudioData", {
      value: function (
        this: AudioContext,
        bytes: ArrayBuffer,
        ...rest: unknown[]
      ) {
        const result: Promise<AudioBuffer> = Reflect.apply(decode, this, [
          bytes,
          ...rest,
        ]);
        return result.then((buffer) => {
          const name = names.get(bytes);
          if (name) buffers.set(buffer, name);
          return buffer;
        });
      },
    });
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
    const start = AudioBufferSourceNode.prototype.start;
    Object.defineProperty(AudioBufferSourceNode.prototype, "start", {
      value: function (this: AudioBufferSourceNode, ...args: unknown[]) {
        const result = Reflect.apply(start, this, args);
        const path = this.buffer ? buffers.get(this.buffer) : undefined;
        if (path) trace.push({ path, at: Date.now() });
        return result;
      },
    });
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
