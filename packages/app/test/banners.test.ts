import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BOSS_BANNER, DEFAULT_SETTINGS, SQUADS, type PowerEventKind } from "@chessroyale/core";
import { BLOCK, BOARD_SAW, BOSS_INTRO, BOUNCE, KING_COMMAND, KING_SUMMON, LAST_STAND, LIGHTS_OUT, POWER_FX, PULL, RECLUSE_FX, SAW_CUT, SHOWDOWN, SPLIT, START_FEN, bossShowMs, bossThinkMs } from "@chessroyale/chess";
import { WARN } from "../src/components/BossPowers.tsx";
import { BIGBOY_UI } from "../src/components/BigBoy.tsx";
import { BOINGO_UI, FUNHOUSE, PIE, SPIN, funhouseFlipAt } from "../src/components/Boingo.tsx";
import { BLIZZARD, FREEZE, GINGER_UI, THAW } from "../src/components/Ginger.tsx";
import { CANDLE, GREX_UI, SPARK } from "../src/components/Grex.tsx";
import { DARK, HOLLOW_UI } from "../src/components/Hollow.tsx";
import { PIG_UI } from "../src/components/Pig.tsx";
import { BULLET, RECLUSE_UI } from "../src/components/Recluse.tsx";
import { SAWYER_UI } from "../src/components/Sawyer.tsx";
import { LIGHTS_BANNER_MS } from "../src/components/LightsOut.tsx";
import { bannerLength } from "../src/components/FightBanner.tsx";
import type { MomentProps, MomentUi } from "../src/components/PowerParts.tsx";
import { PHASE2_ULT_BANNER_MS, PHASE_CHANGE } from "../src/recluse-phase2.ts";
import { bossKit } from "../src/characters/kits.ts";
import type { BossView } from "../src/game.ts";

/**
 * A boss's banners a second shorter (Eric, Oct 16: "when the bosses ult they are ulting while the banner is still up,
 * same thing for Toy Blocks: he threw it and we couldn't even see due to long banner time. Do 1 second less"; Oct 15
 * had made every banner a second longer): BOSS_BANNER.ms (1.5 s), each off the board before its power plays, and the
 * moments that had grown a second for the longer banner a second shorter again. The God King's cut-ins and FISCHER
 * RANDOM! keep 2.5 s. docs/decisions/2026-10-16-banner-timing.md.
 */
const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

/** Every power moment's view, by kind (the rage warning and each boss's). */
const VIEWS: Partial<Record<PowerEventKind, { ui: MomentUi; boss: string; name: string }>> = {};
for (const [ui, name] of [[GINGER_UI, "Ginger"], [BOINGO_UI, "Boingo"], [GREX_UI, "Jefferson"], [HOLLOW_UI, "Hollow"], [BIGBOY_UI, "Big Boy"], [SAWYER_UI, "Sawyer"], [PIG_UI, "Wrangler"], [RECLUSE_UI, "Hidden Boss"]] as const) {
  for (const [kind, m] of Object.entries(ui.moments)) VIEWS[kind as PowerEventKind] = { ui: m as MomentUi, boss: ui.id, name };
}
VIEWS.warn = { ui: WARN, boss: "bigboy", name: "Big Boy" };

/** The banners a moment's view asks for (its real code, drawn at `t`): each one's text and its window. */
function bannersOf(kind: PowerEventKind, t: number): { text: string; from: number; to: number }[] {
  const v = VIEWS[kind]!;
  const boss = { id: v.boss, name: v.name, crowdSide: "w", crowdMoves: 2, startMove: 1, board: { id: 0, fen: START_FEN, history: [], ply: 0, lastMove: null }, powers: { events: [], turn: 2 } } as unknown as BossView;
  const out: { text: string; from: number; to: number }[] = [];
  const props: MomentProps = {
    boss,
    moment: { kind, key: `k:${kind}`, at: 0, ms: POWER_FX[kind as keyof typeof POWER_FX] },
    now: t,
    t,
    orientation: "white",
    side: "w",
    kit: null,
    banner: (text, _sub, _tone, until = Infinity, from = 0) => {
      out.push({ text, from, to: from + Math.min(BOSS_BANNER.ms, until - from) });
      return null;
    },
    cast: () => null,
    anim: () => null,
  };
  v.ui.view(props);
  return out;
}

