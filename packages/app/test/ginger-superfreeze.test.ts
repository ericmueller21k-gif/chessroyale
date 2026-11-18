import { describe, expect, it } from "vitest";
import { POWER_BANNERS, SUPER_FREEZE_BEATS as SF, bannerLeadMs, powerFxMs } from "@chessroyale/chess";
import { GINGER_BATTLE, superFreezeCast } from "../src/characters/ginger-super.ts";
import { GINGER_LINES, GINGERBREAD } from "../src/characters/gingerbread.ts";
import { SUPER_ICE, SUPER_ICE_STEPS } from "../src/characters/effects/ginger-superice.ts";
import { BOSS_KITS } from "../src/characters/kits.ts";
import { EFFECTS } from "../src/characters/power-art.ts";
import { animLength, renderFrame } from "../src/characters/sprite.ts";
import { GINGER_UI, MELT_MS, SuperMeter, gingerMoments } from "../src/components/Ginger.tsx";
import type { Moment, MomentProps } from "../src/components/PowerParts.tsx";
import { resetBeats } from "../src/components/boss-figure.ts";
import { noteRejoin } from "../src/characters/moo-state.ts";
import type { BossView } from "../src/game.ts";

/**
 * Ginger's Super Freeze on screen (Nov 18): his cast and the ice block drawn by the art runner, timed to the beats the server and
 * solo wait for (SUPER_FREEZE_BEATS), his own sounds and lines, and its moment on his thinking screen.
 */

const cueAt = (frames: readonly { ms: number; cue?: string }[], cue: string) => {
  let t = 0;
  for (const f of frames) {
    if (f.cue === cue) return t;
    t += f.ms;
  }
  return -1;
};

