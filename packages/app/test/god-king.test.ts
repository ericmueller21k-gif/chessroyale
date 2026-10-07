import { beforeEach, describe, expect, it } from "vitest";
import { KING_LINES, SPEECH_MS, blunderLabel, blunderWords, capitalised, chancesWords, kingLine, kingSay, kingTurn, lastStandLine, replyWords, resetKingSpeech, setKingFallen } from "../src/godKing.ts";

describe("the God King's lines", () => {
  beforeEach(() => resetKingSpeech());

  it("has dozens of lines across every moment", () => {
    const all = Object.values(KING_LINES).flat();
    expect(all.length).toBeGreaterThanOrEqual(40);
    expect(new Set(all).size).toBe(all.length);
    for (const lines of Object.values(KING_LINES)) expect(lines.length).toBeGreaterThan(0);
  });

  it("speaks once per moment, shows the line for a while, and lets urgent cues cut in over small talk", () => {
    const always = () => 0;
    const t = 1_000_000;
    const intro = kingSay("intro", "intro", t, always)!;
    expect(KING_LINES.intro).toContain(intro);
    expect(kingLine(t + 100)).toEqual({ text: intro, at: t, until: t + SPEECH_MS });
    expect(kingLine(t + SPEECH_MS + 1)).toBeNull();
    // The same moment again (a screen drawn twice): silent.
    expect(kingSay("intro", "intro", t + 10, always)).toBeNull();
    // Small talk waits a while after the last line…
    expect(kingSay("idle", "idle-1", t + 1000, always)).toBeNull();
    // …but danger doesn't.
    expect(KING_LINES.queenDanger).toContain(kingSay("queenDanger", "q-1", t + 1500, always));
    // Later, small talk is fine (when the dice allow).
    expect(kingSay("idle", "idle-2", t + 20_000, () => 0.9)).toBeNull();
    for (const m of [1, 2, 3, 4, 5, 6]) kingTurn(`quiet-${m}`);
    expect(KING_LINES.idle).toContain(kingSay("idle", "idle-3", t + 30_000, always));
  });

  it("paces small talk by moves: each quiet move makes him likelier to speak, so he talks every few moves", () => {
    const roll = () => 0.7;
    let t = 1_000_000;
    // Right after a line, or at the start, he rests: a 0.7 roll beats idle's chance for a few moves.
    for (const m of [1, 2, 3, 4]) {
      kingTurn(`m${m}`);
      kingTurn(`m${m}`); // the same move drawn twice counts once
      expect(kingSay("idle", `i${m}`, (t += 60_000), roll)).toBeNull();
    }
    // Then it gets likelier each quiet move: by the sixth he speaks.
    kingTurn("m5");
    expect(kingSay("idle", "i5", (t += 60_000), roll)).toBeNull();
    kingTurn("m6");
    expect(kingSay("idle", "i6", (t += 60_000), roll)).not.toBeNull();
    // Speaking resets the count.
    kingTurn("m7");
    expect(kingSay("idle", "i7", (t += 60_000), roll)).toBeNull();
  });

  it("speaks 5 to 10 times in a typical 35-move boss battle of small talk alone", () => {
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
    expect(avg).toBeGreaterThanOrEqual(5);
    expect(avg).toBeLessThanOrEqual(10);
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
