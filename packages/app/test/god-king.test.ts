import { beforeEach, describe, expect, it } from "vitest";
import { KING_SPEECH } from "@chessroyale/core";
import { holdMs } from "../src/speech.tsx";
import { KING_LINES, blunderLabel, blunderWords, bossMoveCues, capitalised, chancesWords, crowdMoveCues, kingLine, kingSay, kingTurn, lastStandLine, mateThreatened, replyWords, resetKingSpeech, setKingFallen, turnCues } from "../src/godKing.ts";

describe("the God King's lines", () => {
  beforeEach(() => resetKingSpeech());

  it("has dozens of lines across every moment", () => {
    const all = Object.values(KING_LINES).flat();
    expect(all.length).toBeGreaterThanOrEqual(40);
    expect(new Set(all).size).toBe(all.length);
    for (const lines of Object.values(KING_LINES)) expect(lines.length).toBeGreaterThan(0);
  });

  it("speaks once per moment, shows the line for its time, and a second critical line waits for the first", () => {
    const always = () => 0;
    const t = 1_000_000;
    const intro = kingSay("intro", "intro", t, always)!;
    expect(KING_LINES.intro).toContain(intro);
    expect(kingLine(t + 100)).toMatchObject({ text: intro, at: t, until: t + holdMs(intro) });
    // The same moment again (a screen drawn twice): silent.
    expect(kingSay("intro", "intro", t + 10, always)).toBeNull();
    // Small talk waits a while after the last line…
    expect(kingSay("idle", "idle-1", t + 1000, always)).toBeNull();
    // …but danger doesn't: it's said, and (both critical) it waits until his opening line has had its time.
    const danger = kingSay("queenDanger", "q-1", t + 1500, always)!;
    expect(KING_LINES.queenDanger).toContain(danger);
    expect(kingLine(t + holdMs(intro) - 1)?.text).toBe(intro);
    expect(kingLine(t + holdMs(intro))).toMatchObject({ text: danger, at: t + holdMs(intro) });
    expect(kingLine(t + holdMs(intro) + holdMs(danger))).toBeNull();
    // Later, small talk is fine (when the dice allow).
    expect(kingSay("idle", "idle-2", t + 20_000, () => 0.9)).toBeNull();
    for (let m = 1; m <= KING_SPEECH.restMoves + 10; m++) kingTurn(`quiet-${m}`);
    expect(KING_LINES.idle).toContain(kingSay("idle", "idle-3", t + 30_000, always));
  });

  it("paces small talk by moves: he rests for several moves after any line, then each quiet move makes him likelier", () => {
    const roll = () => 0.45;
    let t = 1_000_000;
    const rest = KING_SPEECH.restMoves;
    // A 0.45 roll beats idle's chance until it has grown past it: restMoves, then a few more quiet moves.
    const speaksAt = rest + Math.ceil(0.45 / KING_SPEECH.perQuietMove);
    for (let m = 1; m < speaksAt; m++) {
      kingTurn(`m${m}`);
      kingTurn(`m${m}`); // the same move drawn twice counts once
      expect(kingSay("idle", `i${m}`, (t += 60_000), roll), `move ${m}`).toBeNull();
    }
    kingTurn(`m${speaksAt}`);
    expect(kingSay("idle", `i${speaksAt}`, (t += 60_000), roll)).not.toBeNull();
    // Speaking resets the count.
    kingTurn("again");
    expect(kingSay("idle", "i-again", (t += 60_000), roll)).toBeNull();
  });

  it("remarks on a move only now and then: a low chance, and none for several moves after the last", () => {
    let t = 1_000_000;
    const always = () => 0;
    kingTurn("r0");
    expect(kingSay("greatMove", "g0", t, always)).not.toBeNull();
    // Even with the dice on his side, no remark until remarkGapMoves have passed.
    for (let m = 1; m < KING_SPEECH.remarkGapMoves; m++) {
      kingTurn(`r${m}`);
      expect(kingSay("greatMove", `g${m}`, (t += 60_000), always), `move ${m}`).toBeNull();
      expect(kingSay("badMove", `b${m}`, t, always)).toBeNull();
    }
    kingTurn("r-last");
    expect(kingSay("goodMove", "g-last", (t += 60_000), always)).not.toBeNull();
    // A critical moment speaks at once, whatever was just said: it cuts in on the remark.
    const lost = kingSay("queenLost", "ql", t + 100, () => 0.99);
    expect(lost).not.toBeNull();
    expect(kingLine(t + 200)?.text).toBe(lost);
    // And the dice: a brilliant move is remarked on about a third of the time.
    expect(KING_SPEECH.chance.greatMove).toBeLessThanOrEqual(0.35);
  });

  it("speaks 2 to 5 times in a 35-move boss battle of small talk alone (Eric, Oct 9: less)", () => {
    let rng = 7;
    const random = () => ((rng = (rng * 16807) % 2147483647) / 2147483647);
    const counts = [];
    for (let game = 0; game < 50; game++) {
      resetKingSpeech();
      let n = 0;
      for (let move = 0; move < 35; move++) {
        kingTurn(`g${game}-m${move}`);
        if (kingSay("idle", `g${game}-i${move}`, 1_000_000 + move * 40_000, random)) n++;
      }
      counts.push(n);
    }
    const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
    expect(avg).toBeGreaterThanOrEqual(2);
    expect(avg).toBeLessThanOrEqual(5);
  });

  it("opens with one line from a big pool, once a battle", () => {
    expect(KING_LINES.intro.length).toBeGreaterThanOrEqual(20);
    const fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
    const cues = turnCues({ fen, side: "b", charges: 3, ply: 1 });
    expect(cues.map((c) => c.cue)).toContain("intro");
    expect(kingSay("intro", "intro", 1_000_000, () => 0.99)).not.toBeNull();
    expect(kingSay("intro", "intro", 1_100_000, () => 0)).toBeNull();
  });

  it("critical moments: a new danger speaks, the same danger on the next move doesn't; a queen taken either way", () => {
    // White's queen on d4 attacked by the c5 pawn: a new danger.
    const before = "rnbqkbnr/pp1ppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 2";
    const now = "rnbqkbnr/pp1ppppp/8/2p5/3Q4/8/PPP1PPPP/RNB1KBNR w KQkq - 0 3";
    const cues = (fen: string, prevFen?: string) => turnCues({ fen, side: "w", charges: 3, ply: 4, prevFen }).map((c) => c.cue);
    expect(cues(now, before)).toContain("queenDanger");
    // Still attacked a move later: no repeat.
    expect(cues(now, now)).not.toContain("queenDanger");
    // Check, then check again on the next move: said once.
    const check = "rnb1kbnr/pppp1ppp/8/4p3/5PPq/8/PPPPP2P/RNBQKBNR w KQkq - 1 3";
    expect(cues(check, "rnbqkbnr/pppp1ppp/8/4p3/5P2/8/PPPPP1PP/RNBQKBNR w KQkq - 0 2")).toContain("inCheck");
    expect(cues(check, check)).not.toContain("inCheck");
    // A queen taken: by the boss (with its banner), or by the crowd.
    expect(bossMoveCues("x", { captured: "q" })[0]!.cue).toBe("queenLost");
    expect(bossMoveCues("x", { captured: "n" }).map((c) => c.cue)).toEqual(["bossCapture"]);
    expect(crowdMoveCues(now, "d4c5", 0)[0]!.cue).toBe("crowdCapture");
    const takeQueen = "rnb1kbnr/pppp1ppp/8/4p3/7q/5N2/PPPPPPPP/RNBQKB1R w KQkq - 2 3";
    expect(crowdMoveCues(takeQueen, "f3h4", 0)[0]!.cue).toBe("queenWon");
  });

  it("warns of a mate threat: the boss would mate at once if the crowd passed", () => {
    // Scholar's mate set up: Black's queen and bishop aim at f7 (White to move... here Black to move, threatened).
    expect(mateThreatened("r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3")).toBe(true);
    expect(mateThreatened("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1")).toBe(false);
    // In check already: that's the check's cue, not this.
    expect(mateThreatened("rnb1kbnr/pppp1ppp/8/4p3/5PPq/8/PPPPP2P/RNBQKBNR w KQkq - 1 3")).toBe(false);
  });

  it("never says the same line twice running for a cue", () => {
    let last: string | null = null;
    for (let i = 0; i < 20; i++) {
      const line = kingSay("queenDanger", `q-${i}`, 1_000_000 + i * 10_000, () => 0.01);
      expect(line).not.toBe(last);
      last = line;
    }
  });

  it("his Last Stand: the same banner line on every screen for a move; fallen, he says nothing but his last words and his return", () => {
    const line = lastStandLine("fen-e2e4");
    expect(KING_LINES.lastStand).toContain(line);
    expect(lastStandLine("fen-e2e4")).toBe(line);
    expect(new Set(["a", "b", "c", "d", "e", "f", "g", "h"].map((x) => lastStandLine(x))).size).toBeGreaterThan(1);
    const t = 1_000_000;
    setKingFallen(true);
    expect(kingSay("queenDanger", "q", t, () => 0)).toBeNull();
    expect(kingSay("idle", "i", t + 20_000, () => 0)).toBeNull();
    // Not even after a blizzard, nor on a burning tile (Eric, Oct 9).
    expect(kingSay("blizzard", "b", t + 21_000, () => 0)).toBeNull();
    expect(kingSay("blizzardKing", "bk", t + 22_000, () => 0)).toBeNull();
    expect(kingSay("fireTile", "f", t + 23_000, () => 0)).toBeNull();
    expect(kingSay("lastWords", "last", t + 30_000, () => 0)).toBe("Finish… it… for me.");
    expect(kingSay("rise", "rise", t + 31_000, () => 0)).toBe("A god does not stay down.");
    // A new battle: he's back.
    resetKingSpeech();
    expect(kingSay("intro", "intro", t + 60_000, () => 0)).not.toBeNull();
  });
});

