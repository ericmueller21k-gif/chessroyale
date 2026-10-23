import { afterEach, describe, expect, it } from "vitest";
import { BOSS_POWERS, BOSS_ROSTER, GARDENER_NAME, isPlayable, menuBosses, playableBosses, type PowerEvent, type WaterGrowth } from "@chessroyale/core";
import { GARDENER_ANIM, GARDEN_ART, KING_ATTACKERS, START_FEN, WATER_BEATS, growthAt, growthMs, pieceAt, seedFill, seedsAt, waterMs } from "@chessroyale/chess";
import { GARDENER, GARDENER_ATTACK } from "../src/characters/gardener.ts";
import { GARDENER_BAR, isSpray } from "../src/characters/gardener-bar.ts";
import { GARDENER_CHANCE, GARDENER_LINES } from "../src/characters/gardener-lines.ts";
import { GARDEN_PLANT, SEED_FLY, SEED_PLOP, SWEEP_MS, WATER_SWEEP } from "../src/characters/effects/gardener.ts";
import { GARDENER_SOUNDS, gardenerSound } from "../src/characters/gardener-sounds.ts";
import { MOVE_MEAN_DB, MOVE_PEAK } from "../src/characters/synth.ts";
import { SELECT_LINES, SELECT_SOUND, selectLine } from "../src/characters/boss-select.ts";
import { CHARACTERS } from "../src/characters/index.ts";
import { bossKit } from "../src/characters/kits.ts";
import { EFFECTS, POWER_MOMENTS, animLength, cueAt } from "../src/characters/power-art.ts";
import { frameKeys, renderFrame, type Anim } from "../src/characters/sprite.ts";
import { momentsOf, powerLine } from "../src/components/BossPowers.tsx";
import { GARDENER_UI, HAND, POP_MS, SWEEP, frontMs, gardenerFen, plantState, waterLine } from "../src/components/Gardener.tsx";
import type { Moment } from "../src/components/PowerParts.tsx";
import { gardenNow, realMs, setGardenSource } from "../src/garden-clock.ts";
import { SEED_FRESH_MS, addToss, currentTosses, freshLanding, hasTossed, lastLanding, resetTosses, seedReading, tossSquares } from "../src/garden-seeds.ts";
import { BOSS_BLOCKS } from "../src/faq/content.ts";
import { POWER_WORDS, powersLine } from "../src/power-words.ts";
import { REFUSED } from "../src/refused.ts";
import type { BossView } from "../src/game.ts";

/**
 * Puddles, the hippo gardener, in the game (Oct 23: live, his art wired in): his kit, lines, sounds, the timing of his watering against his
 * art, the board under it, the plain plants' states and his seed meter and tosses on the garden's clock
 * (docs/decisions/2026-10-23-gardener-wired.md). The art's own tests: gardener.test.ts and gardener-art.test.ts; his rules': packages/chess.
 */
afterEach(() => {
  resetTosses();
  setGardenSource(null);
});

const NAME = "Gardener";
const view = (events: PowerEvent[], extra: Record<string, unknown> = {}): BossView =>
  ({ id: "gardener", name: GARDENER_NAME, crowdSide: "w", crowdMoves: 4, startMove: 1, lastMove: null, board: { fen: START_FEN, history: [], generation: 1 }, powers: { events, turn: 5, ultAt: null, rage: 0.3, warned: false, ...extra } }) as unknown as BossView;
const at = (kind: Moment["kind"], key: string): Pick<Moment, "kind" | "key"> => ({ kind, key });

