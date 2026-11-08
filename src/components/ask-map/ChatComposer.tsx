import type { Ref } from "react";
import type { ChatMode } from "./types";
export default function ChatComposer({
  inputRef,
  message,
  onMessageChange,
  mode,
  pending,
  onSend,
}: {
  inputRef: Ref<HTMLInputElement>;
  message: string;
  onMessageChange: (message: string) => void;
  mode: ChatMode;
  pending: boolean;
  onSend: () => void;
}) {
  return (
    <form
      className="ask-compose"
      onSubmit={(e) => {
        e.preventDefault();
        onSend();
      }}
    >
      <label htmlFor="ask-input" className="sr-only">
        Ask about campus events
      </label>
      <input
        id="ask-input"
        ref={inputRef}
        value={message}
        onChange={(e) => onMessageChange(e.target.value)}
        maxLength={1000}
        placeholder={
          mode === "explore"
            ? "Tell Aura your interests and what you’re hoping for…"
            : "Ask Aura about campus events…"
        }
        autoComplete="off"
      />
      <button type="submit" disabled={pending || !message.trim()}>
        Send ↑
      </button>
    </form>
  );
}