describe("Ginger's Super Freeze: the art against its beats", () => {
  it("his cast (his intro's charge, one charged cycle, the blast) lasts the beats' castMs, the bolt leaving on the blast cue at boltAt", () => {
    const cast = GINGER_BATTLE.anims.superFreeze!;
    expect(cast).toBe(superFreezeCast);
    expect(animLength(cast)).toBe(SF.castMs);
    expect(cueAt(cast.frames, "charge")).toBeGreaterThanOrEqual(0);
    expect(SF.chargeAt + cueAt(cast.frames, "blast")).toBe(SF.boltAt);
    // (It ends where he stands at rest: his idle's first frame.)
    expect(cast.frames.at(-1)!.layers).toEqual(GINGERBREAD.anims.idle!.frames[0]!.layers);
    // (His drawing for the battle is his own: the same frame, foot and parts, his other animations untouched.)
    expect({ id: GINGER_BATTLE.id, w: GINGER_BATTLE.w, h: GINGER_BATTLE.h, foot: GINGER_BATTLE.foot }).toEqual({ id: GINGERBREAD.id, w: GINGERBREAD.w, h: GINGERBREAD.h, foot: GINGERBREAD.foot });
    for (const [name, anim] of Object.entries(GINGERBREAD.anims)) expect(GINGER_BATTLE.anims[name]).toBe(anim);
  });

  it("the ice block grows over growMs (each square whole within it), holds, and settles over settleMs to nothing", () => {
    expect(animLength(SUPER_ICE.anims.grow!)).toBe(SF.growMs);
    expect(animLength(SUPER_ICE.anims.settle!)).toBe(SF.settleMs);
    expect(SUPER_ICE.anims.hold!.loop).toBe(true);
    expect(SUPER_ICE_STEPS).toHaveLength(9);
    for (const t of SUPER_ICE_STEPS) expect(t).toBeLessThanOrEqual(SF.growMs);
    // (The middle first, then the sides, then the corners.)
    expect(SUPER_ICE_STEPS[4]).toBeLessThan(SUPER_ICE_STEPS[1]!);
    expect(SUPER_ICE_STEPS[1]).toBeLessThan(SUPER_ICE_STEPS[0]!);
    const last = SUPER_ICE.anims.settle!.frames.at(-1)!;
    const img = renderFrame(SUPER_ICE, last);
    expect([...img.data].filter((_, i) => i % 4 === 3).every((a) => a === 0)).toBe(true);
    expect({ w: SUPER_ICE.w, h: SUPER_ICE.h }).toEqual({ w: 96, h: 96 });
    expect(SF.settleAt - SF.iceAt).toBe(SF.growMs + SF.holdMs);
  });

  it("his own sounds (his pack's: the charge, the blast, the burst and the crackle) and his own lines", () => {
    const kit = BOSS_KITS["Ginger"]!;
    expect(kit.ch).toBe(GINGER_BATTLE);
    expect(kit.anims.superFreeze).toBe("superFreeze");
    expect(kit.sounds.charge).toBe("gingerCharge");
    expect(kit.sounds.blast).toBe("gingerBlast");
    expect(EFFECTS.superIce.sounds).toEqual({ burst: "gingerBurst", crackle: "gingerCrackle" });
    expect(GINGER_LINES.superFreeze?.length).toBeGreaterThanOrEqual(3);
  });

  it("its banner is up until he starts charging; its moment on his thinking screen, from when this device first saw it, after the banner's hold", () => {
    expect(POWER_BANNERS.superFreeze).toEqual([[0, SF.chargeAt]]);
    const boss = {
      id: "gingerbread",
      startMove: 0,
      crowdSide: "w",
      crowdMoves: 9,
      board: { fen: "4k3/8/8/8/8/8/PPP5/4K3 b - - 0 1", history: [], ply: 0 },
      powers: { turn: 9, events: [{ kind: "superFreeze", turn: 9, square: "b2", squares: ["a2", "b2", "c2"] }] },
    } as unknown as BossView;
    const [m] = gingerMoments(boss, 10_000);
    expect(m).toMatchObject({ kind: "superFreeze", square: "b2", squares: ["a2", "b2", "c2"], lead: bannerLeadMs("superFreeze") });
    expect(m!.at).toBe(10_000 + bannerLeadMs("superFreeze"));
    expect(m!.ms + m!.lead!).toBe(powerFxMs({ kind: "superFreeze" }));
    // (Drawn again later, it carries on from when it was first seen.)
    expect(gingerMoments(boss, 12_000)[0]!.at).toBe(m!.at);
    // (Another turn's, or another boss's: none.)
    expect(gingerMoments({ ...boss, powers: { ...boss.powers!, turn: 10 } } as BossView)).toEqual([]);
    expect(gingerMoments({ ...boss, id: "moo" } as BossView)).toEqual([]);
    // A new battle (a rematch, the same turn): it plays again, from when it's seen.
    resetBeats();
    expect(gingerMoments(boss, 50_000)[0]!.at).toBe(50_000 + bannerLeadMs("superFreeze"));
    // First seen just as this device rejoined (his thinking under way): skipped, as his move would cut it off.
    resetBeats();
    noteRejoin(90_000);
    expect(gingerMoments(boss, 90_200)).toEqual([]);
    expect(gingerMoments(boss, 95_000)).toEqual([]);
  });
});

// ---------------- The review's fixes (Nov 18) ----------------

const OVER = (layer: ReturnType<typeof GINGER_UI.board>) => (layer?.over ?? []).filter(Boolean) as unknown as { key: string; props: { class: string; children: { props: { since: number; anim: string } } } }[];
const keysOf = (layer: ReturnType<typeof GINGER_UI.board>) => OVER(layer).map((v) => v.key);
const sfView = (powers: object, fen: string) =>
  ({ id: "gingerbread", startMove: 0, crowdSide: "w", crowdMoves: 9, board: { fen, history: [], ply: 0 }, powers: { turn: 9, events: [], iced: [], frozen: null, thaw: [], ...powers } }) as unknown as BossView;
const layerOf = (boss: BossView, moments: Moment[], now: number) =>
  GINGER_UI.board({ boss, p: boss.powers!, board: boss.board.fen, orientation: "white", turn: 0, moments, now, appearAt: (sq) => (moments[0] ? (GINGER_UI.moments.superFreeze.appearAt(moments[0], sq) ?? 0) : 0) });