describe("Puddles is live", () => {
  it("is playable, on the Boss raid screen and the boss menu, with a kit of his own whose every moment has an animation", () => {
    const def = BOSS_ROSTER.find((b) => b.id === "gardener")!;
    expect(def).toMatchObject({ name: GARDENER_NAME, kit: NAME, powers: { passive: "seeds", ultimate: "water" } });
    expect(isPlayable(def)).toBe(true);
    expect(playableBosses().map((b) => b.id)).toContain("gardener");
    expect(menuBosses({ admin: false, raid: true }).map((b) => b.id)).toContain("gardener");
    const kit = bossKit(GARDENER_NAME)!;
    expect(kit.ch).toBe(GARDENER);
    expect(bossKit(NAME)).toBe(kit);
    expect(CHARACTERS).toContain(GARDENER);
    // (The character's own name is its kit's: BossCharacter and POWER_MOMENTS look a kit up by it.)
    expect(GARDENER.name).toBe(NAME);
    expect(POWER_MOMENTS[GARDENER.name]).toBeTruthy();
    expect(kit.anims).toMatchObject({ strike: "capture", power: "plant", plantMany: "plantMany", plant: "plant", ultimateWarn: "check", ultimate: "water", ultimateHit: "cheer", cheer: "cheer", bigCheer: "bigCheer", shrug: "shrug" });
    for (const a of Object.values(kit.anims)) expect(GARDENER.anims[a!], a).toBeTruthy();
    expect(KING_ATTACKERS).toContain("gardener");
    expect(POWER_WORDS.seeds).toBe("plants seeds as the clock runs");
    expect(powersLine(def)).toBe("plants seeds as the clock runs · Watering");
    expect(POWER_MOMENTS[NAME]!.ultimate).toMatchObject({ anim: "water", hit: "spray" });
  });

  it("stands in the phone's bar in the tall and wide box, drawn without his spray (it runs past his box into his name); a computer keeps the spray", () => {
    const kit = bossKit(NAME)!;
    expect(kit.tall).toBe(true);
    expect(kit.wide).toBe(true);
    expect(kit.bar).toBe(GARDENER_BAR);
    expect([GARDENER_BAR.w, GARDENER_BAR.h, GARDENER_BAR.foot]).toEqual([GARDENER.w, GARDENER.h, GARDENER.foot]);
    let sprays = 0;
    for (const [name, a] of Object.entries(GARDENER.anims)) {
      const b = GARDENER_BAR.anims[name]!;
      expect(b.frames.map((f) => [f.ms, f.cue]), name).toEqual(a.frames.map((f) => [f.ms, f.cue]));
      expect(b.loop).toBe(a.loop);
      for (const [i, f] of a.frames.entries()) {
        sprays += f.layers.filter((l) => isSpray(l.part)).length;
        expect(b.frames[i]!.layers.some((l) => isSpray(l.part)), `${name} ${i + 1}`).toBe(false);
        expect(b.frames[i]!.layers.length, `${name} ${i + 1}`).toBe(f.layers.filter((l) => !isSpray(l.part)).length);
      }
    }
    expect(sprays, "the full drawing has his spray").toBeGreaterThan(20);
    // (His idle's first frame, the approved still, drawn on the bar: the water gone and nothing else.)
    const still = GARDENER_BAR.anims.idle!.frames[0]!;
    expect(frameKeys(GARDENER_BAR, still).flat().filter(Boolean).length).toBeGreaterThan(1000);
  });

  it("reaches no further than the wide box on the phone's bar: 29 px each side of his feet, the spray off", () => {
    for (const [name, a] of Object.entries(GARDENER_BAR.anims))
      for (const [i, f] of a.frames.entries()) {
        const rows = frameKeys(GARDENER_BAR, f);
        let left = Infinity;
        for (const row of rows) row.forEach((k, x) => k && (left = Math.min(left, x)));
        // (A drop or a sparkle thrown off him may fly further; he himself, the nozzle and the hose, do not.)
        if (name === "idle" && i === 0) expect(GARDENER_BAR.foot[0] - left, "the still").toBeLessThanOrEqual(29);
      }
  });
});

/** Every line of the director's draft (Oct 21), as written. */
const WRITTEN = {
  entrance: ["Mind the flower beds.", "Big feet, gentle hands. Wipe yours.", "Welcome to my garden. Stay as long as you like. Longer, ideally."],
  plantMany: ["A few seeds to start…", "Good soil here. Very good soil."],
  plant: ["Another one.", "Take your time. They grow either way.", "Plop."],
  move: ["Slow and steady.", "One step at a time.", "Easy does it.", "Patience."],
  capture: ["Weeded out.", "Pulled it up by the roots.", "That one was crowding the bed."],
  hurt: ["My petunias!", "Hey! I just watered that.", "Ouch. That'll leave a mark on the lawn."],
  strike: ["Spritz!", "Little drink for you!"],
  thinking: ["Hmm… let it grow.", "Good things take time."],
  check: ["Check. Feeling the heat?", "Check. Nowhere to plant your feet."],
  smug: ["Everything's coming up roses.", "Green thumb. Both of them."],
  rattled: ["Somebody's trampling my garden!", "This was not in the seed catalog."],
  ultimateWarn: ["Clouds are rolling in…", "Feels like rain."],
  ultimate: ["Watering time!", "Let's see what comes up!", "Drink up, little ones!"],
  cheer: ["Look at that! A fine crop.", "Grown it myself!"],
  bigCheer: ["A queen! Prize of the county fair!", "Now that's what I call a harvest!"],
  shrug: ["Hm. Dry year.", "Next season."],
  ownEaten: ["Not that one! Bad plant!", "Well… it was hungry."],
  victory: ["Another fine harvest.", "Everything in its season."],
  defeat: ["Trampled… my whole garden…", "I'll replant. I always do."],
  kingAttack: ["Hold still, your majesty. You look thirsty.", "Spritz! Spritz! Spritz!", "A royal soaking!"],
};

