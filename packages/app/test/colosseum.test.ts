import { describe, expect, it, vi } from "vitest";
import { START_FEN, applyMove } from "@chessroyale/chess";
import { BLACK_VIEW, BOARD, BOARD_SPHERE, FLOOR_R, GALLERY_H, GALLERY_R, HIGH, HIGH_VIEW, HIGH_VIEWS, PILLARS, PILLAR_ANGLES, SEAT_VIEWS, STANDS, STATUE, VIEWS, WHITE_VIEW, fovFor, isHigh, lookAt, multiply, onAisle, otherSeat, perspective, project, railPitch, rowR, rowY, seats, squareXZ, turnLimits, viewFor, viewsFor } from "../src/colosseum/arena.ts";
import { PILLAR_TOP_PX } from "../src/colosseum/art.ts";
import { ARENA_PILLAR } from "../src/colosseum/sprites/arena-pillar.ts";
import { ARENA_STATUE } from "../src/colosseum/sprites/arena-statue.ts";
import { AMBIENT_DB, AMBIENT_LEVELS, AMBIENT_LEVEL_NAME, ambientLevelOf } from "../src/colosseum/ambient.ts";
import { FLOOR, FloorMatch, PLAYERS, clockText, evalText, piecesAfter, piecesOf, resultText, viewersText, type FloorDeps } from "../src/colosseum/match.ts";
import { BOTS } from "../src/town/world.ts";

/** The Colosseum's first look (Oct 30): its layout, its views and the game on its floor (docs/areas/colosseum.md). */

/** Where world points land through a view, on a w × h screen, turned by yaw and pitch. */
function screenOf(v: (typeof VIEWS)[number], w: number, h: number, yaw = 0, pitch = 0) {
  const p = new Float32Array(16);
  const m = new Float32Array(16);
  const vp = new Float32Array(16);
  perspective(p, fovFor(v, w / h), w / h, 0.2, 120);
  lookAt(m, v.eye, v.at, yaw, pitch, new Float32Array(3));
  multiply(vp, p, m);
  return (x: number, y: number, z: number) => project(vp, x, y, z, w, h);
}
const SCREENS = [
  ["phone's arena", 390, 262],
  ["computer", 1440, 848],
] as const;
/** Every view as a screen of this shape gets it (the high views' eyes set for it). */
const viewsOf = (w: number, h: number) => viewsFor(w / h, w > 900);