/** Where each power starts playing on the board (ms into its moment): its banner is gone by then. */
const POWER_AT: Partial<Record<PowerEventKind, number>> = {
  freeze: FREEZE.boltAt,
  blizzard: BLIZZARD.sweepAt,
  thaw: THAW.meltAt,
  pie: PIE.flyAt,
  funhouse: funhouseFlipAt(bossKit("Boingo")),
  spin: SPIN.spinAt,
  spark: SPARK.flyAt,
  candle: CANDLE.slamAt,
  dark: DARK.pourAt,
  block: BLOCK.flyAt,
  bounce: BOUNCE.leapAt,
  split: SPLIT.sawAt,
  cut: SAW_CUT.cutAt,
  boardsaw: BOARD_SAW.revAt,
  pull: PULL.catchAt,
  drag: PULL.catchAt,
  showdown: SHOWDOWN.throwAt,
};

/** Each power's banner on screen on Oct 15, ms (its window, at most the 2.5 s it slid off by then). */
const OCT_15: Partial<Record<PowerEventKind, number>> = {
  warn: 2500,
  freeze: 2500,
  blizzard: 2500,
  thaw: 2500,
  pie: 2500,
  funhouse: 2500,
  spin: 2300,
  spark: 2500,
  candle: 2500,
  dark: 2250,
  extra: 2500,
  block: 2500,
  bounce: 2300,
  split: 2300,
  cut: 2500,
  boardsaw: 2500,
  pull: 2300,
  drag: 2300,
  showdown: 2300,
  bullet: 2500,
};