describe("his lines", () => {
  it("are the director's, as written, by the beat with the same meaning (plantBlocked's one line is left out: the kit has no such beat)", () => {
    expect(GARDENER_LINES).toEqual(WRITTEN);
    expect(Object.values(GARDENER_LINES).flat()).toHaveLength(48);
    expect(GARDENER_LINES).not.toHaveProperty("plantBlocked");
    expect(Object.values(GARDENER_LINES).flat()).not.toContain("Keep off the grass.");
  });

  it("never say his name (it is one constant, GARDENER_NAME: nothing else needs an edit when it changes)", () => {
    for (const l of [...Object.values(GARDENER_LINES).flat(), ...SELECT_LINES.gardener!]) expect(l.toLowerCase(), l).not.toContain(GARDENER_NAME.toLowerCase());
  });

  it("speak as Moo's do, plus the opening five, the watering, its reactions and a killer plant's meal always; the 30 s seed rarely", () => {
    for (const beat of ["entrance", "kingAttack", "defeat", "victory", "ultimate", "plantMany", "cheer", "bigCheer", "shrug", "ownEaten"] as const) expect(GARDENER_CHANCE[beat], beat).toBe(1);
    expect(GARDENER_CHANCE.plant).toBe(0.15);
    expect(GARDENER_CHANCE).toMatchObject({ move: 0.12, capture: 0.6, check: 0.75, hurt: 0.6, thinking: 0.08, smug: 0.8, rattled: 0.8, strike: 0.8 });
    expect(bossKit(NAME)!.lines).toBe(GARDENER_LINES);
    expect(bossKit(NAME)!.chance).toBe(GARDENER_CHANCE);
  });

  it("has the select screen's three, and his happy grunt and a splash", () => {
    expect(SELECT_LINES.gardener).toEqual(["Mind the flower beds.", "Good soil here. Very good soil.", "Everything's coming up roses."]);
    expect(SELECT_SOUND.gardener).toBe("gardenerHello");
    expect(selectLine("gardener", SELECT_LINES.gardener![0]!, 0)).not.toBe(SELECT_LINES.gardener![0]);
  });

  it("are said for his moments: the watering's ultimate lines, each reaction its own, the warning's; the seeds' tosses are said by the board's watch, not a moment", () => {
    const kit = bossKit(NAME)!;
    for (let i = 0; i < 12; i++) {
      expect(GARDENER_LINES.ultimate).toContain(powerLine(kit, at("water", `k${i}`)));
      expect(GARDENER_LINES.cheer).toContain(powerLine(kit, at("cheer", `k${i}`)));
      expect(GARDENER_LINES.bigCheer).toContain(powerLine(kit, at("bigCheer", `k${i}`)));
      expect(GARDENER_LINES.shrug).toContain(powerLine(kit, at("shrug", `k${i}`)));
      expect(GARDENER_LINES.ultimateWarn).toContain(powerLine(kit, at("warn", `k${i}`)));
      expect(powerLine(kit, at("plantMany", `k${i}`))).toBeNull();
      expect(powerLine(kit, at("plant", `k${i}`))).toBeNull();
    }
  });

  it("go with the rage warning's words and the dock's: \"After your move: Watering\" and \"Puddles spent his turn watering.\"", () => {
    expect(GARDENER_UI.ultimate).toEqual({ name: "Watering", when: "After your move" });
    expect(waterLine({ name: GARDENER_NAME })).toBe("Puddles spent his turn watering.");
    const done = { at: 4, seeds: 3, rolled: [], growth: [], gain: null };
    expect(GARDENER_UI.noMove({ ...view([], { garden: { water: done } }), crowdMoves: 4, lastMove: null } as BossView)).toBe("Puddles spent his turn watering.");
    expect(GARDENER_UI.noMove({ ...view([], { garden: { water: done } }), crowdMoves: 5 } as BossView)).toBeNull();
    expect(GARDENER_UI.noMove({ ...view([], { garden: { water: done } }), crowdMoves: 4, lastMove: { san: "e4" } } as unknown as BossView)).toBeNull();
    expect(REFUSED.plant).toBe("A plant is in the way.");
  });
});

