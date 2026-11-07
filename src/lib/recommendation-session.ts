import type { Recommendation } from "./chat-contract";
/** Session-only guard. Neither late responses nor non-success results replace a valid target. */
export class RecommendationSession {
  private sequence = 0;
  active: Extract<Recommendation, { status: "ok" }> | null = null;
  begin() {
    return ++this.sequence;
  }
  isCurrent(token: number) {
    return token === this.sequence;
  }
  accept(token: number, value: Recommendation | undefined) {
    if (!this.isCurrent(token) || value?.status !== "ok") return null;
    this.active = value;
    return value;
  }
}
