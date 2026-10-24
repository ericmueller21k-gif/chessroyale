import { describe, expect, it } from "vitest";
import { BOSS_POWERS, BOSS_ROSTER, TIGER_NAME, isPlayable, playableBosses } from "@chessroyale/core";
import { HOOPS_BEATS, KING_ATTACK, KING_ATTACKERS, POWER_FX, TIGER_ANIM, kingAttackHits } from "@chessroyale/chess";
import { TIGER, TIGER_ATTACK, TIGER_HOP_AIR } from "../src/characters/tiger.ts";
import { TIGER_FIGURE, HOP_AIR_MS } from "../src/characters/tiger-figure.ts";
import { TIGER_PUMP, pumpAnim } from "../src/characters/tiger-bar.ts";
import { TIGER_CHANCE, TIGER_LINES } from "../src/characters/tiger-lines.ts";
import { TIGER_SOUNDS, tigerSound, type TigerSound } from "../src/characters/tiger-sounds.ts";
import { MOVE_MEAN_DB, MOVE_PEAK } from "../src/characters/synth.ts";
import { SELECT_LINES, SELECT_SOUND } from "../src/characters/boss-select.ts";
import { bossKit } from "../src/characters/kits.ts";
import { EFFECTS, animLength, cueAt } from "../src/characters/power-art.ts";
import { HOP_TRIP_MS, TIGER_UI, blockCell, tripMove } from "../src/components/Tiger.tsx";
import { POOF_AT, balloonFen, landBeats, noteTiger, pumpShows, resetTiger, ringShows, ringState, type TigerShow } from "../src/tiger-show.ts";
import { REFUSED } from "../src/refused.ts";

/**
 * Babur, the circus tiger, in the game (Oct 24: live, his art wired in): his kit, lines and sounds, the art's timing against the rules',
 * the pump on the battle's clock, the board under a landing, the rings' states and his trip along a phone's bar
 * (docs/decisions/2026-10-24-tiger-wired.md). The art's own tests: tiger.test.ts and tiger-bar.test.ts; his rules': packages/chess.
 */

const len = (a: { frames: readonly { ms: number }[] }) => a.frames.reduce((t, f) => t + f.ms, 0);
const cues = (a: { frames: readonly { ms: number; cue?: string }[] }) => {
  let t = 0;
  const out: [string, number][] = [];
  for (const f of a.frames) {
    if (f.cue) out.push([f.cue, t]);
    t += f.ms;
  }
  return out;
};

describe("Babur: playable", () => {
  it("is on the roster with his kit, met like every other boss", () => {
    const def = BOSS_ROSTER.find((b) => b.id === "tiger")!;
    expect(def).toMatchObject({ name: TIGER_NAME, kit: "Tiger" });
    expect(isPlayable(def)).toBe(true);
    expect(playableBosses().map((b) => b.id)).toContain("tiger");
    expect(bossKit(TIGER_NAME)?.ch.id).toBe("tiger");
    expect(KING_ATTACKERS).toContain("tiger");
  });

  it("says the director's lines as written, with Puddles' chances and his own", () => {
    expect(TIGER_LINES.entrance).toEqual(["Ugh. Another crowd.", "No roaring tonight. Balloons only.", "Step right up. Or don't. I'm on break."]);
    expect(TIGER_LINES.cheer).toEqual(["Ta-da! Fresh from the pump.", "Balloon art. Very serious.", "Another masterpiece."]);
    expect(TIGER_LINES.wince).toEqual(["…I meant to do that.", "Too much air. Again.", "That one was a rough draft."]);
    expect(TIGER_CHANCE).toMatchObject({ place: 0.15, cheer: 0.6, bigCheer: 1, wince: 0.6, ultimate: 1, entrance: 1, move: 0.12 });
    for (const lines of Object.values(TIGER_LINES)) for (const l of lines!) expect(l).not.toMatch(/Babur|Tiger/);
    expect(SELECT_LINES.tiger).toEqual(["No roaring tonight. Balloons only.", "Another masterpiece.", "Don't rush the artist."]);
    expect(SELECT_SOUND.tiger).toBe("tigerHello");
  });

  it("goes with the warning's words, his move in the dock on his cast's turn (he keeps his turn: Oct 24), and the rules' refusal", () => {
    expect(TIGER_UI.ultimate).toEqual({ name: "Hoops", when: "After your move" });
    // (No "spent his turn" line: the dock shows his move, as any turn of his.)
    expect("noMove" in TIGER_UI).toBe(false);
    expect(REFUSED.hoop).toBe("A burning hoop is in the way.");
  });
});

