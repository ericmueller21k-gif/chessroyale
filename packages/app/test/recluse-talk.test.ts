import { describe, expect, it } from "vitest";
import { RECLUSE_TALK, SPEECH } from "@chessroyale/core";
import { Chatter, TALK_TICK_MS, talkStage, talkWhen, type TalkPhase } from "../src/recluse-talk.ts";
import { RECLUSE_LINES } from "../src/characters/recluse-lines.ts";
import { CHATTER, CRITICAL, LOW, NORMAL, Voice, holdMs, typeMs } from "../src/speech.tsx";
import type { GameView } from "../src/game.ts";

// The Hidden Boss's chatter (recluse-talk.ts): one line about every 15 s of play in both phases, by the clock, in three
// stages; never over another line of his. Simulated over long fights with real move timing.

/** A seeded random number (0-1). */
const seeded = (seed: number) => () => ((seed = (Math.imul(seed ^ (seed >>> 15), 2246822507) + 0x6d2b79f5) >>> 0) / 2 ** 32);

/** One stretch of the fight: how long, whether he may talk in it, and a line of his said as it starts (a moment's). */
interface Stretch {
  ms: number;
  talk: boolean;
  line?: { text: string; priority: typeof LOW | typeof NORMAL | typeof CRITICAL };
}

/**
 * Plays a fight's stretches as the app's driver does (a look every TALK_TICK_MS, `tick` only when he may talk, busy
 * while any line of his is up), with the other lines said into the same voice. Returns his chatter (when, what) and
 * whether it ever cut a line or was said over one.
 */
function play(phase: TalkPhase, stretches: Stretch[], rng: () => number) {
  const voice = new Voice();
  const chatter = new Chatter(phase, 0, rng);
  const said: { at: number; text: string }[] = [];
  let t = 0;
  let k = 0;
  // (The longest he's quiet: no line of his up at all.)
  let quietFrom = 0;
  let quiet = 0;
  for (const s of stretches) {
    if (s.line) {
      const before = voice.line(t);
      voice.say(s.line.text, `m${k++}`, s.line.priority, t);
      // (His chatter never holds another line back for long: with nothing up the line starts at once; over his chatter,
      // once the chatter has typed out and been readable for SPEECH.minReadMs, the rule for every line, Oct 24.)
      if (!before) expect(voice.line(t)?.text).toBe(s.line.text);
      else if (before.priority === CHATTER) expect(voice.line(t)?.text).toBe(t >= before.firm ? s.line.text : before.text);
    }
    const end = t + s.ms;
    // (The driver's looks run on the clock, across stretches.)
    for (let now = Math.ceil(t / TALK_TICK_MS) * TALK_TICK_MS; now < end; now += TALK_TICK_MS) {
      const up = !!voice.line(now);
      if (up) quietFrom = now;
      quiet = Math.max(quiet, now - quietFrom);
      if (!s.talk) continue;
      const busy = up;
      const line = chatter.tick(now, busy);
      if (line) {
        expect(busy).toBe(false);
        voice.say(line, `talk${now}`, CHATTER, now);
        expect(voice.line(now)?.text).toBe(line);
        said.push({ at: now, text: line });
        quietFrom = now;
      }
    }
    t = end;
  }
  return { said, end: t, quiet };
}

const gaps = (at: number[]) => at.slice(1).map((x, i) => x - at[i]!);
const sec = (ms: number) => Math.round(ms / 100) / 10;

/**
 * Phase 1 against him in Boss alone: six crowd moves at a thinker's pace (5 to 25 s), his turns (2 to 4 s: thinking,
 * his move), the bullet clock as turn 7 begins (his moment, its CRITICAL line), three moves at 1+0 (1 to 3 s), his
 * "time per move" moment as turn 10 begins, then moves at 1+2 (1 to 4 s) up to turn 60.
 */
function phase1(rng: () => number): Stretch[] {
  const out: Stretch[] = [];
  const r = (lo: number, hi: number) => lo + rng() * (hi - lo);
  for (let turn = 1; turn <= 60; turn++) {
    if (turn === 7) out.push({ ms: 2800, talk: false, line: { text: RECLUSE_LINES.bullet[0], priority: CRITICAL } });
    if (turn === 10) out.push({ ms: 2800, talk: false, line: { text: RECLUSE_LINES.bulletPlus[0], priority: NORMAL } });
    out.push({ ms: turn < 7 ? r(5000, 25_000) : turn < 10 ? r(1000, 3000) : r(1000, 4000), talk: true });
    // His turn: he thinks (he may talk), then his move shows, with his reaction now and then (his kit's beats: low).
    out.push({ ms: r(800, 2000), talk: true });
    out.push({ ms: r(1200, 2500), talk: false, line: rng() < 0.1 ? { text: RECLUSE_LINES.rattled[0], priority: LOW } : undefined });
  }
  return out;
}

