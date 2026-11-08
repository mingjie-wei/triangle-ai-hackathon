import type { ChatSource, Recommendation } from "@/lib/chat-contract";
import SourceCard from "./SourceCard";
export default function RecommendationCard({
  recommendation: r,
  sources,
  onAction,
}: {
  recommendation: Extract<Recommendation, { status: "ok" }>;
  sources: ChatSource[];
  onAction: (
    recommendation: Extract<Recommendation, { status: "ok" }>,
    kind: "locate" | "walk",
  ) => void;
}) {
  return (
    <article
      className="ask-recommendation"
      aria-label={`Recommendation: ${r.placeName}`}
    >
      <span className="eyebrow">
        YOUR STARTING POINT ·{" "}
        {r.kind === "verified_event" ? "EVENT-BACKED" : "CAMPUS PLACE"}
      </span>
      <h3>{r.placeName}</h3>
      <p>{r.reason}</p>
      {sources.map((source) => (
        <SourceCard
          key={source.key}
          source={source}
          compact
          onAction={() => onAction(r, "locate")}
        />
      ))}
      <p className="ask-quest-note">{r.quest1.description}</p>
      <div className="ask-actions">
        <button onClick={() => onAction(r, "locate")}>Show on Map</button>
        <button onClick={() => onAction(r, "walk")}>
          Walk there virtually
        </button>
      </div>
      <details>
        <summary>An optional conversation starter</summary>
        <blockquote>{r.quest2.conversationStarter}</blockquote>
        <p className="ask-quest-note">
          A suggestion for later, not an arrival or attendance tracker.
        </p>
      </details>
      <details>
        <summary>What this suggestion verifies</summary>
        {r.limitations.map((x) => (
          <p key={x}>{x}</p>
        ))}
      </details>
    </article>
  );
}
