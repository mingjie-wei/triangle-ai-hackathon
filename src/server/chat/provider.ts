import { z } from "zod";
export class ChatRateLimit extends Error {}
async function modelLimit(
  env: NodeJS.ProcessEnv,
  fetcher: typeof fetch,
  signal: AbortSignal,
) {
  if (!env.CHAT_RATE_LIMIT_URL || !env.CHAT_RATE_LIMIT_TOKEN)
    return env.NODE_ENV !== "production";
  const limit = Number(env.CHAT_MODEL_REQUESTS_PER_MINUTE || "20");
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) return false;
  const r = await fetcher(env.CHAT_RATE_LIMIT_URL, {
    method: "POST",
    signal,
    headers: {
      Authorization: `Bearer ${env.CHAT_RATE_LIMIT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      "EVAL",
      "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],120) end; return n",
      1,
      `duke:chat:model:${Math.floor(Date.now() / 60000)}`,
    ]),
  });
  if (!r.ok) return false;
  const value = await r.json();
  if (typeof value.result !== "number") return false;
  if (value.result > limit) throw new ChatRateLimit("RATE_LIMITED");
  return true;
}

export class ProviderFailure extends Error {
  constructor(public reason: string) {
    super(reason);
  }
}
export async function providerJson(
  system: string,
  data: unknown,
  fetcher: typeof fetch = fetch,
  env: NodeJS.ProcessEnv = process.env,
  onAttempt: () => void = () => {},
  maxTokens = 500,
) {
  if (
    env.CHAT_MODEL_ENABLED !== "true" ||
    !env.DEEPSEEK_API_KEY ||
    !env.DEEPSEEK_MODEL
  )
    throw new ProviderFailure("MODEL_NOT_CONFIGURED");
  const signal = AbortSignal.timeout(8000);
  try {
    if (!(await modelLimit(env, fetcher, signal)))
      throw new ProviderFailure("MODEL_LIMIT_UNAVAILABLE");
    onAttempt();
    const response = await fetcher(
      "https://api.deepseek.com/chat/completions",
      {
        method: "POST",
        signal,
        headers: {
          Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: env.DEEPSEEK_MODEL,
          max_tokens: maxTokens,
          temperature: 0,
          thinking: { type: "disabled" },
          stream: false,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: JSON.stringify(data) },
          ],
        }),
      },
    );
    if (!response.ok) throw new ProviderFailure("PROVIDER_UNAVAILABLE");
    const body = z
      .object({
        choices: z
          .array(z.object({ message: z.object({ content: z.string() }) }))
          .min(1),
      })
      .parse(await response.json());
    return JSON.parse(body.choices[0].message.content) as unknown;
  } catch (e) {
    if (e instanceof ChatRateLimit || e instanceof ProviderFailure) throw e;
    throw new ProviderFailure("PROVIDER_OR_VALIDATION_FAILURE");
  }
}