/** Phase 2 down to one board: a move every 10 to 20 s for ten minutes, a slow-move line now and then, boards ending. */
function phase2(rng: () => number): Stretch[] {
  const out: Stretch[] = [];
  for (let t = 0, i = 0; t < 600_000; i++) {
    const ms = 10_000 + rng() * 10_000;
    const line = i === 3 || i === 9 ? { text: RECLUSE_LINES.boardWon[0], priority: CRITICAL } : rng() < 0.15 ? { text: RECLUSE_LINES.slow[0], priority: LOW } : undefined;
    out.push({ ms, talk: true, line: line as Stretch["line"] });
    t += ms;
  }
  return out;
}

describe("his chatter", () => {
  it("picks the stage by play time so far, per phase", () => {
    for (const p of [1, 2] as const) {
      const { middleFromMs: mid, lateFromMs: late } = RECLUSE_TALK[p];
      expect(talkStage(p, 0)).toBe("early");
      expect(talkStage(p, mid - 1)).toBe("early");
      expect(talkStage(p, mid)).toBe("middle");
      expect(talkStage(p, late - 1)).toBe("middle");
      expect(talkStage(p, late)).toBe("late");
      expect(talkStage(p, 3_600_000)).toBe("late");
    }
  });

  it("phase 1, a whole fight to move 60 (the bullet stretch too): a line about every 15 s, never a long gap, never over another line", () => {
    const { everyMs, jitterMs } = RECLUSE_TALK;
    for (const seed of [1, 2, 3, 4, 5]) {
      const rng = seeded(seed);
      const { said, end, quiet } = play(1, phase1(rng), rng);
      // Never quiet for long: at most an interval, and a moment of his or a bit of his turn it waited out.
      expect(quiet, `seed ${seed}`).toBeLessThanOrEqual(everyMs + jitterMs + 5000);
      const at = said.map((s) => s.at);
      // Steady from the start to the end of the fight: the first within an interval, then never much over one.
      expect(at[0]!, `seed ${seed}`).toBeLessThanOrEqual(everyMs + jitterMs + 5000);
      const g = gaps(at);
      // (The longest are where his bullet line was up when one came due: his own words first.)
      expect(Math.max(...g), `seed ${seed}: ${g.map(sec)}`).toBeLessThanOrEqual(everyMs + jitterMs + 10_000);
      expect(Math.min(...g)).toBeGreaterThanOrEqual(everyMs - jitterMs);
      expect(end - at.at(-1)!).toBeLessThanOrEqual(everyMs + jitterMs + 10_000);
      const mean = (at.at(-1)! - at[0]!) / (at.length - 1);
      expect(mean).toBeGreaterThan(everyMs - 1000);
      expect(mean).toBeLessThan(everyMs + 4000);
      // Every stage's lines in turn: suspicious, accusing, angry; and nothing again until a stage has said them all.
      for (const { at: t, text } of said) expect(RECLUSE_LINES.talk[1][talkStage(1, t)], text).toContain(text);
      for (const stage of ["early", "middle", "late"] as const) {
        const lines = said.filter((s) => talkStage(1, s.at) === stage).map((s) => s.text);
        const pool = RECLUSE_LINES.talk[1][stage].length;
        expect(lines.length, stage).toBeGreaterThan(0);
        for (let i = 0; i < lines.length; i += pool) expect(new Set(lines.slice(i, i + pool)).size, stage).toBe(lines.slice(i, i + pool).length);
      }
    }
  });

  it("phase 2 down to one board, a move every 10 to 20 s: lines keep coming at a steady pace, every third the engine's", () => {
    const { everyMs, jitterMs } = RECLUSE_TALK;
    for (const seed of [11, 12, 13]) {
      const rng = seeded(seed);
      const { said, quiet } = play(2, phase2(rng), rng);
      expect(quiet, `seed ${seed}`).toBeLessThanOrEqual(everyMs + jitterMs + 2000);
      const g = gaps(said.map((s) => s.at));
      // (A slow-move or board line up when one is due holds it a few seconds at most: one line's time.)
      expect(Math.max(...g), `seed ${seed}: ${g.map(sec)}`).toBeLessThanOrEqual(everyMs + jitterMs + 7000);
      expect(said.length).toBeGreaterThanOrEqual(600_000 / (everyMs + jitterMs + 3000));
      said.forEach((s, i) => {
        if (i % 3 === 0) expect(s.text).toBe(RECLUSE_LINES.engine[(i / 3) % RECLUSE_LINES.engine.length]);
        else expect(RECLUSE_LINES.talk[2][talkStage(2, s.at)]).toContain(s.text);
      });
    }
  });

  it("a line due while another is up is tried again a moment later, not a whole interval on", () => {
    const c = new Chatter(1, 0, () => 0.5);
    const due = RECLUSE_TALK.everyMs;
    expect(c.tick(due - 1, false)).toBeNull();
    expect(c.tick(due, true)).toBeNull();
    expect(c.tick(due + RECLUSE_TALK.retryMs - 1, false)).toBeNull();
    expect(c.tick(due + RECLUSE_TALK.retryMs, false)).not.toBeNull();
    // (The next a whole interval after it was said.)
    expect(c.tick(due + RECLUSE_TALK.retryMs + due - 1, false)).toBeNull();
    expect(c.tick(due + RECLUSE_TALK.retryMs + due, false)).not.toBeNull();
  });

  it("is the lowest priority in his voice: any other line cuts in on it (once it has been read: SPEECH.minReadMs), and it never cuts in", () => {
    const voice = new Voice();
    const talk = "Who told you that move?";
    const firm = 1000 + typeMs(talk) + SPEECH.minReadMs;
    voice.say(talk, "talk", CHATTER, 1000);
    voice.say("Still thinking? Move!", "slow", LOW, 1500);
    expect(voice.line(1500)?.text).toBe(talk);
    expect(voice.line(firm)?.text).toBe("Still thinking? Move!");
    voice.say(RECLUSE_LINES.bullet[0], "bullet", CRITICAL, firm + 100);
    expect(voice.line(firm + 100)?.text).toBe("Still thinking? Move!");
    const cut = firm + typeMs("Still thinking? Move!") + SPEECH.minReadMs;
    expect(voice.line(cut)?.text).toBe(RECLUSE_LINES.bullet[0]);
    expect(voice.line(cut + holdMs(RECLUSE_LINES.bullet[0]) - 1)?.text).toBe(RECLUSE_LINES.bullet[0]);
    // A critical line over his chatter: from when the chatter has been read.
    const v = new Voice();
    v.say(talk, "talk", CHATTER, 1000);
    v.say(RECLUSE_LINES.bullet[0], "bullet", CRITICAL, 1200);
    expect(v.line(firm - 1)?.text).toBe(talk);
    expect(v.line(firm)?.text).toBe(RECLUSE_LINES.bullet[0]);
    // His chatter never cuts in: said over a line, it waits.
    v.say("Hm.", "talk2", CHATTER, firm + 10);
    expect(v.line(firm + 20)?.text).toBe(RECLUSE_LINES.bullet[0]);
  });

  it("talks in phase 1 on your move once its clock runs or while he thinks, until he's beaten; in phase 2 while a board is in play; never to a player who's out, nor for another boss", () => {
    const boss = { id: "recluse" } as GameView["boss"];
    const v = (phase: unknown, b = boss, simul: unknown = null, out = false) => ({ boss: b, phase, simul, standings: () => [{ isYou: false, out: true }, { isYou: true, out }] }) as unknown as Pick<GameView, "boss" | "phase" | "simul" | "standings">;
    expect(talkWhen(v({ kind: "play", startsAt: 100 }), 100)).toEqual({ phase: 1 });
    expect(talkWhen(v({ kind: "play", startsAt: 100 }), 99)).toBeNull();
    expect(talkWhen(v({ kind: "boss", until: 0 }), 100)).toBeNull();
    expect(talkWhen(v({ kind: "boss", until: 0, thinking: true }), 100)).toEqual({ phase: 1 });
    expect(talkWhen(v({ kind: "boss", until: 0, intro: true }), 100)).toBeNull();
    expect(talkWhen(v({ kind: "play", startsAt: 0 }, { id: "recluse", result: "crowd" } as GameView["boss"]), 100)).toBeNull();
    expect(talkWhen(v({ kind: "play", startsAt: 0 }, { id: "clown" } as GameView["boss"]), 100)).toBeNull();
    expect(talkWhen(v({ kind: "phaseChange", at: 0 }), 100)).toBeNull();
    expect(talkWhen(v({ kind: "simul", at: 50 }, boss, { playing: true, decided: false }), 100)).toEqual({ phase: 2, startAt: 50 });
    expect(talkWhen(v({ kind: "simul", at: 50 }, boss, { playing: true, decided: true }), 100)).toBeNull();
    expect(talkWhen(v({ kind: "results" }), 100)).toBeNull();
    // (A player knocked out before his final, online: watching, not fighting him.)
    expect(talkWhen(v({ kind: "play", startsAt: 0 }, boss, null, true), 100)).toBeNull();
    expect(talkWhen(v({ kind: "boss", until: 0, thinking: true }, boss, null, true), 100)).toBeNull();
    expect(talkWhen(v({ kind: "spectating", boards: [] }), 100)).toBeNull();
  });

  it("lines: no country or its people; each stage enough for a long fight before any repeats", () => {
    for (const p of [1, 2] as const)
      for (const stage of ["early", "middle", "late"] as const) {
        const lines = RECLUSE_LINES.talk[p][stage];
        expect(new Set(lines).size).toBe(lines.length);
        for (const l of lines) expect(l).not.toMatch(/soviet|russia/i);
      }
    // (Phase 1's stages at a line every 15 s: about 5 lines early, 7 in the middle; the late one runs on.)
    expect(RECLUSE_LINES.talk[1].early.length).toBeGreaterThanOrEqual(Math.floor(RECLUSE_TALK[1].middleFromMs / RECLUSE_TALK.everyMs));
    expect(RECLUSE_LINES.talk[1].middle.length).toBeGreaterThanOrEqual(Math.floor((RECLUSE_TALK[1].lateFromMs - RECLUSE_TALK[1].middleFromMs) / RECLUSE_TALK.everyMs) - 1);
  });
});
