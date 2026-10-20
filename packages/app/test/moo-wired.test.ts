import { afterEach, describe, expect, it } from "vitest";
import { BOSS_ROSTER, isPlayable, menuBosses, playableBosses, type PowerEvent } from "@chessroyale/core";
import { KING_ATTACKERS, MOO_BEATS, MOO_FX, POWER_FX, START_FEN } from "@chessroyale/chess";
import { momentsOf, powerLine } from "../src/components/BossPowers.tsx";
import { FADE_MS, MOO_UI, beamPhase, fallAtOf, fullMoonMoment, heldMarks, moonPixels, moonStep, noteMooMoments, scorchItems, waxLevel } from "../src/components/Moo.tsx";
import { ragePct, type Moment } from "../src/components/PowerParts.tsx";
import { MOO, MOO_ATTACK, MOO_CHANCE, MOO_ICONS, MOO_LINES, MOO_POWER_PALETTE, type MooIconId } from "../src/characters/moo.ts";
import { MOONBEAM, MOON_SCORCH, FLURRY_STAGGER_MS } from "../src/characters/effects/moo.ts";
import { MOO_SOUNDS, mooSound } from "../src/characters/moo-sounds.ts";
import { mooPowered, noteCalm, noteSwap, resetMoo } from "../src/characters/moo-state.ts";
import { stanceAt, stanceCycle } from "../src/characters/stance.ts";
import { MOVE_MEAN_DB, MOVE_PEAK } from "../src/characters/synth.ts";
import { SELECT_LINES, SELECT_SOUND, selectLine } from "../src/characters/boss-select.ts";
import { CHARACTERS } from "../src/characters/index.ts";
import { EFFECTS, POWER_MOMENTS, animLength, cueAt } from "../src/characters/power-art.ts";
import { bossKit, poweredKit } from "../src/characters/kits.ts";
import { BOSS_BLOCKS } from "../src/faq/content.ts";
import { POWER_WORDS, powersLine } from "../src/power-words.ts";
import { lineLength, parseLine, plainLine } from "../src/speech-icons.ts";
import type { BossView } from "../src/game.ts";

/**
 * Moo & Moon in the game (Oct 20: live, his art wired in): his kit, lines, sounds, his moments timed by his animations' cues
 * (MOO_BEATS), the stunned mark on the board, his powered-up look during the Full Moon, his hug and sit, the Moon on his meter,
 * and the select screen (docs/decisions/2026-10-20-moo-wired.md). The art's own tests: moo.test.ts; the icon tokens': speech-icons.test.ts.
 */
afterEach(() => resetMoo());

const NAME = "Moo";
const B = MOO_BEATS;
/** A boss view for the moments and the state (the parts they read). */
const view = (events: PowerEvent[], powers: Record<string, unknown> = {}, extra: Record<string, unknown> = {}): BossView =>
  ({ id: "moo", name: NAME, crowdSide: "w", crowdMoves: 4, startMove: 1, lastMove: null, board: { fen: START_FEN, history: [] }, powers: { events, turn: 5, ultAt: null, rage: 0.3, warned: false, ...powers }, ...extra }) as unknown as BossView;