describe("the arena", () => {
  it("seats some two thousand people, every row full but its aisles", () => {
    const all = seats();
    expect(all.length).toBeGreaterThan(1800);
    for (const s of all) expect(onAisle(Math.atan2(s.x, s.z), Math.hypot(s.x, s.z))).toBe(false);
    // Everyone faces the middle.
    for (const s of all.slice(0, 50)) expect(Math.cos(s.face - Math.atan2(-s.x, -s.z))).toBeCloseTo(1, 6);
  });

  it("has fourteen views: eight seats at eight angles (lower and higher), White's and Black's player views, then the four high views going round the board", () => {
    expect(VIEWS).toHaveLength(14);
    expect(SEAT_VIEWS).toBe(8);
    const angles = VIEWS.slice(0, 8).map((v) => Math.round((Math.atan2(v.eye[0], v.eye[2]) * 180) / Math.PI + 360) % 360);
    expect(new Set(angles).size).toBe(8);
    const heights = VIEWS.slice(0, 8).map((v) => v.eye[1]);
    expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(3);
    // The player views: about 20 feet (6 m) above the board, behind their own end.
    expect(VIEWS[WHITE_VIEW]!.eye[1]).toBe(6);
    expect(VIEWS[WHITE_VIEW]!.eye[2]).toBeGreaterThan(4);
    expect(VIEWS[BLACK_VIEW]!.eye[2]).toBeLessThan(-4);
    expect(viewFor("white")).toBe(WHITE_VIEW);
    expect(viewFor("black")).toBe(BLACK_VIEW);
    // The page opens on the high view behind White (the director, Nov 1: Eric found the seats too close).
    expect(viewFor(null)).toBe(HIGH_VIEW);
    expect(HIGH_VIEWS).toBe(4);
    expect([...VIEWS.keys()].filter(isHigh)).toEqual([10, 11, 12, 13]);
    // Behind White, its right (the h-file's side), behind Black, its left: high up, looking down 40 to 47 degrees at the board's middle.
    for (const [w, h] of SCREENS.map(([, w, h]) => [w, h]))
      viewsOf(w, h).forEach((v, i) => {
        if (!isHigh(i)) return;
        const deg = Math.round((Math.atan2(v.eye[0], v.eye[2]) * 180) / Math.PI + 360) % 360;
        expect(deg).toBe([0, 90, 180, 270][i - HIGH_VIEW]);
        const down = (Math.atan2(v.eye[1] - v.at[1], Math.hypot(v.eye[0] - v.at[0], v.eye[2] - v.at[2])) * 180) / Math.PI;
        expect(down).toBeGreaterThanOrEqual(40);
        expect(down).toBeLessThanOrEqual(47.01);
        // (Aimed a little past the board's middle, along the way you look.)
        expect(Math.hypot(v.at[0], v.at[2])).toBeLessThan(1.5);
        expect(v.eye[1]).toBeGreaterThan(12);
      });
  });

  it.each(SCREENS)("the high views: the whole board and the floor round it, the board filling the frame about as Eric's picture does, the lower stands in view, nothing in the stands between the eye and the board (%s)", (_, w, h) => {
    const all = viewsOf(w, h);
    const computer = w > 900;
    for (let i = HIGH_VIEW; i < HIGH_VIEW + HIGH_VIEWS; i++) {
      const v = all[i]!;
      const at = screenOf(v, w, h);
      const B = BOARD.half + BOARD.rim;
      const pts = [-B, B].flatMap((x) => [-B, B].map((z) => at(x, BOARD.lift, z)!));
      const ys = pts.map((p) => p[1]);
      const xs = pts.map((p) => p[0]);
      // The board and its border: about the share the picture gives it (computer: the overlay takes the top and the right).
      const share = (Math.max(...ys) - Math.min(...ys)) / h;
      expect(share).toBeGreaterThan((computer ? HIGH.computer.share : HIGH.phone.share) - 0.02);
      expect(share).toBeLessThanOrEqual((computer ? HIGH.computer.share : HIGH.phone.share) + 1e-6);
      expect((Math.max(...xs) - Math.min(...xs)) / w).toBeLessThanOrEqual((computer ? HIGH.computer.wide : HIGH.phone.wide) + 1e-6);
      // The floor round it: the arena wall's foot across the board from you is on screen, and so are the lower stands where
      // they come round on either side (row 2's front, 50 degrees from straight across).
      const a = Math.atan2(v.eye[0], v.eye[2]) + Math.PI;
      const wall = at(Math.sin(a) * FLOOR_R, 0, Math.cos(a) * FLOOR_R)!;
      expect(wall[1]).toBeGreaterThan(0);
      for (const side of [-1, 1]) {
        const b = a + (side * 50 * Math.PI) / 180;
        const row = at(Math.sin(b) * rowR(1), rowY(1), Math.cos(b) * rowR(1))!;
        expect(row[0]).toBeGreaterThan(0);
        expect(row[0]).toBeLessThan(w);
        expect(row[1]).toBeGreaterThan(0);
        expect(row[1]).toBeLessThan(h);
      }
      // Inside the gallery wall and above it, so no step, row or wall stands between the eye and any of the board.
      const r = Math.hypot(v.eye[0], v.eye[2]);
      expect(r).toBeLessThan(GALLERY_R);
      for (const x of [-B, B])
        for (const z of [-B, B]) {
          for (let k = 0; k < STANDS.rows; k++) {
            // Where the line from the eye to this corner crosses row k's front edge (if it does), it's well above the row's heads.
            const R0 = rowR(k);
            const d0 = Math.hypot(x, z);
            if (R0 > r || R0 < d0) continue;
            const t = (r - R0) / (r - d0);
            expect(v.eye[1] + (BOARD.lift - v.eye[1]) * t).toBeGreaterThan(rowY(k) + 1.5);
          }
          expect(v.eye[1]).toBeGreaterThan(rowY(STANDS.rows - 1) + GALLERY_H);
        }
    }
  });

  it("no pillar or statue stands between a seat and the board (each seat's angle half-way between two)", () => {
    for (const v of VIEWS.slice(0, 8)) {
      const a = Math.atan2(v.eye[0], v.eye[2]);
      for (const p of [...PILLAR_ANGLES, ...STATUE.angles]) {
        const d = Math.abs(Math.atan2(Math.sin(a - p), Math.cos(a - p)));
        expect(d).toBeGreaterThan(Math.PI / 8 - 1e-6);
      }
    }
    expect(PILLAR_ANGLES.length + STATUE.angles.length).toBe(PILLARS.places);
  });

  it.each(SCREENS)("no pillar or statue hides any of the board (its squares and border) from any of the views (%s)", (_, sw, sh) => {
    // Each figure as drawn (arena-gl.ts buildFigures): a picture its drawing's shape, turned to face the eye. Lines from the eye
    // through points all over it, carried on to the board's height: none lands on the board behind it.
    const pillarTall = (PILLARS.h * ARENA_PILLAR.h) / (ARENA_PILLAR.h - PILLAR_TOP_PX);
    const figures = [
      ...PILLAR_ANGLES.map((a) => ({ a, r: PILLARS.r, h: pillarTall, hw: (pillarTall * ARENA_PILLAR.w) / ARENA_PILLAR.h / 2 })),
      ...STATUE.angles.map((a) => ({ a, r: STATUE.r, h: STATUE.h, hw: (STATUE.h * ARENA_STATUE.w) / ARENA_STATUE.h / 2 })),
    ];
    const B = BOARD.half + BOARD.rim;
    const views = viewsOf(sw, sh);
    for (const v of views)
      for (const f of figures) {
        const px = Math.sin(f.a) * f.r;
        const pz = Math.cos(f.a) * f.r;
        const l = Math.hypot(v.eye[0] - px, v.eye[2] - pz);
        const rx = (v.eye[2] - pz) / l;
        const rz = -(v.eye[0] - px) / l;
        for (let i = 0; i <= 20; i++)
          for (let j = 0; j <= 40; j++) {
            const s = -f.hw + (2 * f.hw * i) / 20;
            const q = [px + rx * s, (f.h * j) / 40, pz + rz * s];
            const dy = q[1]! - v.eye[1];
            if (dy >= 0) continue;
            const t = (BOARD.lift - v.eye[1]) / dy;
            const x = v.eye[0] + (q[0]! - v.eye[0]) * t;
            const z = v.eye[2] + (q[2]! - v.eye[2]) * t;
            expect(t < 1 || Math.abs(x) > B || Math.abs(z) > B, `a figure at ${Math.round((f.a * 180) / Math.PI)}° hides the board from view ${views.indexOf(v)}`).toBe(true);
          }
      }
  });

  it.each(SCREENS)("the railing at the foot of a seat's view never covers the board: at rest, turned either way, and looking up as far as it may (%s)", (_, w, h) => {
    // (The computer's lens is shifted down by the cards along the top: Colosseum.tsx, about 102 px.)
    const shift = w > 900 ? 102 / h : 0;
    const rail = 32 / h;
    const lim = { yaw: 0, pitch: 0 };
    for (const v of VIEWS.slice(0, SEAT_VIEWS)) {
      turnLimits(v, w / h, lim);
      const up = railPitch(v, w / h, shift, rail, lim.yaw, lim.pitch);
      expect(up, "you can still look up a little").toBeGreaterThan(0);
      for (const yaw of [-lim.yaw, 0, lim.yaw])
        for (const pitch of [0, up, -lim.pitch]) {
          const p = new Float32Array(16);
          const m = new Float32Array(16);
          const vp = new Float32Array(16);
          perspective(p, fovFor(v, w / h), w / h, 0.2, 120);
          p[9] = shift;
          lookAt(m, v.eye, v.at, yaw, pitch, new Float32Array(3));
          multiply(vp, p, m);
          for (const [x, z] of [[-4, -4], [4, -4], [4, 4], [-4, 4]]) expect(project(vp, x!, BOARD.lift, z!, w, h)![1]).toBeLessThan(h * (1 - rail));
        }
    }
  });

  it.each(SCREENS)("every view shows the whole board, turned as far as it may go each way (%s)", (_, w, h) => {
    const lim = { yaw: 0, pitch: 0 };
    for (const v of viewsOf(w, h)) {
      turnLimits(v, w / h, lim);
      expect(lim.yaw).toBeGreaterThan(0);
      for (const [yaw, pitch] of [[0, 0], [lim.yaw, 0], [-lim.yaw, 0], [0, lim.pitch], [0, -lim.pitch]] as const) {
        const at = screenOf(v, w, h, yaw, pitch);
        // The board's middle stays on screen, and so does at least one of its corners.
        const mid = at(0, 0, 0)!;
        expect(mid[0]).toBeGreaterThan(0);
        expect(mid[0]).toBeLessThan(w);
        expect(mid[1]).toBeGreaterThan(0);
        expect(mid[1]).toBeLessThan(h);
      }
      // Not turned: all four corners.
      const at = screenOf(v, w, h);
      for (const [x, z] of [[-4, -4], [4, -4], [4, 4], [-4, 4]]) {
        const p = at(x!, 0, z!)!;
        expect(p[0]).toBeGreaterThan(-1);
        expect(p[0]).toBeLessThan(w + 1);
        expect(p[1]).toBeGreaterThan(-1);
        expect(p[1]).toBeLessThan(h + 1);
      }
    }
    expect(BOARD_SPHERE).toBeGreaterThan(4);
  });

  it("White's view has White's first rank nearest (lower on screen), Black's the reverse", () => {
    const w = screenOf(VIEWS[WHITE_VIEW]!, 800, 600);
    const b = screenOf(VIEWS[BLACK_VIEW]!, 800, 600);
    const [x1, z1] = squareXZ("e1");
    const [x8, z8] = squareXZ("e8");
    expect(w(x1, 0, z1)![1]).toBeGreaterThan(w(x8, 0, z8)![1]);
    expect(b(x8, 0, z8)![1]).toBeGreaterThan(b(x1, 0, z1)![1]);
    // a-file on White's left.
    expect(w(...([squareXZ("a1")[0], 0, squareXZ("a1")[1]] as const))![0]).toBeLessThan(w(squareXZ("h1")[0], 0, squareXZ("h1")[1])![0]);
  });

  it("Change seat always picks another of the eight seats and the four high views, each of them in time, never a player view", () => {
    const pickable = [0, 1, 2, 3, 4, 5, 6, 7, 10, 11, 12, 13];
    for (const from of pickable) {
      const seen = new Set<number>();
      for (let i = 0; i < 110; i++) {
        const to = otherSeat(from, i / 110);
        expect(to).not.toBe(from);
        expect(pickable).toContain(to);
        seen.add(to);
      }
      expect(seen.size).toBe(11);
    }
    // From a player view: any of the twelve.
    const seen = new Set([0, 0.2, 0.4, 0.6, 0.8, 0.99].map((r) => otherSeat(WHITE_VIEW, r)));
    for (const v of seen) expect(pickable).toContain(v);
    expect(otherSeat(WHITE_VIEW, 0.99)).toBe(13);
  });
});