describe("his sounds", () => {
  it("each stay under a piece's move, in peak and in loudness (the #271 rule), and are all finite and the same every time", () => {
    for (const name of GARDENER_SOUNDS) {
      const s = gardenerSound(name, 44100);
      let peak = 0;
      let sum = 0;
      for (const v of s) {
        expect(Number.isFinite(v), name).toBe(true);
        peak = Math.max(peak, Math.abs(v));
        sum += v * v;
      }
      expect(peak, name).toBeLessThan(MOVE_PEAK / 2);
      expect(10 * Math.log10(sum / s.length), name).toBeLessThan(MOVE_MEAN_DB - 2);
    }
  });

  it("wire every cue of his animations and his attack to one of his sounds", () => {
    const kit = bossKit(NAME)!;
    for (const ch of [GARDENER, GARDENER_ATTACK]) for (const [anim, a] of Object.entries(ch.anims)) for (const f of a.frames) if (f.cue) expect(kit.sounds[f.cue], `${anim} ${f.cue}`).toMatch(/^gardener[A-Z]/);
    expect(kit.sounds).toMatchObject({ toss: "gardenerToss", tug: "gardenerTug", spray: "gardenerSpray", sweep: "gardenerSwell", stop: "gardenerDrips", jet: "gardenerJet", spurt: "gardenerSpurt", whoop: "gardenerBellow", grunt: "gardenerGrunt" });
    // (The board's: a seed's plop, the killer plant's snap and gulp, a bud's pop, the wilt; the sweep's `spray` is his own cue's.)
    expect(EFFECTS.seedPlop.sounds).toEqual({ plop: "gardenerPlip" });
    expect(EFFECTS.gardenPlant.sounds).toMatchObject({ snap: "gardenerSnap", gulp: "gardenerGulp", pop: "gardenerPop", wilt: "gardenerWilt" });
    // (The leaves unfurling and the jaws rising are a very soft rustle; every cue of the art has a sound, as the effects' test wants.)
    for (const c of ["sprout", "grow", "rise", "open", "swell"]) expect(EFFECTS.gardenPlant.sounds[c], c).toBe("gardenerRustle");
    expect(EFFECTS.waterSweep.sounds).toEqual({ spray: "gardenerSpray" });
  });

  it("keep the 30 s toss quiet: a soft whiff, no grunt (his seed animations have the toss's cue alone), and a soft plip for each seed landing", () => {
    for (const anim of ["plant", "plantMany"]) expect(GARDENER.anims[anim]!.frames.flatMap((f) => (f.cue ? [f.cue] : []))).toEqual(["toss"]);
    const mean = (n: Parameters<typeof gardenerSound>[0]) => {
      const s = gardenerSound(n, 44100);
      return 10 * Math.log10(s.reduce((a, v) => a + v * v, 0) / s.length);
    };
    expect(mean("toss")).toBeLessThan(-30);
    expect(mean("plip")).toBeLessThan(-30);
    expect(mean("grunt")).toBeGreaterThan(mean("toss") + 5);
  });

  it("grunts deep and bellows bigger: the bellow longer and lower than the grunt, the cheer two short grunts", () => {
    const len = (n: Parameters<typeof gardenerSound>[0]) => gardenerSound(n, 44100).length / 44100;
    expect(len("bellow")).toBeGreaterThan(len("grunt") * 2);
    expect(len("cheer")).toBeGreaterThan(len("grunt"));
    // The hose: the hiss swells for the sweep and dies to drips, each a beat after the last.
    expect(len("drips")).toBeGreaterThan(len("spray"));
    expect(len("spurt")).toBeLessThan(len("jet"));
  });

  it("his ten squirts at a king together stay under a move", () => {
    const rate = 44100;
    const mix = new Float32Array(rate * 2.2);
    for (let i = 0; i < 10; i++) {
      const w = gardenerSound(i % 2 ? "spurt" : "jet", rate);
      const at = Math.round(i * 0.17 * rate);
      for (let j = 0; j < w.length; j++) mix[at + j]! += w[j]!;
    }
    let peak = 0;
    let sum = 0;
    const span = Math.round(1.7 * rate);
    for (let j = 0; j < span; j++) {
      peak = Math.max(peak, Math.abs(mix[j]!));
      sum += mix[j]! * mix[j]!;
    }
    expect(peak).toBeLessThan(MOVE_PEAK);
    expect(10 * Math.log10(sum / span)).toBeLessThan(MOVE_MEAN_DB);
  });
});