describe("Moo & Moon are live", () => {
  it("are playable: their kit (every moment, their powers' moments, lines, a portrait), their power words, and the character tests cover them", () => {
    const def = BOSS_ROSTER.find((b) => b.id === "moo")!;
    expect(def.kit).toBe(NAME);
    expect(isPlayable(def)).toBe(true);
    expect(playableBosses().map((b) => b.id)).toContain("moo");
    expect(menuBosses({ admin: false, raid: true }).map((b) => b.id)).toContain("moo");
    const kit = bossKit(NAME)!;
    expect(kit.ch).toBe(MOO);
    expect(CHARACTERS).toContain(MOO);
    // (The flurry is the ultimate's payoff, the daze the passive's: each its own animation, which the caster plays.)
    expect(kit.anims).toMatchObject({ strike: "capture", power: "moonbeam", powerHit: "dazed", ultimateWarn: "check", ultimate: "fullMoon", ultimateHit: "flurry" });
    for (const a of Object.values(kit.anims)) expect(MOO.anims[a!], a).toBeTruthy();
    // (A phone's bar: his idle reaches 26 px left of his feet, past the usual box's 24; 68 px tall as Sawyer's and Smudgy's, so not tall.)
    expect(kit.wide).toBe(true);
    expect(kit.tall).toBeUndefined();
    expect(powersLine(def)).toBe(`${POWER_WORDS.moonbeam} · ${POWER_WORDS.fullmoon}`);
    expect(POWER_MOMENTS[NAME]!.power).toMatchObject({ anim: "moonbeam", hit: "beam" });
    expect(POWER_MOMENTS[NAME]!.ultimateHit).toMatchObject({ anim: "flurry", hit: "beam1" });
    expect(KING_ATTACKERS).toContain("moo");
    expect(kit.kingAttack).toMatchObject({ ch: MOO_ATTACK, anim: "kingAttack", poweredAnim: "p_kingAttack", perSquare: 36, stand: 1.8, facesLeft: true });
    expect(BOSS_BLOCKS.moo).toBeTruthy();
  });

  it("has his board effects in the registry: the beam (a column eight squares tall), the burned crescent and the king's small beam", () => {
    expect(EFFECTS.moonbeam).toMatchObject({ ch: MOONBEAM, covers: "strip", start: "fall", loop: "hold", end: "fade" });
    expect(EFFECTS.moonScorch).toMatchObject({ ch: MOON_SCORCH, covers: "square", start: "burn", loop: "hold", end: "fade" });
    expect(EFFECTS.moonHit.start).toBe("hitHL");
  });
});

describe("the director's lines, as written", () => {
  /** How many lines each moment has in lines.md (44 in all, the select screen's three among them). */
  const COUNTS = { entrance: 3, move: 4, capture: 3, hurt: 3, strike: 2, power: 3, wax: 3, thinking: 2, check: 2, smug: 2, rattled: 2, victory: 2, defeat: 2, ultimateWarn: 2, ultimate: 2, flurry: 2, dazed: 2, kingAttack: 3 };

  it("says all 44, by moment, each icon token one of his ten icons, the ellipsis the character the other bosses use", () => {
    expect(Object.fromEntries(Object.entries(MOO_LINES).map(([k, v]) => [k, v!.length]))).toEqual(COUNTS);
    const all = Object.values(MOO_LINES).flat() as string[];
    expect(all).toHaveLength(44);
    for (const line of all) {
      for (const m of line.matchAll(/\{(\w+)\}/g)) expect(Object.keys(MOO_ICONS), line).toContain(m[1]);
      expect(line, "no three dots").not.toContain("...");
      expect(line.trim(), line).toBe(line);
    }
    // (Spot checks of the exact words, with their tokens and their "…".)
    expect(MOO_LINES.entrance).toEqual(["Hi! This is Moo. He's my best friend. (Moo! {heart})", "I watched your farm for ages. Let's play! (Moo? {question})", "Moo, look! Little horses! (Moooo… {sparkle})"]);
    expect(MOO_LINES.dazed).toEqual(["Oh dear. Too much moon. (…moo. {zzz})", "Easy, buddy. Easy. (Moo… {zzz})"]);
    expect(MOO_LINES.kingAttack![1]).toBe("Sorry, King. Moo really wants to win! (Moo!)");
    // (Every one of his ten icons is said somewhere but the milk, the one the director's draft doesn't use.)
    const used = new Set(all.flatMap((l) => parseLine(l).flatMap((s) => (s.icon ? [s.icon] : []))));
    expect([...used].sort()).toEqual(["anger", "cowbell", "grass", "heart", "moon", "pawn", "question", "sparkle", "zzz"] satisfies MooIconId[]);
  });

  it("is, with an icon counted as one character, at most 50 long: five run past the 42 Alfil's and Chub & Chirp's own tests cap their lines at", () => {
    const all = (Object.values(MOO_LINES).flat() as string[]).concat(SELECT_LINES.moo!);
    expect(Math.max(...all.map(lineLength))).toBeLessThanOrEqual(50);
    expect([...new Set(all.filter((l) => lineLength(l) > 42))].sort()).toEqual(
      [
        "Hi! This is Moo. He's my best friend. (Moo! {heart})",
        "I watched your farm for ages. Let's play! (Moo? {question})",
        "I'm getting fuller, Moo… I can feel it! (Mooo…)",
        "Sorry, King. Moo really wants to win! (Moo!)",
        "That's okay, Moo. We have each other. (…moo. {heart})",
      ].sort(),
    );
    // (A screen reader and any plain-text place read them without the icons.)
    expect(plainLine(MOO_LINES.entrance![0]!)).toBe("Hi! This is Moo. He's my best friend. (Moo!)");
    expect(plainLine(MOO_LINES.hurt![2]!)).toBe("(MOO!)");
  });

  it("speaks as Smudgy's do, plus his own: a power always, the wax, the ultimate, the flurry and the daze always", () => {
    for (const beat of ["power", "wax", "ultimate", "flurry", "dazed", "kingAttack", "entrance", "defeat", "victory"] as const) expect(MOO_CHANCE[beat], beat).toBe(1);
    expect(MOO_CHANCE).toMatchObject({ move: 0.12, capture: 0.6, check: 0.75, hurt: 0.6, thinking: 0.08, smug: 0.8, rattled: 0.8, strike: 0.8 });
  });

  it("has the select screen's three lines and his happy moo", () => {
    expect(SELECT_LINES.moo).toEqual(["Hi! This is Moo. He's my best friend. (Moo! {heart})", "I watched your farm for ages. Let's play! (Moo? {question})", "Best friends make the best moves! (Moo! {heart})"]);
    expect(SELECT_SOUND.moo).toBe("mooHappy");
    // (None twice running: the stage's own rule.)
    expect(selectLine("moo", SELECT_LINES.moo![0]!, 0)).not.toBe(SELECT_LINES.moo![0]);
  });

  it("says each power moment's own words: the moonbeam's power lines, the full moon's ultimate lines, the flurry's and the daze's own", () => {
    const kit = bossKit(NAME)!;
    const at = (kind: Moment["kind"], key: string): Pick<Moment, "kind" | "key"> => ({ kind, key });
    for (let i = 0; i < 12; i++) {
      expect(MOO_LINES.power).toContain(powerLine(kit, at("moonbeam", `k${i}`)));
      expect(MOO_LINES.ultimate).toContain(powerLine(kit, at("fullMoon", `k${i}`)));
      expect(MOO_LINES.flurry).toContain(powerLine(kit, at("flurry", `k${i}`)));
      expect(MOO_LINES.dazed).toContain(powerLine(kit, at("dazed", `k${i}`)));
      expect(MOO_LINES.ultimateWarn).toContain(powerLine(kit, at("warn", `k${i}`)));
    }
  });
});

