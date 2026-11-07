import { DateTime } from "luxon";
import { ZONE, type EventRecord, safeUrl } from "@/lib/domain";
export function eventTime(e: EventRecord) {
  const d = DateTime.fromISO(e.startsAt).setZone(ZONE);
  return e.allDay
    ? `${d.toFormat("EEE, MMM d")} · All day`
    : `${d.toFormat("EEE, MMM d")} · ${d.toFormat("h:mm a")}`;
}
export default function EventCard({
  event,
  onSelect,
}: {
  event: EventRecord;
  onSelect: (e: EventRecord) => void;
}) {
  const d = DateTime.fromISO(event.startsAt).setZone(ZONE);
  return (
    <article className="event-card">
      <div className="event-date">
        <span>{d.toFormat("MMM")}</span>
        <b>{d.toFormat("dd")}</b>
      </div>
      <div>
        <span className="event-category">
          {event.categories[0] ?? "Campus event"}
        </span>
        <button className="event-title" onClick={() => onSelect(event)}>
          {event.title}
        </button>
        <p>{eventTime(event)}</p>
        <p className="room">
          ⌖ {event.locationLabel ?? "Location not provided"}
        </p>
        {safeUrl(event.sourceUrl) && (
          <a href={event.sourceUrl!} target="_blank" rel="noreferrer">
            Official event ↗
          </a>
        )}
      </div>
    </article>
  );
}
