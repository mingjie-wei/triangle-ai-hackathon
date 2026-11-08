import Image from "next/image";
export default function AuraWelcome({
  pending,
  onPrompt,
}: {
  pending: boolean;
  onPrompt: (prompt: string) => void;
}) {
  return (
    <div className="ask-welcome">
      <div className="aura-introduction">
        <Image
          className="aura-portrait"
          src="/mascots/aura-guide.png"
          width={128}
          height={148}
          alt="Aura, your smiling campus guide in a blue Duke cap"
        />
        <div className="aura-greeting">
          <span className="aura-name">AURA · YOUR CAMPUS COMPANION</span>
          <h3>Hi! I’m Aura.</h3>
          <p>
            Let’s explore Duke together! Tell me what you’re curious about —
            I’ll help you find a little something you’ll love.
          </p>
        </div>
      </div>
      <p>A concert, a new place, or weekend plans — where shall we start?</p>
      {[
        "What music events are coming up?",
        "What is happening at Duke Chapel?",
        "What events are happening this weekend?",
      ].map((prompt) => (
        <button
          key={prompt}
          onClick={() => onPrompt(prompt)}
          disabled={pending}
        >
          {prompt} ↗
        </button>
      ))}
      <small>
        Selected buildings and map filters apply only when you opt in.
      </small>
    </div>
  );
}