describe("his art against the rules' timing", () => {
  it("matches TIGER_ANIM beat for beat (his moments, the pump, the landing, the rings)", () => {
    const A = TIGER.anims;
    expect([len(A.hop!), len(A.place!), cueAt(A.place!, "touch"), len(A.cheer!), len(A.bigCheer!), len(A.wince!), len(A.hoops!)]).toEqual([TIGER_ANIM.hop, TIGER_ANIM.place, TIGER_ANIM.placeTouchAt, TIGER_ANIM.cheer, TIGER_ANIM.bigCheer, TIGER_ANIM.wince, TIGER_ANIM.hoops]);
    expect(["throw1", "throw2", "throw3"].map((c) => cueAt(A.hoops!, c))).toEqual([...TIGER_ANIM.throwsAt]);
    const P = TIGER_PUMP.anims;
    expect(len(P[pumpAnim("grow", "knight", 3)]!)).toBe(TIGER_ANIM.pumpStage);
    expect(len(P[pumpAnim("release", "rook")]!)).toBe(TIGER_ANIM.pumpRelease);
    // (The pop's last look, bare, is held: its 400 ms are what plays.)
    expect(len(P[pumpAnim("pop", "queen", 4)]!) - P[pumpAnim("pop", "queen", 4)]!.frames.at(-1)!.ms).toBe(TIGER_ANIM.pumpPop);
    const land = EFFECTS.balloonLand.ch.anims.landPawn!;
    expect([animLength(land), cueAt(land, "poof")]).toEqual([TIGER_ANIM.balloonLand, POOF_AT]);
    const ring = EFFECTS.hoopRing.ch.anims;
    expect([animLength(ring.land!), animLength(ring.out!)]).toEqual([TIGER_ANIM.ringLand, TIGER_ANIM.ringOut]);
  });

  it("holds the turn for the cast exactly as long as its art: the last hoop's throw, its flight and its ring's landing (1490 ms)", () => {
    const lastRing = TIGER_ANIM.throwsAt[2] + HOOPS_BEATS.flyMs + animLength(EFFECTS.hoopRing.ch.anims.land!);
    expect(lastRing).toBe(1490);
    expect(POWER_FX.hoops).toBe(Math.max(lastRing, len(TIGER.anims.hoops!)));
    // Nothing of the balloons holds a move.
    for (const k of ["place", "balloonLand", "pop", "balloonCheer", "balloonBigCheer", "wince", "hoopsOut"] as const) expect(POWER_FX[k]).toBe(0);
  });

  it("has a trip hop: his hop with its airborne frame held while the bar moves him", () => {
    const trip = TIGER_FIGURE.anims.hopTrip!;
    expect(trip.frames[TIGER_HOP_AIR]!.ms).toBe(HOP_AIR_MS);
    expect(len(trip)).toBe(HOP_TRIP_MS);
    expect(trip.frames.map((f) => f.cue ?? null)).toEqual(TIGER.anims.hop!.frames.map((f) => f.cue ?? null));
  });

  it("bats a balloon at the king on every shared hit, a pop 90 ms after each", () => {
    const a = TIGER_ATTACK.anims.kingAttack!;
    expect(len(a)).toBe(KING_ATTACK.ms);
    const c = cues(a);
    expect(c.filter(([n]) => n === "bonk").map(([, t]) => t)).toEqual(kingAttackHits());
    expect(c.filter(([n]) => n === "pop").map(([, t]) => t)).toEqual(kingAttackHits().map((t) => t + 90));
  });
});

