/**
 * No boss ever plays another boss's sound (Eric, Nov 18: "I think I noticed a big boy sound reused in chandy, can't do that"; .claude/LESSONS.md,
 * "A boss's sounds are its own"). Chandy shipped with 23 placeholders borrowed from other packs, and Dodge's four "own" names were other
 * packs' sounds under his name. The cause: a placeholder from another pack looked like a sound. So every place a boss maps a sound is
 * checked here, by what the sound is made from, not only its name:
 *
 * - its kit's `sounds` (and any part's own `sounds`, e.g. its king attack), its select sound, its intro's cues, and every power-art
 *   effect drawn in its own effects file;
 * - each sound is either the app's (no boss's name, made from no boss's pack: the app's soft `pop`) or its own: named after its pack
 *   and, when synthesized, made from its own module (sound.ts's MAKE table).
 *
 * A new boss adds its line to PACKS (and its effects file to FX_FILES).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BOSS_ROSTER } from "@chessroyale/core";
import { BOSS_KITS, RECLUSE_CHILD_KIT, type BossKit } from "../src/characters/kits.ts";
import { EFFECTS } from "../src/characters/power-art.ts";
import { SELECT_SOUND } from "../src/characters/boss-select.ts";
import { BOSS_INTROS } from "../src/town/shops/challenge.ts";
import * as fxAlfil from "../src/characters/effects/alfil.ts";
import * as fxBigboy from "../src/characters/effects/bigboy.ts";
import * as fxBigboyTower from "../src/characters/effects/bigboy-tower.ts";
import * as fxBoingo from "../src/characters/effects/boingo.ts";
import * as fxChandy from "../src/characters/effects/chandy.ts";
import * as fxBirdie from "../src/characters/effects/birdie.ts";
import * as fxGingerSuper from "../src/characters/effects/ginger-superice.ts";
import * as fxDash from "../src/characters/effects/dash.ts";
import * as fxFolio from "../src/characters/effects/folio.ts";
import * as fxGardener from "../src/characters/effects/gardener.ts";
import * as fxGinger from "../src/characters/effects/ginger.ts";
import * as fxGrex from "../src/characters/effects/grex.ts";
import * as fxHollow from "../src/characters/effects/hollow.ts";
import * as fxHopper from "../src/characters/effects/hopper.ts";
import * as fxMoo from "../src/characters/effects/moo.ts";
import * as fxPig from "../src/characters/effects/pig.ts";
import * as fxRecluse from "../src/characters/effects/recluse.ts";
import * as fxSawyer from "../src/characters/effects/sawyer.ts";
import * as fxSmudgy from "../src/characters/effects/smudgy.ts";
import * as fxTiger from "../src/characters/effects/tiger.ts";
import * as fxTimber from "../src/characters/effects/timber.ts";
import * as fxZebra from "../src/characters/effects/zebra.ts";
import * as zebraDough from "../src/characters/zebra-dough.ts";
import * as zebraGold from "../src/characters/zebra-gold.ts";

/** Each boss's pack, by its roster id: its sounds' name prefix and its synthesized module (boss-sounds.ts MAKERS). */
const PACKS: Record<string, { prefix: string; module: string }> = {
  gingerbread: { prefix: "ginger", module: "ginger" },
  clown: { prefix: "clown", module: "clown" },
  grex: { prefix: "grex", module: "grex" },
  hollow: { prefix: "hollow", module: "hollow" },
  bigboy: { prefix: "bigboy", module: "bigBoy" },
  sawyer: { prefix: "sawyer", module: "sawyer" },
  pig: { prefix: "pig", module: "pig" },
  alfil: { prefix: "alfil", module: "alfil" },
  hopper: { prefix: "hopper", module: "hopper" },
  smudgy: { prefix: "smudgy", module: "smudgy" },
  moo: { prefix: "moo", module: "moo" },
  gardener: { prefix: "gardener", module: "gardener" },
  tiger: { prefix: "tiger", module: "tiger" },
  folio: { prefix: "folio", module: "folio" },
  timber: { prefix: "timber", module: "timber" },
  dash: { prefix: "dash", module: "dash" },
  zebra: { prefix: "zebra", module: "zebra" },
  chandy: { prefix: "chandy", module: "chandy" },
  birdie: { prefix: "birdie", module: "birdie" },
  recluse: { prefix: "recluse", module: "recluse" },
};

/** Each boss's effects files (its board art), by roster id. */
const FX_FILES: Record<string, readonly object[]> = {
  alfil: [fxAlfil],
  bigboy: [fxBigboy, fxBigboyTower],
  clown: [fxBoingo],
  chandy: [fxChandy],
  birdie: [fxBirdie],
  dash: [fxDash],
  folio: [fxFolio],
  gardener: [fxGardener],
  gingerbread: [fxGinger, fxGingerSuper],
  grex: [fxGrex],
  hollow: [fxHollow],
  hopper: [fxHopper],
  moo: [fxMoo],
  pig: [fxPig],
  recluse: [fxRecluse],
  sawyer: [fxSawyer],
  smudgy: [fxSmudgy],
  tiger: [fxTiger],
  timber: [fxTimber],
  zebra: [fxZebra, zebraDough, zebraGold],
};

