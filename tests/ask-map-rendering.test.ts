import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ChatTranscript from "../src/components/ask-map/ChatTranscript";
import { chatRequest, type ChatResponse } from "../src/lib/chat-contract";
import type { Turn } from "../src/components/ask-map/types";
import { retrieve } from "../src/server/chat/retrieve";

process.env.DATA_MODE = "fixture";
const noop = () => {};
function render(
  turns: Turn[],
  pending = false,
  mode: "events" | "explore" = "events",
) {
  return renderToStaticMarkup(
    createElement(ChatTranscript, {
      scrollRef: null,
      turns,
      pending,
      mode,
      demo: true,
      onPrompt: noop,
      onRetry: noop,
      onAction: noop,
      onRecommendationAction: noop,
    }),
  );
}

test("extracted transcript keeps each recommendation and its evidence inside its chronological turn", async () => {
  const request = chatRequest.parse({ message: "AI" });
  const response: ChatResponse = await retrieve(request);
  const recommended: ChatResponse = {
    ...response,
    reply: "Do not duplicate this plain-text recommendation",
    sources: response.sources.slice(0, 1),
    recommendation: {
      status: "ok",
      requestId: "test",
      recommendationId: "test",
      kind: "campus_place",
      buildingSlug: "wilkinson-building",
      placeId: "test-place",
      placeName: "Test destination",
      eventId: null,
      reason: "First recommendation rationale",
      evidenceKeys: [],
      quest1: { title: "Explore", description: "Walk virtually" },
      quest2: { conversationStarter: "Hello there" },
      limitations: ["Test limitation"],
    },
  };
  assert.ok(recommended.sources.length, "fixture must supply evidence");
  const html = render([
    { id: 1, question: "First question", request, response: recommended },
    {
      id: 2,
      question: "Second question",
      request,
      response: { ...response, reply: "Ordinary event reply" },
    },
  ]);
  const turns = html.split('<section class="ask-turn"');
  assert.equal(turns.length, 3);
  assert.match(turns[1], /First recommendation rationale/);
  assert.equal((turns[1].match(/class="ask-source"/g) ?? []).length, 1);
  assert.doesNotMatch(turns[1], /Do not duplicate|ask-count/);
  assert.match(turns[1], /Show on Map/);
  assert.match(turns[1], /Walk there virtually/);
  assert.match(turns[1], /Hello there/);
  assert.match(turns[1], /Test limitation/);
  assert.match(turns[2], /Ordinary event reply/);
  assert.equal(
    (turns[2].match(/class="ask-source"/g) ?? []).length,
    response.sources.length,
  );
  assert.doesNotMatch(turns[2], /ask-recommendation/);
});

test("extracted transcript preserves unavailable replies and retry/pending accessibility", async () => {
  const request = chatRequest.parse({ message: "AI" });
  const response: ChatResponse = {
    ...(await retrieve(request)),
    reply: "Provider is unavailable",
    recommendation: {
      status: "unavailable",
      requestId: "test",
      message: "Provider is unavailable",
    },
  };
  const html = render(
    [
      { id: 1, question: "Question", request, response },
      {
        id: 2,
        question: "Retry me",
        request,
        error: "The event index is unavailable.",
      },
    ],
    true,
    "explore",
  );
  assert.match(html, /Provider is unavailable/);
  assert.doesNotMatch(html, /ask-recommendation/);
  assert.match(html, /role="alert"/);
  assert.match(html, /<button disabled="">Retry question/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /Aura is finding a grounded starting point/);
  assert.match(render([], true), /Aura is checking the event index/);
});
