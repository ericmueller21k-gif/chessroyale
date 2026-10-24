import { describe, expect, it } from "vitest";
import { BOSS_POWERS, BOSS_ROSTER, HOPPER_NAME, SPEECH, isPlayable, playableBosses, type PowerEvent } from "@chessroyale/core";
import { HOPPER_BEATS, HOPPER_FX, KING_ATTACK, bannerLeadMs, KING_ATTACKERS, POWER_FX, START_FEN, bossShowMs, bossTurnShowMs, mateAttackDue, pieceAt, withPiece } from "@chessroyale/chess";
import { mateMomentsOf, momentsOf, noMoveLine, powerLine, momentLineAt, momentPriority } from "../src/components/BossPowers.tsx";
import { Voice, holdMs, typeMs } from "../src/speech.tsx";
import { CAST_LINE, HOPPER_UI, PRIZE_DROP, carrotItems, hopperFen, raceWon, yourPulls } from "../src/components/Hopper.tsx";
import { HOPPER, HOPPER_LINES } from "../src/characters/hopper.ts";
import { HOPPER_SOUNDS, hopperSound } from "../src/characters/hopper-sounds.ts";
import { MOVE_MEAN_DB, MOVE_PEAK } from "../src/characters/synth.ts";
import { SELECT_LINES, SELECT_SOUND } from "../src/characters/boss-select.ts";
import { CHARACTERS } from "../src/characters/index.ts";
import { EFFECTS, POWER_MOMENTS, animLength, cueAt } from "../src/characters/power-art.ts";
import { frameKeys } from "../src/characters/sprite.ts";
import { bossKit } from "../src/characters/kits.ts";
import { BOSS_BLOCKS } from "../src/faq/content.ts";
import { POWER_WORDS, powersLine } from "../src/power-words.ts";
import type { BossView } from "../src/game.ts";
import type { Moment } from "../src/components/PowerParts.tsx";

/**
 * Chub & Chirp in the game (Oct 18: live, their art wired in): their kit, sounds and lines, their moments timed by their
 * animations' cues (HOPPER_BEATS), the board under them, the carrots on the board and the select screen
 * (docs/decisions/2026-10-18-hopper-wired.md). The reel's own tests: carrot-race.test.ts; the art's: hopper-art.test.ts.
 */
const view = (events: PowerEvent[], powers: Record<string, unknown> = {}, crowdMoves = 4, fen = START_FEN, extra: Record<string, unknown> = {}): BossView =>
  ({ id: "hopper", name: HOPPER_NAME, crowdSide: "w", crowdMoves, startMove: 1, lastMove: null, board: { fen, history: [] }, powers: { events, turn: 4, ...powers }, ...extra }) as unknown as BossView;
const A = HOPPER.anims;
const B = HOPPER_BEATS;
const carrots = (patch: Record<string, unknown> = {}) => ({ at: 4, squares: ["a5", "c3", "h5", "e6", "g2"], by: [null, null, null, null, null], crowd: 0, boss: 0, crowdLeft: 12, bossLeft: 12, over: null, tier: 0, spin: null, ...patch });