describe("his watering is as long as his art (so the server never moves on before the board is done)", () => {
  it("has the rules' lengths of every piece of art exactly: the cast, the reactions, the sweep, a sprout and each outcome", () => {
    const len = (a: Anim) => animLength(a);
    expect(GARDENER_ANIM).toEqual({ plant: len(GARDENER.anims.plant!), plantMany: len(GARDENER.anims.plantMany!), water: len(GARDENER.anims.water!), waterSprayAt: cueAt(GARDENER.anims.water!, "spray"), cheer: len(GARDENER.anims.cheer!), bigCheer: len(GARDENER.anims.bigCheer!), shrug: len(GARDENER.anims.shrug!) });
    const plant = GARDEN_PLANT.anims;
    expect(GARDEN_ART).toEqual({ sweep: len(WATER_SWEEP.anims.sweep!), sprout: len(plant.sprout!), kill: len(plant.kill!), killSnap: cueAt(plant.kill!, "snap"), bud: len(plant.bud!), budQueen: len(plant.budQueen!), budPop: cueAt(plant.bud!, "pop"), grow: len(plant.grow!), wilt: len(plant.wilt!), gone: len(plant.gone!) });
    expect(cueAt(plant.budQueen!, "pop")).toBe(GARDEN_ART.budPop);
    expect(SWEEP_MS).toBe(GARDEN_ART.sweep);
  });

  it("holds the screen until the last outcome's art has played, and every sprout is up before the first outcome starts", () => {
    // The worst case: ten seeds, one of each look, the last a killer plant.
    const kinds: WaterGrowth["kind"][] = ["killer", "q", "p", "n", "plant", "plant", "plant", "nothing", "nothing", "killer"];
    const growth = kinds.map((kind) => ({ kind, square: "e4" }));
    const total = waterMs(growth);
    expect(total).toBeGreaterThanOrEqual(GARDENER.anims.water ? animLength(GARDENER.anims.water) : 0);
    growth.forEach((g, i) => {
      const art = g.kind === "killer" ? animLength(GARDEN_PLANT.anims.kill!) : g.kind === "q" ? animLength(GARDEN_PLANT.anims.budQueen!) : g.kind === "plant" ? animLength(GARDEN_PLANT.anims.grow!) : g.kind === "nothing" ? animLength(GARDEN_PLANT.anims.wilt!) : animLength(GARDEN_PLANT.anims.bud!);
      expect(growthMs(g), g.kind).toBe(art);
      expect(total, `outcome ${i + 1}`).toBeGreaterThanOrEqual(growthAt(i) + art);
    });
    expect(total).toBe(growthAt(9) + animLength(GARDEN_PLANT.anims.kill!));
    // The sprouts: the sweep starts at his `spray` cue and its front reaches every square within SWEEP_MS; each sprout (300 ms) holds its look until the first outcome.
    expect(WATER_BEATS.sprayAt).toBe(cueAt(GARDENER.anims.water!, "spray"));
    let latest = 0;
    for (const o of ["white", "black"] as const)
      for (let f = 0; f < 8; f++)
        for (let r = 1; r <= 8; r++) {
          const t = frontMs(`${"abcdefgh"[f]}${r}`, o);
          expect(t).toBeGreaterThanOrEqual(0);
          expect(t).toBeLessThanOrEqual(SWEEP_MS);
          latest = Math.max(latest, t);
        }
    expect(WATER_BEATS.sprayAt + latest + GARDEN_ART.sprout).toBeLessThanOrEqual(WATER_BEATS.sproutsBy);
    expect(WATER_BEATS.sproutsBy).toBeLessThanOrEqual(WATER_BEATS.growAt);
  });

  it("sprouts a square as the sweep's front reaches it: the sprite's own front, measured, is where frontMs says, the lower rows leading", () => {
    // The sweep's frame i has its spray's front at x = front0 + step * i, leaning by `lean` px a row: the rightmost pixel of a row is just ahead of it.
    const a = WATER_SWEEP.anims.sweep!;
    expect(a.frames.length * SWEEP.frameMs).toBe(SWEEP_MS);
    expect([WATER_SWEEP.w, WATER_SWEEP.h]).toEqual([SWEEP.board, SWEEP.board]);
    a.frames.forEach((f, i) => {
      expect(f.ms).toBe(SWEEP.frameMs);
      const img = renderFrame(WATER_SWEEP, f);
      for (const y of [16, 80, 128, 176, 240]) {
        let right = -1;
        for (let x = 0; x < SWEEP.board; x++) if (img.data[(y * SWEEP.board + x) * 4 + 3]! > 0) right = x;
        const front = SWEEP.front0 + SWEEP.step * i + SWEEP.lean * (y - SWEEP.board / 2);
        if (front > 8 && front < SWEEP.board - 24) {
          expect(right, `frame ${i + 1}, row ${y}`).toBeGreaterThanOrEqual(front - 2);
          expect(right, `frame ${i + 1}, row ${y}`).toBeLessThanOrEqual(front + 18);
        }
      }
    });
    // (A square on the left sprouts before one on the right; in a column, the lower rows first.)
    expect(frontMs("a1", "white")).toBeLessThan(frontMs("h1", "white"));
    expect(frontMs("c1", "white")).toBeLessThan(frontMs("c8", "white"));
    // (The same squares from Black's side: the screen's columns, not the files.)
    expect(frontMs("a1", "black")).toBe(frontMs("h8", "white"));
  });

  it("makes the moment as long as the rules say: the cast, then every outcome, then his reaction (a cheer 720 ms, a big cheer 1200 ms, a shrug 800 ms)", () => {
    const events: PowerEvent[] = [
      { kind: "water", turn: 5, growth: [{ kind: "killer", square: "e2", ate: "P" }, { kind: "p", square: "e5" }] as WaterGrowth[] },
      { kind: "cheer", turn: 5 },
    ];
    const ms = momentsOf(view(events), 20_000);
    expect(ms.map((m) => m.kind)).toEqual(["water", "cheer"]);
    expect(ms[0]!.ms).toBe(waterMs(ms[0]!.growth));
    expect(ms[0]!.growth).toHaveLength(2);
    expect(ms[1]!.ms).toBe(GARDENER_ANIM.cheer);
    expect(ms[1]!.at).toBe(ms[0]!.at + ms[0]!.ms);
    expect(ms[1]!.at + ms[1]!.ms).toBe(20_000);
    // (The seeds' tosses are moments of no length: nothing ever waits for them.)
    expect(momentsOf(view([{ kind: "plantMany", turn: 1, seeds: 5 }]), 20_000).every((m) => m.ms === 0)).toBe(true);
  });

  it("lets his hand's toss point be where the seeds are in the air at the toss cue", () => {
    for (const anim of ["plant", "plantMany"]) {
      const a = GARDENER.anims[anim]!;
      const f = a.frames.find((fr) => fr.cue === "toss")!;
      const seeds: [number, number][] = [];
      frameKeys(GARDENER, f).forEach((row, y) => row.forEach((k, x) => (k === "5" || k === "6" || k === "7") && seeds.push([x, y])));
      expect(seeds.length, anim).toBeGreaterThan(8);
      const [x0, x1] = [Math.min(...seeds.map((s) => s[0])), Math.max(...seeds.map((s) => s[0]))];
      const [y0, y1] = [Math.min(...seeds.map((s) => s[1])), Math.max(...seeds.map((s) => s[1]))];
      expect(HAND.x, anim).toBeGreaterThanOrEqual(x0 - 3);
      expect(HAND.x, anim).toBeLessThanOrEqual(x1 + 3);
      expect(HAND.y, anim).toBeGreaterThanOrEqual(y0 - 3);
      expect(HAND.y, anim).toBeLessThanOrEqual(y1 + 3);
    }
  });
});

