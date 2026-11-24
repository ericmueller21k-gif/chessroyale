import { describe, expect, it } from "vitest";
import { BIRDIE_BEATS, BIRDIE_FX, lineSquares, pieceAt, trainReaches } from "@chessroyale/chess";
import { BIRDIE_CINEMATIC, BIRDIE_ULT } from "@chessroyale/core";
import { BIRDIE_FIGURE } from "../src/characters/birdie-figure.ts";
import { BIRDIE_CUTSCENE_SHEET } from "../src/characters/birdie-cutscene-sheet.ts";
import { birdieArmoredNow, noteArmor, resetBirdie } from "../src/characters/birdie-state.ts";
import { BOSS_KITS, liveKit } from "../src/characters/kits.ts";
import { animLength, cueAt } from "../src/characters/power-art.ts";
import { BIRDIE_WORDS, birdieDecor, birdieFen, birdieTurnMoments, ridePieces } from "../src/components/Birdie.tsx";
import { HEADLIGHTS_Y, cutscenePicture, headlightsAt, sceneOpacity, sheetColumn } from "../src/components/BirdieFall.tsx";
import { birdieSound } from "../src/characters/birdie-sounds.ts";
import { birdieMusic } from "../src/birdie-music.ts";
import { noteRejoin } from "../src/characters/moo-state.ts";
import type { Moment } from "../src/components/PowerParts.tsx";
import { dockLine } from "../src/components/BossPowers.tsx";
import { trainLine } from "../src/refused.ts";
import { cutsceneHash } from "../../../scripts/bake-birdie-cutscene.ts";
import type { BossView } from "../src/game.ts";

/**
 * Birdie on screen (components/Birdie.tsx, BirdieFall.tsx; docs/decisions/2026-11-23-birdie-rules.md): his moments' beats are his art's,
 * the cutscene's baked sheet is its drawings', the board during his train's ride, Armored Birdie from the cutscene's hit, the dock's words.
 */

const anim = (name: string) => BIRDIE_FIGURE.anims[name]!;

describe("his beats are his art's", () => {
  it("the warning's crossing lights at his signal's cue; the ride's figure run is his depart, his spot empty, his entrance", () => {
    expect(animLength(anim("signal"))).toBe(BIRDIE_BEATS.signal.total);
    expect(cueAt(anim("signal"), "signal")).toBe(BIRDIE_BEATS.signal.lightAt);
    expect(animLength(anim("depart"))).toBe(BIRDIE_BEATS.ride.departMs);
    expect(animLength(anim("entrance"))).toBe(BIRDIE_BEATS.ride.entranceMs);
    expect(animLength(anim("depart")) + animLength(anim("gone")) + animLength(anim("entrance"))).toBe(BIRDIE_FX.trainSmash);
    // (His fall where he stands, then his spot empty until the cutscene's hit, when he's back as Armored Birdie.)
    expect(animLength(anim("fall"))).toBeLessThanOrEqual(BIRDIE_CINEMATIC.dropMs);
    // (His fall's whoosh ends before the cutscene's own whoosh starts, at dropMs: both at once doubled it, Nov 23.)
    const whooshMs = (birdieSound("whoosh", 44100).length / 44100) * 1000;
    expect(cueAt(anim("fall"), "fall")! + whooshMs).toBeLessThanOrEqual(BIRDIE_CINEMATIC.dropMs);
    expect(animLength(anim("fall")) + animLength(anim("away"))).toBe(BIRDIE_BEATS.fall.hitAt - BIRDIE_BEATS.fall.fallAt);
  });

  it("Armored Birdie has a twin for every moment and loop the kit names", () => {
    const kit = BOSS_KITS["Birdie"]!;
    for (const a of ["p_idle", "p_thinking", "p_smug", "p_rattled", "p_victory", "p_defeat", "p_entrance", "p_move", "p_capture", "p_hurt", "p_check"]) expect(BIRDIE_FIGURE.anims[a], a).toBeTruthy();
    expect(kit.powered?.idle).toBe("p_idle");
  });
});

