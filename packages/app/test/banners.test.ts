import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BOSS_INTRO, KING_COMMAND, KING_SUMMON, LAST_STAND, LIGHTS_OUT, POWER_FX, RECLUSE_FX, bossShowMs, bossThinkMs } from "@chessroyale/chess";
import { DEFAULT_SETTINGS, SQUADS } from "@chessroyale/core";
import { FUNHOUSE, SPIN, funhouseFlipAt } from "../src/components/Boingo.tsx";
import { THAW } from "../src/components/Ginger.tsx";
import { BULLET } from "../src/components/Recluse.tsx";
import { PHASE2_ULT_BANNER_MS, PHASE_CHANGE } from "../src/recluse-phase2.ts";
import { bossKit } from "../src/characters/kits.ts";

/**
 * Every banner a second longer (Eric, Oct 15: "increase the banners for all banners by the extra second we discussed"):
 * the fighting-game banner's animation is 2.5 s (was 1.5 s; the Last Stand's cut-in 3.1 s, was 2.1 s), and each
 * moment that ended with its banner holds it whole.
 */
const BANNER_MS = 2500;
const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

describe("every banner a second longer", () => {
  it("the banner's animation: 2.5 s (the Last Stand's cut-in 3.1 s), with no separate long version", () => {
    for (const name of ["fb-flash", "fb-band", "fb-face", "fb-slam", "kc-portrait", "kc-target"]) expect(css).toMatch(new RegExp(`animation: ${name} 2\\.5s`));
    expect(css).not.toMatch(/animation: fb-[a-z]+ 1\.5s/);
    expect(css).not.toMatch(/fb-[a-z]+-long/);
    expect(css).toMatch(/\.fight-banner\.last-stand-cut \.kc-portrait \{\s*animation-duration: 3\.1s;/);
    expect(LAST_STAND.bannerMs).toBe(3100);
  });

  it("each moment that ends with its banner holds it whole", () => {
    // (Banners shown from the moment's start for this long, ms: the rage warning 2.6 s, the rest 2.5 s; Hollow's extra
    // move 2.8 s; each inside its moment, which the server's clock waits for.)
    const shown: [keyof typeof POWER_FX, number][] = [
      ["warn", 2600],
      ["freeze", BANNER_MS],
      ["blizzard", BANNER_MS],
      ["thaw", THAW.bannerMs],
      ["pie", BANNER_MS],
      ["funhouse", BANNER_MS],
      ["spin", SPIN.spinAt],
      ["spark", BANNER_MS],
      ["candle", BANNER_MS],
      ["dark", 2250],
      ["extra", 2800],
      ["block", BANNER_MS],
      ["bounce", 2300],
      ["split", 2300],
      ["cut", BANNER_MS],
      ["boardsaw", BANNER_MS],
      ["pull", 2300],
      ["drag", 2300],
      ["showdown", 2300],
    ];
    for (const [kind, ms] of shown) expect(ms, kind).toBeLessThanOrEqual(POWER_FX[kind]);
    expect(THAW.bannerMs).toBe(BANNER_MS);
    // Wrangler's "DRAW!" from its beat to the moment's end: 2.4 s.
    expect(POWER_FX.showdown - 4600).toBeGreaterThanOrEqual(2400);
    expect(BULLET.bannerAt + BULLET.bannerMs).toBeLessThanOrEqual(RECLUSE_FX.bullet);
    // Lights out's banner before his rounds (nobody's clock runs in it).
    expect(LIGHTS_OUT.dropAt + 1000).toBeLessThanOrEqual(LIGHTS_OUT.dropAt + LIGHTS_OUT.dropMs + LIGHTS_OUT.gapMs);
  });

  it("Boingo's board never turns under his banner: the turn comes after it", () => {
    expect(SPIN.spinAt).toBeGreaterThanOrEqual(2300);
    expect(funhouseFlipAt(bossKit("Boingo"))).toBeGreaterThanOrEqual(BANNER_MS);
    expect(FUNHOUSE.exitAt).toBeLessThan(POWER_FX.funhouse);
    expect(SPIN.spinAt + SPIN.spinMs).toBeLessThan(POWER_FX.spin);
  });

  it("the intro's START!, the queen banners, the God King's cut-ins, the phase change's PHASE 2", () => {
    expect(BOSS_INTRO.bannerMs).toBe(BANNER_MS);
    // QUEEN DOWN! inside the boss's move; QUEEN SLAIN! while the boss thinks.
    expect(bossShowMs({ captured: "q" })).toBeGreaterThanOrEqual(BANNER_MS);
    expect(bossShowMs({ captured: "q" }, true)).toBeGreaterThanOrEqual(BANNER_MS);
    expect(bossThinkMs(["e2e4", "e7e5", "d1h5", "d8h4", "h5h4"])).toBeGreaterThanOrEqual(BANNER_MS);
    for (const k of [KING_COMMAND, KING_SUMMON]) {
      expect(k.cutMs).toBe(BANNER_MS);
      expect(k.boltAt).toBeGreaterThanOrEqual(k.cutAt + k.cutMs);
    }
    expect(KING_COMMAND.strikeLowerAt).toBeLessThanOrEqual(DEFAULT_SETTINGS.kingStrikeMs);
    expect(LAST_STAND.slideAt).toBeGreaterThanOrEqual(LAST_STAND.bannerAt + LAST_STAND.bannerMs);
    expect(PHASE_CHANGE.bannerMs).toBe(2400);
    expect(PHASE_CHANGE.total).toBe(PHASE_CHANGE.bannerAt + PHASE_CHANGE.bannerMs);
    // (His ultimate's "5 SECONDS!" had its extra second already: as it was.)
    expect(PHASE2_ULT_BANNER_MS).toBe(2800);
  });

  it("the votes' result banner: a second longer, Crowd and Squads alike", () => {
    expect(DEFAULT_SETTINGS.voteResultSeconds).toBe(4.2);
    expect(SQUADS.voteResultSeconds).toBe(4.2);
  });
});
