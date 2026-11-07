import type { Place, EventRecord } from "@/lib/domain";
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
  onClose,
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
  onClose: () => void;
  onRetry: () => void;
}) {
  return (
    <aside
      className="details-panel"
      aria-label="Event details"
      aria-busy={loading}
    >
      <div className="panel-heading">
        <span className="eyebrow">
          {event
            ? "A CLOSER LOOK"
            : place
              ? "EXPLORE THIS PLACE"
              : "YOUR NEXT CAMPUS MOMENT"}
        </span>
        {(place || event) && (
          <button
            className="close-button"
            aria-label={event ? "Back to events" : "Show all places"}
            onClick={event ? () => onEvent(null) : onClose}
          >
            ×
          </button>
        )}
        <h2>{event ? event.title : (place?.name ?? "What’s happening")}</h2>
        {!event && (
          <p>
            {place
              ? "Find something worth stopping by for."
              : "A few steps away. A whole new possibility."}
          </p>
        )}
        {place?.officialMapUrl && !event && (
          <a target="_blank" rel="noreferrer" href={place.officialMapUrl}>
            View official campus map ↗
          </a>
        )}
      </div>
      {error ? (
        <div className="empty-state" role="alert">
          <b>Events couldn’t load</b>
          <p>{error}</p>
          <button onClick={onRetry}>Try again</button>
        </div>
      ) : loading ? (
        <div className="skeletons" role="status">
          Loading events…
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
            Check the official listing for registration, access, and the latest
            updates.
          </p>
        </div>
      ) : (
        <>
          <div className="event-list-label">
            <span>{place ? "AT THIS PLACE" : "UPCOMING & ONGOING"}</span>
            <span>
              {events.length}
              {next ? "+" : ""} events
            </span>
          </div>
          <div className="event-list">
            {events.length ? (
              events.map((e) => (
                <EventCard key={e.id} event={e} onSelect={onEvent} />
              ))
            ) : (
              <div className="empty-state">
                <span>☀</span>
                <b>A little quiet here</b>
                <p>No matching events in the current calendar window.</p>
                <p>Try another place or adjust your filters.</p>
              </div>
            )}
            {next && (
              <button className="load-more" onClick={onMore}>
                Show more events ↓
              </button>
            )}
          </div>
        </>
      )}
    </aside>
  );
}