describe("his fall's cutscene", () => {
  it("the baked sheet is the drawings' (run scripts/bake-birdie-cutscene.ts after changing them)", () => {
    expect(cutsceneHash()).toBe(BIRDIE_CUTSCENE_SHEET.hash);
  });

  it("plays the fall, the approach to its hit, the reveal and the hold, in the drawings' frames, between its fades", () => {
    const B = BIRDIE_BEATS.fall;
    expect(cutscenePicture(B.cutAt - 1)).toBeNull();
    expect(cutscenePicture(B.cutAt)?.anim).toBe("fall");
    expect(cutscenePicture(B.approachAt)).toEqual({ anim: "approach", column: BIRDIE_CUTSCENE_SHEET.anims.approach.at });
    // (The approach's hit frame, held, as the light whitens.)
    const a = BIRDIE_CUTSCENE_SHEET.anims.approach;
    expect(cutscenePicture(B.hitAt - 1)?.column).toBe(a.at + a.ms.length - 1);
    expect(a.cues[a.ms.length - 1]).toBe("hit");
    expect(cutscenePicture(B.hitAt)?.anim).toBe("reveal");
    expect(cutscenePicture(B.holdAt)?.anim).toBe("hold");
    expect(cutscenePicture(B.total)).toBeNull();
    expect(sceneOpacity(B.cutAt)).toBe(0);
    expect(sceneOpacity(B.tumbleAt)).toBe(1);
    expect(sceneOpacity(B.total)).toBe(0);
    expect(sheetColumn("hold", 10_000)).toBeGreaterThanOrEqual(BIRDIE_CUTSCENE_SHEET.anims.hold.at);
  });

  it("he's Armored Birdie from the hit noted by his moment; at once when none was (a rejoin skipped it)", () => {
    resetBirdie();
    const boss = { id: "birdie", startMove: 3, powers: { birdie: { warn: null, ride: null, fell: 4 } } } as unknown as BossView;
    expect(birdieArmoredNow(boss, 0)).toBe(true);
    noteArmor(boss, 5_000);
    expect(birdieArmoredNow(boss, 4_999)).toBe(false);
    expect(birdieArmoredNow(boss, 5_000)).toBe(true);
    expect(birdieArmoredNow({ ...boss, powers: { birdie: { warn: null, ride: null, fell: null } } } as unknown as BossView, 9_999)).toBe(false);
    expect(liveKit(BOSS_KITS["Birdie"]!, boss, 6_000).loops?.idle).toBe("p_idle");
    resetBirdie();
  });
});

describe("his fall timed to his ult's piece (Nov 23)", () => {
  const fallen = (turnAt?: { turn: number; at: number; dropAt?: number }, startMove = 40) =>
    ({ id: "birdie", startMove, crowdSide: "w", crowdMoves: 4, powers: { turn: 4, events: [{ kind: "birdieFall", turn: 4 }], birdie: { warn: null, ride: null, fell: 4, ...(turnAt ? { turnAt } : {}) } }, board: { history: ["e2e4", "e7e5"] } }) as unknown as BossView;

  it("his music: his theme (the piece decoded ahead) until his fall; then the piece, its drop on the impact sent; after it (or joined later), the loop alone", () => {
    expect(birdieMusic({ id: "birdie", powers: { turn: 2, birdie: { warn: null, ride: null, fell: null } } } as unknown as BossView)).toEqual({ theme: "birdie", next: BIRDIE_ULT.theme });
    expect(birdieMusic(fallen({ turn: 4, at: 1000, dropAt: 1000 + BIRDIE_BEATS.fall.impactAt }))).toEqual({ theme: BIRDIE_ULT.theme, dropAt: 1000 + BIRDIE_BEATS.fall.impactAt });
    // (A later turn, or no drop sent: long past, so switchPlan plays his theme's loop alone.)
    expect(birdieMusic(fallen({ turn: 3, at: 1000, dropAt: 5000 }))).toEqual({ theme: BIRDIE_ULT.theme, dropAt: 0 });
    expect(birdieMusic(fallen())).toEqual({ theme: BIRDIE_ULT.theme, dropAt: 0 });
    expect(birdieMusic({ id: "moo", powers: null } as unknown as BossView)).toBeNull();
  });

  it("his moments from when his thinking began (turnAt): a reload in the wait or the cutscene carries on there, never from its start, never skipped", () => {
    noteRejoin(50_000);
    // (Rejoined 8 s into the wait, then 12 s in: in the cutscene.)
    for (const [into, key] of [[8_000, 41], [12_000, 42]] as const) {
      const m = birdieTurnMoments(fallen({ turn: 4, at: 50_000 - into }, key), 50_000);
      expect(m.map((x) => x.kind)).toEqual(["birdieFall"]);
      expect(m[0]!.at).toBe(50_000 - into);
      expect(m[0]!.at + BIRDIE_BEATS.fall.impactAt - 50_000).toBe(BIRDIE_BEATS.fall.impactAt - into);
    }
    // (No turnAt, as from an older server: skipped on a rejoin, as before.)
    expect(birdieTurnMoments(fallen(undefined, 43), 50_100)).toEqual([]);
    noteRejoin(-Infinity);
  });

  it("the headlights' light follows the lamps the approved drawing draws, the train head-on down the middle of the track", () => {
    const B = BIRDIE_BEATS.fall;
    expect(headlightsAt(B.approachAt)).toEqual({ x: 100, y: HEADLIGHTS_Y[0] });
    expect(headlightsAt(B.impactAt)).toEqual({ x: 100, y: HEADLIGHTS_Y.at(-1) });
    expect(headlightsAt(B.hitAt).y).toBe(HEADLIGHTS_Y.at(-1));
    expect(HEADLIGHTS_Y.length).toBe(BIRDIE_CUTSCENE_SHEET.anims.approach.ms.length);
  });
});

