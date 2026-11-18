import { describe, expect, it } from "vitest";
import { RECLUSE_CHILD, RECLUSE_MUSIC, childSteps } from "@chessroyale/core";
import { BOSS_KITS, RECLUSE_CHILD_KIT, bossKitOf } from "../src/characters/kits.ts";
import { GROWING_HEADS, GROWING_LOOPS, RECLUSE_GROWING, RECLUSE_GROWING_BUST, growAnim, growUpAnim } from "../src/characters/recluse-ages.ts";
import { RECLUSE_CHILD_LINES, RECLUSE_GROWUP_EXCHANGES, RECLUSE_LINES } from "../src/characters/recluse-lines.ts";
import { ageAtStep, growUpExchange, growUpMs, growingRun, resetGrowing } from "../src/components/RecluseChild.ts";
import { recluseMusic } from "../src/music.ts";
import { talkWhen } from "../src/recluse-talk.ts";
import { bossVoice, typeMs } from "../src/speech.tsx";
import type { BossView } from "../src/game.ts";
import { SPEECH } from "@chessroyale/core";
import { BAR_TOP_GAP } from "../src/characters/kits.ts";
import { REST_UP, barFit, restExtent, restOk } from "./bar-fit.ts";
import { renderFrame } from "../src/characters/sprite.ts";

/** The Hidden Boss's child form on screen (Nov 13; RECLUSE_CHILD): his growing figure, his lines, his music. */

const animMs = (name: string) => RECLUSE_GROWING.anims[name]!.frames.reduce((t, f) => t + f.ms, 0);
const view = (step: number, result?: "crowd" | "boss") => ({ id: "recluse", startMove: 1, form: "child" as const, formStep: step, ...(result ? { result } : {}) });