/** A watering's moment as Boss.tsx has it: the cast starts at `at`. */
const water = (growth: WaterGrowth[], at = 10_000): Moment => ({ kind: "water", key: "gardener:water:5", at, ms: waterMs(growth), growth });
const placeOf = (fen: string, sq: string) => pieceAt(fen, sq);

describe("the board under his watering", () => {
  // After the watering: his pawn on e5 grew, a killer plant ate the white pawn on e2 (the position the game holds).
  const AFTER = "rnbqkbnr/pppp1ppp/8/4p3/8/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1";
  const growth: WaterGrowth[] = [{ kind: "killer", square: "e2", ate: "P" }, { kind: "p", square: "e5" }, { kind: "plant", square: "c4" }, { kind: "nothing", square: "h4" }];
  const m = water(growth);
  const when = (i: number, cue: number) => m.at + growthAt(i) + cue;

  it("is the position before it until each outcome's cue: the eaten piece stays until the plant's snap, the grown piece comes at the bud's pop", () => {
    const before = gardenerFen({ id: "gardener" }, [m], m.at, AFTER)!;
    expect(placeOf(before.fen, "e2")).toEqual({ color: "w", type: "p" });
    expect(placeOf(before.fen, "e5")).toBeNull();
    // Just before the snap: still there. At the snap: gone (the board fades it as a captured piece goes).
    expect(placeOf(gardenerFen({ id: "gardener" }, [m], when(0, GARDEN_ART.killSnap - 1), AFTER)!.fen, "e2")).toEqual({ color: "w", type: "p" });
    // The grown piece: not there until its pop, then there, with a pop-in for POP_MS.
    expect(placeOf(gardenerFen({ id: "gardener" }, [m], when(1, GARDEN_ART.budPop - 1), AFTER)!.fen, "e5")).toBeNull();
    const popped = gardenerFen({ id: "gardener" }, [m], when(1, GARDEN_ART.budPop + 20), AFTER)!;
    expect(placeOf(popped.fen, "e5")).toEqual({ color: "b", type: "p" });
    expect(popped.decor!.of("e5", "bp")).toEqual({ cls: "gd-pop", kids: null });
    expect(popped.decor!.of("e4", "bp")).toBeUndefined();
    expect(popped.decor!.key).toBe("gd-pop:e5");
    // (The kill has snapped by then: the eaten pawn is off, the position is the game's.)
    expect(popped.fen).toBe(AFTER);
  });

  it("is the game's position (nothing to say) once every outcome has played, and where none of its outcomes move a piece", () => {
    expect(gardenerFen({ id: "gardener" }, [m], when(1, GARDEN_ART.budPop + POP_MS), AFTER)).toBeNull();
    expect(gardenerFen({ id: "gardener" }, [water([{ kind: "plant", square: "c4" }, { kind: "nothing", square: "h4" }])], 10_000, AFTER)).toBeNull();
    expect(gardenerFen({ id: "gardener" }, [], 10_000, AFTER)).toBeNull();
    expect(gardenerFen({ id: "smudgy" }, [m], 10_000, AFTER)).toBeNull();
    expect(gardenerFen({ id: "gardener" }, [{ ...m, growth: undefined }], 10_000, AFTER)).toBeNull();
  });

  it("puts back the black piece a killer plant ate (a letter in lower case is Black's) and a grown piece of his is Black's when the crowd is White", () => {
    const g: WaterGrowth[] = [{ kind: "killer", square: "d7", ate: "p", own: true }];
    const after = "rnbqkbnr/ppp1pppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    expect(placeOf(gardenerFen({ id: "gardener" }, [water(g)], 10_000, after)!.fen, "d7")).toEqual({ color: "b", type: "p" });
  });
});