describe("the game on the floor", () => {
  it("reads a position's pieces, and a move's slide, capture, castling and en passant", () => {
    expect(piecesOf(START_FEN)).toHaveLength(32);
    const a = piecesAfter(START_FEN, "e2e4", applyMove(START_FEN, "e2e4"));
    expect(a.took).toBeNull();
    expect(a.pieces.find((p) => p.sq === "e4")).toMatchObject({ key: "wp", from: "e2" });
    expect(a.pieces.filter((p) => p.from)).toHaveLength(1);
    const castle = "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1";
    const c = piecesAfter(castle, "e1g1", applyMove(castle, "e1g1"));
    expect(c.pieces.find((p) => p.sq === "f1")).toMatchObject({ key: "wr", from: "h1" });
    expect(c.pieces.find((p) => p.sq === "g1")).toMatchObject({ key: "wk", from: "e1" });
    const ep = "4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2";
    const e = piecesAfter(ep, "e5d6", applyMove(ep, "e5d6"));
    expect(e.took).toBe("p");
    expect(e.pieces.find((p) => p.taken)).toMatchObject({ key: "bp", sq: "d5" });
    const qx = "4k3/8/8/3q4/4P3/8/8/4K3 w - - 0 1";
    const q = piecesAfter(qx, "e4d5", applyMove(qx, "e4d5"));
    expect(q.took).toBe("q");
    expect(q.pieces.find((p) => p.taken)).toMatchObject({ key: "bq", sq: "d5" });
  });

  it("says clocks, evals, viewers and results the overlay's way", () => {
    expect(clockText(180_000)).toBe("3:00");
    expect(clockText(61_001)).toBe("1:02");
    expect(clockText(9_400)).toBe("0:09.4");
    expect(evalText(0.5, null)).toBe("0.0");
    expect(evalText(0.53, null)).toMatch(/^\+0\.\d$/);
    expect(evalText(0.2, null)).toMatch(/^−\d\.\d$/);
    expect(evalText(0.9, 3)).toBe("M3");
    expect(evalText(0.1, -2)).toBe("−M2");
    expect(viewersText(2103)).toBe("2.1K");
    expect(viewersText(950)).toBe("950");
    expect(resultText({ result: "1-0", reason: "checkmate" })).toBe("White wins by checkmate");
    expect(resultText({ result: "0-1", reason: "time" })).toBe("Black wins on time");
    expect(resultText({ result: "1/2-1/2", reason: "repetition" })).toBe("Draw by repetition");
  });

  it("plays only town bots Stockfish can play at their rating", () => {
    expect(PLAYERS.length).toBeGreaterThan(6);
    for (const i of PLAYERS) expect(BOTS[i]!.rating).toBeGreaterThanOrEqual(1300);
  });

  it("plays a game to its end (fool's mate), the queen's capture marked, then starts the next with two new clocks", async () => {
    let t = 0;
    const line = ["f2f3", "e7e5", "g2g4", "d8h4"];
    const seen: { game: number; status: string; plies: number }[] = [];
    let jumps = 0;
    const deps: FloorDeps = {
      move: async (fen) => line[fen.includes(" w ") ? (fen.split(" ")[5] === "1" ? 0 : 2) : fen.split(" ")[5] === "1" ? 1 : 3]!,
      evaluate: async () => ({ white: 0.4, mate: null }),
      now: () => t,
      random: () => 0.3,
      wait: async (ms) => {
        t += ms;
        return seen.filter((s) => s.status === "waiting").length < 3;
      },
      think: () => 1000,
      nextMs: () => 2000,
    };
    const m = new FloorMatch(deps, (s) => {
      seen.push({ game: s.game, status: s.status, plies: s.moves.length });
      if (s.queenTaken) jumps++;
    });
    await m.run();
    const over = seen.find((s) => s.status === "over")!;
    expect(over).toMatchObject({ game: 1, plies: 4 });
    expect(seen.some((s) => s.game === 2 && s.status === "waiting")).toBe(true);
    expect(jumps).toBe(0);
    // Each side's clock: 3 minutes, less a second a move, plus the 2-second increment.
    expect(FLOOR.baseMs).toBe(180_000);
    expect(FLOOR.incMs).toBe(2_000);
  });

  it("marks each move's piece sound as a played game's: a move, castling, a capture (Eric, Oct 31)", async () => {
    const line = ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "f8c5", "e1g1", "c5f2"];
    const knocks: string[] = [];
    let ply = 0;
    const m = new FloorMatch(
      {
        move: (fen) => (ply < line.length && fen ? Promise.resolve(line[ply++]!) : new Promise(() => {})),
        evaluate: async () => null,
        now: () => 0,
        random: () => 0.3,
        wait: async () => true,
        think: () => 10,
        nextMs: () => 10,
      },
      (s) => {
        if (s.knock) knocks.push(s.knock);
        s.knock = null; // (The screen clears it once played: an eval's update after doesn't play it again.)
      },
    );
    void m.run();
    await vi.waitFor(() => expect(knocks).toHaveLength(8));
    m.stop();
    expect(knocks).toEqual(["move", "move", "move", "move", "move", "move", "castle", "capture"]);
  });

  it("the gear's ambient levels: Normal 4 dB and Low 12 dB under the file as made; the old On is Normal, Off stays Off", () => {
    expect(AMBIENT_LEVELS).toEqual(["normal", "low", "off"]);
    expect(AMBIENT_DB).toMatchObject({ normal: -4, low: -12 });
    expect(Object.values(AMBIENT_LEVEL_NAME)).toEqual(["Normal", "Low", "Off"]);
    expect([null, "on", "normal", "low", "off", "junk"].map(ambientLevelOf)).toEqual(["normal", "normal", "normal", "low", "off", "normal"]);
  });

  it("flags the side to move (the e2e's way to end a game at once) and calls a flag a loss on time", () => {
    const m = new FloorMatch({ move: () => new Promise(() => {}), evaluate: async () => null, now: () => 0, random: () => 0.5, wait: async () => true }, () => {});
    m.state.status = "playing";
    m.flag();
    expect(m.state).toMatchObject({ status: "over", result: "0-1", reason: "time" });
  });
});

