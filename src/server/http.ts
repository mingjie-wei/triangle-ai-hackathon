import { z } from "zod";
import { filters, pageEvents } from "../lib/domain";
import { search, eventById } from "./services/search";
export function failure(code: string, message: string, status: number) {
  return Response.json({ error: { code, message } }, { status });
}
export async function handle(
  request: Request,
  kind: "locations" | "events" | "place" | "event",
  id?: string,
) {
  let f;
  try {
    if (id) z.uuid().parse(id);
    f = filters(new URL(request.url).searchParams);
  } catch {
    return failure(
      "INVALID_REQUEST",
      "Check the ID, dates, filters, and pagination parameters.",
      400,
    );
  }
  try {
    if (kind === "event") {
      const event = await eventById(id!);
      return event
        ? Response.json({ data: event })
        : failure("NOT_FOUND", "Event not found.", 404);
    }
    const result = await search(f);
    if (kind === "locations")
      return Response.json(
        {
          data: {
            items: result.places,
            total: result.events.length,
            next_cursor: null,
          },
          meta: result.meta,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    if (kind === "place" && !result.places.some((p) => p.id === id))
      return failure("NOT_FOUND", "Place not found.", 404);
    return Response.json(
      {
        data: pageEvents(
          kind === "place"
            ? result.events.filter((e) => e.placeId === id)
            : result.events,
          f,
        ),
        meta: result.meta,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return failure(
      "DATA_UNAVAILABLE",
      "The event index is unavailable. Please try again shortly.",
      503,
    );
  }
}
