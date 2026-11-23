import { describe, expect, it } from "vitest";
import { BOSS_ROSTER, isPlayable } from "@chessroyale/core";
import { BOUNCE, SNACK, START_FEN, applyMove, bounceCandidates, bounceResult, pieceAt, withoutPiece } from "@chessroyale/chess";
import { BIGBOY, bounceShape } from "../src/characters/bigboy.ts";
import { BIGBOY_SOUNDS, bigBoySound } from "../src/characters/bigboy-sounds.ts";
import { BOSS_KITS } from "../src/characters/kits.ts";
import { EFFECTS, POWER_MOMENTS, animLength, blockItem, cueAt } from "../src/characters/power-art.ts";
import { TOWER_BLOCKS, TOWER_TOPS } from "../src/characters/effects/bigboy-tower.ts";
import { MOVE_MEAN_DB, MOVE_PEAK } from "../src/characters/synth.ts";
import { frameKeys } from "../src/characters/sprite.ts";
import { bounceFen, bounceFlyers, spotSquares } from "../src/components/BigBoy.tsx";

const RAINBOW = ["1", "2", "3", "4", "5", "6"];
const top = (keys: (string | null)[][]) => keys.findIndex((r) => r.some(Boolean));
const kit = BOSS_KITS["Big Boy"]!;

describe("Big Boy, the baby boss", () => {
  it("is the roster's bigboy (🍭), playable, his kit under his name", () => {
    const def = BOSS_ROSTER.find((b) => b.id === "bigboy")!;
    expect(def.kit).toBe("Big Boy");
    expect(isPlayable(def)).toBe(true);
    expect(kit.ch).toBe(BIGBOY);
  });

  it("never rises above his wave in the boss bar (his moments there), so on a phone he stays under its heading", () => {
    const highest = Math.min(...BIGBOY.anims.idle!.frames.map((f) => top(frameKeys(BIGBOY, f))));
    // (His powers' moments play on the board: the snack, the toss from its corner, the bounce.)
    const bar = new Set(Object.values(kit.anims).filter((a) => !["snack", "toss", "bigBounce"].includes(a!)));
    for (const name of bar) {
      BIGBOY.anims[name!]!.frames.forEach((f, i) => expect(top(frameKeys(BIGBOY, f)), `${name} frame ${i + 1}`).toBeGreaterThanOrEqual(highest));
    }
  });

  it("keeps the approved idle, swing and tantrum: the wail is the tantrum with its sound", () => {
    expect(BIGBOY.anims.idle!.frames).toHaveLength(40);
    expect(BIGBOY.anims.swing!.frames).toHaveLength(10);
    expect(BIGBOY.anims.wail!.frames.map((f) => f.layers)).toEqual(BIGBOY.anims.tantrum!.frames.map((f) => f.layers));
    expect(BIGBOY.anims.wail!.frames.filter((f) => f.cue === "wail")).toHaveLength(1);
  });

  it("shows every color of the lollipop's swirl at rest, enough of each to read at phone size", () => {
    const keys = frameKeys(BIGBOY, BIGBOY.anims.idle!.frames[0]!).flat();
    for (const k of RAINBOW) expect(keys.filter((c) => c === k).length, k).toBeGreaterThanOrEqual(20);
  });

  it("has a portrait inside his frame that shows his lips and the whole candy", () => {
    const p = kit.portrait;
    expect(p.x + p.w).toBeLessThanOrEqual(BIGBOY.w);
    expect(p.y + p.h).toBeLessThanOrEqual(BIGBOY.h);
    const keys = frameKeys(BIGBOY, BIGBOY.anims[p.anim]!.frames[p.frame]!);
    const inside = keys.slice(p.y, p.y + p.h).flatMap((r) => r.slice(p.x, p.x + p.w));
    expect(inside).toContain("L");
    const all = (k: string) => keys.flat().filter((c) => c === k).length;
    for (const k of RAINBOW) expect(inside.filter((c) => c === k).length, k).toBe(all(k));
  });
});

describe("his snack", () => {
  const snack = BIGBOY.anims.snack!;
  it("lasts the snack's beats: he waddles over by grabAt, the pawn in his hand after, two noms from nomAt", () => {
    expect(animLength(snack)).toBeCloseTo(SNACK.ms, 0);
    expect(cueAt(snack, "nom")).toBe(SNACK.nomAt);
    expect(snack.frames.filter((f) => f.cue === "nom")).toHaveLength(2);
    // The pawn shows in his hand from the grab until he's eaten it, and never before.
    let t = 0;
    const pawnAt: number[] = [];
    for (const f of snack.frames) {
      if (frameKeys(BIGBOY, f).flat().includes("x")) pawnAt.push(t);
      t += f.ms;
    }
    expect(Math.min(...pawnAt)).toBeGreaterThanOrEqual(SNACK.grabAt);
    expect(Math.max(...pawnAt)).toBeLessThan(SNACK.ms - 500);
  });

  it("eats the crowd's black pawn when it plays Black (his look)", () => {
    expect(BIGBOY.looks!.blackPawn!.x).not.toBe(BIGBOY.palette.x);
    expect(kit.lookOf!({ crowdSide: "b" } as never)).toBe("blackPawn");
    expect(kit.lookOf!({ crowdSide: "w" } as never)).toBeUndefined();
  });
});

