const decodedBudget = 48 * 1024 * 1024;
const imageTimeoutMs = 30000;
const cache = new Map<string, PreparedImage>();
class PreparedImage {
  readonly image = new Image();
  readonly decoded: Promise<boolean>;
  users = 0;
  complete = false;
  private settle: (ok: boolean) => void = () => {};
  private timer: ReturnType<typeof setTimeout>;
  constructor(private path: string) {
    this.decoded = new Promise((resolve) => {
      this.settle = resolve;
    });
    this.timer = setTimeout(() => this.finish(false), imageTimeoutMs);
    this.image.onload = this.decode;
    this.image.onerror = () => this.finish(false);
  }
  start() {
    this.image.src = this.path;
  }
  private decode = async () => {
    try {
      await this.image.decode();
      this.finish(true);
    } catch {
      this.finish(false);
    }
  };
  private finish(ok: boolean) {
    if (this.complete) return;
    this.complete = true;
    clearTimeout(this.timer);
    this.image.onload = null;
    this.image.onerror = null;
    if (!ok && cache.get(this.path) === this) cache.delete(this.path);
    this.settle(ok);
  }
  cancel() {
    this.finish(false);
    this.image.src = "";
  }
  get bytes() {
    return this.image.naturalWidth * this.image.naturalHeight * 4;
  }
}
function trimCache() {
  let bytes = [...cache.values()]
    .filter((entry) => entry.complete)
    .reduce((sum, entry) => sum + entry.bytes, 0);
  for (const [path, entry] of cache) {
    if (bytes <= decodedBudget) break;
    if (entry.complete && entry.users === 0) {
      cache.delete(path);
      bytes -= entry.bytes;
    }
  }
}
/** Successful decoded images survive rematches; abandoned setup requests are cancellable. */
export async function prepareImage(
  path: string,
  signal?: AbortSignal,
): Promise<boolean> {
  if (signal?.aborted) return false;
  let entry = cache.get(path);
  if (!entry) {
    entry = new PreparedImage(path);
    cache.set(path, entry);
    entry.start();
  }
  const acquired = entry;
  acquired.users++;
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    acquired.users--;
    if (!acquired.complete && acquired.users === 0) acquired.cancel();
    trimCache();
  };
  signal?.addEventListener("abort", release, { once: true });
  try {
    return await acquired.decoded;
  } finally {
    signal?.removeEventListener("abort", release);
    release();
  }
}
