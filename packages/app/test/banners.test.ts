import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { BOSS_BANNER, BANNER_PLUS_MS, DEFAULT_SETTINGS, SQUADS, bannerPlusMs, bossBannerMs, setBannerPlusSource, voteResultMs, type PowerEventKind } from "@chessroyale/core";
import { ALFIL_BEATS, BLOCK, BOARD_SAW, BOSS_INTRO, BOUNCE, HOOPS_BEATS, HOPPER_BEATS, KING_COMMAND, KING_SUMMON, LAST_STAND, LIGHTS_OUT, POWER_BANNERS, POWER_FX, PULL, RECLUSE_FX, SAW_CUT, SHOWDOWN, SPLIT, START_FEN, bannerLeadMs, bannerWaitMs, bossIntroTimeline, bossShowMs, bossThinkMs, kingStrikeMs, lastStandMs, lightsOutTimeline, powerFxMs, powerMomentMs } from "@chessroyale/chess";
import { WARN, PowerBanner, PowerMoment, momentAt, momentsOf } from "../src/components/BossPowers.tsx";
import { HOPPER_UI } from "../src/components/Hopper.tsx";
import { SMUDGY_UI } from "../src/components/Smudgy.tsx";
import { MOO_UI } from "../src/components/Moo.tsx";
import { GARDENER_UI } from "../src/components/Gardener.tsx";
import { TIGER_UI } from "../src/components/Tiger.tsx";
import { FOLIO_BEATS, FOLIO_UI } from "../src/components/Folio.tsx";
import { TIMBER_UI } from "../src/components/Timber.tsx";
import { BIGBOY_UI } from "../src/components/BigBoy.tsx";
import { BOINGO_UI, FUNHOUSE, PIE, SPIN, funhouseFlipAt } from "../src/components/Boingo.tsx";
import { BLIZZARD, FREEZE, GINGER_UI, THAW } from "../src/components/Ginger.tsx";
import { CANDLE, GREX_UI, SPARK } from "../src/components/Grex.tsx";
import { DARK, HOLLOW_UI } from "../src/components/Hollow.tsx";
import { PIG_UI } from "../src/components/Pig.tsx";
import { BULLET, RECLUSE_UI } from "../src/components/Recluse.tsx";
import { SAWYER_UI } from "../src/components/Sawyer.tsx";
import { ALFIL_UI } from "../src/components/Alfil.tsx";
import { lightsBannerMs } from "../src/components/LightsOut.tsx";
import { bannerLength } from "../src/components/FightBanner.tsx";
import type { MomentProps, MomentUi } from "../src/components/PowerParts.tsx";
import { PHASE_CHANGE, phase2UltBannerMs } from "../src/recluse-phase2.ts";
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
for (const [ui, name] of [[GINGER_UI, "Ginger"], [BOINGO_UI, "Boingo"], [GREX_UI, "Jefferson"], [HOLLOW_UI, "Hollow"], [BIGBOY_UI, "Big Boy"], [SAWYER_UI, "Sawyer"], [PIG_UI, "Wrangler"], [RECLUSE_UI, "Hidden Boss"], [ALFIL_UI, "Alfil"], [HOPPER_UI, "Chub & Chirp"], [SMUDGY_UI, "Smudgy"], [MOO_UI, "Moo & Moon"], [GARDENER_UI, "Puddles"], [TIGER_UI, "Babur"], [FOLIO_UI, "Folio"], [TIMBER_UI, "Timber"]] as const) {
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
  tusks: ALFIL_BEATS.tusks.castAt,
  slam: ALFIL_BEATS.slam.leapAt,
  hoops: HOOPS_BEATS.throwsAt[0],
  // (Folio's: the ink lands, the paper folds over, the board folds, the first stroke crosses out its move.)
  draft: FOLIO_BEATS.draft.inkAt,
  fold: FOLIO_BEATS.fold.foldAt,
  crease: FOLIO_BEATS.crease.pressAt,
  revision: FOLIO_BEATS.revision.strikeAt[0],
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
    for (const name of ["fb-flash", "fb-face", "fb-sub", "kc-portrait", "kc-target"]) expect(css).toMatch(new RegExp(`animation: ${name} 2\\.5s`));
    // (The slam: its own 0.48 s, the first 19.2% of those 2.5 s, where its motion was; it ends there and holds. Oct 29.)
    expect(css).toMatch(/animation: fb-slam 0\.48s/);
    expect(bannerLength(BOSS_BANNER.ms)).toEqual({ "--fb-ms": "1500ms" });
    expect(bannerLength(undefined)).toBeUndefined();
    expect(BOSS_BANNER.ms).toBe(1500);
  });

  it("each power's banner's window in its moment's beats: a second shorter than on Oct 15, or gone sooner where its power starts sooner (Oct 24's extra comes on top: below)", () => {
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
    // Lights out's: off the board as he drops (1.3 s on Oct 16; a boss banner's whole length since Oct 24), before his
    // rounds (nobody's clock runs in it).
    expect(lightsBannerMs()).toBe(LIGHTS_OUT.dropAt);
    expect(lightsBannerMs()).toBe(bossBannerMs());
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

  it("START!, the queen banners, PHASE 2 and 5 SECONDS!: a boss's (with Oct 24's extra), and what follows each after it", () => {
    expect(BOSS_INTRO.bannerMs).toBe(bossBannerMs());
    const tl = bossIntroTimeline(4);
    expect(tl.total - tl.bannerAt).toBe(bossBannerMs());
    // QUEEN DOWN! inside the boss's move (the move shows the extra longer); QUEEN SLAIN! while the boss thinks (and a beat after it).
    expect(bossShowMs({ captured: "q" })).toBe(3100 + bannerPlusMs());
    expect(bossShowMs({ captured: "q" }, true)).toBe(3100 + bannerPlusMs());
    expect(bossShowMs({ captured: "q" })).toBeGreaterThanOrEqual(bossBannerMs());
    const took = { crowdSide: "w" as const, crowdMoves: 3, board: { history: ["e2e4", "e7e5", "d1h5", "d8h4", "h5h4"] } };
    expect(bossThinkMs(took)).toBe(bossBannerMs() + 500);
    expect(PHASE_CHANGE.bannerMs).toBe(1400 + bannerPlusMs());
    expect(PHASE_CHANGE.total).toBe(PHASE_CHANGE.bannerAt + PHASE_CHANGE.bannerMs);
    expect(phase2UltBannerMs()).toBe(bossBannerMs());
  });

  it("the God King's cut-ins, the Last Stand's and the votes' result: their Oct 15 lengths and Oct 24's extra, everything after them later by it", () => {
    expect(KING_COMMAND.cutMs).toBe(2500 + bannerPlusMs());
    expect(KING_COMMAND.boltAt).toBeGreaterThanOrEqual(KING_COMMAND.cutAt + KING_COMMAND.cutMs);
    for (const at of KING_COMMAND.slashAt) expect(at).toBeGreaterThanOrEqual(KING_COMMAND.cutAt + KING_COMMAND.cutMs);
    // (Behind settings.kingOnBoard, off: unchanged.)
    expect(KING_SUMMON.cutMs).toBe(2500);
    expect(KING_SUMMON.boltAt).toBeGreaterThanOrEqual(KING_SUMMON.cutAt + KING_SUMMON.cutMs);
    expect(KING_COMMAND.strikeLowerAt).toBeLessThanOrEqual(kingStrikeMs(DEFAULT_SETTINGS));
    expect(kingStrikeMs(DEFAULT_SETTINGS)).toBe(DEFAULT_SETTINGS.kingStrikeMs + bannerPlusMs());
    expect(LAST_STAND.bannerMs).toBe(3100 + bannerPlusMs());
    expect(LAST_STAND.slideAt).toBeGreaterThanOrEqual(LAST_STAND.bannerAt + LAST_STAND.bannerMs);
    expect(LAST_STAND.attackAt).toBeGreaterThanOrEqual(LAST_STAND.bannerAt + LAST_STAND.bannerMs);
    // (Its band stretched as before: in over 0.41 s, off by its length: 3.1 s in the stylesheet, the extra on the element.)
    expect(css).toMatch(/\.fight-banner\.last-stand-cut \{\s*--fb-ms: 3\.1s;\s*--fb-in: 409ms;\s*--fb-out: 298ms;\s*\}/);
    expect(DEFAULT_SETTINGS.voteResultSeconds).toBe(4.2);
    expect(SQUADS.voteResultSeconds).toBe(4.2);
    expect(voteResultMs(DEFAULT_SETTINGS)).toBe(4200 + bannerPlusMs());
  });
});