describe("his sounds", () => {
  const measure = (s: Float32Array) => {
    let peak = 0;
    let sum = 0;
    for (const v of s) {
      expect(Number.isFinite(v)).toBe(true);
      peak = Math.max(peak, Math.abs(v));
      sum += v * v;
    }
    return { peak, db: 10 * Math.log10(sum / s.length) };
  };

  it("each stay under a piece's move, in peak and in loudness (the #271 rule); the pump (every 30 s) the quietest of his balloons'", () => {
    const m = Object.fromEntries(TIGER_SOUNDS.map((n) => [n, measure(tigerSound(n, 44100))])) as Record<TigerSound, { peak: number; db: number }>;
    for (const n of TIGER_SOUNDS) {
      expect(m[n].peak, n).toBeLessThan(MOVE_PEAK / 2);
      expect(m[n].db, n).toBeLessThan(MOVE_MEAN_DB - 2);
    }
    for (const n of ["squeak", "pop", "whoosh", "poof"] as const) expect(m.pump.db, n).toBeLessThan(m[n].db);
  });

  it("wire every cue of his figure, his attack, the pump and his board art to one of his sounds", () => {
    const kit = bossKit(TIGER_NAME)!;
    for (const ch of [TIGER_FIGURE, TIGER_ATTACK]) for (const [anim, a] of Object.entries(ch.anims)) for (const f of a.frames) if (f.cue) expect(kit.sounds[f.cue], `${anim} ${f.cue}`).toMatch(/^tiger[A-Z]/);
    for (const name of ["balloonLand", "hoopRing"] as const) for (const a of Object.values(EFFECTS[name].ch.anims)) for (const f of a.frames) if (f.cue) expect(EFFECTS[name].sounds[f.cue], `${name} ${f.cue}`).toMatch(/^tiger[A-Z]/);
  });

  it("keeps his attack's ten bonks and pops together under a move", () => {
    const rate = 44100;
    const hits = kingAttackHits();
    const mix = new Float32Array(Math.ceil(((hits.at(-1)! - hits[0]! + 1000) / 1000) * rate));
    const add = (w: Float32Array, ms: number) => {
      const at = Math.round((ms / 1000) * rate);
      for (let j = 0; j < w.length && at + j < mix.length; j++) mix[at + j]! += w[j]!;
    };
    for (const t of hits) {
      add(tigerSound("bonk", rate), t - hits[0]!);
      add(tigerSound("pop", rate), t - hits[0]! + 90);
    }
    const span = Math.round(((hits.at(-1)! - hits[0]!) / 1000) * rate);
    const m = measure(mix.subarray(0, span));
    expect(m.peak).toBeLessThan(MOVE_PEAK);
    expect(m.db).toBeLessThan(MOVE_MEAN_DB);
  });
});

/** A battle's view, as the screens read it. */
const boss = (events: { kind: string; turn: number; [k: string]: unknown }[], fen = "8/8/8/8/8/8/8/8 w - - 0 1", startMove = 1) => ({ id: "tiger", startMove, board: { fen, generation: 0 }, powers: { events } });

