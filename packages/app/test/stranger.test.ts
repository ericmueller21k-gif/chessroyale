// The Stranger's art (Nov 27; docs/decisions/2026-11-27-stranger-art.md), drawn ahead of his rules: his figure (and its locked look), his
// kit (in BOSS_KITS with his rules since Nov 27, the roster's `stranger`), his square's fire and ice, and his sounds. The same checks characters.test.ts and
// boss-character.test.ts make of every boss, plus his own: swords on his back at rest, drawn before every move, the tips meeting.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ART_KITS, BOSS_KITS, STRANGER_FLOURISH_EVERY, STRANGER_SLASHES, strangerAnim } from "../src/characters/kits.ts";
import { FINISHERS, FINISHER_BLOCK_MS, STORM_SCENE } from "@chessroyale/chess";
import { animLength } from "../src/characters/power-art.ts";
import { FINISHER_MARGIN_MS, RING_BUILD, STORM_ART, THROW, UP, arc, buildStep, cornerOf, finishTimeline, finisherStand, fly, hopHeight, nudged, ringArrivals, sceneOf, stormLevel, thrownAt } from "../src/components/Stranger.tsx";
import { fireBurnItems } from "../src/components/Grex.tsx";
import { EFFECTS } from "../src/characters/power-art.ts";
import { POSES, STRANGER, STRANGER_FOOT, STRANGER_HOP, STRANGER_PORTRAIT, STRANGER_SOUNDS, TIPS_AT } from "../src/characters/stranger.ts";
import { STRANGER_SQUARE } from "../src/characters/effects/stranger.ts";
import { STRANGER_LINES } from "../src/characters/stranger-lines.ts";
import { STRANGER_SOUND_NAMES, strangerSound } from "../src/characters/stranger-sounds.ts";
import { frameKeys, renderFrame, type Character } from "../src/characters/sprite.ts";
import { MOVE_MEAN_DB, MOVE_PEAK } from "../src/characters/synth.ts";
import type { Beat } from "../src/characters/boss-beats.ts";

const whole = (ch: Character, edges = true) => {
  for (const [name, anim] of Object.entries(ch.anims))
    anim.frames.forEach((f, i) => {
      for (const look of [undefined, ...Object.keys(ch.looks ?? {})]) expect(renderFrame(ch, f, { look }).data.length).toBe(ch.w * ch.h * 4);
      if (!edges) return;
      const keys = frameKeys(ch, f);
      const edge = [...keys[0]!, ...keys[ch.h - 1]!, ...keys.map((r) => r[0]), ...keys.map((r) => r[ch.w - 1])];
      expect(edge.filter(Boolean), `${ch.id} ${name} frame ${i + 1}`).toEqual([]);
    });
  // (After the frames: his parts are painted the first time a frame shows them.)
  expect(Object.keys(ch.parts).length).toBeGreaterThan(0);
  for (const [name, part] of Object.entries(ch.parts)) for (const row of part.grid) for (const k of row) if (k !== ".") expect(ch.palette, `${name}: "${k}"`).toHaveProperty(k);
};

