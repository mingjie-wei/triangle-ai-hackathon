import { chatRequest } from "../../lib/chat-contract";
import { failure } from "../http";
import { recommend } from "./recommend";
import { retrieve } from "./retrieve";
import { answer, ChatRateLimit } from "./answer";
export async function handleChat(
  request: Request,
  retrieveData = retrieve,
  generate = answer,
) {
  let input;
  try {
    if (Number(request.headers.get("content-length")) > 20000)
      return failure("INVALID_REQUEST", "Request is too large.", 413);
    // Streaming bound also covers chunked requests without a Content-Length.
    const reader = request.body?.getReader();
    let bytes = 0;
    const chunks: Uint8Array[] = [];
    if (!reader) throw new Error("EMPTY");
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.length;
      if (bytes > 20000) {
        await reader.cancel();
        return failure("INVALID_REQUEST", "Request is too large.", 413);
      }
      chunks.push(value);
    }
    const body = Buffer.concat(chunks).toString("utf8");
    input = chatRequest.parse(JSON.parse(body));
  } catch {
    return failure(
      "INVALID_REQUEST",
      "Use a question of 1–1000 characters and valid context.",
      400,
    );
  }
  try {
    const result =
      input.mode === "explore"
        ? await recommend(input)
        : await generate(input, await retrieveData(input));
    return Response.json(
      { data: result },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    if (e instanceof ChatRateLimit)
      return failure(
        "RATE_LIMITED",
        "Ask Map is receiving too many requests. Please retry in a minute.",
        429,
      );
    if (e instanceof Error && e.message === "INVALID_CLOCK")
      return failure(
        "INVALID_REQUEST",
        "Refresh the page to update the discovery clock.",
        400,
      );
    return failure(
      "DATA_UNAVAILABLE",
      "The event index is unavailable. Please try again shortly.",
      503,
    );
  }
}
