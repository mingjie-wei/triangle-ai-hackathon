import { z } from "zod";
import type { Meta } from "./domain";
export const chatFilters = z
  .object({
    q: z.string().max(200).default(""),
    category: z
      .enum([
        "all",
        "arts",
        "talks",
        "learning",
        "info",
        "wellbeing",
        "community",
      ])
      .default("all"),
    day: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    food: z.boolean().default(false),
  })
  .strict();
export const chatRequest = z
  .object({
    mode: z.enum(["events", "explore"]).default("events"),
    priorRecommendationSlug: z.string().max(100).optional(),
    message: z.string().trim().min(1).max(1000),
    history: z
      .array(
        z
          .object({
            role: z.enum(["user", "assistant"]),
            content: z.string().max(2000),
          })
          .strict(),
      )
      .max(6)
      .default([]),
    context: z
      .object({
        scope: z.enum(["campus", "selected"]).default("campus"),
        selectedSlug: z.string().max(100).optional(),
        asOf: z.iso.datetime({ offset: true }).optional(),
        filters: chatFilters.optional(),
      })
      .strict()
      .default({ scope: "campus" }),
    previousIds: z.array(z.uuid()).max(8).optional(),
  })
  .strict();
export type ChatRequest = z.infer<typeof chatRequest>;
export type ChatSource = {
  key: string;
  kind: "event" | "place";
  id: string;
  title: string;
  description?: string;
  url: string | null;
  location: string | null;
  startsAt: string | null;
  endsAt: string | null;
  allDay: boolean;
  placeId: string | null;
  placeSlug: string | null;
  mapped: boolean;
};
export type ChatResponse = {
  recommendation?: Recommendation;
  diagnostics?: {
    requestId: string;
    mode: "explore";
    places: number;
    events: number;
    totalCandidateEvents: number;
    modelAttempted: boolean;
    validation: string;
    elapsedMs: number;
  };
  reply: string;
  sources: ChatSource[];
  resolvedScope: {
    label: string;
    placeSlug: string | null;
    start: string;
    end: string;
    totalMatches: number;
    filters: string;
    notes: string[];
  };
  meta: Meta & {
    answerMode: "model" | "retrieval";
    clarification?: string;
    fallbackReason?: string;
  };
};

export type Recommendation =
  | {
      status: "ok";
      requestId: string;
      recommendationId: string;
      kind: "verified_event" | "campus_place";
      buildingSlug: string;
      placeId: string;
      placeName: string;
      eventId: string | null;
      reason: string;
      evidenceKeys: string[];
      quest1: { title: string; description: string };
      quest2: { conversationStarter: string };
      limitations: string[];
    }
  | {
      status: "clarification" | "no_match" | "unavailable";
      requestId: string;
      message: string;
    };