describe("the board during his train's ride", () => {
  const crowd = "w" as const;
  // After the crowd's move, the smash made: his b-file, your knight on b1 gone; his rook on b8 stands on the line too.
  const after = "1r2k3/8/8/8/8/8/P6P/4K3 b - - 0 1";
  const ride = { at: 2, line: "b", squares: lineSquares("b", crowd), square: "b1", piece: "n" };
  const boss = { id: "birdie", crowdSide: crowd, crowdMoves: 2, powers: { birdie: { warn: null, ride, fell: null } } } as unknown as BossView;
  const m: Moment = { kind: "trainSmash", key: "k", at: 1000, ms: BIRDIE_FX.trainSmash, square: "b1", squares: ride.squares, shape: "n" };
  it("your piece on its square until the ride; the line's pieces off the board while it rides (the layer draws them); then the board", () => {
    expect(pieceAt(birdieFen(boss, [m], 1000, after)!.fen, "b1")).toEqual({ color: "w", type: "n" });
    const riding = birdieFen(boss, [m], 1000 + BIRDIE_BEATS.ride.rideAt + 10, after)!;
    expect(pieceAt(riding.fen, "b8")).toBeNull();
    expect(pieceAt(riding.fen, "b1")).toBeNull();
    expect(riding.still).toBe(true);
    expect(birdieFen(boss, [m], 1000 + BIRDIE_BEATS.ride.backAt, after)).toBeNull();
    expect(birdieFen(boss, [], 0, after)).toBeNull();
  });

  it("his layer draws the line's pieces from the rules' position (the drawn board has them off), the smashed one until it's reached", () => {
    const rideAt = 1000 + BIRDIE_BEATS.ride.rideAt;
    const drawn = birdieFen(boss, [m], rideAt + 10, after)!.fen;
    // (Off the drawn board, so read from it his rook would be lost: the layer reads the boss's board.)
    expect(ridePieces(drawn, crowd, ride, ride.squares, rideAt, rideAt + 10).map((x) => x.square)).toEqual(["b1"]);
    expect(ridePieces(after, crowd, ride, ride.squares, rideAt, rideAt + 10)).toEqual([
      { square: "b8", i: 0, color: "b", type: "r", smashed: false },
      { square: "b1", i: 7, color: "w", type: "n", smashed: true },
    ]);
    expect(ridePieces(after, crowd, ride, ride.squares, rideAt, rideAt + trainReaches(7)).map((x) => x.square)).toEqual(["b8"]);
    // (Spared: on the board as it is; a king: never in the layer.)
    expect(ridePieces(after, crowd, { ...ride, spared: true }, ride.squares, rideAt, rideAt).map((x) => x.square)).toEqual(["b8"]);
    expect(ridePieces("1k6/8/8/8/8/8/8/1K6 b - - 0 1", crowd, { square: "b1", piece: "k" }, ride.squares, rideAt, rideAt)).toEqual([]);
  });

  it("a miss (Nov 24, your piece saved): the board as it is until the ride, every piece on the line stepping aside, none smashed", () => {
    // Your knight moved off b1 to c3 (saved): his rook on b8 the only piece left on the b-file.
    const saved = "1r2k3/8/8/8/8/2N5/P6P/4K3 b - - 0 1";
    const missed = { ...ride, missed: true as const };
    const mb = { ...boss, powers: { birdie: { warn: null, ride: missed, fell: null } } } as unknown as BossView;
    const mm: Moment = { ...m, missed: true };
    const rideAt = 1000 + BIRDIE_BEATS.ride.rideAt;
    // (Nothing put back on b1 before the ride: there's nothing to smash.)
    expect(birdieFen(mb, [mm], 1000, saved)).toBeNull();
    const riding = birdieFen(mb, [mm], rideAt + 10, saved)!;
    expect(pieceAt(riding.fen, "b8")).toBeNull();
    expect(pieceAt(riding.fen, "b1")).toBeNull();
    expect(pieceAt(riding.fen, "c3")).toEqual({ color: "w", type: "n" });
    expect(birdieFen(mb, [mm], 1000 + BIRDIE_BEATS.ride.backAt, saved)).toBeNull();
    expect(ridePieces(saved, crowd, missed, ride.squares, rideAt, rideAt + 10)).toEqual([{ square: "b8", i: 0, color: "b", type: "r", smashed: false }]);
    // (Moved along the line, b1 to b4: it steps aside as the train passes too, never smashed, never gone.)
    const along = "1r2k3/8/8/8/1N6/8/P6P/4K3 b - - 0 1";
    for (const now of [rideAt, rideAt + trainReaches(7) + 1]) {
      expect(ridePieces(along, crowd, missed, ride.squares, rideAt, now).map((x) => [x.square, x.smashed])).toEqual([
        ["b8", false],
        ["b4", false],
      ]);
    }
    expect(birdieDecor(mb, [mm], 99_999)).toBeUndefined();
  });

  it("your king, smashed: hidden from the train's hit on (the battle his), never taken off the drawn board", () => {
    const won = { ...boss, powers: { birdie: { warn: null, ride: { ...ride, line: "e", squares: lineSquares("e", crowd), square: "e1", piece: "k", king: true }, fell: null } } } as unknown as BossView;
    const w: Moment = { ...m, kind: "trainWin", square: "e1", squares: lineSquares("e", crowd) };
    const riding = birdieFen(won, [w], 1000 + BIRDIE_BEATS.ride.rideAt + 10, after)!;
    expect(pieceAt(riding.fen, "e1")).toEqual({ color: "w", type: "k" });
    expect(birdieDecor(won, [w], 1000 + BIRDIE_BEATS.ride.rideAt)).toBeUndefined();
    expect(birdieDecor(won, [w], 1000 + BIRDIE_BEATS.ride.rideAt + trainReaches(7))?.of("e1", "wk")?.cls).toBe("bd-smashed");
    expect(birdieDecor(won, [], 99_999)?.of("e1", "wk")?.cls).toBe("bd-smashed");
    expect(birdieDecor(boss, [], 99_999)).toBeUndefined();
  });
});

