"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import ChatControls from "./ask-map/ChatControls";
import ChatTranscript from "./ask-map/ChatTranscript";
import ChatComposer from "./ask-map/ChatComposer";
import type { Turn } from "./ask-map/types";
import { RecommendationSession } from "@/lib/recommendation-session";
import type { Place } from "@/lib/domain";
import type {
  ChatRequest,
  ChatResponse,
  Recommendation,
} from "@/lib/chat-contract";
export default function AskMap({
  place,
  asOf,
  demo,
  currentFilters,
  buildingOpen,
  onOpenChange,
  onLocatePlace,
  onOpenPlace,
  onRecommend,
  onWalkPlace,
}: {
  place: Place | null;
  asOf: string;
  demo: boolean;
  currentFilters: NonNullable<ChatRequest["context"]["filters"]>;
  buildingOpen: boolean;
  onOpenChange?: (open: boolean) => void;
  onLocatePlace: (id: string) => void;
  onOpenPlace: (id: string) => void;
  onRecommend: (id: string) => void;
  onWalkPlace: (id: string) => void;
}) {
  const [mode, setMode] = useState<"events" | "explore">("events");
  const [activeRecommendation, setActiveRecommendation] = useState<Extract<
    Recommendation,
    { status: "ok" }
  > | null>(null);
  const recommendationSession = useRef(new RecommendationSession());
  const [open, setOpen] = useState(false),
    [scope, setScope] = useState<"campus" | "selected">("campus"),
    [useFilters, setUseFilters] = useState(false);
  const [message, setMessage] = useState(""),
    [turns, setTurns] = useState<Turn[]>([]),
    [pending, setPending] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null),
    inputRef = useRef<HTMLInputElement>(null),
    launcher = useRef<HTMLButtonElement>(null);
  const controller = useRef<AbortController | null>(null),
    sequence = useRef(0),
    locked = useRef(false),
    scroll = useRef<HTMLDivElement>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);
  useEffect(() => {
    if (!open) return;
    const el = dialog.current,
      trigger = launcher.current;
    el?.showModal();
    inputRef.current?.focus();
    return () => {
      el?.close();
      trigger?.focus({ preventScroll: true });
    };
  }, [open]);
  useEffect(() => {
    const container = scroll.current,
      latest = container?.querySelector<HTMLElement>(".ask-turn:last-of-type");
    if (open && container && latest)
      container.scrollTo({
        top:
          container.scrollTop +
          latest.getBoundingClientRect().top -
          container.getBoundingClientRect().top -
          12,
      });
  }, [turns, open]);
  function close() {
    setOpen(false);
  }
  function action(id: string, kind: "locate" | "open") {
    close();
    requestAnimationFrame(() =>
      kind === "locate" ? onLocatePlace(id) : onOpenPlace(id),
    );
  }
  async function send(saved?: Turn, prompt?: string, requestedMode = mode) {
    if (locked.current) return;
    const question = (
      prompt ?? (saved ? message.trim() || saved.question : message)
    ).trim();
    if (!saved && !question) return;
    const previous = turns.at(-1)?.response;
    const request: ChatRequest = {
      mode: requestedMode,
      priorRecommendationSlug: activeRecommendation?.buildingSlug,
      message: question,
      history: turns
        .filter((t) => t.response)
        .slice(-3)
        .flatMap((t) => [
          { role: "user" as const, content: t.question },
          {
            role: "assistant" as const,
            content: t.response!.reply.slice(0, 2000),
          },
        ]),
      context: {
        scope,
        selectedSlug: place?.slug,
        asOf,
        filters: useFilters ? currentFilters : undefined,
      },
      previousIds: previous?.sources
        .filter((s) => s.kind === "event")
        .map((s) => s.id),
    };
    const id = saved?.id ?? ++sequence.current;
    const generation = recommendationSession.current.begin();
    locked.current = true;
    setPending(true);
    if (saved)
      setTurns((old) =>
        old.map((t) => (t.id === id ? { ...t, error: undefined } : t)),
      );
    else {
      setTurns((old) => [...old, { id, question, request }]);
      setMessage("");
    }
    const abort = new AbortController();
    controller.current = abort;
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: abort.signal,
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(
          body.error?.message ?? "Ask Map couldn’t load. Please retry.",
        );
      if (
        !abort.signal.aborted &&
        recommendationSession.current.isCurrent(generation)
      ) {
        setTurns((old) =>
          old.map((t) =>
            t.id === id
              ? {
                  ...t,
                  question,
                  request,
                  response: body.data,
                  error: undefined,
                }
              : t,
          ),
        );
        const recommendation = recommendationSession.current.accept(
          generation,
          (body.data as ChatResponse).recommendation,
        );
        if (recommendation?.status === "ok") {
          setActiveRecommendation(recommendation);
          onRecommend(recommendation.placeId);
        }
      }
    } catch (e) {
      if (!abort.signal.aborted)
        setTurns((old) =>
          old.map((t) =>
            t.id === id
              ? {
                  ...t,
                  error: e instanceof Error ? e.message : "Please try again.",
                }
              : t,
          ),
        );
    } finally {
      if (!abort.signal.aborted) {
        locked.current = false;
        setPending(false);
      }
    }
  }
  return (
    <>
      <button
        ref={launcher}
        className="ask-launcher"
        hidden={buildingOpen || !asOf}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        <Image
          src="/mascots/aura-guide.png"
          alt=""
          width={48}
          height={48}
          className="aura-launcher-avatar"
        />
        <span>
          Ask Aura <small>Your campus companion</small>
        </span>
      </button>
      <dialog
        ref={dialog}
        className="ask-dialog paper"
        aria-labelledby="ask-title"
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key !== "Tab") return;
          const controls = Array.from(
            e.currentTarget.querySelectorAll<HTMLElement>(
              "button:not(:disabled),a[href],input,select",
            ),
          ).filter((el) => el.getClientRects().length);
          const first = controls[0],
            last = controls.at(-1);
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }}
      >
        <header className="ask-header">
          <div>
            <span className="eyebrow">DUKE VALLEY / YOUR AI CAMPUS GUIDE</span>
            <h2 id="ask-title">
              Meet Aura <span>✦</span>
            </h2>
            <p>A friendly face. A little campus magic.</p>
          </div>
          <button
            className="close-button"
            aria-label="Close Aura"
            onClick={close}
          >
            ×
          </button>
        </header>
        <ChatControls
          mode={mode}
          setMode={setMode}
          scope={scope}
          setScope={setScope}
          useFilters={useFilters}
          setUseFilters={setUseFilters}
          pending={pending}
          hasTurns={turns.length > 0}
          place={place}
          asOf={asOf}
          demo={demo}
          currentFilters={currentFilters}
          onAlex={() => {
            setMode("explore");
            void send(
              undefined,
              "I'm new here. I love AI and entrepreneurship, but I'm shy and don't know anyone. Where should I start?",
              "explore",
            );
          }}
        />
        {place && activeRecommendation && (
          <p className="ask-current-destination">
            Current map destination: <strong>{place.name}</strong>
          </p>
        )}
        <ChatTranscript
          scrollRef={scroll}
          turns={turns}
          pending={pending}
          mode={mode}
          demo={demo}
          onPrompt={(prompt) => {
            setMode("events");
            void send(undefined, prompt, "events");
          }}
          onRetry={(turn) => void send(turn)}
          onAction={action}
          onRecommendationAction={(recommendation, kind) => {
            setActiveRecommendation(recommendation);
            if (kind === "walk") {
              close();
              onWalkPlace(recommendation.placeId);
            } else action(recommendation.placeId, "locate");
          }}
        />
        <ChatComposer
          inputRef={inputRef}
          message={message}
          onMessageChange={setMessage}
          mode={mode}
          pending={pending}
          onSend={() => void send()}
        />
        <small className="ask-privacy">
          Conversation is not saved here. When AI is enabled, requests and
          recent context are sent to DeepSeek. Official listings remain
          authoritative.
        </small>
      </dialog>
    </>
  );
}