describe("the plain plants' states", () => {
  it("are green the turn it grew (3 turns left), fall colors the next (2), dropping its leaves the third (1)", () => {
    expect([3, 2, 1].map(plantState)).toEqual(["green", "fall", "drop"]);
    expect(BOSS_POWERS.plantTurns).toBe(3);
    // (The art has a state for each, chained from the sprout: the turn-over animations and what they come to.)
    for (const a of ["green", "toFall", "fall", "toDrop", "drop", "gone"]) expect(GARDEN_PLANT.anims[a], a).toBeTruthy();
    expect(GARDEN_PLANT.anims.green!.loop && GARDEN_PLANT.anims.fall!.loop && GARDEN_PLANT.anims.drop!.loop).toBe(true);
    expect(GARDEN_PLANT.anims.toFall!.loop || GARDEN_PLANT.anims.toDrop!.loop || GARDEN_PLANT.anims.gone!.loop).toBe(false);
  });
});

describe("his seed meter", () => {
  const every = BOSS_POWERS.seedEverySec * 1000;
  const g = (since: number, base: number) => ({ since, base, fixed: null, taken: null });

  it("shows the seeds waiting and the bar toward the next, by the rules' own functions: five at the start, one more every 30 s", () => {
    expect(seedReading(g(1000, 5), 1000)).toEqual({ count: 5, fill: 0, next: 1000 + every, held: false });
    expect(seedReading(g(1000, 5), 1000 + every / 2)).toMatchObject({ count: 5, fill: 0.5, held: false });
    expect(seedReading(g(1000, 5), 1000 + every)).toMatchObject({ count: 6, fill: 0 });
    expect(seedReading(g(1000, 5), 1000 + every * 2.25)).toMatchObject({ count: 7, fill: 0.25 });
    for (const now of [0, 1000, 31_000, 77_000, 400_000]) {
      const r = seedReading(g(1000, 5), now);
      expect(r.count).toBe(seedsAt(g(1000, 5), now).count);
      expect(r.fill).toBe(seedFill(g(1000, 5), now));
    }
  });

  it("is full and still at the cap, however long you wait", () => {
    const r = seedReading(g(0, 5), every * 5);
    expect(r).toEqual({ count: BOSS_POWERS.seedMax, fill: 1, next: null, held: false });
    expect(seedReading(g(0, 5), every * 500)).toEqual(r);
    expect(seedReading(g(0, 0), every * 100).count).toBe(BOSS_POWERS.seedMax);
  });

  it("holds while a watering is being placed: the count taken, the bar where it stood when it was taken, whatever the clock does", () => {
    const taken = { clock: 1000 + every * 2.5, seeds: 7 };
    const held = { ...g(1000, 5), taken };
    const r = seedReading(held, taken.clock);
    expect(r).toEqual({ count: 7, fill: 0.5, next: null, held: true });
    for (const later of [taken.clock + 1, taken.clock + every, taken.clock + every * 20]) expect(seedReading(held, later)).toEqual(r);
    // (Once it's played the meter starts again from none, from that moment.)
    expect(seedReading(g(taken.clock, 0), taken.clock + 1)).toMatchObject({ count: 0, held: false });
    expect(seedReading(g(taken.clock, 0), taken.clock + every)).toMatchObject({ count: 1 });
  });

  it("shows the test switch's set count full (?seeds=N): N, whatever the clock says", () => {
    expect(seedReading({ since: 0, base: 5, fixed: 10, taken: null }, 123_456)).toEqual({ count: 10, fill: 1, next: null, held: false });
    expect(seedReading({ since: 0, base: 5, fixed: 3, taken: null }, 0)).toMatchObject({ count: 3, fill: 1 });
  });
});