describe("the bosses in the crowd (Eric, Oct 30)", () => {
  it("each boss with a sidekick sits once, its sidekick beside it, in rows 1 to 3, at the same seats whatever the view, never covering the board", async () => {
    const { buildCrowd } = await import("../src/colosseum/arena-gl.ts");
    const { bossSeats, coversBoard, rowY, seatR } = await import("../src/colosseum/arena.ts");
    const homes = BOTS.flatMap((b) => ("sprite" in b.look && b.boss ? [b.boss] : []));
    expect(homes.length).toBeGreaterThan(10);
    const r = { u0: 0, v0: 0, u1: 1, v1: 1 };
    // A crowd's cells as crowdArt makes them: pawns, the sidekicks, the bosses (each cell's u0 marks which it is).
    const cells = [
      ...[0, 1, 2].map((i) => ({ rect: { ...r, u0: i / 100 }, foot: 1, meters: 0.6, kind: "pawn" as const })),
      ...homes.map((h, i) => ({ rect: { ...r, u0: 0.2 + i / 100 }, foot: 1, meters: 0.64, kind: "sidekick" as const, home: h })),
      ...homes.map((h, i) => ({ rect: { ...r, u0: 0.5 + i / 100 }, foot: 1, meters: 1.4, kind: "boss" as const, home: h })),
    ];
    const a = buildCrowd({ cells });
    expect(buildCrowd({ cells }), "the same seats on every build").toEqual(a);
    const at = (u0: number) => {
      const out: { x: number; y: number; z: number }[] = [];
      for (let o = 0; o < a.length; o += 20) if (Math.abs(a[o + 4]! - u0) < 1e-6) out.push({ x: a[o]!, y: a[o + 1]!, z: a[o + 2]! });
      return out;
    };
    homes.forEach((_, i) => {
      const kid = at(0.2 + i / 100);
      const boss = at(0.5 + i / 100);
      expect(kid.length, "each sidekick once").toBe(1);
      expect(boss.length, "each boss once").toBe(1);
      expect(Math.hypot(kid[0]!.x - boss[0]!.x, kid[0]!.z - boss[0]!.z), "side by side").toBeLessThan(1.3);
      expect(kid[0]!.y).toBe(boss[0]!.y);
      expect(boss[0]!.y, "rows 1 to 3").toBeLessThanOrEqual(rowY(2) + 1e-6);
    });
    // The seats come from the layout alone (no view goes in), and none covers the board from any of the views, the high views
    // (Nov 1) on a phone and a computer too (the bosses keep the seats they had: the high views take no part in choosing them).
    const seatsNow = bossSeats(homes.length);
    expect(seatsNow).toEqual(bossSeats(homes.length));
    for (const v of [...VIEWS, ...SCREENS.flatMap(([, w, h]) => viewsOf(w, h).filter((_, i) => isHigh(i)))])
      for (const p of seatsNow) {
        expect(coversBoard(v, p.boss, 0.8, 1.75)).toBe(false);
        expect(coversBoard(v, p.kid, 0.42, 1.0)).toBe(false);
      }
    // (And the check does catch one: a boss two rows straight in front of the first seat would cover it.)
    expect(coversBoard(VIEWS[0]!, { x: 0, y: rowY(1), z: seatR(1) }, 0.8, 1.75)).toBe(true);
  });
});