// ---------------- Oct 24: every banner longer, the same for all, and nothing under it ----------------

/** The banners (PowerBanner) in what PowerMoment draws: their lengths. */
function drawnBanners(node: unknown, out: number[] = []): number[] {
  if (Array.isArray(node)) node.forEach((n) => drawnBanners(n, out));
  else if (node && typeof node === "object" && "type" in node) {
    const v = node as { type: unknown; props: { ms?: number; children?: unknown } };
    if (v.type === PowerBanner) out.push(v.props.ms!);
    drawnBanners(v.props.children, out);
  }
  return out;
}

/** Each kind's boss, for PowerMoment (its kit's name). */
const BOSS_OF = Object.fromEntries((Object.entries(VIEWS) as [PowerEventKind, { boss: string; name: string }][]).map(([k, v]) => [k, v]));

/** A power's moment as momentsOf makes it, starting at 0 (its banner's hold first), and its banners' spans on screen (real ms). */
function shownSpans(kind: PowerEventKind): { lead: number; spans: { from: number; to: number; ms: number }[]; end: number } {
  const { boss: id, name } = BOSS_OF[kind]!;
  const boss = { id, name, crowdSide: "w", crowdMoves: 2, startMove: 1, board: { id: 0, fen: START_FEN, history: [], ply: 0, lastMove: null }, powers: { events: [], turn: 2 } } as unknown as BossView;
  const lead = bannerLeadMs(kind);
  const moment = { kind, key: `k:${kind}`, at: lead, ms: powerFxMs({ kind: kind as keyof typeof POWER_FX }) - lead, ...(lead ? { lead } : {}) };
  const spans: { from: number; to: number; ms: number }[] = [];
  const end = moment.at + moment.ms;
  for (let t = 0; t < end; t += 10) {
    const ms = drawnBanners(PowerMoment({ boss, moment, now: t, orientation: "white", side: "w" }));
    const last = spans.at(-1);
    if (ms.length && last && last.to === t) last.to = t + 10;
    else if (ms.length) spans.push({ from: t, to: t + 10, ms: ms[0]! });
  }
  return { lead, spans, end };
}