describe("his Big Bounce", () => {
  const a = BIGBOY.anims.bigBounce!;
  it("plays from the leap to the end of the moment, a boing on each landing, the crash on the crash, a giggle as they settle", () => {
    expect(animLength(a)).toBe(BOUNCE.total - BOUNCE.leapAt);
    let t = 0;
    const cues: [string, number][] = [];
    for (const f of a.frames) {
      if (f.cue) cues.push([f.cue, t + BOUNCE.leapAt]);
      t += f.ms;
    }
    expect(cues.filter(([c]) => c === "boing").map(([, at]) => at).slice(0, 3)).toEqual([...BOUNCE.lands]);
    expect(cues.find(([c]) => c === "crash")![1]).toBe(BOUNCE.crashAt);
    const giggle = cues.find(([c]) => c === "giggle")![1];
    expect(giggle).toBeGreaterThan(BOUNCE.crashAt);
    expect(giggle).toBeLessThan(BOUNCE.backAt);
    expect(POWER_MOMENTS["Big Boy"]!.ultimate).toMatchObject({ anim: "bigBounce", hit: "crash", onBoard: true });
  });

  it("squashes as he lands and at the crash, stretches as he springs", () => {
    const L = BOUNCE.leapAt;
    for (const land of BOUNCE.lands) {
      expect(bounceShape(land - L + 50)).toBe("squash");
      expect(bounceShape(land - L - 50)).toBe("stretch");
    }
    expect(bounceShape(BOUNCE.crashAt - L + 50)).toBe("crash");
    expect(bounceShape(BOUNCE.settledAt - L)).toBeNull();
  });

  it("knocks up every piece on his spots and the middle; the moved ones land on their new squares before the board settles", () => {
    let fen = withoutPiece(START_FEN, "e2");
    for (const m of ["g1f3", "d7d5", "b1c3", "g8f6", "d2d4", "c8f5"]) fen = applyMove(fen, m);
    for (let seed = 0; seed < 20; seed++) {
      const c = bounceCandidates(fen, "w", seed, 4)[0]!;
      const b = bounceResult(fen, "w", seed, 4, c, 1);
      const after = c.fen;
      const flyers = bounceFlyers(b);
      for (const m of b.moves) {
        const f = flyers.find((x) => x.from === m.from)!;
        expect(f.hop).toBe(false);
        expect(f.to).toBe(m.to);
        expect(f.up).toBeLessThan(BOUNCE.settleAt);
        expect(f.land).toBeLessThanOrEqual(BOUNCE.settledAt);
      }
      // Everything under a spot goes up as he lands there, but a king (the board always has both).
      b.spots.forEach((sp, k) =>
        spotSquares(sp).forEach((sq) => {
          const pc = pieceAt(fen, sq);
          if (pc?.type === "k") expect(flyers.some((x) => x.from === sq)).toBe(false);
          else if (pc) expect(flyers.find((x) => x.from === sq)!.up).toBeLessThanOrEqual(BOUNCE.lands[k]!);
        }),
      );
      // The board: the position before; less what's in the air; then the new one.
      const m = { kind: "bounce" as const, at: 1000 };
      expect(bounceFen(b, m, 1000, after)).toBe(fen);
      expect(bounceFen(b, m, 1000 + BOUNCE.settledAt, after)).toBe(after);
      const mid = bounceFen(b, m, 1000 + BOUNCE.crashAt + 10, after)!;
      for (const f of flyers) if (!f.hop) expect(pieceAt(mid, f.from)).toBeNull();
      // Just before it settles, every moved piece is on its new square already, and nothing stands on another.
      const late = bounceFen(b, m, 1000 + BOUNCE.settledAt - 1, after)!;
      expect(late.split(" ")[0]).toBe(after.split(" ")[0]);
    }
  });
});

