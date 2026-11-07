import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SHOP_ALFIL_LAYOUT } from "../src/town/shops/alfil-art.ts";
import { SHOP_BIGBOY_LAYOUT, SHOP_BIGBOY_MARKS } from "../src/town/shops/bigboy-art.ts";
import { SHOP_SMUDGY_LAYOUT, SHOP_SMUDGY_MARKS } from "../src/town/shops/smudgy-art.ts";
import { SHOP_TIMBER_LAYOUT, SHOP_TIMBER_MARKS } from "../src/town/shops/timber-art.ts";
import { CHALLENGE_FEEL, attackStart, introOf, marksFeel, marksOf, seatedMarks, type IntroLayout } from "../src/town/shops/challenge.ts";
import { ALFIL_INTRO } from "../src/town/shops/intros/alfil.ts";
import { BIGBOY_INTRO } from "../src/town/shops/intros/bigboy.ts";
import { SMUDGY_INTRO } from "../src/town/shops/intros/smudgy.ts";
import { TIMBER_INTRO } from "../src/town/shops/intros/timber.ts";
import { castBefore, standAt, timelineAt, timelineBeats, timelineCues, type IntroData } from "../src/town/shops/timeline.ts";
import type { HomeId } from "../src/town/world.ts";
import type { ShopPlace } from "../src/town/shops/room.ts";

/**
 * Intros as data (shops/timeline.ts): each intro moved onto the timeline plays the same as it did on its own state machine. Its beat
 * log (packages/app/test/intro-logs/<boss>.json) was recorded on main (a0b82fc1, before the move) from introBeats / introAt /
 * introCues: every 1 ms its step, its line and chant, the table and its stools, each prop's animation and frame, and every 10 ms where
 * you and the boss stand (column, row, height) and the board's height; its beats, its cues and its attack's start. The timeline's,
 * made the same way, matches it: the same beats, the same events in the same order at the same times (±1 frame, 17 ms, allowed; 0
 * found), the same cues at the same ms.
 */
type Log = { boss: string; length: number; attack: number | null; beats: [string, number, number | null][]; cues: [number, string][]; events: [number, string, string | number | boolean][] };
const logOf = (id: string): Log => JSON.parse(readFileSync(new URL(`./intro-logs/${id}.json`, import.meta.url), "utf8"));
const ROOMS: Record<string, { layout: readonly ShopPlace[]; marks: { boss: readonly [number, number]; you: readonly [number, number] } | null; data: IntroData }> = {
  alfil: { layout: SHOP_ALFIL_LAYOUT, marks: null, data: ALFIL_INTRO },
  bigboy: { layout: SHOP_BIGBOY_LAYOUT, marks: SHOP_BIGBOY_MARKS, data: BIGBOY_INTRO },
  timber: { layout: SHOP_TIMBER_LAYOUT, marks: SHOP_TIMBER_MARKS, data: TIMBER_INTRO },
  smudgy: { layout: SHOP_SMUDGY_LAYOUT, marks: SHOP_SMUDGY_MARKS, data: SMUDGY_INTRO },
};
const r3 = (v: number) => Math.round(v * 1000) / 1000;

/** The timeline's beat log, in the recorded log's words (see its recorder's: the old IntroNow's fields, as drawn). */
function record(id: string): Log {
  const { layout, marks: drawn, data } = ROOMS[id]!;
  const def = introOf(id as HomeId)!;
  const found = marksOf(layout, def.layout as IntroLayout, drawn, marksFeel(null, CHALLENGE_FEEL, def.clear ?? data.clear))!;
  const m = def.seated ? seatedMarks(found) : found;
  const tl = data.timeline;
  const beats = timelineBeats(tl);
  const len = beats[beats.length - 1]!.at;
  const events: Log["events"] = [];
  const last = new Map<string, unknown>();
  const put = (t: number, k: string, v: string | number | boolean) => {
    if (last.get(k) === v) return;
    last.set(k, v);
    events.push([t, k, v]);
  };
  for (let t = 0; t <= len + 500; t++) {
    const now = timelineAt(tl, t);
    const c = now.cast;
    const fr = (k: string) => (c[k]?.on && c[k]!.anim ? `${c[k]!.anim}:${c[k]!.frame}` : "-");
    put(t, "step", now.step);
    put(t, "line", !!c.line?.on);
    put(t, "chant", !!c.chant?.on);
    put(t, "table", !!c.board?.on);
    put(t, "stools", !!c.stools?.on);
    if (id === "alfil") put(t, "pyramid", fr("pyramid"));
    if (id === "bigboy") put(t, "blocks", fr("blocks"));
    if (id === "smudgy") put(t, "cloth", fr("cloth"));
    if (id === "timber") {
      const b = c.boss;
      put(t, "boss", b?.on && b.anim ? `${b.anim}:${b.frame}${b.flip ? "<" : ""}` : "figure");
      put(t, "log", c.log?.on ? fr("log") : fr("worked"));
      put(t, "fog", fr("fog"));
      put(t, "ring", !!c.ring?.on);
      put(t, "stumps", fr("stumps"));
    }
    if (t % 10 === 0) {
      for (const who of ["you", "boss"] as const) {
        const a = c[who];
        const mine = who === "you" ? { mark: m.you, clear: m.youClear } : { mark: m.boss, clear: m.bossClear };
        const at = a ? standAt(a, m, mine) : mine.mark;
        put(t, `${who}.c`, r3(at.c));
        put(t, `${who}.r`, r3(at.r));
        put(t, `${who}.lift`, r3(a?.hop ?? 0));
      }
      if (id === "bigboy") put(t, "table.lift", r3(c.board?.lift ?? 0));
    }
  }
  const at = attackStart(beats);
  return {
    boss: id,
    length: len,
    attack: Number.isFinite(at) ? at : null,
    beats: beats.map((b) => [b.step, b.at, b.end === Infinity ? null : b.end]),
    cues: timelineCues(tl).map((q) => [q.at, q.cue]),
    events,
  };
}

describe("intros as data: each moved intro plays as it did on main (its beat log)", () => {
  for (const id of Object.keys(ROOMS)) {
    it(`${id}: the same beats, cues, lines, props' frames and places, at the same times`, () => {
      const was = logOf(id);
      const now = record(id);
      expect(now.beats).toEqual(was.beats);
      expect(now.length).toBe(was.length);
      expect(now.attack).toBe(was.attack === null ? null : was.attack);
      expect(now.cues).toEqual(was.cues);
      // The events, in order: each the same actor and value, within a frame of its time.
      expect(now.events.map((e) => [e[1], e[2]])).toEqual(was.events.map((e) => [e[1], e[2]]));
      const off = now.events.map((e, i) => Math.abs(e[0] - was.events[i]![0]));
      expect(Math.max(...off)).toBeLessThanOrEqual(17);
      expect(Math.max(...off), "no frame off at all").toBe(0);
    });
  }
  it("who is there from the walk in: Timber's log lying, Smudgy's covered table; nothing of Alfil's or Big Boy's", () => {
    const on = (d: IntroData) => Object.entries(castBefore(d.timeline)).filter(([, a]) => a.on).map(([k, a]) => `${k}:${a.anim ?? ""}`);
    expect(on(TIMBER_INTRO)).toEqual(["log:lying"]);
    expect(on(SMUDGY_INTRO)).toEqual(["table:", "cloth:covered"]);
    expect(on(ALFIL_INTRO)).toEqual([]);
    expect(on(BIGBOY_INTRO)).toEqual([]);
  });
});