describe("his sounds", () => {
  it("each stay under a piece's move, in peak and in loudness (the #271 rule), and are all finite", () => {
    for (const name of MOO_SOUNDS) {
      const s = mooSound(name, 44100);
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

  it("moos four ways: a soft one, a happy one, a big one and a sleepy one, the big one the longest and lowest", () => {
    const len = (n: "mooSoft" | "mooHappy" | "mooBig" | "mooSleepy") => mooSound(n, 44100).length / 44100;
    expect(len("mooBig")).toBeGreaterThan(len("mooHappy"));
    expect(len("mooBig")).toBeGreaterThan(len("mooSleepy"));
    expect(len("mooSoft")).toBeLessThan(len("mooHappy"));
  });

  it("wires every cue of his animations to one of his sounds, the beam's cues each to their own: the flurry's five zaps, the aura's fizz, the moon's hum and swell", () => {
    const kit = bossKit(NAME)!;
    for (const ch of [MOO, MOO_ATTACK]) for (const [anim, a] of Object.entries(ch.anims)) for (const f of a.frames) if (f.cue) expect(kit.sounds[f.cue], `${anim} ${f.cue}`).toMatch(/^moo[A-Z]/);
    expect(kit.sounds).toMatchObject({ beam: "mooBeam", hum: "mooHum", swell: "mooSwell", fizz: "mooFizz", swap: "mooFlare", mooBig: "mooBig", mooSoft: "mooSoft", mooSleepy: "mooSleepy", moo: "mooHappy" });
    for (const c of ["beam1", "beam2", "beam3", "beam4", "beam5"]) expect(kit.sounds[c]).toBe("mooZap");
    // (The moonbeam's whoosh is his `beam` cue's alone: the board's own beam plays only its shimmer, and the flurry's five are quiet.)
    expect(EFFECTS.moonbeam.sounds).toMatchObject({ hit: "mooShimmer" });
  });
});

describe("his moments are timed by his animations", () => {
  it("lasts the longest of the animation and the board's beam, its cues where the rules put them (MOO_BEATS, so the server waits the same)", () => {
    const fall = animLength(MOONBEAM.anims.fall!);
    const hit = animLength(MOONBEAM.anims.hit!);
    expect([B.moonbeam.fallMs, B.moonbeam.hitMs]).toEqual([fall, hit]);
    expect(B.flurry.stagger).toBe(FLURRY_STAGGER_MS);
    // The moonbeam: the beam falls at his `beam` cue; the moment is his animation, which outlasts the beam's hit.
    expect(cueAt(MOO.anims.moonbeam!, "beam")).toBe(B.moonbeam.beamAt);
    expect(B.moonbeam.total).toBe(animLength(MOO.anims.moonbeam!));
    expect(B.moonbeam.total).toBeGreaterThanOrEqual(B.moonbeam.beamAt + fall + hit);
    // The flurry: five beams from `beam1`, 120 ms apart; the last hits before the animation ends.
    expect(cueAt(MOO.anims.flurry!, "beam1")).toBe(B.flurry.beamAt);
    expect(B.flurry.total).toBe(animLength(MOO.anims.flurry!));
    expect(B.flurry.total).toBeGreaterThanOrEqual(B.flurry.beamAt + 4 * B.flurry.stagger + fall + hit);
    for (let i = 0; i < 5; i++) expect(cueAt(MOO.anims.flurry!, `beam${i + 1}`)).toBe(B.flurry.beamAt + i * B.flurry.stagger);
    expect(cueAt(MOO.anims.fullMoon!, "swap")).toBe(B.fullMoon.swapAt);
    expect(B.fullMoon.total).toBe(animLength(MOO.anims.fullMoon!));
    expect(cueAt(MOO.anims.dazed!, "calm")).toBe(B.dazed.calmAt);
    expect(B.dazed.total).toBe(animLength(MOO.anims.dazed!));
    expect(MOO_FX).toEqual({ moonbeam: B.moonbeam.total, flurry: B.flurry.total, fullMoon: B.fullMoon.total, dazed: B.dazed.total });
    expect(POWER_FX).toMatchObject(MOO_FX);
  });

  it("plays the Moonbeam and the flurry as the crowd's turn begins, the daze after them, each its length, none with a banner; the Full Moon only while he thinks", () => {
    const boss = view([
      { kind: "dazed", turn: 5 },
      { kind: "moonbeam", turn: 5, square: "g2" },
    ]);
    const list = momentsOf(boss, 20_000);
    expect(list.map((m) => m.kind)).toEqual(["moonbeam", "dazed"]);
    expect(list.map((m) => m.ms)).toEqual([B.moonbeam.total, B.dazed.total]);
    expect(list[1]!.at + list[1]!.ms).toBe(20_000);
    expect(momentsOf(view([{ kind: "flurry", turn: 5, squares: ["a2", "b2"] }]), 9000).map((m) => [m.kind, m.ms])).toEqual([["flurry", B.flurry.total]]);
    // (His moments name no banner: the views hold only his caster.)
    expect(MOO_UI.ultimate).toEqual({ name: "Full Moon", when: "After your move" });
    // The Full Moon is a moment of his thinking screen, from when this device first saw it, its swap and no more noted.
    const thinking = view([{ kind: "fullMoon", turn: 5 }], { ultAt: 4, fullMoon: { left: 5 } });
    const [m] = fullMoonMoment(thinking, 7000);
    expect(m).toMatchObject({ kind: "fullMoon", at: 7000, ms: B.fullMoon.total });
    // (A screen drawn again carries on: the same start.)
    expect(fullMoonMoment(thinking, 9000)[0]!.at).toBe(7000);
    expect(fullMoonMoment(view([]), 7000)).toEqual([]);
  });
});

describe("the stunned mark on the board", () => {
  it("follows each beam through its fall, hit and hold, and fades from when the crowd's move lands", () => {
    const t = 1_000_000;
    expect(beamPhase(t - 1, t)).toBe("wait");
    expect(beamPhase(t, t)).toBe("fall");
    expect(beamPhase(t + B.moonbeam.fallMs, t)).toBe("hit");
    expect(beamPhase(t + B.moonbeam.fallMs + B.moonbeam.hitMs, t)).toBe("hold");
    expect(beamPhase(t + 60_000, t)).toBe("hold");
    expect(beamPhase(t + 5000, t, t + 4000)).toBe("fade");
    // A beam with no moment on this screen (the crowd's turn) has long since fallen.
    expect(beamPhase(t, 0)).toBe("hold");
  });

  it("drops the flurry's five beams 120 ms apart from the moon's `beam1`, a single beam at his `beam`", () => {
    const flurry = { kind: "flurry" as const, at: 5000 };
    expect([0, 1, 2, 3, 4].map((i) => fallAtOf(flurry, i))).toEqual([0, 1, 2, 3, 4].map((i) => 5000 + B.flurry.beamAt + 120 * i));
    expect(fallAtOf({ kind: "moonbeam", at: 5000 }, 0)).toBe(5000 + B.moonbeam.beamAt);
    expect(fallAtOf(null, 3)).toBe(0);
  });

  it("burns a crescent into each square as its beam hits, under the piece, holds it, and fades it", () => {
    const flurry = { kind: "flurry" as const, at: 10_000 };
    const squares = ["a2", "b2", "c2"];
    // Before the first beam has hit: none.
    expect(scorchItems(squares, flurry, 0, 10_000 + B.flurry.beamAt)).toEqual([]);
    // The first has hit, the others not yet.
    const first = 10_000 + B.flurry.beamAt + B.moonbeam.fallMs;
    expect(scorchItems(squares, flurry, 0, first + 10).map((i) => i.square)).toEqual(["a2"]);
    // All hit: each burns from its own hit.
    const all = scorchItems(squares, flurry, 0, first + 600);
    expect(all.map((i) => [i.square, i.anim, i.since])).toEqual(squares.map((s, i) => [s, "burn", first + i * 120]));
    // Holding on the crowd's turn (no moment), then fading as the stun ends.
    const now = 1_700_000_000_000;
    expect(scorchItems(squares, null, 0, now).map((i) => i.anim)).toEqual(["burn", "burn", "burn"]);
    expect(scorchItems(squares, null, now - 10, now).map((i) => [i.anim, i.since])).toEqual([["fade", now - 10], ["fade", now - 10], ["fade", now - 10]]);
  });

  it("keeps the squares through the crowd's turn and fades them once the move lands, for the fade's length and no more", () => {
    const boss = { id: "moo", startMove: 3 };
    expect(heldMarks(boss, ["g2"], 100)).toEqual({ squares: ["g2"], fadeAt: 0 });
    // (The crowd moved: the view holds nothing now.)
    expect(heldMarks(boss, [], 5000)).toEqual({ squares: ["g2"], fadeAt: 5000 });
    expect(heldMarks(boss, [], 5000 + FADE_MS - 1).fadeAt).toBe(5000);
    expect(heldMarks(boss, [], 5000 + FADE_MS)).toEqual({ squares: [], fadeAt: 0 });
    expect(FADE_MS).toBeGreaterThanOrEqual(animLength(MOONBEAM.anims.fade!));
    expect(FADE_MS).toBeGreaterThanOrEqual(animLength(MOON_SCORCH.anims.fade!));
    // A new battle holds nothing of the last one's.
    expect(heldMarks(boss, ["h3"], 9000).squares).toEqual(["h3"]);
    expect(heldMarks({ id: "moo", startMove: 4 }, [], 9500).squares).toEqual([]);
  });

  it("draws the layer only for held squares, with the glow over the pieces and the scorch under them (one canvas)", () => {
    const boss = view([], { stunned: [] });
    const now = 1_700_000_000_000;
    const layer = MOO_UI.board({ boss, p: boss.powers!, board: START_FEN, orientation: "white", turn: 0, moments: [], now, appearAt: () => 0 });
    expect(layer.over).toBeNull();
    const held = view([], { stunned: ["c2", "a2"] });
    const l2 = MOO_UI.board({ boss: held, p: held.powers!, board: START_FEN, orientation: "white", turn: 0, moments: [], now, appearAt: () => 0 });
    expect(l2.over).toBeTruthy();
    expect(l2.under).toBeTruthy();
  });
});

describe("powered up for the Full Moon", () => {
  const full = (left: number, extra: Record<string, unknown> = {}) => view([], { ultAt: 4, fullMoon: { left }, ...extra });

  it("is powered from the start of the transformation's swap while it lasts, and not before it: every screen the same", () => {
    const boss = full(5);
    // (A device that never saw the transformation: powered at once.)
    expect(mooPowered(boss, 1000, "crowd")).toBe(true);
    noteSwap(boss, 5000);
    expect(mooPowered(boss, 4999, "thinking")).toBe(false);
    expect(mooPowered(boss, 5000, "thinking")).toBe(true);
    expect(mooPowered(full(1), 9000, "bossMove")).toBe(true);
    // Another battle, or another boss, is never powered.
    expect(mooPowered({ ...boss, id: "smudgy" } as BossView, 9000, "crowd")).toBe(false);
    expect(mooPowered(view([]), 9000, "crowd")).toBe(false);
  });

  it("stays powered through his last powered move and the daze's start, and goes back at its `calm`, only on his own screen", () => {
    const dazed = view([{ kind: "dazed", turn: 5 }], { turn: 5, fullMoon: null });
    // His last move's animation: before the daze's moment has even begun.
    expect(mooPowered(dazed, 1000, "bossMove")).toBe(true);
    // The daze plays: the colors go back at its calm.
    const moments = momentsOf(dazed, 30_000);
    noteMooMoments(dazed, moments);
    const calm = moments[0]!.at + B.dazed.calmAt;
    expect(mooPowered(dazed, calm - 1, "bossMove")).toBe(true);
    expect(mooPowered(dazed, calm, "bossMove")).toBe(false);
    // The crowd's turn after it: himself again, however the screen came by it (a reload shows no daze).
    expect(mooPowered(dazed, 1000, "crowd")).toBe(false);
    noteCalm(dazed, 0);
  });

  it("makes every animation of his its powered twin while powered, and his idle powerIdle; the twins keep their cues and lengths", () => {
    const kit = bossKit(NAME)!;
    const lit = poweredKit(kit);
    expect(poweredKit(kit)).toBe(lit);
    expect(lit.loops).toMatchObject({ idle: "powerIdle", thinking: "p_thinking", smug: "p_smug", rattled: "p_rattled", defeat: "p_defeat", victory: "p_victory" });
    expect(lit.anims).toMatchObject({ move: "p_move", capture: "p_capture", hurt: "p_hurt", check: "p_check", strike: "p_capture", power: "p_moonbeam", ultimateWarn: "p_check" });
    // (Already powered, or never drawn so: the transformation, the flurry, the daze and the entrance.)
    expect(lit.anims.ultimate).toBe("fullMoon");
    expect(lit.anims.ultimateHit).toBe("flurry");
    expect(lit.anims.powerHit).toBe("dazed");
    expect(lit.anims.entrance).toBe("entrance");
    for (const name of ["thinking", "move", "capture", "hurt", "check", "smug", "rattled", "defeat", "victory", "moonbeam"]) {
      const a = MOO.anims[name]!;
      const p = MOO.anims[`p_${name}`]!;
      expect(p.loop, name).toBe(a.loop);
      expect(p.frames.map((f) => [f.ms, f.cue]), name).toEqual(a.frames.map((f) => [f.ms, f.cue]));
      // Powered up: the power palette's colors (the dark-gold outline) on its frames, never on the normal one's.
      expect(p.frames.some((f) => f.pal?.k === MOO_POWER_PALETTE.k), name).toBe(true);
      expect(a.frames.some((f) => f.pal?.k === MOO_POWER_PALETTE.k), name).toBe(false);
    }
    expect(MOO_ATTACK.anims.p_kingAttack!.frames.map((f) => [f.ms, f.cue])).toEqual(MOO_ATTACK.anims.kingAttack!.frames.map((f) => [f.ms, f.cue]));
  });
});

describe("hugging the moon and sitting on it", () => {
  it("rests in his idle, now and then lets go and sits (toSit, sit, toHug), then hugs again, on a schedule from when he settled", () => {
    const st = bossKit(NAME)!.rest!;
    expect(st).toEqual({ hugMs: 7000, sitMs: 5000, toSit: "toSit", sit: "sit", toHug: "toHug" });
    const down = animLength(MOO.anims.toSit!);
    const up = animLength(MOO.anims.toHug!);
    expect(stanceCycle(MOO, st)).toBe(7000 + down + 5000 + up);
    // Hugging: his idle goes on (null: nothing overrides it).
    expect(stanceAt(MOO, st, -50)).toBeNull();
    expect(stanceAt(MOO, st, 6999)).toBeNull();
    // The switch down, with its slip and plop cues in order, then the sit, then the switch back, then round again.
    expect(stanceAt(MOO, st, 7000)).toMatchObject({ anim: "toSit", frame: 0 });
    const last = stanceAt(MOO, st, 7000 + down - 1)!;
    expect([last.anim, last.frame]).toEqual(["toSit", MOO.anims.toSit!.frames.length - 1]);
    expect(stanceAt(MOO, st, 7000 + down)!.anim).toBe("sit");
    expect(stanceAt(MOO, st, 7000 + down + 4999)!.anim).toBe("sit");
    expect(stanceAt(MOO, st, 7000 + down + 5000)).toMatchObject({ anim: "toHug", frame: 0 });
    expect(stanceAt(MOO, st, stanceCycle(MOO, st) - 1)!.anim).toBe("toHug");
    expect(stanceAt(MOO, st, stanceCycle(MOO, st) + 100)).toBeNull();
    expect(stanceAt(MOO, st, stanceCycle(MOO, st) + 7000)!.anim).toBe("toSit");
    // Each pass's switch has its own tag (its sounds play once a pass), a sit's frame shares one (it has none).
    expect(stanceAt(MOO, st, 7000)!.tag).not.toBe(stanceAt(MOO, st, stanceCycle(MOO, st) + 7000)!.tag);
    expect(cueAt(MOO.anims.toSit!, "slip")).toBeLessThan(cueAt(MOO.anims.toSit!, "plop")!);
  });
});

describe("the Moon on his meter", () => {
  it("shows the rage meter's own number as the moon from new to full in eight steps, and speaks at a quarter, a half and three quarters", () => {
    expect([0, 6, 7, 12, 50, 99, 100].map(moonStep)).toEqual([0, 0, 1, 1, 4, 8, 8]);
    expect([0, 24, 25, 49, 50, 74, 75, 99, 100].map(waxLevel)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 0]);
    expect(MOO_LINES.wax).toHaveLength(3);
    // The meter's number: full once warned or on its turn, empty and held while the ultimate runs, none once the battle is over.
    expect(ragePct(view([], { rage: 0.42 }))).toBe(42);
    expect(ragePct(view([], { rage: 0.42, warned: true }))).toBe(100);
    expect(ragePct(view([], { rage: 0, ultAt: 4, paused: true }))).toBe(0);
    expect(ragePct(view([], { rage: null }))).toBeNull();
    expect(ragePct({ ...view([]), result: "boss" } as BossView)).toBeNull();
  });

  it("draws a 12 x 12 disc: new, none of it lit; full, all of it; half, its right half; each step lights more", () => {
    const lit = (step: number) => moonPixels(step).flat().filter((v) => v === true).length;
    const disc = moonPixels(0).flat().filter((v) => v !== null).length;
    expect(disc).toBeGreaterThan(90);
    expect(lit(0)).toBe(0);
    expect(lit(8)).toBe(disc);
    for (let s = 1; s <= 8; s++) expect(lit(s), `step ${s}`).toBeGreaterThan(lit(s - 1));
    const half = moonPixels(4);
    // (Lit on the right as it waxes: nothing lit left of the middle, the right edge lit.)
    for (const row of half) for (let x = 0; x < 6; x++) expect(row[x] === true, "left of the middle").toBe(false);
    expect(half.map((r) => r[10]).filter((v) => v === true).length).toBeGreaterThan(3);
  });
});