describe("his words", () => {
  it("through your warned turn, the piece named; a smash and a sparing in the dock", () => {
    const view = (piece: string, turn = 3) => ({ id: "birdie", powers: { turn: 3, birdie: { warn: { turn, piece } } } });
    expect(trainLine(view("n"))).toBe("Move your knight!");
    expect(trainLine(view("k"))).toBe("Move your king!");
    expect(trainLine(view("n", 2))).toBeNull();
    expect(trainLine({ id: "moo", powers: { turn: 3 } })).toBeNull();
    expect(BIRDIE_WORDS.move("q")).toBe("Move your queen!");
    expect(BIRDIE_WORDS.move(undefined)).toBe("Move your king!");
    // (As short as the Saw Swap's "Swapped out of check.", which fits a phone's dock at 320 px.)
    expect(trainLine(view("b"))!.length).toBeLessThanOrEqual("Swapped out of check.".length);
    // His ride's line in the dock: a smash, a sparing, a miss (Nov 24: your piece saved, never a word of a piece lost; no longer than
    // the sparing's longest, which fits a phone's dock at 320 px).
    const squares = lineSquares("b", "w");
    expect(dockLine({ kind: "trainSmash", squares, shape: "n" })).toBe("His train hit your knight.");
    expect(dockLine({ kind: "trainSmash", squares, shape: "b", fizzled: ["b1"] })).toBe("The train spared your bishop.");
    const miss = dockLine({ kind: "trainSmash", squares, shape: "n", missed: true })!;
    expect(miss).toBe(BIRDIE_WORDS.missed);
    expect(miss).not.toMatch(/your|lost|hit your/i);
    expect(miss.length).toBeLessThanOrEqual(BIRDIE_WORDS.spared("b").length);
  });
});
