import type { ChatRequest, ChatResponse } from "@/lib/chat-contract";
export type Turn = {
  id: number;
  question: string;
  request: ChatRequest;
  response?: ChatResponse;
  error?: string;
};

export type ChatMode = "events" | "explore";