describe("a boss's banners a second shorter", () => {
  it("the banner's band: in, held, and off the board by its length (--fb-ms), 2.5 s without one", () => {
    expect(css).toMatch(/animation:\s*fb-band-in var\(--fb-in, 330ms\)[^;]*,\s*fb-band-out var\(--fb-out, 240ms\)[^;]*calc\(var\(--fb-ms, 2\.5s\) - var\(--fb-out, 240ms\)\) forwards;/);
    expect(css).not.toMatch(/animation: fb-band /);
    // (The entrances inside it come in its first 0.6 s, whatever its length.)
    for (const name of ["fb-flash", "fb-face", "fb-slam", "fb-sub", "kc-portrait", "kc-target"]) expect(css).toMatch(new RegExp(`animation: ${name} 2\\.5s`));
    expect(bannerLength(BOSS_BANNER.ms)).toEqual({ "--fb-ms": "1500ms" });
    expect(bannerLength(undefined)).toBeUndefined();
    expect(BOSS_BANNER.ms).toBe(1500);
  });

  it("each power's banner: a second shorter than on Oct 15, or gone sooner where its power starts sooner", () => {
    for (const [kind, old] of Object.entries(OCT_15) as [PowerEventKind, number][]) {
      const b = bannersOf(kind, 0).concat(bannersOf(kind, BULLET.bannerAt))[0]!;
      expect(b, kind).toBeTruthy();
      const shown = b.to - b.from;
      expect(shown, kind).toBe(Math.min(old - 1000, (POWER_AT[kind] ?? Infinity) - b.from));
      // (Never cut to nothing: the shortest, 1.25 s.)
      expect(shown, kind).toBeGreaterThanOrEqual(1250);
    }
  });

  it("nothing a power does plays under its banner, and every banner ends inside its moment", () => {
    for (const kind of Object.keys(VIEWS) as PowerEventKind[]) {
      const shown = [...bannersOf(kind, 0), ...bannersOf(kind, BULLET.bannerAt), ...bannersOf(kind, SHOWDOWN.drawAt)];
      for (const b of shown) {
        expect(b.to, `${kind} ${b.text}`).toBeLessThanOrEqual(POWER_FX[kind as keyof typeof POWER_FX]);
        if (b.from === 0) expect(b.to, `${kind} ${b.text}`).toBeLessThanOrEqual(POWER_AT[kind] ?? Infinity);
      }
    }
    // Wrangler's "DRAW!": from its beat to the moment's end, 1.4 s (2.4 on Oct 15).
    expect(bannersOf("showdown", SHOWDOWN.drawAt).find((b) => b.text === "DRAW!")).toEqual({ text: "DRAW!", from: SHOWDOWN.drawAt, to: SHOWDOWN.total });
    expect(SHOWDOWN.total - SHOWDOWN.drawAt).toBe(1400);
    // The Hidden Boss's BULLET!: as the book falls open, inside his moment.
    expect(BULLET.bannerAt + BOSS_BANNER.ms).toBeLessThanOrEqual(RECLUSE_FX.bullet);
    // Lights out's: off the board as he drops (1.3 s; 2.3 on Oct 15), before his rounds (nobody's clock runs in it).
    expect(LIGHTS_BANNER_MS).toBe(LIGHTS_OUT.dropAt);
    expect(LIGHTS_BANNER_MS).toBe(1300);
  });

  it("the moments that grew a second for the longer banner are a second shorter again (no time on screen with nothing)", () => {
    expect(POWER_FX).toMatchObject({ warn: 1700, freeze: 2300, thaw: 2200, pie: 2300, spark: 2300, extra: 2200, block: 2300, cut: 2300, showdown: 6000, funhouse: 5200, spin: 2600 });
    // (Those that held their banner already keep their length.)
    expect(POWER_FX).toMatchObject({ blizzard: 3600, candle: 7100, dark: 2700, bounce: 6200, split: 3600, boardsaw: 5700, pull: 3500, drag: 3500, bullet: 4600 });
  });

  it("Boingo's board never turns under his banner: the turn comes after it, a second sooner than on Oct 15", () => {
    expect(SPIN.spinAt).toBe(1300);
    expect(funhouseFlipAt(bossKit("Boingo"))).toBeGreaterThanOrEqual(BOSS_BANNER.ms);
    expect(FUNHOUSE.exitAt).toBeLessThan(POWER_FX.funhouse);
    expect(SPIN.spinAt + SPIN.spinMs).toBeLessThan(POWER_FX.spin);
  });

  it("START!, the queen banners, PHASE 2 and 5 SECONDS!: a boss's, a second shorter", () => {
    expect(BOSS_INTRO.bannerMs).toBe(BOSS_BANNER.ms);
    // QUEEN DOWN! inside the boss's move; QUEEN SLAIN! while the boss thinks (and a beat after it).
    expect(bossShowMs({ captured: "q" })).toBeGreaterThanOrEqual(BOSS_BANNER.ms);
    expect(bossShowMs({ captured: "q" }, true)).toBeGreaterThanOrEqual(BOSS_BANNER.ms);
    const took = { crowdSide: "w" as const, crowdMoves: 3, board: { history: ["e2e4", "e7e5", "d1h5", "d8h4", "h5h4"] } };
    expect(bossThinkMs(took)).toBe(BOSS_BANNER.ms + 500);
    expect(PHASE_CHANGE.bannerMs).toBe(1400);
    expect(PHASE_CHANGE.total).toBe(PHASE_CHANGE.bannerAt + PHASE_CHANGE.bannerMs);
    expect(PHASE2_ULT_BANNER_MS).toBe(BOSS_BANNER.ms);
  });

  it("the God King's cut-ins, the Last Stand's and the votes' result keep their Oct 15 lengths", () => {
    for (const k of [KING_COMMAND, KING_SUMMON]) {
      expect(k.cutMs).toBe(2500);
      expect(k.boltAt).toBeGreaterThanOrEqual(k.cutAt + k.cutMs);
    }
    expect(KING_COMMAND.strikeLowerAt).toBeLessThanOrEqual(DEFAULT_SETTINGS.kingStrikeMs);
    expect(LAST_STAND.bannerMs).toBe(3100);
    expect(LAST_STAND.slideAt).toBeGreaterThanOrEqual(LAST_STAND.bannerAt + LAST_STAND.bannerMs);
    // (Its band stretched as before: in over 0.41 s, off by 3.1 s.)
    expect(css).toMatch(/\.fight-banner\.last-stand-cut \{\s*--fb-ms: 3\.1s;\s*--fb-in: 409ms;\s*--fb-out: 298ms;\s*\}/);
    expect(DEFAULT_SETTINGS.voteResultSeconds).toBe(4.2);
    expect(SQUADS.voteResultSeconds).toBe(4.2);
  });
});
