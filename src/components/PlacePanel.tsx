import type { Place, EventRecord } from "@/lib/domain";
import { isVisualOnly } from "@/lib/presentation";
import EventCard, { eventTime } from "./EventCard";
export default function PlacePanel({
  place,
  event,
  events,
  loading,
  error,
  next,
  onMore,
  onEvent,
  onRetry,
}: {
  place: Place | null;
  event: EventRecord | null;
  events: EventRecord[];
  loading: boolean;
  error: string | null;
  next: string | null;
  onMore: () => void;
  onEvent: (e: EventRecord | null) => void;
  onRetry: () => void;
}) {
  const pending = !!place && isVisualOnly(place.id);
  return (
    <section className="dialog-events" aria-label="Events" aria-busy={loading}>
      {event && <><button className="text-button" onClick={() => onEvent(null)}>← Back to events</button><h3 className="event-detail-title">{event.title}</h3></>}
      <div className="panel-scroll" aria-live="polite">
        {error ? (
          <div className="empty-state error-state" role="alert">
            <span className="empty-icon">!</span>
            <h3>Couldn’t reach the event index</h3>
            <p>{error}</p>
            <button className="primary-link" onClick={onRetry}>
              Try again ↻
            </button>
          </div>
        ) : pending ? (
          <div className="empty-state mapping-pending">
            <span className="empty-icon">⌁</span>
            <h3>A place to explore</h3>
            <p>
              This landmark is on the visual map. Its event mapping has not been
              configured in the backend yet.
            </p>
            <p className="fine-print">
              This is different from a connected place with no matching events.
            </p>
            <a
              className="primary-link"
              href="https://calendar.duke.edu/"
              target="_blank"
              rel="noreferrer"
            >
              Browse Duke Calendar ↗
            </a>
          </div>
        ) : loading ? (
          <div className="skeletons" role="status">
            <p>Finding your next campus moment…</p>
            <div />
            <div />
            <div />
          </div>
        ) : event ? (
          <div className="event-detail">
            <span className="detail-time">{eventTime(event)} ET</span>
            <p>⌖ {event.locationLabel ?? "Location not provided"}</p>
            <div className="tags">
              {event.categories.map((c) => (
                <span key={c}>{c}</span>
              ))}
            </div>
            <p className="description">
              {event.description ||
                "See the official event page for more information."}
            </p>
            {event.sponsor && (
              <p className="sponsor">Hosted by {event.sponsor}</p>
            )}
            {event.sourceUrl && (
              <a
                className="primary-link"
                href={event.sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                Open official event ↗
              </a>
            )}
            <p className="fine-print">
              Check the official listing for registration, access and current
              updates.
            </p>
          </div>
        ) : (
          <>
            <div className="event-list-label">
              <span>
                {place ? "EVENTS AT THIS PLACE" : "UPCOMING & ONGOING"}
              </span>
              <span>
                {events.length}
                {next ? "+" : ""}
              </span>
            </div>
            <div className="event-list">
              {events.length ? (
                events.map((e) => (
                  <EventCard key={e.id} event={e} onSelect={onEvent} />
                ))
              ) : (
                <div className="empty-state">
                  <span className="empty-icon">❧</span>
                  <h3>A little quiet here</h3>
                  <p>
                    No matching events in this calendar window. Try another
                    interest, date or place.
                  </p>
                  <small>Empty results don’t mean a building is closed.</small>
                </div>
              )}
              {next && (
                <button className="load-more" onClick={onMore}>
                  More campus moments ↓
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
