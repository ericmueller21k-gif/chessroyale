/**
 * The one way the tool calls Claude: the official SDK, Opus 5.5 at effort "high", structured outputs (a JSON schema),
 * and a spend guard that adds up the real usage of every response and refuses a call that could take the total past
 * the cap.
 *
 * The key is read from ANTHROPIC_API_KEY only, and only by the SDK: never printed, logged or written. The base URL is
 * pinned to Anthropic's API, so the key never goes to another host a session may have set in ANTHROPIC_BASE_URL.
 */
import Anthropic from "@anthropic-ai/sdk";

export const MODEL = "claude-opus-5-5";
/** Opus 5.5's prices, dollars per million tokens (cache writes at 1.25x input, cache reads $0.20). */
export const PRICE = { input: 4, output: 20, cacheWrite: 5, cacheRead: 0.2 } as const;
/** Each call's output ceiling (thinking included). It bounds the worst case the guard checks before a call. */
export const MAX_TOKENS = 12000;

export interface Usage {
  calls: number;
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
  usd: number;
}

export class SpendCapReached extends Error {}

const usd = (u: Pick<Usage, "input" | "output" | "cacheWrite" | "cacheRead">): number =>
  (u.input * PRICE.input + u.output * PRICE.output + u.cacheWrite * PRICE.cacheWrite + u.cacheRead * PRICE.cacheRead) / 1e6;

/** A key is there (yes or no only: its value is never read here). */
export const hasKey = (): boolean => !!process.env.ANTHROPIC_API_KEY;

export class Writer {
  readonly usage: Usage = { calls: 0, input: 0, output: 0, cacheWrite: 0, cacheRead: 0, usd: 0 };
  readonly log: { step: string; usd: number; input: number; output: number }[] = [];
  private client: Anthropic | null = null;

  constructor(readonly capUsd: number) {}

  private sdk(): Anthropic {
    if (!hasKey()) throw new Error("ANTHROPIC_API_KEY isn't set in this environment: add it in the environment's settings and start a new session.");
    this.client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, baseURL: "https://api.anthropic.com" });
    return this.client;
  }

  /**
   * One call: `system` and `prompt` in, the JSON matching `schema` out. Before it's sent, the guard checks that this call's
   * worst case (its input, estimated generously at 3 characters a token, and a full MAX_TOKENS of output) still fits
   * under the cap; after, it adds the response's real usage.
   */
  async json<T>(step: string, system: string, prompt: string, schema: Record<string, unknown>): Promise<T> {
    const worst = (((system.length + prompt.length + JSON.stringify(schema).length) / 3) * PRICE.input + MAX_TOKENS * PRICE.output) / 1e6;
    if (this.usage.usd + worst > this.capUsd)
      throw new SpendCapReached(`stopped before "${step}": $${this.usage.usd.toFixed(4)} spent, and this call could cost up to $${worst.toFixed(4)} (cap $${this.capUsd})`);
    const msg = await this.sdk()
      .messages.stream({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        thinking: { type: "adaptive" },
        output_config: { effort: "high", format: { type: "json_schema", schema } },
        system,
        messages: [{ role: "user", content: prompt }],
      })
      .finalMessage();
    const u = msg.usage;
    const add = { input: u.input_tokens, output: u.output_tokens, cacheWrite: u.cache_creation_input_tokens ?? 0, cacheRead: u.cache_read_input_tokens ?? 0 };
    const cost = usd(add);
    this.usage.calls++;
    this.usage.input += add.input;
    this.usage.output += add.output;
    this.usage.cacheWrite += add.cacheWrite;
    this.usage.cacheRead += add.cacheRead;
    this.usage.usd += cost;
    this.log.push({ step, usd: cost, input: add.input, output: add.output });
    console.log(`  ${step}: ${add.input} in, ${add.output} out, $${cost.toFixed(4)} (total $${this.usage.usd.toFixed(4)})`);
    if (msg.stop_reason === "refusal") throw new Error(`"${step}" was declined by the model (stop_reason refusal)`);
    if (msg.stop_reason === "max_tokens") throw new Error(`"${step}" ran out of room (max_tokens ${MAX_TOKENS})`);
    const text = msg.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    return JSON.parse(text) as T;
  }
}
