import { useEffect } from "preact/hooks";
import { RECLUSE_TALK } from "@chessroyale/core";
import { RECLUSE_LINES } from "./characters/recluse-lines.ts";
import type { GameView } from "./game.ts";
import { CHATTER, bossVoice } from "./speech.tsx";

/**
 * The Hidden Boss's chatter (Eric, Oct 14 and 15): all through his fight he mutters about the team against him, angrier
 * as it goes on. One mechanism for both phases, by the clock (RECLUSE_TALK): a line about every 15 s of play, in three
 * stages by play time so far. Said into his voice at the lowest priority (CHATTER): only when no other line of his is
 * up, and any other line cuts in on it, so his moments' lines (the bullet clock, his ultimate, a board's result) always
 * come first. Driven by `useRecluseTalk` from the app's top, so it runs on whatever screen shows his fight.
 */
export type TalkPhase = 1 | 2;
export type TalkStage = "early" | "middle" | "late";

/** Which stage his chatter has reached, `playedMs` into a phase's play. */
export function talkStage(phase: TalkPhase, playedMs: number): TalkStage {
  const s = RECLUSE_TALK[phase];
  return playedMs >= s.lateFromMs ? "late" : playedMs >= s.middleFromMs ? "middle" : "early";
}

/**
 * One phase's chatter: when the next line is due, and which it is. Each stage's lines in a shuffled order, none again
 * until all have been said (then a fresh order, never starting with the line just said). In phase 2 every third line,
 * from the first, mocks the engine he took from the God King (RECLUSE_LINES.engine, in turn).
 */
export class Chatter {
  private nextAt: number;
  private lines = 0;
  private engine = 0;
  private stage: TalkStage | null = null;
  private order: string[] = [];
  private last: string | null = null;

  constructor(
    readonly phase: TalkPhase,
    /** When this phase's play began (ms). */
    readonly startAt: number,
    private readonly rng: () => number = Math.random,
  ) {
    this.nextAt = startAt + this.gap();
  }

  private gap() {
    const { everyMs, jitterMs } = RECLUSE_TALK;
    return everyMs - jitterMs + this.rng() * 2 * jitterMs;
  }

  /**
   * At `now`, when he may talk (see `talkWhen`): the line he says, or null (not due yet, or `busy`: another line of his
   * is up, so it's tried again `retryMs` later rather than a whole interval on).
   */
  tick(now: number, busy: boolean): string | null {
    if (now < this.nextAt) return null;
    if (busy) {
      this.nextAt = now + RECLUSE_TALK.retryMs;
      return null;
    }
    this.nextAt = now + this.gap();
    if (this.phase === 2 && this.lines++ % 3 === 0) return RECLUSE_LINES.engine[this.engine++ % RECLUSE_LINES.engine.length]!;
    const stage = talkStage(this.phase, now - this.startAt);
    if (stage !== this.stage || !this.order.length) {
      this.stage = stage;
      this.order = this.shuffled(RECLUSE_LINES.talk[this.phase][stage]);
    }
    return (this.last = this.order.shift()!);
  }

  private shuffled(lines: readonly string[]): string[] {
    const out = [...lines];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [out[i], out[j]] = [out[j]!, out[i]!];
    }
    // (Never the line just said twice in a row, across a fresh order.)
    if (out.length > 1 && out[0] === this.last) out.push(out.shift()!);
    return out;
  }
}

/**
 * Whether he may talk now, and in which phase (null: not his fight, or not now). Only to those fighting him: never to a
 * player out of the match (online, the Crowd final's spectators). Phase 1: on your move, once its clock runs, and while
 * he thinks over his own (so never over his intro, his moments or his fall), until he's beaten. Phase 2: while any board is in play;
 * `startAt` is when its clocks started.
 */
export function talkWhen(view: Pick<GameView, "boss" | "phase" | "simul" | "standings">, now: number): { phase: TalkPhase; startAt?: number } | null {
  if (view.boss?.id !== "recluse") return null;
  // (Only for those fighting him: a player knocked out before his final watches it without his muttering.)
  if (view.standings().some((s) => s.isYou && s.out)) return null;
  const p = view.phase;
  if (p.kind === "simul") return view.simul?.playing && !view.simul.decided ? { phase: 2, startAt: p.at } : null;
  if (view.boss.result) return null;
  if (p.kind === "play" && now >= p.startsAt) return { phase: 1 };
  // (Or while he thinks over his move: his moments come after it.)
  if (p.kind === "boss" && p.thinking && !p.intro && !p.lights && !p.fall) return { phase: 1 };
  return null;
}

/** How often the driver looks (ms): often enough to catch a quick bullet move, and next to nothing to do each time. */
export const TALK_TICK_MS = 500;

/**
 * Runs his chatter while `match` is his fight (solo or online: it reads only the match's view). Phase 1's play time
 * starts when he may first talk; phase 2's when its clocks start.
 */
export function useRecluseTalk(match: GameView | null) {
  const his = match?.boss?.id === "recluse";
  useEffect(() => {
    if (!match || !his) return;
    let talk: Chatter | null = null;
    const id = setInterval(() => {
      const now = Date.now();
      const when = talkWhen(match, now);
      if (!when) return;
      if (talk?.phase !== when.phase) talk = new Chatter(when.phase, when.startAt ?? now);
      const line = talk.tick(now, !!bossVoice.line(now));
      if (line) bossVoice.say(line, `recluse:talk${when.phase}:${now}`, CHATTER, now);
    }, TALK_TICK_MS);
    return () => clearInterval(id);
  }, [match, his]);
}