describe("the pump on the battle's clock", () => {
  const stage = BOSS_POWERS.balloonStageSec * 1000;
  const balloon = { shape: "n" as const, color: 2, at: 0, readyAt: 4 * stage };

  it("shows the stage the clock gives, waits for the next stage's time, and holds still once ready (the bob)", () => {
    resetTiger();
    const rec = noteTiger(boss([]), 0)!;
    expect(pumpShows(rec, balloon, 1000, 10_000, true)).toMatchObject({ anim: "stage1", wake: 10_000 + (stage - 1000) + 30 });
    expect(pumpShows(rec, balloon, 2.5 * stage, 20_000, true)).toMatchObject({ anim: "stage3Knight", look: "blue" });
    const ready = pumpShows(rec, balloon, 4 * stage + 5, 30_000, true);
    expect(ready).toMatchObject({ anim: "readyKnight", wake: null });
    expect(pumpShows(rec, null, 0, 0, true)).toMatchObject({ anim: "bare", wake: null });
  });

  it("plays the step up as a stage comes on screen; one reached while the page was hidden, or long ago, just shows", () => {
    resetTiger();
    const rec = noteTiger(boss([]), 0)!;
    pumpShows(rec, balloon, stage - 10, 1000, true);
    expect(pumpShows(rec, balloon, stage + 20, 1030, true)).toMatchObject({ anim: "grow2Knight", since: 1030, then: "stage2Knight" });
    // (Hidden as stage 3 came: back, it shows stage 3, no burst of steps.)
    expect(pumpShows(rec, balloon, 2 * stage + 20, 60_000, false)).toMatchObject({ anim: "stage3Knight" });
    // (Long ago: a screen drawn late.)
    expect(pumpShows(rec, balloon, 3 * stage + 10_000, 90_000, true)).toMatchObject({ anim: "stage4Knight" });
  });

  it("is bare until his put, then the put, then the balloon's stage; a landing's release, a pop's pop, then bare", () => {
    resetTiger();
    noteTiger(boss([]), 0);
    const rec = noteTiger(boss([{ kind: "place", turn: 1, shape: "n", color: 2 }]), 100)!;
    expect(pumpShows(rec, balloon, 0, 200, true)).toMatchObject({ anim: "bare" });
    rec.place!.putAt = 1000;
    expect(pumpShows(rec, balloon, 0, 500, true)).toMatchObject({ anim: "bare", wake: 1000 });
    expect(pumpShows(rec, balloon, 0, 1050, true)).toMatchObject({ anim: "putKnight", then: "stage1", quiet: true });
    expect(pumpShows(rec, balloon, 100, 1300, true)).toMatchObject({ anim: "stage1" });
    const land = noteTiger(boss([{ kind: "balloonLand", turn: 2, square: "e4", shape: "n", color: 2 }]), 5000, [{ kind: "balloonLand", key: "tiger:balloonLand:2", at: 5500 }])!;
    expect(pumpShows(land, null, 0, 5200, true)).toMatchObject({ anim: "readyKnight", wake: 5500 });
    expect(pumpShows(land, null, 0, 5600, true)).toMatchObject({ anim: "releaseKnight", since: 5500, then: "bare" });
    expect(pumpShows(land, null, 0, 6000, true)).toMatchObject({ anim: "bare" });
    const pop = noteTiger(boss([{ kind: "pop", turn: 3, shape: "q", color: 0 }]), 9000)!;
    expect(pumpShows(pop, null, 0, 9100, true)).toMatchObject({ anim: "pop4Queen", since: 9000 });
  });
});