describe("his figure grows with his level (RecluseChild.ts)", () => {
  // Eric, Nov 14: at 20 his words sat over his face, placed for the child. Beside the board they stand on GROWING_HEADS (the kit's
  // `heads`): for every animation, how far over his feet its tallest frame reaches, as drawn.
  it("his words' heights are his drawing's: every animation, its tallest frame over his feet (GROWING_HEADS)", () => {
    const ch = RECLUSE_GROWING;
    const tallest = (a: string) =>
      Math.max(
        ...ch.anims[a]!.frames.map((f) => {
          const r = renderFrame(ch, f);
          for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) if (r.data[(y * r.w + x) * 4 + 3]! > 0) return ch.foot[1] - y;
          return 0;
        }),
      );
    expect(RECLUSE_CHILD_KIT.heads).toBe(GROWING_HEADS);
    expect(GROWING_HEADS).toEqual(Object.fromEntries(Object.keys(ch.anims).map((a) => [a, tallest(a)])));
    // (The man's too (RECLUSE_HEADS, Nov 14): beaten, his fall's lines come as he kneels, so they stand on the kneel, not where he stood.)
    const man = BOSS_KITS["Hidden Boss"]!;
    const manTallest = (a: string) =>
      Math.max(
        ...man.ch.anims[a]!.frames.map((f) => {
          const r = renderFrame(man.ch, f);
          for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) if (r.data[(y * r.w + x) * 4 + 3]! > 0) return man.ch.foot[1] - y;
          return 0;
        }),
      );
    expect(man.heads).toEqual(Object.fromEntries(Object.keys(man.ch.anims).map((a) => [a, manTallest(a)])));
    expect(man.heads![man.loops!.defeat!]!).toBeLessThan(man.heads!.idle! - 25);
    // (Each age taller than the one before, so his words climb as he grows.)
    const ages = GROWING_LOOPS.map((a) => GROWING_HEADS[a]!);
    expect([...ages].sort((a, b) => a - b)).toEqual(ages);
  });
  it("the ages by step: the child for his first steps, then 13, 20, and his adult look exactly at the last step", () => {
    const ages = Array.from({ length: childSteps() + 1 }, (_, i) => ageAtStep(i));
    expect(ages).toEqual([0, 0, 1, 1, 2, 2, 2, 3]);
    expect(ages.indexOf(3)).toBe(childSteps());
  });

  it("each step up plays once as it comes (the step's growing animation, then the new age's idle); a redraw plays nothing again", () => {
    resetGrowing();
    bossVoice.reset();
    expect(growingRun(view(0), 1000)).toBeNull();
    expect(growingRun(view(1), 2000)).toBeNull();
    const up = growingRun(view(2), 3000)!;
    expect(up).toEqual({ since: 3000, before: "idle", anims: [growAnim(1)], loop: "age1", talks: true });
    // (Drawn again, by another screen or placement: nothing new.)
    expect(growingRun(view(2), 3100)).toBeNull();
    expect(growingRun(view(4), 4000)).toEqual({ since: 4000, before: "age1", anims: [growAnim(2)], loop: "age2", talks: true });
    expect(growingRun(view(5), 5000)).toBeNull();
    expect(growingRun(view(6), 5500)).toBeNull();
    expect(growingRun(view(7), 6000)).toEqual({ since: 6000, before: "age2", anims: [growAnim(3)], loop: "age3", talks: true });
  });

  it("beaten: his line first, then he grows up into his adult look at growUpAt, within his fall", () => {
    resetGrowing();
    growingRun(view(3), 1000);
    const run = growingRun(view(3, "crowd"), 2000)!;
    expect(run).toEqual({ since: 2000 + RECLUSE_CHILD.growUpAt, before: "age1", anims: [growUpAnim(1)], loop: "age3", talks: true });
    expect(growingRun(view(3, "crowd"), 2100)).toBeNull();
    // (The slowest: from the child at the start.)
    for (let a = 0; a < 3; a++) expect(RECLUSE_CHILD.growUpAt + animMs(growUpAnim(a)) + 300).toBeLessThanOrEqual(RECLUSE_CHILD.fallMs);
  });

  // Eric, Nov 14: "there was no conversation" as he grew up. Each fight one exchange of the five, the same on every device (the
  // battle's start and its seeded level offset); the kid's line his `defeat`, the man's as he's grown, both read before the man's match.
  it("beaten: one exchange a fight, the same for everyone in it, all five coming up; the kid's line, then the man's, both read in his fall", () => {
    const fight = (levelBase: number, startMove = 1) => growUpExchange({ startMove, levelBase });
    expect(fight(71)).toBe(fight(71));
    expect(new Set(Array.from({ length: 40 }, (_, i) => fight(60 + i)))).toEqual(new Set(RECLUSE_GROWUP_EXCHANGES));
    expect(RECLUSE_GROWUP_EXCHANGES).toHaveLength(5);
    const child = { ...view(3, "crowd"), name: "Hidden Boss", levelBase: 72 } as unknown as BossView;
    expect(RECLUSE_CHILD_KIT.lineOf!("defeat", child)).toBe(growUpExchange(child).kid);
    expect(RECLUSE_CHILD_KIT.lineOf!("capture", child)).toBeUndefined();
    // (The kid's line firm before the man answers; the man's typed and read 2 s or more before the fall ends, the longest too.)
    const grown = RECLUSE_CHILD.growUpAt + growUpMs(0);
    for (const { kid, man } of RECLUSE_GROWUP_EXCHANGES) {
      expect(typeMs(kid) + SPEECH.minReadMs, kid).toBeLessThanOrEqual(grown);
      expect(grown + typeMs(man) + 2000, man).toBeLessThanOrEqual(RECLUSE_CHILD.fallMs);
    }
  });

  it("a battle first seen part way (a new screen, a reload): his age as it is, no step up played", () => {
    resetGrowing();
    expect(growingRun(view(5), 1000)).toEqual({ since: 1000, anims: [], loop: "age2", talks: true });
    resetGrowing();
    expect(growingRun(view(0), 1000)).toBeNull();
  });

  it("only in the child form", () => {
    resetGrowing();
    expect(growingRun({ id: "recluse", startMove: 1, formStep: 4 }, 1000)).toBeNull();
  });
});

