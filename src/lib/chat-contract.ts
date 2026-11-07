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