describe("Chub & Chirp are live", () => {
  it("are playable: their kit (every moment, their powers' moments, lines, a portrait), their power words, and the character tests cover them", () => {
    const def = BOSS_ROSTER.find((b) => b.id === "hopper")!;
    expect(def.name).toBe("Chub & Chirp");
    expect(isPlayable(def)).toBe(true);
    expect(playableBosses().map((b) => b.id)).toContain("hopper");
    const kit = bossKit(def.name)!;
    expect(kit.ch).toBe(HOPPER);
    expect(CHARACTERS).toContain(HOPPER);
    expect(kit.anims).toMatchObject({ power: "leapfrog", ultimate: "carrotPatch", ultimateWarn: "check", ultimateHit: "raceWon" });
    for (const a of Object.values(kit.anims)) expect(HOPPER.anims[a!], a).toBeTruthy();
    // (The phone bar's wider box: in the usual one his scarf and wing tip reach his name.)
    expect(kit.wide).toBe(true);
    expect(powersLine(def)).toBe(`${POWER_WORDS.leapfrog} · ${POWER_WORDS.carrotpatch}`);
    expect(POWER_MOMENTS[HOPPER_NAME]!.power.anim).toBe("leapfrog");
    expect(KING_ATTACKERS).toContain("hopper");
    expect(kit.kingAttack).toMatchObject({ anim: "kingAttack", perSquare: 36, stand: 1.8, facesLeft: true });
  });

  it("say every line of the draft (CHC-*), as written, each at most 42 characters", () => {
    const all = Object.values(HOPPER_LINES).flat();
    const select = SELECT_LINES.hopper!;
    expect(all.length + select.length).toBe(60);
    for (const l of [...all, ...select]) expect(l.length, l).toBeLessThanOrEqual(42);
    expect(HOPPER_LINES.power).toContain("Leapfrog!");
    expect(HOPPER_LINES.ultimate).toContain("Carrot Patch! Race you!");
    expect(HOPPER_LINES.carrotHis).toHaveLength(4);
    expect(HOPPER_LINES.carrotYours).toHaveLength(4);
    expect(HOPPER_LINES.spinBig).toHaveLength(2);
    expect(HOPPER_LINES.spinSmall).toHaveLength(2);
    expect(HOPPER_LINES.spinEmpty).toHaveLength(3);
    expect(HOPPER_LINES.carrotsAll).toHaveLength(2);
    expect(HOPPER_LINES.kingAttack).toHaveLength(3);
  });

  it("have a sound of their own for every cue but none of a piece's, each quieter than a move and the same every time", () => {
    const kit = bossKit(HOPPER_NAME)!;
    for (const [name, a] of Object.entries(HOPPER.anims)) for (const f of a.frames) if (f.cue) expect(kit.sounds[f.cue], `${name}: ${f.cue}`).toMatch(/^hopper/);
    // (The planting's thunk is the cast's own cue: the board's planting is quiet, carrotItems.)
    expect(EFFECTS.carrotPatch.sounds).toEqual({ thunk: "hopperThunk", pop: "hopperPop" });
    expect(kit.sounds).toMatchObject({ plant1: "hopperThunk", toss1: "hopperToss", takeoff: "hopperHop", land: "hopperLand", bonk: "hopperBonk", chirp: "hopperChirp" });
    for (const name of HOPPER_SOUNDS) {
      const s = hopperSound(name, 44100);
      let peak = 0;
      let sum = 0;
      for (const v of s) {
        expect(Number.isFinite(v)).toBe(true);
        peak = Math.max(peak, Math.abs(v));
        sum += v * v;
      }
      expect(peak, name).toBeLessThan(MOVE_PEAK / 2);
      expect(10 * Math.log10(sum / s.length), name).toBeLessThan(MOVE_MEAN_DB - 2);
      expect(s, `${name} is the same every time`).toEqual(hopperSound(name, 44100));
    }
    expect([...HOPPER_SOUNDS].sort()).toEqual(["bonk", "cheer", "chirp", "flop", "hop", "land", "oof", "pop", "sigh", "squeak", "stop", "thump", "thunk", "tick", "toss"]);
  });

  it("on the select screen: Chirp's chirp, their draft's select lines, and full size on the stage (70 px tall or less)", () => {
    expect(SELECT_SOUND.hopper).toBe("hopperChirp");
    expect(SELECT_LINES.hopper).toEqual(["Chub and Chirp! Best friends!", "He's Chirp. I'm Chub. We hop.", "Got any carrots?"]);
    const rows = frameKeys(HOPPER, A.idle!.frames[0]!);
    const top = rows.findIndex((r) => r.some((k) => k !== null));
    // (The stage draws every boss at 0.8 a pixel up to 56 / 0.8 = 70 px tall: BossSelect.tsx.)
    expect(HOPPER.foot[1] - top).toBeLessThanOrEqual(70);
  });

  it("have their FAQ block: Leapfrog's rule and the Carrot Patch's ladder with the odds for each count, from the settings", () => {
    const def = BOSS_ROSTER.find((b) => b.id === "hopper")!;
    const text = BOSS_BLOCKS.hopper!(BOSS_POWERS, def);
    expect(text).toContain("**Leapfrog** (passive)");
    expect(text).toContain(`At most ${BOSS_POWERS.hopMax} hops a battle`);
    expect(text).toContain("**Carrot Patch** (ultimate, **once a battle**)");
    expect(text).toContain("| 1 | a pawn 60%, two pawns 40% | 1.4 |");
    expect(text).toContain("| 3 | a knight 25%, a bishop 25%, a rook 30%, a queen 15%, a queen and a rook 5% | 5.05 |");
    expect(text).toContain("| 4 | two queens, every time | 18 |");
    expect(text).toContain("| 5 | they win the battle on the spot |");
    // (Changed in the settings, changed in the FAQ.)
    expect(BOSS_BLOCKS.hopper!({ ...BOSS_POWERS, carrotMoves: 9 }, def)).toContain("Each side has 9 moves");
  });
});