describe("his drawings and kit", () => {
  it("the growing figure has every age's loop and each step's one-shot, the last age his adult form's own idle", () => {
    for (const ch of [RECLUSE_GROWING, RECLUSE_GROWING_BUST]) {
      for (const l of GROWING_LOOPS) expect(ch.anims[l]?.loop, `${ch.id} ${l}`).toBe(true);
      for (const a of [1, 2, 3]) expect(ch.anims[growAnim(a)]?.loop, `${ch.id} ${growAnim(a)}`).toBe(false);
      for (const a of [0, 1, 2]) expect(ch.anims[growUpAnim(a)]?.loop, `${ch.id} ${growUpAnim(a)}`).toBe(false);
    }
    // (The same frame and feet as his adult figure: the ages swap in place.)
    const adult = BOSS_KITS["Hidden Boss"]!;
    expect([RECLUSE_GROWING.w, RECLUSE_GROWING.h, ...RECLUSE_GROWING.foot]).toEqual([adult.ch.w, adult.ch.h, ...adult.ch.foot]);
    expect([RECLUSE_GROWING_BUST.w, RECLUSE_GROWING_BUST.h, ...RECLUSE_GROWING_BUST.foot]).toEqual([adult.bar!.w, adult.bar!.h, ...adult.bar!.foot]);
    expect(RECLUSE_GROWING.anims.age3!.frames.length).toBe(adult.ch.anims.idle!.frames.length);
  });

  it("his kit is the child's in the child form only; its bust fits a phone's bar at his adult kit's size", () => {
    expect(bossKitOf({ name: "Hidden Boss", form: "child" })).toBe(RECLUSE_CHILD_KIT);
    expect(bossKitOf({ name: "Hidden Boss" })).toBe(BOSS_KITS["Hidden Boss"]);
    expect(bossKitOf({ name: "Boingo the Clown", form: "child" })).toBe(BOSS_KITS["Boingo the Clown"]);
    const rest = restExtent(RECLUSE_GROWING_BUST);
    expect(restOk(rest, RECLUSE_CHILD_KIT.barScale!, RECLUSE_CHILD_KIT.barShift!, RECLUSE_CHILD_KIT.barName ?? 0)).toBe(true);
    expect(rest.up * RECLUSE_CHILD_KIT.barScale!).toBeLessThanOrEqual(REST_UP - BAR_TOP_GAP);
    expect(barFit(rest).barScale).toBeGreaterThanOrEqual(RECLUSE_CHILD_KIT.barScale!);
  });

  it("the kid's lines: short, his own (none of the man's), never a name", () => {
    const all = [...Object.values(RECLUSE_CHILD_LINES).flat(2)] as string[];
    const man = new Set(Object.values(RECLUSE_LINES).flat(2).filter((x) => typeof x === "string"));
    for (const line of all) {
      expect(line.length, line).toBeLessThanOrEqual(48);
      expect(man.has(line), line).toBe(false);
      expect(line).not.toMatch(/Bobby|Fischer|Hidden Boss/i);
    }
    expect(RECLUSE_CHILD_LINES.grow.length).toBe(3);
    expect(RECLUSE_CHILD_KIT.lines.defeat).toBe(RECLUSE_CHILD_LINES.beaten);
  });
});

describe("his music and chatter in the child form", () => {
  const play = { kind: "play" } as never;
  it("his room's theme from the start, through his fall; the adult form's after it (decoded meanwhile)", () => {
    expect(recluseMusic(play, false, false, true)).toEqual({ theme: RECLUSE_MUSIC.child, next: RECLUSE_MUSIC.adult });
    expect(recluseMusic({ kind: "boss", fall: true } as never, true, false, true)).toEqual({ theme: RECLUSE_MUSIC.child, next: RECLUSE_MUSIC.adult });
    // (The new match: his adult form's.)
    expect(recluseMusic({ kind: "boss", intro: true } as never, false, false, false)).toEqual({ theme: RECLUSE_MUSIC.adult });
    expect(recluseMusic({ kind: "results" } as never, true, false, true)).toBeNull();
  });

  it("the man's muttering never plays over the kid", () => {
    const v = (form?: "child") => ({ boss: { id: "recluse", ...(form ? { form } : {}) }, phase: { kind: "play", startsAt: 0 }, simul: null, standings: () => [] }) as never;
    expect(talkWhen(v("child"), 1000)).toBeNull();
    expect(talkWhen(v(), 1000)).toEqual({ phase: 1 });
  });
});