describe("the 3D pieces (the gear's 3D pieces; pieces3d.ts)", () => {
  it("six meshes, built once: whole triangles, unit normals, standing on the board, sized to a square, the king tallest", async () => {
    const { KINDS, MAT, PV, pieceMeshes, triangulate, KNIGHT_OUTLINE } = await import("../src/colosseum/pieces3d.ts");
    const all = pieceMeshes();
    let verts = 0;
    for (const k of KINDS) {
      const m = all[k];
      const n = m.verts.length / PV;
      verts += n;
      expect(m.index.length % 3, k).toBe(0);
      expect(Math.max(...m.index), k).toBeLessThan(n);
      let minY = Infinity;
      let maxR = 0;
      for (let i = 0; i < m.verts.length; i += PV) {
        const [x, y, z, nx, ny, nz, mat] = m.verts.subarray(i, i + PV);
        expect(Math.hypot(nx!, ny!, nz!)).toBeCloseTo(1, 4);
        if (mat === MAT.shadow) continue;
        minY = Math.min(minY, y!);
        maxR = Math.max(maxR, Math.hypot(x!, z!));
      }
      expect(minY, `${k} stands on the board`).toBeCloseTo(0, 5);
      expect(maxR, `${k} fits its square`).toBeLessThan(0.5);
    }
    // (All six in one 16-bit index buffer.)
    expect(verts).toBeLessThan(65536);
    const h = Object.fromEntries(KINDS.map((k) => [k, all[k].height]));
    expect(h.k).toBeGreaterThan(h.q!);
    expect(h.q).toBeGreaterThan(h.b!);
    expect(h.p).toBeLessThan(Math.min(h.n!, h.b!, h.r!));
    // (The tallest stays within what the views keep on screen: the board and a piece about 1.6 m tall over it.)
    expect(h.k).toBeLessThan(1.7);
    // The knight's head: its outline cut into whole triangles.
    expect(triangulate(KNIGHT_OUTLINE).length).toBe((KNIGHT_OUTLINE.length - 2) * 3);
  });
});