describe("their moments, timed by their animations' cues", () => {
  it("the moments' lengths are the beats' (the server waits for them)", () => {
    expect(HOPPER_FX).toEqual({ hop: B.hop.total, carrots: B.carrots.total, carrot: B.carrot.total, carrotSpin: B.carrotSpin.total, carrotWin: B.carrotWin.total });
    for (const k of ["hop", "carrots", "carrot", "carrotSpin", "carrotWin"] as const) expect(POWER_FX[k]).toBe(HOPPER_FX[k]);
  });

  it("Leapfrog: the banner's end is his `takeoff` (the pawn leaves its square), his `land` the pawn's landing; his hop inside the moment", () => {
    const start = B.hop.liftAt - cueAt(A.leapfrog!, "takeoff")!;
    expect(start).toBeGreaterThanOrEqual(0);
    expect(start + cueAt(A.leapfrog!, "land")!).toBe(B.hop.landAt);
    expect(start + animLength(A.leapfrog!)).toBeLessThanOrEqual(B.hop.total);
    expect(B.hop.overAt).toBe((B.hop.liftAt + B.hop.landAt) / 2);
    expect(B.hop.total).toBe(1600);
  });

  it("the cast: each carrot leaves his paw on its `toss<n>` and lands on its `plant<n>`; the ladder after it, for 2.5 s", () => {
    for (let i = 0; i < 5; i++) {
      expect(B.carrots.tosses[i]! - B.carrots.castAt, `toss${i + 1}`).toBe(cueAt(A.carrotPatch!, `toss${i + 1}`));
      expect(cueAt(A.carrotPatch!, `plant${i + 1}`)! - cueAt(A.carrotPatch!, `toss${i + 1}`)!).toBe(B.carrots.flightMs);
    }
    expect(B.carrots.ladderAt).toBeGreaterThanOrEqual(B.carrots.castAt + animLength(A.carrotPatch!));
    expect(B.carrots.total - B.carrots.ladderAt).toBe(2500);
  });

  it("a pull: the pop at once, the token in its corner from the pull's second frame, all inside the moment", () => {
    const pull = EFFECTS.carrotPatch.ch.anims.pullW!;
    expect(pull.frames[0]!.cue).toBe("pop");
    expect(pull.frames[0]!.layers.some((l) => l.part.startsWith("token"))).toBe(false);
    expect(pull.frames[1]!.layers.some((l) => l.part.startsWith("token"))).toBe(true);
    expect(B.carrot.tokenAt).toBe(pull.frames[0]!.ms);
    expect(animLength(pull)).toBeLessThanOrEqual(B.carrot.total);
  });

  it("the spin: the race won or lost, then the reel for 3 s, then the prize dropping, all inside the moment", () => {
    expect(B.carrotSpin.reelAt).toBeGreaterThanOrEqual(Math.max(animLength(A.raceWon!), animLength(A.raceLost!)));
    expect(B.carrotSpin.stopAt - B.carrotSpin.reelAt).toBe(3000);
    expect(B.carrotSpin.prizeAt).toBeGreaterThanOrEqual(B.carrotSpin.stopAt);
    // (Two pieces at most: two queens, or the queen and the rook.)
    expect(B.carrotSpin.prizeAt + PRIZE_DROP.stagger + PRIZE_DROP.fallMs).toBeLessThanOrEqual(B.carrotSpin.total);
    expect(B.carrotWin.cheerAt).toBeGreaterThanOrEqual(cueAt(A.raceWon!, "cheer")!);
  });

  it("the race won on 3 or more carrots, lost on 0 or 1; on 2, won when he pulled at least as many as you", () => {
    expect([0, 1, 2, 3, 4].map((t) => raceWon(t, 1))).toEqual([false, false, true, true, true]);
    expect(raceWon(2, 2)).toBe(true);
    expect(raceWon(2, 3)).toBe(false);
  });
});

