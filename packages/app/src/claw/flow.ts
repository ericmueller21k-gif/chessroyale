/**
 * Boingo's claw machine's flow (Eric, Nov 6; docs/decisions/2026-11-06-claw-machine.md), pure so a test can drive it. The server
 * decides each play as the coin goes in (server/claw.ts); everything here only shows that answer:
 *
 *   insert → coin (the coin drops; the server is asked) → roam (only once the server has answered and the coin has dropped) → drop
 *   (on STOP, or on its own after CLAW.roamSeconds) → lift → carry (a win: over the chute) → won; or lift → lost (it slips at the top).
 *   A refusal (no token, the shop resting, a guest) goes to `refused` with the server's words: nothing was spent.
 *
 * `won` is reachable only from an answer whose `won` is true: the stop tap changes when the claw drops, never what it brings up.
 */
import type { ClawAnswer } from "../account.ts";

export type ClawStage = "insert" | "coin" | "roam" | "drop" | "lift" | "carry" | "won" | "lost" | "refused" | "opening";

export interface ClawState {
  stage: ClawStage;
  /** The boss whose token went in. */
  boss: string | null;
  /** This play's id (one per coin: a retry of the request is the same play). */
  request: string | null;
  /** The server's answer, once it's here. */
  answer: ClawAnswer | null;
  /** The coin has finished dropping (the claw comes out only after both this and the answer). */
  coinIn: boolean;
  /** Why the server refused (refused). */
  message: string | null;
}

export type ClawEvent =
  | { kind: "pick"; boss: string; request: string }
  | { kind: "coinIn" }
  | { kind: "answer"; answer: ClawAnswer }
  | { kind: "refused"; message: string }
  | { kind: "stop" }
  | { kind: "next" }
  | { kind: "open" }
  | { kind: "again" };

export const CLAW_START: ClawState = { stage: "insert", boss: null, request: null, answer: null, coinIn: false, message: null };

/** The coin's in and the server has answered: the claw comes out. */
const ready = (s: ClawState): ClawState => (s.stage === "coin" && s.coinIn && s.answer ? { ...s, stage: "roam" } : s);

export function clawStep(s: ClawState, e: ClawEvent): ClawState {
  switch (e.kind) {
    case "pick":
      return s.stage === "insert" ? { ...CLAW_START, stage: "coin", boss: e.boss, request: e.request } : s;
    case "coinIn":
      return s.stage === "coin" ? ready({ ...s, coinIn: true }) : s;
    case "answer":
      // (Only for the play the coin started: a stale answer changes nothing.)
      return s.stage === "coin" && !s.answer ? ready({ ...s, answer: e.answer }) : s;
    case "refused":
      return s.stage === "coin" && !s.answer ? { ...s, stage: "refused", message: e.message } : s;
    case "stop":
      return s.stage === "roam" ? { ...s, stage: "drop" } : s;
    case "next":
      if (s.stage === "drop") return { ...s, stage: "lift" };
      if (s.stage === "lift") return { ...s, stage: s.answer?.won === true ? "carry" : "lost" };
      if (s.stage === "carry") return { ...s, stage: s.answer?.won === true ? "won" : "lost" };
      return s;
    case "open":
      return s.stage === "won" && s.answer?.crate ? { ...s, stage: "opening" } : s;
    case "again":
      return s.stage === "lost" || s.stage === "won" || s.stage === "refused" || s.stage === "opening" ? CLAW_START : s;
  }
}

/** A new play's id: random, so two plays never share one (the server keeps them per account). */
export function newRequestId(): string {
  const b = crypto.getRandomValues(new Uint8Array(12));
  return `claw-${[...b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

/** Where the claw is over the glass while it roams (0 = left, 1 = right), `ms` after it came out: a slow wander back and forth. */
export function roamX(ms: number): number {
  const t = ms / 1000;
  return 0.5 + 0.38 * Math.sin(t * 1.3) * Math.cos(t * 0.37);
}
