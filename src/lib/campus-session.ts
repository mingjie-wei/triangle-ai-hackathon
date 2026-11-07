export type MapState = {
  slug?: string;
  paused: boolean;
  reveal: number;
  walk: number;
};
type Command =
  "hello" | "pause" | "focus-building" | "walk-to" | "clear-selection";
export type MapStatus = "loading" | "ready" | "error";
/** One host-side lifecycle per mounted iframe. Reload handshakes restore state, not routes. */
export class CampusSession {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private state: MapState;
  private available = false;
  constructor(
    initial: MapState,
    private send: (type: Command, payload?: Record<string, unknown>) => void,
    private status: (status: MapStatus) => void,
    private timeoutMs = 20000,
  ) {
    this.state = initial;
  }
  start() {
    this.dispose();
    this.available = false;
    this.status("loading");
    this.timer = setTimeout(() => this.fail(), this.timeoutMs);
    this.send("hello");
  }
  ready(current: MapState) {
    this.dispose();
    this.available = true;
    this.state = current;
    this.send("pause", { paused: current.paused });
    if (current.slug) this.send("focus-building", { slug: current.slug });
    else this.send("clear-selection");
    this.status("ready");
  }
  update(next: MapState) {
    const previous = this.state;
    this.state = next;
    if (!this.available) return; // Consume requests while unavailable; never replay old walking.
    if (next.paused !== previous.paused)
      this.send("pause", { paused: next.paused });
    if (
      next.slug &&
      (next.slug !== previous.slug || next.reveal !== previous.reveal)
    )
      this.send("focus-building", { slug: next.slug });
    if (!next.slug && previous.slug) this.send("clear-selection");
    if (next.slug && !next.paused && next.walk !== previous.walk)
      this.send("walk-to", { slug: next.slug });
  }
  fail() {
    this.dispose();
    this.available = false;
    this.status("error");
  }
  dispose() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
  }
}