describe("every banner longer by BANNER_PLUS_MS (Eric, Oct 24), the same for all, and nothing under it", () => {
  afterEach(() => setBannerPlusSource(() => null));

  it("the extra: 0.75 s by default, one place (settings.ts), a page's own from its source", () => {
    expect(BANNER_PLUS_MS).toBe(750);
    expect(bannerPlusMs()).toBe(750);
    expect(bossBannerMs()).toBe(BOSS_BANNER.ms + 750);
    setBannerPlusSource(() => 1000);
    expect(bossBannerMs()).toBe(2500);
    setBannerPlusSource(() => null);
    expect(bannerPlusMs()).toBe(750);
  });

  it("POWER_BANNERS (the server's and the runner's) is what each power's view draws", () => {
    const kinds = new Set([...Object.keys(VIEWS), ...Object.keys(POWER_BANNERS)] as PowerEventKind[]);
    for (const kind of kinds) {
      const drawn = new Map<string, [number, number]>();
      for (let t = 0; t < 9000; t += 50) for (const b of bannersOf(kind, t)) drawn.set(b.text, [b.from, b.to - b.from]);
      // (A view drawing two lines of one banner (THAWING! / THAWED!) draws the same window.)
      const windows = [...new Set([...drawn.values()].map((w) => w.join()))].map((w) => w.split(",").map(Number));
      expect(windows, kind).toEqual((POWER_BANNERS[kind as keyof typeof POWER_FX] ?? []).map((w) => [...w]));
    }
  });

  for (const plus of [0, 500, 750, 1000]) {
    it(`at ${plus} ms: every power's banner shows a boss banner's length, its power starts after it, and the moment holds it`, () => {
      setBannerPlusSource(() => plus);
      for (const kind of Object.keys(POWER_BANNERS) as PowerEventKind[]) {
        const { lead, spans, end } = shownSpans(kind);
        const want = BOSS_BANNER.ms + plus;
        expect(spans.length, kind).toBe(POWER_BANNERS[kind as keyof typeof POWER_FX]!.length);
        for (const s of spans) {
          expect(s.ms, kind).toBe(want);
          expect(Math.abs(s.to - s.from - want), `${kind}: shown ${s.to - s.from}`).toBeLessThanOrEqual(10);
          // (Inside its moment, which the server and the solo game hold the screen for.)
          expect(s.to, kind).toBeLessThanOrEqual(end + 10);
        }
        // The power starts after its banner: never under it.
        if (POWER_AT[kind] !== undefined) expect(lead + POWER_AT[kind]!, kind).toBeGreaterThanOrEqual(spans[0]!.to - 10);
        expect(end, kind).toBe(powerMomentMs([{ kind: kind as keyof typeof POWER_FX }]));
      }
    });
  }

  it("a power's start, and the moment's end, move by exactly the extra", () => {
    const at = (plus: number) => {
      setBannerPlusSource(() => plus);
      return Object.fromEntries((Object.keys(POWER_BANNERS) as PowerEventKind[]).map((k) => [k, { start: bannerLeadMs(k) + (POWER_AT[k] ?? 0), wait: bannerWaitMs(k) }]));
    };
    const none = at(0);
    const def = at(750);
    for (const k of Object.keys(POWER_BANNERS) as PowerEventKind[]) {
      // (BULLET! comes later in its moment: it grows in place, nothing of its own after it in the moment.)
      expect(def[k]!.start - none[k]!.start, k).toBe(k === "bullet" ? 0 : 750);
      // (Wrangler's showdown has two banners; BULLET! grows inside its moment until it reaches the end.)
      expect(def[k]!.wait - none[k]!.wait, k).toBe(k === "showdown" ? 1500 : k === "bullet" ? 0 : 750);
    }
    // Leapfrog's (0.72 s on Oct 16, his hop at 0.72 s): brought up to a boss banner's length, the hop after it.
    expect(POWER_BANNERS.hop).toEqual([[0, HOPPER_BEATS.hop.liftAt]]);
    setBannerPlusSource(() => null);
    expect(bannerLeadMs("hop") + HOPPER_BEATS.hop.liftAt).toBe(bossBannerMs());
  });

  it("momentsOf: each moment's clock after its banner's hold, one after another, ending at the screen's end; momentAt covers the hold", () => {
    const until = 100_000;
    const boss = { id: "bigboy", name: "Big Boy", crowdSide: "w", crowdMoves: 2, startMove: 1, board: { id: 0, fen: START_FEN, history: [], ply: 0, lastMove: null }, powers: { events: [{ kind: "warn", turn: 2 }, { kind: "block", turn: 2, square: "e4" }], turn: 2 } } as unknown as BossView;
    const [block, warn] = momentsOf(boss, until);
    expect(block).toMatchObject({ kind: "block", lead: bannerLeadMs("block"), ms: powerFxMs({ kind: "block" }) - bannerLeadMs("block") });
    expect(block!.at - block!.lead!).toBe(until - powerMomentMs([{ kind: "block" }, { kind: "warn" }]));
    expect(warn!.at - warn!.lead!).toBe(block!.at + block!.ms);
    expect(warn!.at + warn!.ms).toBe(until);
    expect(momentAt([block!, warn!], block!.at - block!.lead!)?.kind).toBe("block");
    expect(momentAt([block!, warn!], warn!.at - 1)?.kind).toBe("warn");
    // (The toy block flies only after its banner: the board layer's square fills at its landing, after the hold.)
    expect(block!.at + BLOCK.flyAt - (block!.at - block!.lead!)).toBeGreaterThanOrEqual(bossBannerMs());
  });

  it("Lights out: its banner a boss banner's length, his drop and every round after it that much later", () => {
    setBannerPlusSource(() => 0);
    const before = lightsOutTimeline([{ ms: 5000 }], 500);
    setBannerPlusSource(() => null);
    const after = lightsOutTimeline([{ ms: 5000 }], 500);
    expect(LIGHTS_OUT.dropAt).toBe(bossBannerMs());
    expect(after.rounds[0]!.at - before.rounds[0]!.at).toBe(750);
    expect(after.total - before.total).toBe(after.rounds[0]!.at - before.rounds[0]!.at);
  });

  it("the Last Stand and the God King's command: the slide, the blows and the end later by the extra", () => {
    setBannerPlusSource(() => 0);
    const zero = { end: lastStandMs(), slide: LAST_STAND.slideAt, bolt: KING_COMMAND.boltAt, move: KING_COMMAND.moveMs };
    setBannerPlusSource(() => null);
    expect(lastStandMs() - zero.end).toBe(750);
    expect(LAST_STAND.slideAt - zero.slide).toBe(750);
    expect(KING_COMMAND.boltAt - zero.bolt).toBe(750);
    expect(KING_COMMAND.moveMs - zero.move).toBe(750);
  });
});

