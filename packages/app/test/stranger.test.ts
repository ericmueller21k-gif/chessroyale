// The Stranger's art (Nov 27; docs/decisions/2026-11-27-stranger-art.md), drawn ahead of his rules: his figure (and its locked look), his
// kit (in BOSS_KITS with his rules since Nov 27, the roster's `stranger`), his square's fire and ice, and his sounds. The same checks characters.test.ts and
// boss-character.test.ts make of every boss, plus his own: swords on his back at rest, drawn before every move, the tips meeting.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ART_KITS, BOSS_KITS, STRANGER_FLOURISH_EVERY, STRANGER_SLASHES, strangerAnim } from "../src/characters/kits.ts";
import { FINISHERS, FINISHER_BLOCK_MS } from "@chessroyale/chess";
import { animLength } from "../src/characters/power-art.ts";
import { finishTimeline, finisherStand } from "../src/components/Stranger.tsx";
import { EFFECTS } from "../src/characters/power-art.ts";
import { POSES, STRANGER, STRANGER_FOOT, STRANGER_PORTRAIT, STRANGER_SOUNDS, TIPS_AT } from "../src/characters/stranger.ts";
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
      expect(tl.homeAt + 100, kind).toBeLessThanOrEqual(tl.ms);
      if (kind === "ice") expect(tl.shatterAt).toBeGreaterThan(tl.hitAt + 400);
      if (kind === "frostfire") expect(tl.igniteAt).toBeGreaterThan(tl.hitAt);
    }
    // His shout (the God King's, Eric's) as every strike winds up; his clang as he blocks.
    for (const a of [...STRANGER_SLASHES, ...FINISHERS.map((f) => `fin_${f}`)]) expect(STRANGER.anims[a]!.frames.some((f) => f.cue === "shout"), a).toBe(true);
    expect(STRANGER.anims.block!.frames.some((f) => f.cue === "clang")).toBe(true);
    // (His finisher waits for his block: the block's whole animation within the wait.)
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
});