describe("the Stranger's art", () => {
  it("draws only with his palette, every frame whole in its frame, in every look (his square's art may fill its square)", () => {
    whole(STRANGER);
    whole(STRANGER_SQUARE, false);
  });

  it("loops his rests, cues his one-shots, and stands his boots on the ground point", () => {
    for (const name of ["idle", "think", "smug", "ready", "rattled", "defeatLoop", "victory"]) expect(STRANGER.anims[name]!.loop, name).toBe(true);
    for (const [name, a] of Object.entries(STRANGER.anims)) if (!a.loop) expect(a.frames.some((f) => f.cue), name).toBe(true);
    const keys = frameKeys(STRANGER, STRANGER.anims.idle!.frames[0]!);
    expect(keys[STRANGER_FOOT[1] - 1]!.slice(STRANGER_FOOT[0] - 8, STRANGER_FOOT[0] + 8).some(Boolean)).toBe(true);
  });

  it("keeps his swords on his back at rest and draws them for every move (Eric: 'keeps them put away most of the time')", () => {
    for (const p of [POSES.rest, POSES.flinch, POSES.rattled]) expect([p.swordF, p.swordI]).toEqual(["back", "back"]);
    for (const name of ["strike", "castFull"]) {
      const a = STRANGER.anims[name]!;
      // (Drawn at the start, home again at the end.)
      expect(a.frames.findIndex((f) => f.cue === "draw"), name).toBeLessThan(a.frames.findIndex((f) => f.cue === "slash" || f.cue === "tips"));
      expect(a.frames.at(-2)!.cue ?? a.frames.at(-1)!.cue, name).toBe("sheathe");
    }
    // The twin-tip cast: both blades' tips meet in front of his middle.
    expect(Math.abs(TIPS_AT[0] - STRANGER_FOOT[0])).toBeLessThanOrEqual(1);
    const ice = POSES.aimTips.swordI as { at: readonly [number, number]; deg: number };
    const r = (ice.deg * Math.PI) / 180;
    expect(Math.abs(ice.at[0] + Math.sin(r) * 41 - TIPS_AT[0])).toBeLessThanOrEqual(2);
  });

  it("his locked look is all shadow but his eyes, the crown's jewel and the aura", () => {
    const locked = STRANGER.looks!.locked!;
    for (const k of ["c", "d", "J", "W", "3", "o", "q", "v"]) expect(locked[k], k).toBe("#0b0912");
    for (const k of ["r", "i", "X", "K", "6", "9"]) expect(locked[k], k).toBeUndefined();
  });

  it("is the roster's kit (moved from ART_KITS with his rules): every moment animated, a sound for every cue, its portrait inside the frame", () => {
    const kit = BOSS_KITS.Stranger!;
    expect(ART_KITS.Stranger).toBeUndefined();
    expect(kit.ch).toBe(STRANGER);
    const beats: Beat[] = ["entrance", "idle", "thinking", "move", "capture", "hurt", "check", "smug", "rattled", "defeat", "victory", "strike", "power", "powerHit", "ultimateWarn", "ultimate", "ultimateHit"];
    for (const b of beats) expect(kit.ch.anims[kit.anims[b] ?? b], b).toBeTruthy();
    for (const l of Object.values(kit.loops ?? {})) expect(kit.ch.anims[l!]?.loop, l).toBe(true);
    for (const a of Object.values(STRANGER.anims)) for (const f of a.frames) if (f.cue) expect(kit.sounds[f.cue], f.cue).toBeTruthy();
    for (const a of Object.values(STRANGER_SQUARE.anims)) for (const f of a.frames) if (f.cue) expect(EFFECTS.strangerSquare.sounds[f.cue], f.cue).toBeTruthy();
    const P = STRANGER_PORTRAIT;
    expect(P.x >= 0 && P.y >= 0 && P.x + P.w <= STRANGER.w && P.y + P.h <= STRANGER.h).toBe(true);
    for (const lines of Object.values(STRANGER_LINES)) for (const line of lines ?? []) expect(line.length, line).toBeLessThan(48);
  });

  it("none of his lines is another speaker's (his voice's sound is keyed by a line's words: a shared line changed theirs)", () => {
    const mine = Object.values(STRANGER_LINES).flatMap((l) => [...(l ?? [])]);
    const src = join(import.meta.dirname, "../src");
    const files = (readdirSync(src, { recursive: true }) as string[]).filter((f) => /\.tsx?$/.test(f) && !f.endsWith("stranger-lines.ts"));
    expect(files.length).toBeGreaterThan(100);
    for (const f of files) {
      const text = readFileSync(join(src, f), "utf8");
      for (const line of mine) for (const q of ['"', "'", "`"]) expect(text.includes(q + line + q), `"${line}" in ${f}`).toBe(false);
    }
  });

  it("his ready blades stay clear of the ground (the ground's cut is for his planted swords only)", () => {
    for (const name of ["draw", "slash", "cast", "ready"])
      for (const f of STRANGER.anims[name]!.frames) {
        const keys = frameKeys(STRANGER, f);
        // (A blade reaching the ground's row would be cut there: none in the row above it.)
        expect(keys.slice(STRANGER_FOOT[1] - 1).flat().filter((k) => k && "pPqQysSvVW".includes(k)), name).toEqual([]);
      }
  });

  it("his sounds are his own, every one used, quieter than a piece's move, and the same every time", () => {
    const own = (n: string) => `stranger${n[0]!.toUpperCase()}${n.slice(1)}`;
    const used = new Set([...Object.values(STRANGER_SOUNDS), "strangerVoice"]);
    for (const n of STRANGER_SOUND_NAMES) expect(used.has(own(n) as never), n).toBe(true);
    // (His own, but his shout: the God King's recorded four, one at random, given to him too by Eric, Nov 27.)
    for (const s of used) expect(s.startsWith("stranger") || s === "gkHyuah", s).toBe(true);
    for (const name of STRANGER_SOUND_NAMES)
      for (const rate of [44100, 48000]) {
        const s = strangerSound(name, rate);
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
        expect(db, name).toBeGreaterThan(MOVE_MEAN_DB - 9);
        expect(s.length / rate, name).toBeLessThan(1.3);
      }
    expect(strangerSound("slash", 44100)).toEqual(strangerSound("slash", 44100));
  });
});