describe("his Last Stand in plain words (the warning and the results card)", () => {
  // QGD Exchange, White to move (move 6): Ne4?? hangs the knight to dxe4.
  const qgd = "rnbqkb1r/pp3ppp/2p2n2/3p2B1/3P4/2N5/PP2PPPP/R2QKBNR w KQkq - 0 6";
  it("names the piece the boss's reply wins, a mate it allows, or else the chances", () => {
    expect(blunderWords(qgd, { move: "c3e4", reply: "d5e4", before: 0.52, after: 0.09 })).toBe("loses your knight");
    expect(blunderWords(qgd, { move: "c3e4", reply: "d5e4", mateIn: 2, before: 0.52, after: 0 })).toBe("allows mate");
    expect(blunderWords(qgd, { move: "a2a3", reply: "h7h6", before: 0.52, after: 0.09 })).toBe("your chances 52% → 9%");
    expect(chancesWords({ move: "a2a3", before: 0.524, after: 0.086 })).toBe("52% → 9%");
    expect(capitalised("loses your knight")).toBe("Loses your knight");
  });

  it("the results card: the move as 'Move 6: Ne4??', and the boss's reply with what it won", () => {
    expect(blunderLabel(qgd, "c3e4")).toBe("Move 6: Ne4??");
    expect(blunderLabel("rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2", "d8h4")).toBe("Move 2: …Qh4??");
    expect(replyWords(qgd, { move: "c3e4", reply: "d5e4" })).toEqual({ san: "dxe4", note: "wins your knight" });
    expect(replyWords("rnbqkbnr/pppp1ppp/8/4p3/8/5P2/PPPPP1PP/RNBQKBNR w KQkq - 0 2", { move: "g2g4", reply: "d8h4", mateIn: 1 })).toEqual({ san: "Qh4#", note: "checkmate" });
    expect(replyWords(qgd, { move: "a2a3", reply: "h7h6", mateIn: 5 })).toEqual({ san: "h6", note: "mate in 5" });
    expect(replyWords(qgd, { move: "a2a3", reply: "h7h6" })).toEqual({ san: "h6", note: "" });
    expect(replyWords(qgd, { move: "a2a3" })).toBeNull();
  });
});
