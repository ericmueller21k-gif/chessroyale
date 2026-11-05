import { describe, expect, it } from "vitest";
import { DASH_ANIM } from "@chessroyale/chess";
import { BOSS_POWERS } from "@chessroyale/core";
import { BOSS_KITS, bossKit } from "../src/characters/kits.ts";
import { BOSS_BLITZ } from "../src/characters/boss-blitz.ts";
import { DASH_FIGURE, DASH_ROOM } from "../src/characters/dash-figure.ts";
import { DASH_CHANCE, DASH_LINES } from "../src/characters/dash-lines.ts";
import { DASH_SOUNDS, dashSound, type DashSound } from "../src/characters/dash-sounds.ts";
import { sidekickBlitz } from "../src/characters/sidekicks/blitz.ts";
import { SELECT_LINES, SELECT_SOUND } from "../src/characters/boss-select.ts";
import { MOVE_MEAN_DB, MOVE_PEAK } from "../src/characters/synth.ts";
import { TOKEN_ART } from "../src/components/tokens/index.ts";
import { DASH_UI, DASH_WORDS, slapText } from "../src/components/Dash.tsx";
import { WARN } from "../src/components/BossPowers.tsx";
import type { MomentProps } from "../src/components/PowerParts.tsx";
import { renderFrame } from "../src/characters/sprite.ts";
import { POWER_WORDS } from "../src/power-words.ts";
import { BLITZ_INTRO_DROP_AT, BOSS_BLITZ_INTRO, INTRO_BLITZ_DUST, INTRO_BLITZ_FRONT, INTRO_BLITZ_POP, INTRO_BLITZ_STOOL, INTRO_BLITZ_STORM, INTRO_BLITZ_TABLE } from "../src/town/shops/blitz-intro-art.ts";
import { SHOP_BLITZ_LAYOUT, SHOP_BLITZ_MARKS } from "../src/town/shops/blitz-art.ts";
import { BLITZ_DASHES, CHALLENGE_FEEL, blitzAnims, blitzAt, blitzTimes, coverMs, hopStart, introAt, introBeats, introCues, introLength, introOf, marksFeel, marksOf, seatedMarks } from "../src/town/shops/challenge.ts";
import { TOWN_FEEL } from "../src/town/feel.ts";
import { readFileSync } from "node:fs";

/** Dash's wiring (docs/decisions/2026-11-03-dash.md): his art, lines, sounds, select, token and words. */
const kit = BOSS_KITS["Dash"]!;
const cue = (anim: string, name: string) => {
  let t = 0;
  for (const f of BOSS_BLITZ.anims[anim]!.frames) {
    if (f.cue === name) return t;
    t += f.ms;
  }
  return null;
};
const length = (anim: string) => BOSS_BLITZ.anims[anim]!.frames.reduce((s, f) => s + f.ms, 0);