describe("his swords (Eric, Nov 27: his slashes, his block, his flourish, his finisher)", () => {
  const W = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  const state = (o: Partial<Parameters<typeof strangerAnim>[1]>) => ({ fen: W, history: [] as string[], crowdSide: "w" as const, lastMove: null, ...o });

  it("which capture plays which: your pawn one of three slashes (by the move, the same everywhere); any other piece he rests (his finisher played it)", () => {
    const slashes = new Set<string>();
    for (let ply = 1; ply < 60; ply += 2) {
      const a = strangerAnim({ anim: "capture", key: `capture:${ply}` }, state({ lastMove: { captured: "p" } }))!;
      expect(STRANGER_SLASHES).toContain(a);
      expect(strangerAnim({ anim: "capture", key: `capture:${ply}` }, state({ lastMove: { captured: "p" } }))).toBe(a);
      slashes.add(a);
    }
    expect([...slashes].sort()).toEqual([...STRANGER_SLASHES].sort());
    for (const k of ["n", "b", "r", "q"]) expect(strangerAnim({ anim: "capture", key: "capture:3" }, state({ lastMove: { captured: k } })), k).toBe("idle");
    // A check: the double slash (his kit's), a pawn taken with it one of the three.
    expect(strangerAnim({ anim: "check", key: "check:3" }, state({}))).toBeUndefined();
    expect(STRANGER_SLASHES).toContain(strangerAnim({ anim: "check", key: "check:3" }, state({ lastMove: { captured: "p" } })));
    for (const a of [...STRANGER_SLASHES, "block", "flourishAll", "hop", ...FINISHERS.map((f) => `fin_${f}`)]) expect(STRANGER.anims[a], a).toBeTruthy();
  });

  it("a piece of his taken that isn't a pawn: his block; a pawn: his flinch; every third quiet move of his, his flourish", () => {
    // You (White) took his knight on f6 with your bishop; then his pawn on e5 with your d-pawn.
    const before = "rnbqkb1r/pppp1ppp/5n2/4p1B1/3PP3/8/PPP2PPP/RN1QKBNR w KQkq - 0 4";
    const knight = "rnbqkb1r/pppp1ppp/5B2/4p3/3PP3/8/PPP2PPP/RN1QKBNR b KQkq - 0 4";
    const pawn = "rnbqkb1r/pppp1ppp/5n2/4P1B1/4P3/8/PPP2PPP/RN1QKBNR b KQkq - 0 4";
    const bases = [{ ply: 0, fen: before }];
    expect(strangerAnim({ anim: "hurt", key: "hurt:1" }, state({ fen: knight, history: ["g5f6"], bases }))).toBe("block");
    expect(strangerAnim({ anim: "hurt", key: "hurt:1" }, state({ fen: pawn, history: ["d4e5"], bases }))).toBeUndefined();
    const moves = [1, 2, 3, 4, 5, 6].map((n) => strangerAnim({ anim: "move", key: `move:${2 * n}` }, state({ history: Array(2 * n).fill("e2e4") })));
    expect(moves).toEqual([undefined, undefined, "flourishAll", undefined, undefined, "flourishAll"]);
    expect(STRANGER_FLOURISH_EVERY).toBe(3);
  });

  it("each finisher's beats in order, his hop back home before the moment ends, the piece gone after its board art lands", () => {
    for (const kind of FINISHERS) {
      const tl = finishTimeline(kind);
      expect(tl.landAt, kind).toBeLessThan(tl.finAt);
      expect(tl.finAt, kind).toBeLessThan(tl.hitAt);
      expect(tl.hitAt, kind).toBeLessThan(tl.goneAt);
      expect(tl.goneAt, kind).toBeLessThan(tl.backAt);
      // (Home at least FINISHER_MARGIN_MS before his move shows: a device that saw the event late still sees him land. Review of #1002.)
      expect(tl.backAt + STRANGER_HOP.ms + FINISHER_MARGIN_MS, kind).toBeLessThanOrEqual(tl.ms);
      if (kind === "ice") expect(tl.shatterAt).toBeGreaterThan(tl.hitAt + 400);
      if (kind === "frostfire") expect(tl.igniteAt).toBeGreaterThan(tl.hitAt);
    }
    // His shout (the God King's, Eric's) as every strike winds up; his clang as he blocks.
    for (const a of [...STRANGER_SLASHES, ...FINISHERS.map((f) => `fin_${f}`)]) expect(STRANGER.anims[a]!.frames.some((f) => f.cue === "shout"), a).toBe(true);
    expect(STRANGER.anims.block!.frames.some((f) => f.cue === "clang")).toBe(true);
    // (His thinking lasts at least his block, so his finisher comes as it ends: the block's whole animation within it.)
    expect(animLength(STRANGER.anims.block!)).toBeLessThanOrEqual(FINISHER_BLOCK_MS);
    expect(STRANGER_SOUNDS.shout).toBe("gkHyuah");
  });

  it("where he stands to strike: beside the piece, toward the board's middle, his head no more than a little over the board's top", () => {
    for (const computer of [false, true])
      for (const o of ["white", "black"] as const)
        for (const f of "abcdefgh")
          for (let r = 1; r <= 8; r++) {
            const at = finisherStand(`${f}${r}`, o, computer);
            expect(at.x, `${f}${r}`).toBeGreaterThan(15);
            expect(at.x, `${f}${r}`).toBeLessThan(85);
            expect(at.y, `${f}${r}`).toBeLessThanOrEqual(100);
            expect(at.y - (110 * 38) / 128, `${f}${r}`).toBeGreaterThanOrEqual(computer ? -0.01 : -8.01);
          }
  });

  it("his hop never rises above his corner on a phone (the highest the e2e proves on screen), nor his head over the board's top on a computer", () => {
    for (const computer of [false, true])
      for (const o of ["white", "black"] as const)
        for (const f of "abcdefgh")
          for (let r = 1; r <= 8; r++) {
            const corner = cornerOf(computer);
            const stand = finisherStand(`${f}${r}`, o, computer);
            const h = hopHeight(corner, stand, computer);
            // (The whole arc, both ways: its highest point is at u = 0.5 only when its ends are level.)
            let top = Infinity;
            for (let i = 0; i <= 100; i++) top = Math.min(top, arc(corner, stand, h, i / 100).y, arc(stand, corner, h, i / 100).y);
            expect(top, `${f}${r} ${o}${computer ? " computer" : ""}`).toBeGreaterThanOrEqual(computer ? (UP * 38) / 128 - 0.01 : corner.y - 0.01);
            // (A real hop: the full height wherever it fits, and some rise always.)
            expect(h, `${f}${r}`).toBeGreaterThan(4);
          }
  });

  it("his Frostfire's burn is quiet (Grex's tile and burn art: their poof and fizz are Grex's)", () => {
    for (const burnt of [[{ square: "e4", piece: "n" }], [{ square: "e4" }], [{ square: "e4", fizzled: true }]]) expect(fireBurnItems(burnt, 0, true).every((i) => i.quiet), JSON.stringify(burnt)).toBe(true);
    // (Grex's own keeps his poof.)
    expect(fireBurnItems([{ square: "e4", piece: "n" }], 0).some((i) => !i.quiet)).toBe(true);
  });
});

