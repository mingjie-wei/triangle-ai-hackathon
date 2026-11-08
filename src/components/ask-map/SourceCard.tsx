import { DateTime } from "luxon";
import type { ChatSource } from "@/lib/chat-contract";
export default function SourceCard({
  source,
  onAction,
  compact = false,
}: {
  source: ChatSource;
  compact?: boolean;
  onAction: (id: string, kind: "locate" | "open") => void;
}) {
  return (
    <article className="ask-source">
      <span className="ask-citation">
        {source.key.startsWith("E_") || source.key.startsWith("B_")
          ? "Source evidence"
          : source.key}
      </span>
      <h4>{source.title}</h4>
      {source.startsAt && (
        <p>
          {DateTime.fromISO(source.startsAt)
            .setZone("America/New_York")
            .toFormat(
              source.allDay
                ? "ccc, MMM d · 'All day'"
                : "ccc, MMM d · h:mm a 'ET'",
            )}
        </p>
      )}
      <p>{source.location ?? "Location not provided"}</p>
      {source.description &&
        (compact && source.description.length > 220 ? (
          <>
            <p>{source.description.slice(0, 220).replace(/\s+\S*$/, "")}…</p>
            <details>
              <summary>Full event description</summary>
              <p>{source.description}</p>
            </details>
          </>
        ) : (
          <p>{source.description}</p>
        ))}
      <div className="ask-source-actions">
        {source.url && (
          <a href={source.url} target="_blank" rel="noreferrer">
            Official source ↗
          </a>
        )}
        {!compact && source.mapped && source.placeId && (
          <>
            <button onClick={() => onAction(source.placeId!, "locate")}>
              Locate
            </button>
            <button onClick={() => onAction(source.placeId!, "open")}>
              Building details
            </button>
          </>
        )}
      </div>
    </article>
  );
}