describe("Dash's wiring", () => {
  it("his figure is the art's as drawn, in a frame with room on its right (his feet where they were); his name says Dash everywhere a player sees", () => {
    expect(kit.ch).toBe(DASH_FIGURE);
    expect(DASH_FIGURE.anims).toBe(BOSS_BLITZ.anims);
    expect(DASH_FIGURE.w).toBe(BOSS_BLITZ.w + DASH_ROOM);
    expect(DASH_FIGURE.foot).toEqual(BOSS_BLITZ.foot);
    expect([DASH_FIGURE.name, sidekickBlitz.name, TOKEN_ART.dash!.name]).toEqual(["Dash", "Tick", "Dash token"]);
    const words = [...Object.values(DASH_LINES).flat(), ...(SELECT_LINES.dash ?? []), POWER_WORDS.clockslap, POWER_WORDS.scramble, DASH_WORDS.slap, DASH_WORDS.flag, DASH_WORDS.scramble(5, 3), DASH_UI.ultimate.name];
    for (const w of words) expect(w, w).not.toMatch(/blitz/i);
  });

  it("his moments' beats are his animations': the slap's slam and steal, the scramble's length, his finger gun", () => {
    expect(length("clockSlap")).toBe(DASH_ANIM.clockSlap);
    expect(cue("clockSlap", "slam")).toBe(DASH_ANIM.slapHitAt);
    expect(cue("clockSlap", "steal")).toBe(DASH_ANIM.stealAt);
    expect(length("timeScramble")).toBe(DASH_ANIM.timeScramble);
    expect(length("scrambleWarn")).toBe(DASH_ANIM.scrambleWarn);
    expect(length("check")).toBe(DASH_ANIM.check);
    expect(kit.anims).toMatchObject({ power: "clockSlap", ultimateWarn: "scrambleWarn", ultimate: "timeScramble" });
  });

  it("every moment of his plays where he stands (pm-stay, never cast at the board's corner), the RAGE warning's too", () => {
    expect(DASH_UI.inPlace).toBe(true);
    const boss = { id: "dash", name: "Dash", crowdSide: "w", crowdMoves: 2, startMove: 1, board: { id: 0, fen: "", history: [], ply: 0, lastMove: null }, powers: { events: [], turn: 2, dash: { slaps: 1, stolen: 30000, flags: 0, slap: { at: 1, ms: 30000, bank: true } } } } as unknown as MomentProps["boss"];
    for (const [kind, ui] of [...Object.entries(DASH_UI.moments), ["warn", WARN] as const]) {
      let cast = 0;
      const props = { boss, moment: { kind, key: `k:${kind}`, at: 0, ms: 2000 }, now: 500, t: 500, orientation: "white", side: "w", kit, banner: () => null, cast: () => (cast++, null), anim: () => "scrambleWarn" } as unknown as MomentProps;
      const v = ui!.view(props) as { props: { class: string } };
      expect(v.props.class, kind).toMatch(/\bpm-stay\b/);
      expect(cast, `${kind} casts at the board's corner`).toBe(0);
    }
  });

  it("no frame of any of his animations drops below his feet by more than the boss bar's padding: in his slot, never over the board", () => {
    const ch = kit.ch;
    for (const [name, a] of Object.entries(ch.anims))
      for (const [i, f] of a.frames.entries()) {
        const { w, h, data } = renderFrame(ch, f);
        let low = -1;
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3]! > 0) low = y;
        expect(low + 1 - ch.foot[1], `${name} frame ${i}`).toBeLessThanOrEqual(6);
      }
  });

  it("his lines: two or three a moment, short enough for the bubble; his slap, scramble and flag always speak", () => {
    for (const [beat, lines] of Object.entries(DASH_LINES)) {
      expect(lines!.length, beat).toBeGreaterThanOrEqual(2);
      expect(lines!.length, beat).toBeLessThanOrEqual(3);
      for (const l of lines!) expect(l.length, l).toBeLessThanOrEqual(60);
    }
    expect([DASH_CHANCE.power, DASH_CHANCE.ultimate, DASH_CHANCE.ultimateWarn, DASH_CHANCE.flag]).toEqual([1, 1, 1, 1]);
    expect(slapText(BOSS_POWERS.slapBankSeconds * 1000)).toBe("−30s");
  });

  it("his sounds are his own: one for every cue of his and Tick's animations, his select sound, his intro's cues, every one used", () => {
    const own = (s: string) => /^dash[A-Z]/.test(s) && DASH_SOUNDS.includes((s[4]!.toLowerCase() + s.slice(5)) as DashSound);
    for (const [name, an] of [...Object.entries(BOSS_BLITZ.anims), ...Object.entries(sidekickBlitz.anims)]) for (const f of an.frames) if (f.cue) expect(kit.sounds[f.cue], `${name}: ${f.cue}`).toBeTruthy();
    for (const s of [...Object.values(kit.sounds), SELECT_SOUND.dash!]) expect(own(s), s).toBe(true);
    expect(SELECT_SOUND.dash).toBe("dashHello");
    // (His intro's cues too, Nov 5: the shoe boxes' thud and his brush are its own.)
    const used = new Set<string>([...Object.values(kit.sounds), SELECT_SOUND.dash!, ...Object.values(introOf("dash")!.cues)]);
    for (const n of DASH_SOUNDS) expect(used.has(`dash${n[0]!.toUpperCase()}${n.slice(1)}`), n).toBe(true);
    for (const [name, k] of Object.entries(BOSS_KITS)) if (name !== "Dash") for (const s of Object.values(k.sounds)) expect(s, name).not.toMatch(/^dash[A-Z]/);
  });

  it("every one of his sounds is quieter than a piece's move (peak and loudness), and the same every time", () => {
    for (const name of DASH_SOUNDS) {
      const s = dashSound(name, 44100);
      let peak = 0;
      let sum = 0;
      for (const v of s) {
        expect(Number.isFinite(v)).toBe(true);
        peak = Math.max(peak, Math.abs(v));
        sum += v * v;
      }
      expect(peak, name).toBeLessThan(MOVE_PEAK / 2);
      const db = 10 * Math.log10(sum / s.length);
      expect(db, name).toBeLessThan(MOVE_MEAN_DB - 2);
      expect(db, name).toBeGreaterThan(MOVE_MEAN_DB - 6);
      expect(s, `${name} is the same every time`).toEqual(dashSound(name, 44100));
    }
  });
});