describe("what's new, and the board under a landing", () => {
  it("plays only events that came after this device's first look (a reload replays nothing)", () => {
    resetTiger();
    const ev = [{ kind: "balloonLand", turn: 2, square: "e4", shape: "p", color: 1 }];
    const rec = noteTiger(boss(ev), 0)!;
    expect(rec.end).toBeNull();
    expect(noteTiger(boss([...ev, { kind: "place", turn: 2, shape: "p", color: 1 }]), 10)!.place).toMatchObject({ shape: "p" });
  });

  it("leaves his landed piece off its square until the poof, in the position right after it only", () => {
    resetTiger();
    const after = "4k3/8/8/8/4p3/8/8/4K3 w - - 0 2";
    noteTiger(boss([], after), 0);
    const rec = noteTiger(boss([{ kind: "balloonLand", turn: 2, square: "e4", shape: "p", color: 1 }], after), 100, [{ kind: "balloonLand", key: "tiger:balloonLand:2", at: 1000 }]) as TigerShow;
    expect(rec.end).toMatchObject({ kind: "land", at: 1000, firm: true, after });
    const poof = landBeats(1000).poofAt;
    expect(poof).toBe(1000 + 230 + 520 + 520);
    expect(balloonFen(after, poof - 1)).toBe("4k3/8/8/8/8/8/8/4K3 w - - 0 2");
    expect(balloonFen(after, poof)).toBe(after);
    expect(balloonFen("4k3/8/8/8/4p3/8/8/3K4 b - - 1 2", poof - 1)).toBe("4k3/8/8/8/4p3/8/8/3K4 b - - 1 2");
  });

  it("takes a landing's start from the boss screen when it comes later than the first sight, until it has begun", () => {
    resetTiger();
    noteTiger(boss([]), 0);
    const ev = [{ kind: "pop", turn: 2, shape: "q", color: 0 }];
    expect(noteTiger(boss(ev), 100)!.end).toMatchObject({ at: 100, firm: false });
    expect(noteTiger(boss(ev), 50, [{ kind: "pop", key: "tiger:pop:2", at: 900 }])!.end).toMatchObject({ at: 900, firm: true });
  });
});

describe("the rings", () => {
  it("burn while the hoops have two of your moves, die down for the last, and go out as hoopsOut comes", () => {
    expect([ringState(2), ringState(1)]).toEqual(["burn", "dying"]);
    resetTiger();
    noteTiger(boss([]), 0);
    const hoops = { blocks: ["c3", "f3", "d6"], left: 2 };
    expect(ringShows(hoops, null, 5000, null).map((r) => [r.corner, r.anim])).toEqual([["c3", "burn"], ["f3", "burn"], ["d6", "burn"]]);
    expect(ringShows({ ...hoops, left: 1 }, null, 5000, null).every((r) => r.anim === "dying")).toBe(true);
    const rec = noteTiger(boss([{ kind: "hoopsOut", turn: 5, blocks: hoops.blocks }]), 8000)!;
    expect(ringShows(null, rec, 8100, null).map((r) => [r.corner, r.anim])).toEqual([["c3", "out"], ["f3", "out"], ["d6", "out"]]);
    expect(ringShows(null, rec, 8000 + TIGER_ANIM.ringOut, null)).toEqual([]);
  });

  it("land one by one in the cast, each as its hoop arrives (a reload draws them burning, never the cast)", () => {
    const hoops = { blocks: ["c3", "f3", "d6"], left: 2 };
    const at = (t: number) => ringShows(hoops, null, 1000 + t, 1000).map((r) => r.anim);
    expect(at(599)).toEqual([]);
    expect(at(600)).toEqual(["land"]);
    expect(at(880)).toEqual(["land", "land"]);
    expect(at(1490)).toEqual(["burn", "burn", "burn"]);
  });

  it("sit on their four squares either way up", () => {
    expect(blockCell("c3", "white")).toEqual({ col: 2, row: 4 });
    expect(blockCell("c3", "black")).toEqual({ col: 4, row: 2 });
  });
});

describe("his trip along a phone's bar", () => {
  it("hops across while airborne, places facing the pump (mirrored when it's to his right), and comes home facing back", () => {
    const m = tripMove(200);
    expect(m(0)).toEqual({ x: 0, y: 0, flip: true });
    expect(m(HOP_TRIP_MS - 10).x).toBe(200);
    expect(m(HOP_TRIP_MS + 400)).toMatchObject({ x: 200, flip: true });
    const home = m(2 * HOP_TRIP_MS + TIGER_ANIM.place + 10);
    expect(home).toMatchObject({ x: 0, flip: false });
    expect(tripMove(-50)(HOP_TRIP_MS + 100).flip).toBe(false);
  });
});