describe("his toy block", () => {
  it("is block n from his tower (1 to 10): landing (a clack), sitting, puffing away (ends empty), tumbling in flight", () => {
    const fx = EFFECTS.toyBlock;
    for (let n = 1; n <= 10; n++) {
      expect(fx.ch.anims[`land${n}`]!.frames.some((f) => f.cue === "clack")).toBe(true);
      expect(fx.ch.anims[`sit${n}`]!.loop).toBe(true);
      expect(fx.ch.anims[`poof${n}`]!.frames.at(-1)!.layers).toEqual([]);
      expect(EFFECTS.blockFly.ch.anims[`fly${n}`]!.loop).toBe(true);
    }
    expect(fx.sounds).toEqual({ clack: "bigboyClack", poof: "bigboyPoof" });
    expect(blockItem("c3", "land", 5, 3)).toEqual({ square: "c3", name: "toyBlock", anim: "land3", then: "sit3", since: 5 });
    expect(blockItem("c3", "sit", 5, 12).anim).toBe("sit10");
    expect(POWER_MOMENTS["Big Boy"]!.power).toMatchObject({ anim: "toss", hit: "toss" });
    expect(cueAt(BIGBOY.anims.toss!, "toss")).not.toBeNull();
  });

  it("fills the middle of its square, and nothing of it (outline included) is cut off at the square's edge", () => {
    const keys = frameKeys(EFFECTS.toyBlock.ch, EFFECTS.toyBlock.ch.anims.sit1!.frames[0]!);
    expect(keys[15]![15]).toBeTruthy();
    expect(keys.flat().filter(Boolean).length).toBeGreaterThan(32 * 32 * 0.4);
    // (They're drawn in the tower's frame and cut out as one square: every part's box, its outline too, inside the square.)
    for (const ch of [EFFECTS.toyBlock.ch, EFFECTS.blockFly.ch])
      for (const [name, an] of Object.entries(ch.anims))
        an.frames.forEach((f, i) => {
          for (const l of f.layers) {
            const p = ch.parts[l.part]!;
            const o = p.outline === false ? 0 : 1;
            const [w, h] = (l.rot ?? 0) % 2 ? [p.grid.length, p.grid[0]!.length] : [p.grid[0]!.length, p.grid.length];
            expect([l.x - o, l.y - o, 32 - (l.x + w + o), 32 - (l.y + h + o)].every((v) => v >= 0), `${name} frame ${i}: ${l.part}`).toBe(true);
          }
        });
  });
});

describe("his tower, seen from above (Nov 18)", () => {
  const ch = EFFECTS.toyTower.ch;
  const keysOf = (a: string, i: number) => frameKeys(ch, ch.anims[a]!.frames[i]!);
  it("stands 1 to 10 blocks (the sway from rest), adds each block (its fall the 120 ms before its clack, ending as it stands), tips over (ending empty)", () => {
    for (let n = 1; n <= 10; n++) {
      expect(ch.anims[`stand${n}`]!.loop).toBe(true);
      const add = ch.anims[`add${n}`]!;
      const clack = add.frames.findIndex((f) => f.cue === "clack");
      expect(add.frames.slice(0, clack).reduce((s, f) => s + f.ms, 0), `add${n}`).toBe(120);
      expect(keysOf(`add${n}`, add.frames.length - 1), `add${n} ends as stand${n}`).toEqual(keysOf(`stand${n}`, 0));
      if (n >= 2) {
        expect(ch.anims[`tip${n}`]!.frames[0]!.cue).toBe("crash");
        expect(ch.anims[`tip${n}`]!.frames.at(-1)!.layers).toEqual([]);
      }
    }
  });

  it("stays about on its square: centered on it, the tallest no more than about three quarters of a square above it, nothing at the frame's edge", () => {
    expect([ch.w, ch.h]).toEqual([96, 96]);
    expect(TOWER_BLOCKS).toHaveLength(10);
    for (const [x, y] of TOWER_BLOCKS) expect(Math.abs(x - 48) <= 4 && y <= 48 && y >= 20).toBe(true);
    expect(TOWER_TOPS[9]!).toBeGreaterThanOrEqual(32 - 26);
    for (const name of ["stand10", "add10", "tip10"])
      ch.anims[name]!.frames.forEach((_, i) => {
        const k = keysOf(name, i);
        const edge = k[0]!.some(Boolean) || k[95]!.some(Boolean) || k.some((r) => r[0] || r[95]);
        expect(edge, `${name} frame ${i}`).toBe(false);
      });
  });
});

describe("his sounds", () => {
  it("are all his own (no borrowed ones), one for every cue", () => {
    for (const [cue, sound] of Object.entries(kit.sounds)) expect(sound, cue).toMatch(/^bigboy/);
    for (const [name, an] of Object.entries(BIGBOY.anims)) for (const f of an.frames) if (f.cue) expect(kit.sounds[f.cue], `${name}: ${f.cue}`).toBeTruthy();
  });

  it("sound no louder than a piece's move, and the same every time", () => {
    for (const name of BIGBOY_SOUNDS) {
      const s = bigBoySound(name, 44100);
      let peak = 0;
      let sum = 0;
      for (const v of s) {
        expect(Number.isFinite(v)).toBe(true);
        peak = Math.max(peak, Math.abs(v));
        sum += v * v;
      }
      expect(peak, name).toBeLessThan(MOVE_PEAK / 2);
      expect(10 * Math.log10(sum / s.length), name).toBeLessThan(MOVE_MEAN_DB - 2);
      expect(s, `${name} is the same every time`).toEqual(bigBoySound(name, 44100));
    }
  });

  it("have no chimes or bright dings: baby noises and toys, their energy low and soft", () => {
    for (const name of BIGBOY_SOUNDS) {
      const s = bigBoySound(name, 44100);
      let e = 0;
      let d = 0;
      for (let i = 1; i < s.length; i++) {
        e += s[i]! ** 2;
        d += (s[i]! - s[i - 1]!) ** 2;
      }
      expect((Math.sqrt(d / e) * 44100) / (2 * Math.PI), name).toBeLessThan(2500);
    }
  });
});