describe("Ginger's Super Freeze: the review's fixes", () => {
  // The crowd's pawns on a2, b2, c2 and knight on c3, round b2; him to move, his thinking screen with the moment playing.
  const THINK = "4k3/8/8/8/8/2N5/PPP5/4K3 b - - 0 1";
  const moment: Moment = { kind: "superFreeze", key: "gingerbread:superFreeze:9", at: 10_000, ms: SF.total, square: "b2", squares: ["a2", "b2", "c2", "c3"] };
  const sf = { meter: 0, used: 1, max: 2, held: [], target: "b2", at: 9 };

  it("the regular Freeze's ice stays on its piece while the block grows (it was iced before), the others' from the block's settle", () => {
    const iced = ["a2", "b2", "c2", "c3"];
    const growing = moment.at + SF.iceAt + 100;
    const frozen = sfView({ iced, frozen: { square: "c3", until: 10 }, superFreeze: sf }, THINK);
    expect(keysOf(layerOf(frozen, [moment], growing))).toEqual(["superice", "ice-c3"]);
    // (Its own loop carries on: not the block's settle.)
    const c3 = OVER(layerOf(frozen, [moment], growing)).find((v) => v.key === "ice-c3")!;
    expect(c3.props.children.props.since).toBe(0);
    // Without the Freeze on it, the knight's ice comes with the others' as the block settles.
    const free = sfView({ iced, superFreeze: sf }, THINK);
    expect(keysOf(layerOf(free, [moment], growing))).toEqual(["superice"]);
    expect(keysOf(layerOf(free, [moment], moment.at + SF.settleAt + 10))).toEqual(["superice", "ice-a2", "ice-b2", "ice-c2", "ice-c3"]);
  });

  it("the pieces let go melt as the crowd's turn starts (not the held, not one his move took), then are gone", () => {
    resetBeats();
    // His move took c2; b2 is held; a2 and c3 were let go so the crowd keeps a move.
    const crowdTurn = sfView({ turn: 10, iced: ["b2"], superFreeze: { ...sf, held: ["b2"] } }, "4k3/8/8/8/8/2N5/PPq5/4K3 w - - 0 2");
    const layer = OVER(layerOf(crowdTurn, [], 20_000));
    expect(layer.map((v) => v.key)).toEqual(["ice-b2", "ice-a2", "ice-c3"]);
    expect(layer.filter((v) => v.props.class.includes("melting")).map((v) => v.key)).toEqual(["ice-a2", "ice-c3"]);
    expect(layer.find((v) => v.key === "ice-a2")!.props.children.props).toMatchObject({ anim: EFFECTS.iceOverlay.end, since: 20_000 });
    // (Drawn again, it carries on from when it started; once melted, gone.)
    expect(OVER(layerOf(crowdTurn, [], 20_300)).find((v) => v.key === "ice-a2")!.props.children.props.since).toBe(20_000);
    expect(keysOf(layerOf(crowdTurn, [], 20_000 + MELT_MS() + 1))).toEqual(["ice-b2"]);
  });

  it("its banner doesn't count the pieces (some may be let go, or taken)", () => {
    const words: unknown[] = [];
    const banner = (_name: string, line?: string) => (words.push(line), null);
    GINGER_UI.moments.superFreeze.view({ boss: sfView({}, THINK), moment, t: 0, orientation: "white", banner, cast: () => null } as unknown as MomentProps);
    GINGER_UI.moments.superFreeze.view({ boss: sfView({}, THINK), moment: { ...moment, squares: ["b2"] }, t: 0, orientation: "white", banner, cast: () => null } as unknown as MomentProps);
    expect(words).toEqual(["Your pawn and the pieces around it are iced", "Your pawn is iced"]);
  });

  it("the meter: full and glowing when it comes as your move lands; full but greyed, 'waits for the Blizzard', while the Blizzard holds it", () => {
    const meter = (s: object) => SuperMeter({ boss: sfView({ superFreeze: { ...sf, used: 0, meter: 1, ...s } }, THINK) })!.props as Record<string, unknown>;
    expect(meter({})).toMatchObject({ class: "gs-meter full", "aria-label": "Super Freeze ready: it comes as your move lands", "data-pct": 100 });
    expect(meter({ waiting: true })).toMatchObject({ class: "gs-meter dim waiting", "aria-label": "Super Freeze: waits for the Blizzard", "data-pct": 100 });
    expect(meter({ waiting: true, used: 2 })).toMatchObject({ class: "gs-meter dim spent", "aria-label": "Super Freeze: none left this battle" });
  });
});