describe("the toss as the count rises on a screen's own clock", () => {
  const every = BOSS_POWERS.seedEverySec * 1000;
  const g = (since: number, base: number, taken: { clock: number; seeds: number } | null = null, fixed: number | null = null) => ({ since, base, fixed, taken });

  it("lands one seed each 30 s of the clock, none at the start and none past the cap", () => {
    expect(lastLanding(g(1000, 5), 1000)).toBeNull();
    expect(lastLanding(g(1000, 5), 1000 + every - 1)).toBeNull();
    expect(lastLanding(g(1000, 5), 1000 + every)).toEqual({ key: "1000:1", at: 1000 + every });
    expect(lastLanding(g(1000, 5), 1000 + every * 3.5)).toEqual({ key: "1000:3", at: 1000 + every * 3 });
    // (Five seeds on the meter, the cap 10: the fifth landing is the last.)
    expect(lastLanding(g(0, 5), every * 40)).toEqual({ key: `0:${BOSS_POWERS.seedMax - 5}`, at: every * (BOSS_POWERS.seedMax - 5) });
    expect(lastLanding(g(0, BOSS_POWERS.seedMax), every * 40)).toBeNull();
  });

  it("lands nothing while a watering is placed or at a set count", () => {
    expect(lastLanding(g(0, 5, { clock: every * 2, seeds: 7 }), every * 3)).toBeNull();
    expect(lastLanding(g(0, 5, null, 8), every * 3)).toBeNull();
  });

  it("tosses only for a landing that came a moment ago: a screen drawn late, a hidden page online and a reload never toss for time they didn't see (no burst)", () => {
    expect(freshLanding(g(0, 5), every + 100)).toEqual({ key: "0:1", at: every });
    expect(freshLanding(g(0, 5), every + SEED_FRESH_MS - 1)).not.toBeNull();
    expect(freshLanding(g(0, 5), every + SEED_FRESH_MS)).toBeNull();
    // Back after five minutes (the server's clock ran on): the latest landing is old, and nothing is tossed for the ten before it.
    expect(freshLanding(g(0, 5), every * 10 + 4000)).toBeNull();
    expect(freshLanding(g(0, 5), every * 2 + 500)?.key).toBe("0:2");
  });

  it("picks the squares of a toss from its key, the same every time and on every device: different ones, in the middle four ranks", () => {
    const a = tossSquares("gardener:1:1:plantMany", 5);
    expect(a).toEqual(tossSquares("gardener:1:1:plantMany", 5));
    expect(new Set(a).size).toBe(5);
    for (const sq of a) expect(sq).toMatch(/^[a-h][3-6]$/);
    expect(tossSquares("gardener:1:1:plantMany", 5)).not.toEqual(tossSquares("gardener:1:1:plant:0:1", 5));
    expect(tossSquares("k", 1)).toHaveLength(1);
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) tossSquares(`k${i}`, 1).forEach((s) => seen.add(s));
    expect(seen.size, "every square of the middle ranks turns up").toBe(32);
  });

  it("plays each toss once on a device: a second screen's watch asks for the same one and is refused", () => {
    expect(hasTossed("t1")).toBe(false);
    expect(addToss({ id: "t1", hand: null, seeds: [{ to: "e4", leaveAt: Date.now() }] })).toBe(true);
    expect(hasTossed("t1")).toBe(true);
    expect(addToss({ id: "t1", hand: null, seeds: [{ to: "e4", leaveAt: Date.now() }] })).toBe(false);
    expect(currentTosses()).toHaveLength(1);
    resetTosses();
    expect(hasTossed("t1")).toBe(false);
    expect(currentTosses()).toHaveLength(0);
  });
});

describe("the garden's clock", () => {
  it("is the server's online (this device's time and the offset the last message gave) and the page's visible time otherwise", () => {
    setGardenSource(() => 5_000_000);
    expect(gardenNow()).toBe(5_000_000);
    expect(realMs(30_000)).toBe(30_000);
    setGardenSource(null);
    const t = gardenNow();
    expect(Number.isFinite(t)).toBe(true);
    expect(gardenNow()).toBeGreaterThanOrEqual(t);
  });
});

describe("his FAQ block", () => {
  it("tells the Seeds and the Watering as they play, and that the seeds he tosses are only for show", () => {
    const def = BOSS_ROSTER.find((b) => b.id === "gardener")!;
    const words = BOSS_BLOCKS.gardener!(BOSS_POWERS, def);
    expect(words).toContain("His seed meter shows how many are waiting and fills toward the next.");
    expect(words).toContain("only for show");
    expect(words).toContain("green, then fall colors, then dropping its leaves");
  });
});

describe("the board art is registered", () => {
  it("has the five sprites in the effects (a seed in the air, a plop, the sweep, a sprout and its outcomes, his jet on a king)", () => {
    expect(EFFECTS.seedFly.ch).toBe(SEED_FLY);
    expect(EFFECTS.seedPlop.ch).toBe(SEED_PLOP);
    expect(EFFECTS.waterSweep.ch).toBe(WATER_SWEEP);
    expect(EFFECTS.gardenPlant.ch).toBe(GARDEN_PLANT);
    expect(EFFECTS.gardenPlant.loop, "a sprout holds its last look: it never loops into a plant").toBeUndefined();
    expect(EFFECTS.waterHit.covers).toBe("square");
    expect(EFFECTS.waterSweep.covers).toBe("board");
  });
});