describe("his storm's polish (Eric, Nov 27 and 28; docs/decisions/2026-11-27-stranger-polish.md)", () => {
  const S = STORM_SCENE;

  it("nothing of the storm before its scene: a storm moment still to come says so, one playing gives its clock, none (the storm's turns) neither", () => {
    const m = { kind: "storm" as const, at: 10_000, ms: S.ms, lead: 2249 };
    expect(sceneOf([m], 7000)).toEqual({ at: null, ahead: true });
    expect(sceneOf([m], 7751)).toEqual({ at: 10_000, ahead: false });
    expect(sceneOf([m], 10_000 + S.ms - 1)).toEqual({ at: 10_000, ahead: false });
    expect(sceneOf([m], 10_000 + S.ms)).toEqual({ at: null, ahead: false });
    expect(sceneOf([], 7000)).toEqual({ at: null, ahead: false });
  });

  it("the ring gathers from nothing: each element from its own sword's slam, whole by his grip, never falling; steady through the turns", () => {
    expect(stormLevel(0, S.fireAt - 1)).toMatchObject({ fire: 0, ice: 0 });
    expect(stormLevel(0, S.fireAt + 1).fire).toBeLessThan(0.01);
    expect(stormLevel(0, S.iceAt).ice).toBe(0);
    expect(stormLevel(0, S.gripAt)).toMatchObject({ fire: 1, ice: 1 });
    let last = 0;
    for (let t = S.fireAt; t <= S.gripAt; t += 50) {
      const now = stormLevel(0, t).fire;
      expect(now).toBeGreaterThanOrEqual(last);
      last = now;
    }
    expect(stormLevel(null, 123)).toEqual({ fire: 1, ice: 1, chaos: 0 });
    expect(buildStep(0)).toBe(0);
    expect(buildStep(1)).toBe(STORM_ART.steps);
  });

  it("the ring's build: every pixel joins by the end, the board's edge near each element's start first, the far corner and the outer rim last", () => {
    const { at, ice } = ringArrivals();
    const n = STORM_ART.px;
    expect(at.length).toBe(n * n);
    expect(Math.max(...at)).toBeLessThan(255);
    expect(RING_BUILD.along + RING_BUILD.off + RING_BUILD.rough).toBeCloseTo(1);
    const lo = Math.round((n * STORM_ART.margin) / (1 + 2 * STORM_ART.margin));
    const px = (x: number, y: number) => y * n + x;
    // (The fire: up the left side from the bottom-left corner. The ice: down the right side from the top-right.)
    expect(ice[px(lo, n - lo - 20)]).toBe(0);
    expect(ice[px(n - lo, lo + 20)]).toBe(1);
    expect(at[px(lo, n - lo - 20)]!).toBeLessThan(at[px(lo, lo + 20)]!);
    expect(at[px(lo, lo + 20)]!).toBeLessThan(at[px(n - lo - 20, lo)]!);
    expect(at[px(n - lo, lo + 20)]!).toBeLessThan(at[px(n - lo, n - lo - 20)]!);
    // (On the edge line before the rim far outside it, at the same place along.)
    expect(at[px(lo, 125)]!).toBeLessThan(at[px(1, 125)]! + 40);
  });

  it("his hop's size: from one box to the other, eased, the two ends exact (Eric: 'it almost looked like his size shrunk a bit')", () => {
    const home = { x: 14, y: -4, w: 28 };
    const stand = { x: 50, y: 56, w: 38 };
    expect(fly(home, stand, 14, 0)).toEqual(home);
    expect(fly(home, stand, 14, 1)).toEqual(stand);
    let w = home.w;
    for (let u = 0; u <= 1; u += 0.05) {
      const at = fly(home, stand, 14, u);
      expect(at.w).toBeGreaterThanOrEqual(w - 1e-9);
      w = at.w;
    }
  });

  it("the pieces his swords throw (Eric, Nov 28): the middle's, knocked back a little on the first stab, at the board's edge after the second, home as he leaps away; always on the board", () => {
    const fen = "r1bqkb1r/pp3ppp/2n2n2/2ppp3/2BPP3/2N2N2/PPP2PPP/R1BQK2R w KQkq - 0 6";
    for (const o of ["white", "black"] as const) {
      const all = nudged(fen, o);
      const names = all.map((n) => n.square);
      // (The middle's pieces, not the back ranks' corners.)
      for (const sq of ["d4", "e4", "d5", "e5", "c4", "c5", "c3", "f3", "c6", "f6"]) expect(names, `${sq} (${o})`).toContain(sq);
      for (const sq of ["a1", "h1", "a8", "h8", "a2", "h7"]) expect(names).not.toContain(sq);
      for (const n of all) {
        expect(Math.hypot(n.ux, n.uy)).toBeCloseTo(1);
        expect(thrownAt(n, S.nudgeAt - 1)).toMatchObject({ out: 0, turn: 0 });
        const knocked = thrownAt(n, S.iceAt - 1).out;
        const edge = thrownAt(n, S.iceAt + THROW.blastMs + 1).out;
        expect(knocked - n.shove, `${n.square} knocked`).toBeGreaterThan(THROW.knock * 0.45);
        expect(knocked - n.shove).toBeLessThan(THROW.knock * 1.05);
        expect(edge, `${n.square} blasted further than knocked`).toBeGreaterThanOrEqual(knocked - 0.01);
        expect(thrownAt(n, S.healAt - 1).out).toBeCloseTo(n.far);
        expect(thrownAt(n, S.healAt + S.healMs)).toMatchObject({ out: 0, turn: 0, moving: false });
        // (Its square's middle plus its way out: inside the board at every beat, a bounce and a hop aside.)
        const file = n.square.charCodeAt(0) - 97;
        const rank = Number(n.square[1]);
        const cx = ((o === "white" ? file : 7 - file) + 0.5) * 12.5;
        const cy = ((o === "white" ? 8 - rank : rank - 1) + 0.5) * 12.5;
        for (let t = 0; t <= S.ms; t += 40) {
          const at = thrownAt(n, t);
          const x = cx + n.ux * at.out;
          const y = cy + n.uy * at.out;
          expect(x, `${n.square} at ${t}`).toBeGreaterThan(2);
          expect(x).toBeLessThan(98);
          expect(y).toBeGreaterThan(2);
          expect(y).toBeLessThan(98);
        }
      }
      // (Thrown along one line, they land one behind another, never on one spot.)
      const ends = all.map((n) => `${Math.round(n.ux * 30)},${Math.round(n.uy * 30)},${Math.round(n.far)}`);
      expect(new Set(ends).size).toBe(all.length);
    }
    // (He leaps away, they fly home: from his leap, done before the scene ends.)
    expect(S.healAt).toBeGreaterThanOrEqual(S.leapAt);
    expect(S.healAt + S.healMs).toBeLessThanOrEqual(S.homeAt + 400);
  });
});