/**
 * Dash's own intro (Nov 5, round 3; Eric's design, Nov 3; docs/decisions/2026-11-05-dash-intro.md): you both walk on to where you stand;
 * his line; four dashes (each a bolt off in a trail of dust and back with a thing tossed onto the spot: the shoe-box table, the board,
 * the pieces with a pop, both stools); his brag; the attack's beat (none was drawn for him: he stands); the clock rush.
 */
describe("Dash's intro", () => {
  const F = CHALLENGE_FEEL;
  const def = introOf("dash")!;
  const A = blitzAnims({ mover: BOSS_BLITZ_INTRO, table: INTRO_BLITZ_TABLE, stool: INTRO_BLITZ_STOOL, dust: INTRO_BLITZ_DUST, pop: INTRO_BLITZ_POP });
  const beats = introBeats(A);
  const T = blitzTimes(A);
  const sum = (ms: readonly number[]) => ms.reduce((a, b) => a + b, 0);
  const at = (t: number) => introAt(beats, A, t);

  it("his beats in order, each a feel number or his art's frames: his line, the table, the board, the pieces, the stools, his brag, the attack's beat; about 10 s from his line to the cover", () => {
    expect(beats.map((b) => b.step)).toEqual(["face", "line", ...BLITZ_DASHES, "brag", "swing", "done"]);
    for (let i = 1; i < beats.length; i++) expect(beats[i]!.at, beats[i]!.step).toBe(beats[i - 1]!.end);
    const len = (s: string) => beats.find((b) => b.step === s)!.end - beats.find((b) => b.step === s)!.at;
    expect(len("face")).toBe(F.faceMs);
    expect(len("line")).toBe(F.blitz.lineMs);
    // (Each dash: his bolt, out of sight `awayMs`, his arrive, standing `holdMs`.)
    for (const d of BLITZ_DASHES) expect(len(d), d).toBe(sum(A.moves.bolt) + F.blitz.awayMs + sum(A.moves.arrive) + F.blitz.holdMs);
    expect(len("brag")).toBe(sum(A.moves.brag));
    expect(len("swing")).toBe(F.swingMs - coverMs(true));
    // (The art's own timing: 420 ms of bolt, 730 of arrive, 1030 of brag.)
    expect([sum(A.moves.bolt), sum(A.moves.arrive), sum(A.moves.brag)]).toEqual([420, 730, 1030]);
    const fromLine = introLength(beats) - F.faceMs;
    expect(fromLine).toBeGreaterThanOrEqual(9_000);
    expect(fromLine).toBeLessThanOrEqual(10_500);
    // (No God King attack was drawn for him: he stands through its beat.)
    expect(bossKit("Dash")!.kingAttack).toBeUndefined();
  });

  it("each dash: he bolts off his spot (his dust trail from the launch), is out of sight, races back and skids onto it, tosses; he stands between", () => {
    for (const d of T.dashes) {
      expect(blitzAt(A, d.at)).toMatchObject({ move: { anim: "bolt", frame: 0 }, gone: false, here: true });
      expect(blitzAt(A, d.launch - 1).dust).toBe(-1);
      expect(blitzAt(A, d.launch)).toMatchObject({ move: { anim: "bolt", frame: A.key.whoosh }, here: false, dust: 0 });
      expect(blitzAt(A, d.gone)).toMatchObject({ move: null, gone: true, here: false });
      expect(blitzAt(A, d.back)).toMatchObject({ move: { anim: "arrive", frame: 0 }, gone: false, here: false });
      expect(blitzAt(A, d.back + sum(A.moves.arrive.slice(0, A.key.skid)))).toMatchObject({ move: { anim: "arrive", frame: A.key.skid }, here: true });
      expect(blitzAt(A, d.drop)).toMatchObject({ move: { anim: "arrive", frame: A.key.drop }, here: true });
      expect(blitzAt(A, d.end - 1)).toMatchObject({ move: null, gone: false, here: true });
    }
    expect(blitzAt(A, T.brag)).toMatchObject({ move: { anim: "brag", frame: 0 }, here: true });
    expect(blitzAt(A, beats.find((b) => b.step === "swing")!.at)).toMatchObject({ move: null, here: true });
    // (His dust trail starts on the bolt's whoosh, as the art says, and his drop is the arrive's own toss frame.)
    expect(BOSS_BLITZ_INTRO.anims.bolt!.frames[A.key.whoosh]!.cue).toBe("whoosh");
    expect(BOSS_BLITZ_INTRO.anims.arrive!.frames[A.key.drop]!.cue).toBe("drop");
  });

  it("each thing lands on its toss: the table, then the board falling on, the pieces with the pop, both stools; nothing before, nothing missing after", () => {
    const [d0, d1, d2, d3] = T.drop as [number, number, number, number];
    expect(blitzAt(A, d0 - 1).table).toBeNull();
    expect(blitzAt(A, d0).table).toEqual({ anim: "land", frame: 0 });
    expect(blitzAt(A, d0 + sum(A.gear.table)).table).toEqual({ anim: "idle", frame: 0 });
    expect(blitzAt(A, d1 - 1).board).toBeNull();
    expect(blitzAt(A, d1).board).toBeCloseTo(F.dropFrom);
    expect(blitzAt(A, T.board).board).toBe(0);
    expect(blitzAt(A, d2 - 1)).toMatchObject({ pieces: false, pop: -1 });
    expect(blitzAt(A, d2)).toMatchObject({ pieces: false, pop: 0 });
    expect(blitzAt(A, T.pieces)).toMatchObject({ pieces: true, pop: A.key.pieces });
    expect(INTRO_BLITZ_POP.anims.idle!.frames[A.key.pieces]!.cue).toBe("pop");
    expect(blitzAt(A, d3 - 1).stools).toBeNull();
    expect(blitzAt(A, d3).stools).toEqual({ anim: "land", frame: 0 });
    // The room's table and stools: the board from its toss, the stools from theirs.
    expect([at(d1 - 1).table, at(d1).table, at(d3 - 1).stools, at(d3).stools]).toEqual([false, true, false, true]);
    // Nothing pops in at the end: from the stools' landing to the cover, all of it stands, and nobody hops back.
    expect(hopStart(beats, A)).toBe(Infinity);
    for (let t = d3; t <= introLength(beats) + 2000; t += 50) {
      const n = at(t);
      expect(n.table && n.stools && n.blitz!.table !== null && n.blitz!.board !== null && n.blitz!.pieces, `${t}`).toBe(true);
      expect([n.back, n.hop]).toEqual([0, 0]);
    }
    expect(blitzAt(A, introLength(beats)).stools).toEqual({ anim: "idle", frame: 0 });
  });

  it("the drops land where the table and the stools stand: he stands his toss's reach west of the table's foot, the stools a square each side", () => {
    // (You both walk on straight to where you stand: his place is his BossIntro `clear`, seated.)
    const m = seatedMarks(marksOf(SHOP_BLITZ_LAYOUT, "across", SHOP_BLITZ_MARKS, marksFeel(A, F, def.clear))!);
    expect(def.seated).toBe(true);
    // His pixels are his town figure's (BOSS_BLITZ, `bossSquares` tall): the toss's reach in squares.
    const perSq = BOSS_BLITZ.h / (TOWN_FEEL.bossSquares * (TOWN_FEEL.bossScale.dash ?? 1));
    expect(BOSS_BLITZ_INTRO.h - BOSS_BLITZ_INTRO.foot[1]).toBe(BOSS_BLITZ.h - BOSS_BLITZ.foot[1]);
    expect(BLITZ_INTRO_DROP_AT[1]).toBe(0);
    expect(m.table.c - m.boss.c).toBeCloseTo(BLITZ_INTRO_DROP_AT[0] / perSq, 2);
    expect(m.boss.r).toBe(m.table.r);
    expect(m.you).toEqual({ c: m.table.c + F.clear.you, r: m.table.r });
    // The stools at the table's foot +- 37 room pixels (the art's), a square each side: the room's stools' places.
    expect([m.bossStool, m.youStool]).toEqual([{ c: m.table.c - F.stoolOff, r: m.table.r }, { c: m.table.c + F.stoolOff, r: m.table.r }]);
    expect(F.stoolOff * TOWN_FEEL.housePxPerSquare).toBe(37);
    // The pop's foot is the table's (its art: over the board), the table PARK_TABLE's geometry.
    expect([INTRO_BLITZ_TABLE.w, INTRO_BLITZ_TABLE.h, ...INTRO_BLITZ_TABLE.foot]).toEqual([111, 50, 55, 44]);
    expect(INTRO_BLITZ_POP.foot).toEqual([40, 50]);
  });

  it("every cue of his intro's art has a sound, each one a sound the game makes, and they play on their frames", () => {
    const make = readFileSync(new URL("../src/sound.ts", import.meta.url), "utf8");
    // (A name in sound.ts's SoundName: one the game plays.)
    const known = (s: string) => make.includes(`\n  | "${s}"\n`);
    const arts = [BOSS_BLITZ_INTRO, INTRO_BLITZ_TABLE, INTRO_BLITZ_STOOL, INTRO_BLITZ_DUST, INTRO_BLITZ_POP, INTRO_BLITZ_STORM, INTRO_BLITZ_FRONT];
    const cues = new Set<string>(["storm"]);
    for (const ch of arts) for (const an of Object.values(ch.anims)) for (const f of an!.frames) if (f.cue) cues.add(f.cue);
    expect([...cues].sort()).toEqual(["brush", "ding", "drop", "pop", "skid", "storm", "thud", "tick", "whoosh"]);
    for (const c of cues) {
      expect(def.cues[c], c).toBeTruthy();
      expect(known(def.cues[c]!), `${c}: ${def.cues[c]}`).toBe(true);
    }
    const timed = introCues(beats, A);
    for (const c of timed) expect(def.cues[c.cue], c.cue).toBeTruthy();
    const when = (cue: string) => timed.filter((c) => c.cue === cue).map((c) => c.at);
    // (Each bolt's whoosh and each arrive's; a skid and a toss each arrive; the thuds: the table, the board, the stools; the pop; the brag's.)
    expect(when("skid")).toHaveLength(4);
    expect(when("drop")).toEqual(T.drop);
    expect(when("whoosh")).toHaveLength(8);
    expect(when("thud")).toEqual([T.drop[0]! + sum(A.gear.table.slice(0, 2)), T.board, T.drop[3]! + A.gear.stool[0]!]);
    expect(when("pop")).toEqual([T.pieces]);
    expect(when("brush")).toHaveLength(2);
    expect(when("ding")).toHaveLength(1);
  });

  it("his line and words have no emoji (Nov 5)", () => {
    const pic = /\p{Extended_Pictographic}/u;
    expect(def.line).not.toMatch(pic);
    expect(def.name).not.toMatch(pic);
  });
});