/** What each synthesized sound is made from, by name: sound.ts's MAKE table (read as boss-sounds-finite.test.ts does). */
const src = readFileSync(new URL("../src/sound.ts", import.meta.url), "utf8");
const start = src.indexOf("const MAKE:");
const table = src.slice(start, src.indexOf("\n};", start));
const MADE_FROM = new Map<string, string[]>();
for (const line of table.split("\n")) {
  const m = line.match(/^\s+(\w+): \[(.*)\],?$/);
  if (m) MADE_FROM.set(m[1]!, [...m[2]!.matchAll(/\["(\w+)", "\w+"\]/g)].map((x) => x[1]!));
}

const PREFIXES = Object.values(PACKS).map((p) => p.prefix);
const bossPrefixOf = (s: string) => PREFIXES.find((p) => s.startsWith(p) && /[A-Z]/.test(s[p.length] ?? ""));
const BOSS_MODULES = new Set(Object.values(PACKS).map((p) => p.module));

/** Why `id` may not play this sound ("" if it may: its own, or the app's). */
function borrowed(id: string, sound: string): string {
  const own = PACKS[id]!;
  const pre = bossPrefixOf(sound);
  if (pre && pre !== own.prefix) return `${sound} is ${pre}'s`;
  for (const mod of MADE_FROM.get(sound) ?? []) if (BOSS_MODULES.has(mod) && mod !== own.module) return `${sound} is made from ${mod}'s pack`;
  return "";
}

/** Every sound a kit maps: its own `sounds` and any part's (its king attack's). */
function kitSounds(kit: BossKit): string[] {
  const out = Object.values(kit.sounds) as string[];
  for (const v of Object.values(kit)) if (v && typeof v === "object" && "sounds" in v && v !== kit) out.push(...(Object.values((v as { sounds: Record<string, string> }).sounds ?? {}) as string[]));
  return out;
}

/** Every object an effects file exports, a level down too (Chandy's are in one record): the sprites its effects are drawn from. */
function spritesOf(mod: object): Set<unknown> {
  const out = new Set<unknown>();
  for (const v of Object.values(mod)) {
    out.add(v);
    if (v && typeof v === "object") for (const w of Object.values(v)) out.add(w);
  }
  return out;
}

describe("no boss plays another boss's sound", () => {
  it("knows every boss with a kit, and reads sound.ts's table", () => {
    for (const b of BOSS_ROSTER) if (b.kit) expect(PACKS[b.id], `${b.id}: add its pack to PACKS`).toBeTruthy();
    for (const id of Object.keys(SELECT_SOUND)) expect(PACKS[id], `${id}: add its pack to PACKS`).toBeTruthy();
    expect(MADE_FROM.get("mooZap")).toEqual(["moo"]);
    expect(MADE_FROM.size).toBeGreaterThan(200);
  });

  it("its kit's sounds", () => {
    const bad: string[] = [];
    for (const b of BOSS_ROSTER) {
      if (!b.kit) continue;
      const kits = b.id === "recluse" ? [BOSS_KITS[b.kit]!, RECLUSE_CHILD_KIT] : [BOSS_KITS[b.kit]!];
      for (const k of kits) for (const s of kitSounds(k)) if (borrowed(b.id, s)) bad.push(`${b.name}: ${borrowed(b.id, s)}`);
    }
    expect(bad).toEqual([]);
  });

  it("its select sound and its intro's cues", () => {
    const bad: string[] = [];
    for (const [id, s] of Object.entries(SELECT_SOUND)) if (borrowed(id, s)) bad.push(`${id} select: ${borrowed(id, s)}`);
    for (const [id, intro] of Object.entries(BOSS_INTROS)) {
      const own = id === "blitz" ? "dash" : id;
      for (const [cue, s] of Object.entries(intro!.cues)) if (borrowed(own, s)) bad.push(`${id} intro ${cue}: ${borrowed(own, s)}`);
    }
    expect(bad).toEqual([]);
  });

  it("its board art's (each power-art effect, by the boss whose effects file draws it)", () => {
    const owner = new Map<unknown, string>();
    for (const [id, mods] of Object.entries(FX_FILES)) for (const m of mods) for (const s of spritesOf(m)) if (s && typeof s === "object") owner.set(s, id);
    const bad: string[] = [];
    for (const [name, fx] of Object.entries(EFFECTS)) {
      const sounds = Object.values(fx.sounds) as string[];
      if (!sounds.length) continue;
      const id = owner.get(fx.ch);
      expect(id, `${name}: whose effects file draws it? (FX_FILES)`).toBeTruthy();
      for (const s of sounds) if (borrowed(id!, s)) bad.push(`${name} (${id}): ${borrowed(id!, s)}`);
    }
    expect(bad).toEqual([]);
  });
});
