import { DateTime } from "luxon";
import {
  filters,
  eligible,
  safeUrl,
  ZONE,
  type EventRecord,
} from "../../lib/domain";
import {
  landmarks,
  mergeLandmarks,
  isMappingPending,
} from "../../lib/presentation";
import type {
  ChatRequest,
  ChatResponse,
  ChatSource,
} from "../../lib/chat-contract";
import { search, FIXTURE_AS_OF } from "../services/search";

const stop = new Set(
  "what whats which of those them these are is the a an any events event happening happen coming upcoming up at in on near around duke campus here this today tomorrow weekend show me find please can you for and or about there have do available with coming happening find like to see tell upcoming soon".split(
    " ",
  ),
);
const synonyms: Record<string, string[]> = {
  music: ["music", "concert", "recital", "choral", "carillon", "jazz"],
  art: ["arts", "art", "exhibit", "exhibition", "gallery"],
  arts: ["art", "music", "theater", "exhibit"],
  ai: ["artificial intelligence", "machine learning", " ai "],
  talks: ["lecture", "seminar", "talk", "colloquium"],
  talk: ["lecture", "seminar", "talk"],
  workshops: ["workshop"],
  food: ["free food and beverages"],
};
export function requestedWindow(message: string, asOf: string) {
  const now = DateTime.fromISO(asOf).setZone(ZONE),
    day = now.startOf("day");
  const iso = message.match(/\b\d{4}-\d{2}-\d{2}\b/g);
  const kinds = [
    /\btoday\b/i.test(message),
    /\btomorrow\b/i.test(message),
    /\b(?:this )?weekend\b/i.test(message),
    !!iso,
  ];
  if (kinds.filter(Boolean).length > 1 || (iso && iso.length > 1))
    return {
      clarification: "Please ask for one day or one weekend at a time.",
    };
  let start = now,
    end = now.plus({ days: 30 }),
    label = "Upcoming 30 days";
  if (kinds[0]) {
    start = day;
    end = day.plus({ days: 1 });
    label = "Today";
  }
  if (kinds[1]) {
    start = day.plus({ days: 1 });
    end = start.plus({ days: 1 });
    label = "Tomorrow";
  }
  if (kinds[2]) {
    start = day.plus({ days: now.weekday === 7 ? -1 : 6 - now.weekday });
    end = start.plus({ days: 2 });
    label = "This weekend (Saturday–Monday)";
  }
  if (iso) {
    start = DateTime.fromISO(iso[0], { zone: ZONE });
    end = start.plus({ days: 1 });
    label = iso[0];
  }
  if (!start.isValid)
    return { clarification: "That date is not valid. Please use YYYY-MM-DD." };
  return { start: start.toUTC().toISO()!, end: end.toUTC().toISO()!, label };
}
export async function retrieve(
  input: ChatRequest,
  searchData = search,
  now = new Date(),
): Promise<ChatResponse> {
  const clock =
    process.env.DATA_MODE === "fixture"
      ? FIXTURE_AS_OF
      : (input.context.asOf ?? now.toISOString());
  if (
    process.env.DATA_MODE !== "fixture" &&
    Math.abs(Date.parse(clock) - now.getTime()) > 24 * 3600000
  )
    throw new Error("INVALID_CLOCK");
  const base = filters(new URLSearchParams({ as_of: clock }));
  const data = await searchData(base); // Failure is never interpreted as an empty result.
  const display = mergeLandmarks(data.places);
  const text = input.message.toLowerCase();
  const notes: string[] = [];
  const inherited = input.context.filters;
  const result: ChatResponse = {
    reply: "",
    sources: [],
    resolvedScope: {
      label: "Campus-wide",
      placeSlug: null,
      start: base.start,
      end: base.end,
      totalMatches: 0,
      filters: inherited
        ? [
            inherited.q,
            inherited.category !== "all" ? inherited.category : "",
            inherited.day,
            inherited.food ? "Free food" : "",
          ]
            .filter(Boolean)
            .join(" · ") || "All current filters"
        : "Question only",
      notes,
    },
    meta: { ...data.meta, answerMode: "retrieval" },
  };
  const clarify = (message: string) => {
    result.reply = message;
    result.meta.clarification = message;
    return result;
  };
  const aliases: Record<string, string[]> = {
    "duke-chapel": ["chapel"],
    "innovation-co-lab": ["co-lab", "colab", "tec"],
    "wilkinson-building": ["wilkinson"],
  };
  const explicit = display.filter((p) =>
    [
      p.name.toLowerCase(),
      p.slug.replaceAll("-", " "),
      ...(aliases[p.slug] ?? []),
      p.name.toLowerCase().split(" ")[0],
    ].some(
      (name) =>
        name.length > 2 &&
        !["duke", "the"].includes(name) &&
        new RegExp(
          `\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
          "i",
        ).test(text),
    ),
  );
  if (explicit.length > 1)
    return clarify("Please choose one building, or ask campus-wide.");
  const place =
    explicit[0] ??
    (input.context.scope === "selected"
      ? display.find((p) => p.slug === input.context.selectedSlug)
      : undefined);
  if (
    !place &&
    (input.context.scope === "selected" ||
      /\b(?:events? (?:are )?here|happening here)\b/.test(text))
  )
    return clarify(
      "Select a building and choose Selected building, or name it in your question.",
    );
  if (!place && /\b(?:at|near)\s+(?!duke\b|campus\b)/.test(text))
    return clarify(
      "I couldn’t identify that building. Try a building from Explore campus.",
    );
  if (place) {
    result.resolvedScope.label = place.name;
    result.resolvedScope.placeSlug = place.slug;
  }
  if (/\bnear\b/.test(text))
    notes.push(
      "Building-related results only; no distance or walking-radius search.",
    );
  if (
    /\b(this week|january|february|march|april|may|june|july|august|september|october|november|december)\b|\d\s*(am|pm)\b/.test(
      text,
    ) ||
    /\b(next|last)\s+(week|month|year|weekend)|\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tonight|morning|afternoon|evening|before|after|between|within|miles?|minutes?|beginner|beginners|accessible|wheelchair|cheap|price|cost|free admission)\b/.test(
      text,
    )
  )
    return clarify(
      "I can filter by today, tomorrow, this weekend, or a YYYY-MM-DD date. I can’t reliably apply that time, distance, price, audience, or access requirement. Please simplify the question or check official listings.",
    );
  const window = requestedWindow(text, clock);
  if (window.clarification) return clarify(window.clarification);
  let start = window.start!,
    end = window.end!;
  if (inherited?.day) {
    const day = requestedWindow(inherited.day, clock);
    if (day.clarification) return clarify(day.clarification);
    start = new Date(
      Math.max(Date.parse(start), Date.parse(day.start!)),
    ).toISOString();
    end = new Date(
      Math.min(Date.parse(end), Date.parse(day.end!)),
    ).toISOString();
    if (start >= end)
      return clarify(
        "Your question and current date filter do not overlap. Turn off Use current filters or change the date.",
      );
  }
  if (start < base.start || end > base.end)
    notes.push(
      "Requested time is clipped to the available 30-day discovery window.",
    );
  start = new Date(
    Math.max(Date.parse(start), Date.parse(base.start)),
  ).toISOString();
  end = new Date(Math.min(Date.parse(end), Date.parse(base.end))).toISOString();
  result.resolvedScope.start = start;
  result.resolvedScope.end = end;
  result.resolvedScope.label += ` · ${window.label} · Eastern time`;
  if (start >= end) {
    result.resolvedScope.start = base.start;
    result.resolvedScope.end = base.end;
    return clarify(
      "That date is outside the available 30-day discovery window. Try a date within the displayed coverage.",
    );
  }
  const placeSource = (): ChatSource => ({
    key: "P1",
    kind: "place",
    id: place!.id,
    title: place!.name,
    url: safeUrl(place!.officialMapUrl),
    location: place!.name,
    startsAt: null,
    endsAt: null,
    allDay: false,
    placeId: place!.id,
    placeSlug: place!.slug,
    mapped: landmarks.some((l) => l.slug === place!.slug),
  });
  if (place && isMappingPending(place)) {
    result.sources = [placeSource()];
    return clarify(
      "This building is on the map, but its event mapping is pending. This does not mean it has no events. You can open its building guide. [P1]",
    );
  }
  if (
    (/\b(history|hours|opening|address|building)\b/.test(text) ||
      (!!place && /\babout\b/.test(text))) &&
    !/\bevents?\b/.test(text)
  ) {
    if (!place) return clarify("Which building would you like to explore?");
    result.sources = [placeSource()];
    result.reply = `${place.name} is listed as ${place.kind}. Open its building guide or official campus map for details. [P1] I don’t have verified opening hours or access rules.`;
    return result;
  }
  const followup = /\b(those|them|these)\b/.test(text);
  if (followup && !input.previousIds?.length)
    return clarify(
      "Which events do you mean? Ask a new question or refer to the previous displayed results.",
    );
  if (followup)
    notes.push(
      "Refining only the previously displayed event cards, rechecked against current eligible records.",
    );
  let terms = text.replace(/\d{4}-\d{2}-\d{2}/g, "");
  if (place)
    for (const word of [
      place.name,
      place.slug.replaceAll("-", " "),
      ...(aliases[place.slug] ?? []),
      ...place.name.split(" "),
    ])
      terms = terms.replaceAll(word.toLowerCase(), " ");
  const tokens =
    terms.match(/[a-z]+/g)?.filter((t) => !stop.has(t) && t.length > 1) ?? [];
  const food = /\bfood\b/.test(text);
  const groups = tokens
    .filter((t) => !(food && ["free", "food"].includes(t)))
    .map((t) => synonyms[t] ?? [t]);
  const effective = filters(
    new URLSearchParams({
      as_of: clock,
      start,
      end,
      category: inherited?.category ?? "all",
      q: inherited?.q ?? "",
      food: String(food || inherited?.food || false),
    }),
  );
  const matches = data.events
    .filter(
      (e) =>
        eligible(e, effective) &&
        (!place || e.placeId === place.id) &&
        (!followup || input.previousIds!.includes(e.id)),
    )
    .map((e) => ({
      e,
      score: groups.reduce(
        (score, group) =>
          score +
          Number(
            group.some((t) =>
              new RegExp(`\\b${t.trim()}\\b`, "i").test(
                `${e.title} ${e.description} ${e.categories.join(" ")}`,
              ),
            ),
          ),
        0,
      ),
    }))
    .filter(({ score }) => !groups.length || score === groups.length)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.e.startsAt.localeCompare(b.e.startsAt) ||
        a.e.id.localeCompare(b.e.id),
    );
  result.resolvedScope.totalMatches = matches.length;
  result.sources = matches
    .slice(0, 8)
    .map(({ e }, i) => eventSource(e, i, data.places));
  result.reply = matches.length
    ? `Found ${matches.length} matching event${matches.length === 1 ? "" : "s"}; showing ${result.sources.length}. ${result.sources
        .slice(0, 3)
        .map((s) => `${s.title} [${s.key}]`)
        .join(
          "; ",
        )}. Check official listings for registration and current details.`
    : "No matching events in this scope. Try another date or topic, switch to Campus-wide, or turn off Use current filters.";
  return result;
}
function eventSource(
  e: EventRecord,
  i: number,
  places: Awaited<ReturnType<typeof search>>["places"],
): ChatSource {
  const p = places.find((p) => p.id === e.placeId);
  return {
    key: `E${i + 1}`,
    kind: "event",
    id: e.id,
    title: e.title,
    url: safeUrl(e.sourceUrl),
    location: e.locationLabel,
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    allDay: e.allDay,
    placeId: p?.id ?? null,
    placeSlug: p?.slug ?? null,
    mapped: !!p && landmarks.some((l) => l.slug === p.slug),
  };
}
