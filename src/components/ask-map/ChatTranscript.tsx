import type { Ref } from "react";
import { DateTime } from "luxon";
import Image from "next/image";
import type { Recommendation } from "@/lib/chat-contract";
import type { Turn, ChatMode } from "./types";
import AuraWelcome from "./AuraWelcome";
import SourceCard from "./SourceCard";
import RecommendationCard from "./RecommendationCard";
export default function ChatTranscript({
  scrollRef,
  turns,
  pending,
  mode,
  demo,
  onPrompt,
  onRetry,
  onAction,
  onRecommendationAction,
}: {
  scrollRef: Ref<HTMLDivElement>;
  turns: Turn[];
  pending: boolean;
  mode: ChatMode;
  demo: boolean;
  onPrompt: (prompt: string) => void;
  onRetry: (turn: Turn) => void;
  onAction: (id: string, kind: "locate" | "open") => void;
  onRecommendationAction: (
    recommendation: Extract<Recommendation, { status: "ok" }>,
    kind: "locate" | "walk",
  ) => void;
}) {
  return (
    <div ref={scrollRef} className="ask-transcript">
      {!turns.length && <AuraWelcome pending={pending} onPrompt={onPrompt} />}
      {turns.map((turn) => (
        <section
          className="ask-turn"
          key={turn.id}
          aria-label="Conversation turn"
        >
          <p className="ask-question">{turn.question}</p>
          <small className="ask-request-context">
            {turn.request.context.scope === "campus"
              ? "Campus-wide"
              : `Selected: ${turn.request.context.selectedSlug ?? "none"}`}
            {turn.request.context.filters
              ? " · Current filters included"
              : " · Question filters only"}
          </small>
          {turn.response && (
            <>
              <div className="aura-answer-label">
                <Image
                  src="/mascots/aura-guide.png"
                  width={38}
                  height={42}
                  alt=""
                />
                <strong>Aura</strong>
                <span>Here to help</span>
              </div>
              {turn.response.recommendation?.status === "ok" ? (
                <RecommendationCard
                  recommendation={turn.response.recommendation}
                  sources={turn.response.sources}
                  onAction={onRecommendationAction}
                />
              ) : (
                <p className="ask-reply">{turn.response.reply}</p>
              )}
              <div className="ask-resolution">
                <strong>{turn.response.resolvedScope.label}</strong>
                <span>
                  {DateTime.fromISO(turn.response.resolvedScope.start)
                    .setZone("America/New_York")
                    .toFormat("MMM d, h:mm a")}{" "}
                  –{" "}
                  {DateTime.fromISO(turn.response.resolvedScope.end)
                    .setZone("America/New_York")
                    .toFormat("MMM d, h:mm a")}{" "}
                  ET
                </span>
                <span>{turn.response.resolvedScope.filters}</span>
                {turn.response.resolvedScope.notes.map((note) => (
                  <span key={note}>{note}</span>
                ))}
              </div>
              {turn.response.recommendation?.status !== "ok" &&
                turn.response.resolvedScope.totalMatches > 0 &&
                turn.response.sources.some((x) => x.kind === "event") && (
                  <p className="ask-count">
                    Showing{" "}
                    {
                      turn.response.sources.filter((s) => s.kind === "event")
                        .length
                    }{" "}
                    of {turn.response.resolvedScope.totalMatches} event
                    {turn.response.resolvedScope.totalMatches === 1 ? "" : "s"}
                  </p>
                )}
              {turn.response.recommendation?.status !== "ok" && (
                <div className="ask-source-list">
                  {turn.response.sources.map((source) => (
                    <SourceCard
                      key={source.key}
                      source={source}
                      onAction={onAction}
                    />
                  ))}
                </div>
              )}
              <p className="ask-mode">
                {turn.response.meta.data_mode === "fixture"
                  ? "Saved demo feed"
                  : "Live event index"}{" "}
                ·{" "}
                {turn.response.meta.answerMode === "retrieval"
                  ? "Retrieval-only answer"
                  : turn.response.recommendation
                    ? "AI exploration response"
                    : "AI-selected highlights · All retrieved cards shown"}
                {turn.response.meta.fallbackReason &&
                turn.response.meta.fallbackReason !== "MODEL_NOT_CONFIGURED"
                  ? " · Model unavailable; showing retrieved facts"
                  : ""}
                {turn.response.meta.stale ? " · Event index may be stale" : ""}
              </p>
              <small>{turn.response.meta.coverage}</small>
              {demo && turn.response.diagnostics && (
                <details className="ask-diagnostics">
                  <summary>Demo diagnostics</summary>
                  <pre>
                    {JSON.stringify(
                      {
                        diagnostics: turn.response.diagnostics,
                        mode: turn.response.meta.answerMode,
                        fallbackReason: turn.response.meta.fallbackReason,
                        recommendation: turn.response.recommendation,
                      },
                      null,
                      2,
                    )}
                  </pre>
                </details>
              )}
            </>
          )}
          {turn.error && (
            <div className="ask-error" role="alert">
              <p>{turn.error}</p>
              <button onClick={() => onRetry(turn)} disabled={pending}>
                Retry question
              </button>
            </div>
          )}
        </section>
      ))}
      <div role="status" aria-live="polite" className="ask-status">
        {pending
          ? mode === "explore"
            ? "Aura is finding a grounded starting point…"
            : "Aura is checking the event index…"
          : turns.at(-1)?.response
            ? `Answer ready. ${turns.at(-1)!.response!.sources.length} source cards.`
            : ""}
      </div>
    </div>
  );
}