describe("their moments on screen", () => {
  it("the hop plays on a screen of its own, before his move, for its full time, with Leapfrog's line as it begins", () => {
    const hop = { at: 4, from: "e5", over: "e4", to: "e3" };
    const list = momentsOf(view([{ kind: "hop", turn: 4, square: "e3", squares: ["e5", "e4", "e3"] }], { hop }), 10_000);
    expect(list.map((m) => [m.kind, m.ms, m.square, m.squares])).toEqual([["hop", POWER_FX.hop, "e3", ["e5", "e4", "e3"]]]);
    expect(list[0]!.at).toBe(10_000 - POWER_FX.hop);
    // (After his move, a new turn's events: no hop there, so it doesn't play again.)
    expect(momentsOf(view([], { hop }, 5), 10_000)).toEqual([]);
    expect(HOPPER_LINES.power).toContain(powerLine(bossKit(HOPPER_NAME), list[0]!));
    expect(momentLineAt(list[0]!)).toBe(0);
  });

  it("the Carrot Patch's moments come as a crowd turn begins, each for its full time, each with its own line", () => {
    const c = carrots();
    const kit = bossKit(HOPPER_NAME);
    const cast = momentsOf(view([{ kind: "carrots", turn: 5, squares: c.squares }], { carrots: c }, 4), 10_000);
    expect(cast.map((m) => [m.kind, m.ms, m.squares])).toEqual([["carrots", POWER_FX.carrots, c.squares]]);
    expect(HOPPER_LINES.ultimate).toContain(powerLine(kit, cast[0]!));
    const spin = { kind: "carrotSpin" as const, turn: 9, tier: 3, prize: ["r"], squares: ["d8"] };
    const list = momentsOf(view([{ kind: "carrot", turn: 9, square: "e6", by: "boss" }, spin, { kind: "carrotWin", turn: 9, square: "e6" }], { carrots: c }, 8), 20_000);
    expect(list.map((m) => [m.kind, m.ms])).toEqual([
      ["carrot", POWER_FX.carrot],
      ["carrotSpin", POWER_FX.carrotSpin],
      ["carrotWin", POWER_FX.carrotWin],
    ]);
    expect(list.at(-1)!.at + list.at(-1)!.ms).toBe(20_000);
    expect(HOPPER_LINES.carrotHis).toContain(powerLine(kit, list[0]!));
    expect(HOPPER_LINES.spinBig).toContain(powerLine(kit, list[1]!));
    expect(momentLineAt(list[1]!)).toBe(B.carrotSpin.reelAt);
    // (As the reel starts, the spin's line is said, and cuts the pull's said just before it short, once the pull's has typed
    // out and been readable for SPEECH.minReadMs: Oct 24.)
    const voice = new Voice();
    const sayAt = (m: Moment) => voice.say(powerLine(kit, m), m.key, momentPriority(m), m.at + momentLineAt(m));
    sayAt(list[0]!);
    const reel = list[1]!.at + B.carrotSpin.reelAt;
    expect(voice.line(list[0]!.at + 1)?.text).toBe(powerLine(kit, list[0]!));
    expect(voice.line(reel - 1)?.text).toBe(powerLine(kit, list[0]!));
    expect(holdMs(powerLine(kit, list[0]!)!)).toBeGreaterThan(reel - list[0]!.at);
    sayAt(list[1]!);
    const firm = list[0]!.at + typeMs(powerLine(kit, list[0]!)!) + SPEECH.minReadMs;
    expect(voice.line(Math.max(reel, firm) - 1)?.text).toBe(powerLine(kit, list[0]!));
    expect(voice.line(Math.max(reel, firm))?.text).toBe(powerLine(kit, list[1]!));
    expect(HOPPER_LINES.carrotsAll).toContain(powerLine(kit, list[2]!));
    expect(HOPPER_LINES.spinSmall).toContain(powerLine(kit, { ...list[1]!, tier: 2 }));
    expect(HOPPER_LINES.spinEmpty).toContain(powerLine(kit, { ...list[1]!, tier: 0 }));
    expect(HOPPER_LINES.carrotYours).toContain(powerLine(kit, { ...list[0]!, by: "crowd" }));
    // (A carrot each side pulled in one turn: two moments, two keys.)
    const two = momentsOf(view([{ kind: "carrot", turn: 9, square: "e6", by: "crowd" }, { kind: "carrot", turn: 9, square: "a5", by: "boss" }], { carrots: c }, 8), 20_000);
    expect(new Set(two.map((m) => m.key)).size).toBe(2);
  });

  it("his fifth carrot that also mates: the pull and his win play first, then his attack on your king, then the result", () => {
    // (Your king on h1, his queen on h3 and king on f2: mated.)
    const mated = "8/8/8/8/8/7q/5k2/7K w - - 1 61";
    const fifth: PowerEvent[] = [
      { kind: "carrot", turn: 9, square: "h3", by: "boss" },
      { kind: "carrotWin", turn: 9, square: "h3" },
    ];
    const v = { ...view(fifth, { carrots: carrots() }, 8, mated), lastMove: { from: "d3", to: "h3" } } as unknown as BossView;
    expect(mateAttackDue(v)).toBe(true);
    const until = 50_000;
    const shownAt = until - bossTurnShowMs(v, true);
    const list = mateMomentsOf(v, until);
    expect(list.map((m) => m.kind)).toEqual(["carrot", "carrotWin"]);
    // After his move has shown, one after another, ending as the attack's hold begins; the attack from mateAt into it.
    expect(list[0]!.at).toBe(shownAt + bossShowMs(v.lastMove, true));
    // (FIVE CARROTS!: its banner up for its moment's hold first, `lead`, Oct 24.)
    expect(list[1]!.at - (list[1]!.lead ?? 0)).toBe(list[0]!.at + list[0]!.ms);
    expect(list[1]!.lead).toBe(bannerLeadMs("carrotWin"));
    expect(list[1]!.at + list[1]!.ms).toBe(until - KING_ATTACK.mateHoldMs);
    expect(until - KING_ATTACK.mateHoldMs + KING_ATTACK.mateAt).toBeGreaterThan(list[1]!.at + list[1]!.ms);
    // (Any other mate: no moments, the attack alone.)
    expect(mateMomentsOf(view([{ kind: "carrot", turn: 9, square: "h3", by: "boss" }], { carrots: carrots() }, 8, mated), until)).toEqual([]);
    expect(mateMomentsOf(view([], {}, 8, mated), until)).toEqual([]);
  });

  it("the dock's line for the cast (his whole turn: no move to show), only on that turn; the warning says when it comes", () => {
    const c = carrots();
    expect(noMoveLine({ ...view([], { carrots: c }, 4), lastMove: null } as BossView)).toBe(CAST_LINE);
    expect(CAST_LINE).toBe("Chub & Chirp spent their turn planting carrots.");
    expect(noMoveLine({ ...view([], { carrots: c }, 5), lastMove: null } as BossView)).toBeNull();
    expect(HOPPER_UI.ultimate).toEqual({ name: "Carrot Patch", when: "After your move" });
  });

  it("your pull plays as your move lands (his thinking screen), from when this device first saw it, with his line about it", () => {
    const c = carrots({ by: [null, null, null, "crowd", null], crowd: 1 });
    const v = view([{ kind: "carrot", turn: 4, square: "e6", by: "crowd" }], { carrots: c }, 4);
    const first = yourPulls(v, 5_000);
    expect(first).toEqual([{ kind: "carrot", key: "hopper:carrot:4:crowd:e6", at: 5_000, ms: POWER_FX.carrot, square: "e6", by: "crowd" }]);
    expect(yourPulls(v, 9_000)[0]!.at).toBe(5_000);
    expect(HOPPER_LINES.carrotYours).toContain(powerLine(bossKit(HOPPER_NAME), first[0]!));
    // (An older turn's, or none: nothing.)
    expect(yourPulls(view([{ kind: "carrot", turn: 3, square: "e6", by: "crowd" }], { carrots: c }, 4))).toEqual([]);
    expect(yourPulls(view([], { carrots: c }, 4))).toEqual([]);
  });
});