describe("the pixel set and the gear's Pieces (Nov 1; pieces-pixel.ts)", () => {
  it("six meshes, built once: whole triangles, unit normals, standing on the board, inside their squares, real-set heights (the king about twice the pawn), 1.25 times the proof of concept's, on eight-sided bases", async () => {
    const { KINDS, MAT, PV, triangulate } = await import("../src/colosseum/pieces3d.ts");
    const { PIXEL_KNIGHT, PIXEL_SIZE, pixelMeshes } = await import("../src/colosseum/pieces-pixel.ts");
    const all = pixelMeshes();
    let verts = 0;
    for (const k of KINDS) {
      const m = all[k];
      const n = m.verts.length / PV;
      verts += n;
      expect(m.index.length % 3, k).toBe(0);
      expect(Math.max(...m.index), k).toBeLessThan(n);
      let minY = Infinity;
      let maxR = 0;
      const foot = new Set<number>();
      for (let i = 0; i < m.verts.length; i += PV) {
        const [x, y, z, nx, ny, nz, mat] = m.verts.subarray(i, i + PV);
        expect(Math.hypot(nx!, ny!, nz!)).toBeCloseTo(1, 4);
        if (mat === MAT.shadow) continue;
        minY = Math.min(minY, y!);
        maxR = Math.max(maxR, Math.hypot(x!, z!));
        // (The base's foot: its corners round the board.)
        if (Math.abs(y!) < 1e-6 && Math.hypot(x!, z!) > 0.1) foot.add(Math.round(((Math.atan2(x!, z!) * 180) / Math.PI + 360) % 360));
      }
      expect(minY, `${k} stands on the board`).toBeCloseTo(0, 5);
      expect(maxR, `${k} fits its square`).toBeLessThan(0.5);
      expect(foot.size, `${k}'s base has eight corners`).toBe(8);
      // A flat face toward you (+z): no corner straight ahead.
      expect(foot.has(0) || foot.has(360)).toBe(false);
    }
    expect(verts).toBeLessThan(65536);
    const h = Object.fromEntries(KINDS.map((k) => [k, all[k].height]));
    expect(h.p).toBeLessThan(h.r!);
    expect(h.r).toBeLessThan(h.n!);
    expect(h.n).toBeLessThan(h.b!);
    expect(h.b).toBeLessThan(h.q!);
    expect(h.q).toBeLessThan(h.k!);
    expect(h.k! / h.p!).toBeGreaterThan(1.8);
    expect(h.k! / h.p!).toBeLessThan(2.1);
    // 1.25 times the proof of concept's (its pawn 0.622 and king 1.31 tall, at the 3D set's 1.25).
    expect(PIXEL_SIZE).toBeCloseTo(1.5625, 6);
    expect(h.p).toBeGreaterThan(0.622 * 1.25 * 1.2);
    expect(h.k).toBeLessThan(1.9);
    // The knight's head: its outline cut into whole triangles.
    expect(triangulate(PIXEL_KNIGHT).length).toBe((PIXEL_KNIGHT.length - 2) * 3);
  });

  it("the gear's Pieces: Pixel, 3D, 2D in turn; Pixel by default; a saved choice kept; an old '3D pieces' on keeps 3D", async () => {
    const { PIECE_STYLES, PIECE_STYLE_NAME, pieceStyleOf } = await import("../src/colosseum/arena-gl.ts");
    expect(PIECE_STYLES.map((p) => PIECE_STYLE_NAME[p])).toEqual(["Pixel", "3D", "2D"]);
    expect(pieceStyleOf(null, null)).toBe("pixel");
    expect(pieceStyleOf(null, "on")).toBe("3d");
    expect(pieceStyleOf(null, "off")).toBe("pixel");
    for (const p of PIECE_STYLES) expect(pieceStyleOf(p, "on")).toBe(p);
    expect(pieceStyleOf("nonsense", null)).toBe("pixel");
  });
});