describe("the board under their moments", () => {
  const moment = (kind: Moment["kind"], at = 10_000): Moment => ({ kind, key: `hopper:${kind}:4`, at, ms: POWER_FX[kind as keyof typeof POWER_FX] });

  it("the hop: his pawn on its own square until it takes off, in the air (on neither) until it lands, then beyond yours", () => {
    const hopped = "rnbqkbnr/pppp1ppp/8/8/4P3/4p3/PPPP1PPP/RNBQKBNR b KQkq - 0 2";
    const v = view([], { hop: { at: 4, from: "e5", over: "e4", to: "e3" } }, 4, hopped);
    const m = moment("hop");
    const at = (t: number) => hopperFen(v, [m], m.at + t, hopped);
    const before = at(B.hop.liftAt - 1)!;
    expect(pieceAt(before, "e5")).toMatchObject({ color: "b", type: "p" });
    expect(pieceAt(before, "e3")).toBeNull();
    const air = at(B.hop.liftAt + 1)!;
    expect(pieceAt(air, "e5")).toBeNull();
    expect(pieceAt(air, "e3")).toBeNull();
    expect(pieceAt(air, "e4")).toMatchObject({ color: "w", type: "p" });
    expect(at(B.hop.landAt)).toBe(hopped);
    expect(hopperFen(v, [], m.at, hopped)).toBeNull();
  });

  it("the spin: his prize pieces only once each has dropped onto its square", () => {
    const fen = withPiece(withPiece("4k3/8/8/8/8/8/8/4K3 w - - 0 30", "d8", { color: "b", type: "q" }), "c8", { color: "b", type: "q" });
    const v = view([], { carrots: carrots({ over: "moves", boss: 4, tier: 4, spin: { at: 9, tier: 4, rolled: ["q", "q"], prize: ["q", "q"], squares: ["d8", "c8"] } }) }, 9, fen);
    const m = moment("carrotSpin");
    const at = (t: number) => hopperFen(v, [m], m.at + t, fen)!;
    expect(pieceAt(at(B.carrotSpin.prizeAt), "d8")).toBeNull();
    expect(pieceAt(at(B.carrotSpin.prizeAt), "c8")).toBeNull();
    expect(pieceAt(at(B.carrotSpin.prizeAt + PRIZE_DROP.fallMs), "d8")).toMatchObject({ type: "q" });
    expect(pieceAt(at(B.carrotSpin.prizeAt + PRIZE_DROP.fallMs), "c8")).toBeNull();
    expect(at(B.carrotSpin.prizeAt + PRIZE_DROP.stagger + PRIZE_DROP.fallMs)).toBe(fen);
  });

  it("the carrots: none until the cast plants each, then planted; pulled ones pop as their moment plays, the puller's token after", () => {
    const c = carrots();
    const cast = moment("carrots", 10_000);
    const items = (v: BossView, moments: Moment[], now: number) => carrotItems(v, moments, now).map((i) => [i.square, i.anim, i.then ?? null, i.since]);
    const v = view([], { carrots: c }, 4);
    const plant = (i: number) => cast.at + B.carrots.tosses[i]! + B.carrots.flightMs;
    expect(items(v, [cast], plant(0) - 1)).toEqual([]);
    expect(items(v, [cast], plant(0))).toEqual([["a5", "plant", "planted", plant(0)]]);
    expect(carrotItems(v, [cast], plant(0))[0]!.quiet).toBe(true);
    expect(items(v, [cast], plant(4)).map(([sq]) => sq)).toEqual(c.squares);
    // After the cast: all planted.
    expect(items(v, [], 99_000).map(([, a]) => a)).toEqual(["planted", "planted", "planted", "planted", "planted"]);
    // His pull (the crowd White: his token black), as its moment plays; one pulled earlier (yours, white), simply claimed.
    const pulled = view([], { carrots: carrots({ by: ["crowd", null, null, "boss", null] }) }, 8);
    const pull: Moment = { kind: "carrot", key: "hopper:carrot:9:boss", at: 20_000, ms: POWER_FX.carrot, square: "e6", by: "boss" };
    expect(items(pulled, [pull], 19_999).find(([sq]) => sq === "e6")).toEqual(["e6", "planted", null, expect.any(Number)]);
    expect(items(pulled, [pull], 20_000).find(([sq]) => sq === "e6")).toEqual(["e6", "pullB", "claimedB", 20_000]);
    expect(items(pulled, [pull], 20_000).find(([sq]) => sq === "a5")).toEqual(["a5", "claimedW", null, 0]);
  });

  it("the race over: the carrots left in the ground and the tokens go once its last moments have played (Eric, Oct 18)", () => {
    const over = view([], { carrots: carrots({ by: ["crowd", "boss", null, "crowd", "crowd"], over: "moves", spin: { at: 9 } }) }, 30);
    const spin: Moment = { kind: "carrotSpin", key: "hopper:carrotSpin:30", at: 50_000, ms: 4_000 };
    // (While his spin plays: still there; after it, or with nothing playing (a reload): none.)
    expect(carrotItems(over, [spin], 51_000).map((i) => i.square)).toEqual(["a5", "c3", "h5", "e6", "g2"]);
    expect(carrotItems(over, [spin], 54_000)).toEqual([]);
    expect(carrotItems(over, [], 99_000)).toEqual([]);
    // (The race on: the one still in the ground stays planted.)
    const on = view([], { carrots: carrots({ by: ["crowd", "boss", null, "crowd", "crowd"] }) }, 30);
    expect(carrotItems(on, [], 99_000).find((i) => i.square === "h5")!.anim).toBe("planted");
  });
});
