import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, RAID_SETTINGS, bossBannerMs, type BossState, type MatchState, type PowerEventKind, type Settings } from "@chessroyale/core";
import { BOSS_OPENING, FOLIO, FOLIO_FRESH, POWER_BANNERS, POWER_FX, boardEnd, bannerLeadMs, burnOnBoard, freestyleBoard, initPowers, newestCapture, playOnBoard, powerFxMs, prepareTurn, queenSlain, sideToMove, type Battle, type BoardState } from "@chessroyale/chess";
import { bannerOn, dueQueenBanner, queenBanners, resetBattleBanners, type BannerScreen } from "../src/battle-banners.ts";
import { PowerBanner, PowerMoment } from "../src/components/BossPowers.tsx";
import { BOINGO_UI } from "../src/components/Boingo.tsx";
import { BIGBOY_UI } from "../src/components/BigBoy.tsx";
import { GINGER_UI } from "../src/components/Ginger.tsx";
import { GREX_UI } from "../src/components/Grex.tsx";
import { HOLLOW_UI } from "../src/components/Hollow.tsx";
import { SAWYER_UI } from "../src/components/Sawyer.tsx";
import { PIG_UI } from "../src/components/Pig.tsx";
import { RECLUSE_UI } from "../src/components/Recluse.tsx";
import { ALFIL_UI } from "../src/components/Alfil.tsx";
import { HOPPER_UI } from "../src/components/Hopper.tsx";
import { SMUDGY_UI } from "../src/components/Smudgy.tsx";
import { TIGER_UI } from "../src/components/Tiger.tsx";
import { FOLIO_UI } from "../src/components/Folio.tsx";
import { TIMBER_UI } from "../src/components/Timber.tsx";
import { DASH_UI } from "../src/components/Dash.tsx";
import type { BossView } from "../src/game.ts";

/**
 * The battle's banners as events (Eric, Nov 5): QUEEN DOWN! and QUEEN SLAIN! read only the capture records playOnBoard
 * writes, each shows once for its ply on its own screen, and a power can neither make one nor hide one.
 */

// Queens face to face on the d-file: White (the crowd) to move takes Black's (QUEEN SLAIN!); Black to move takes White's (QUEEN DOWN!).
const QUEENS_W = "3qk3/8/8/8/8/8/8/3QK3 w - - 0 1";
const QUEENS_B = "3qk3/8/8/8/8/8/8/3QK3 b - - 0 1";
const play = (b: BoardState, ...moves: string[]) => moves.reduce((x, m) => playOnBoard(x, m, 0.5), b);
const view = (board: BoardState, crowdSide: "w" | "b" = "w") => ({ crowdSide, board });

/**
 * The boss screen drawn every 50 ms, screen after screen, as Boss.tsx draws its queen banner: each step a board and the
 * screen it's on for `ms`. Returns each banner's appearances (its text each time it comes on after being off).
 */
function screens(steps: { board: BoardState; screen: BannerScreen; ms: number }[], crowdSide: "w" | "b" = "w"): string[] {
  resetBattleBanners();
  const out: string[] = [];
  let t = 1000;
  let was: string | null = null;
  for (const s of steps) {
    for (const end = t + s.ms; t < end; t += 50) {
      const due = dueQueenBanner(view(s.board, crowdSide), s.screen, "test");
      const on = due && bannerOn(due.key, t, bossBannerMs()) ? due : null;
      const text = on ? (on.kind === "down" ? "QUEEN DOWN!" : "QUEEN SLAIN!") : null;
      if (text && on!.key !== was) out.push(text);
      was = on ? on.key : null;
    }
  }
  return out;
}
const LONG = bossBannerMs() + 2000;

describe("the capture record: written as the move is played", () => {
  it("playOnBoard records what a move takes (ply, side, squares, piece), and nothing for a move that takes nothing", () => {
    const b = play(freestyleBoard(0, QUEENS_W), "d1d8");
    expect(b.captures).toEqual([{ ply: 1, side: "w", from: "d1", to: "d8", piece: "q", color: "b" }]);
    expect(play(freestyleBoard(0, QUEENS_W), "d1d7").captures).toBeUndefined();
    // (En passant: the pawn it takes isn't on the square it lands on.)
    const ep = play(freestyleBoard(0, "4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1"), "e5d6");
    expect(ep.captures).toEqual([{ ply: 1, side: "w", from: "e5", to: "d6", piece: "p", color: "b" }]);
  });
});

describe("QUEEN DOWN! and QUEEN SLAIN!: one for each queen capture, on its own screen", () => {
  it("a queen capture gives exactly one banner for its ply: his of yours QUEEN DOWN!, yours of his QUEEN SLAIN!", () => {
    const his = play(freestyleBoard(0, QUEENS_B), "d8d1");
    expect(queenBanners(his, "w").map((b) => [b.kind, b.ply])).toEqual([["down", 1]]);
    expect(screens([{ board: his, screen: "move", ms: LONG }])).toEqual(["QUEEN DOWN!"]);
    const yours = play(freestyleBoard(0, QUEENS_W), "d1d8");
    expect(queenBanners(yours, "w").map((b) => [b.kind, b.ply])).toEqual([["slain", 1]]);
    expect(screens([{ board: yours, screen: "thinking", ms: LONG }])).toEqual(["QUEEN SLAIN!"]);
    // (Each on its own screen only: QUEEN DOWN! as his move lands, QUEEN SLAIN! while he thinks.)
    expect(dueQueenBanner(view(his), "thinking")).toBeNull();
    expect(dueQueenBanner(view(yours), "move")).toBeNull();
    // (A trade: his takes yours, yours takes his back: both, each once, in its own turn, never merged.)
    const down = play(freestyleBoard(0, "3qk3/8/8/8/8/8/8/R2QK3 b - - 0 1"), "d8d1");
    const back = play(down, "a1d1");
    expect(queenBanners(back, "w").map((b) => [b.kind, b.ply])).toEqual([["down", 1], ["slain", 2]]);
    expect(
      screens([
        { board: down, screen: "move", ms: LONG },
        { board: back, screen: "thinking", ms: LONG },
        { board: back, screen: "thinking", ms: LONG },
      ]),
    ).toEqual(["QUEEN DOWN!", "QUEEN SLAIN!"]);
  });

  it("his capture of your queen with a Slam starting his next turn: QUEEN DOWN! on his move's screen, the Slam's turn without it, never merged or twice", () => {
    // He takes your queen (his move's screen), you move, then his Slam's screen (the Slam lifts pieces: a base), his
    // thinking, his move.
    const took = play(freestyleBoard(0, "3qk3/8/8/8/8/8/P6K/3Q4 b - - 0 1"), "d8d1");
    const yours = play(took, "a2a3");
    const slammed = burnOnBoard(yours, "a3");
    expect(
      screens([
        { board: took, screen: "move", ms: LONG },
        { board: yours, screen: "thinking", ms: 1500 },
        { board: slammed, screen: "move", ms: LONG },
        { board: slammed, screen: "thinking", ms: 1500 },
      ]),
    ).toEqual(["QUEEN DOWN!"]);
  });

  it("a power's turn (a step, a bounce, the funhouse) draws the screen again without bringing a banner back", () => {
    // Your move takes his queen: QUEEN SLAIN! in his thinking; then a step of his (the Slam, the bounce, the hop: a base,
    // the same newest move), his second thinking, his move.
    const yours = play(freestyleBoard(0, "3qk3/7p/8/8/8/8/8/3QK3 w - - 0 1"), "d1d8");
    const bounced = burnOnBoard(yours, "h7");
    const his = play(bounced, "e8f7");
    expect(
      screens([
        { board: yours, screen: "thinking", ms: 1500 },
        { board: bounced, screen: "move", ms: LONG },
        { board: bounced, screen: "thinking", ms: LONG },
        { board: his, screen: "move", ms: LONG },
      ]),
    ).toEqual(["QUEEN SLAIN!"]);
    // The screen drawn again or mounted anew mid-banner (each boss screen is): the showing keeps its first start and ends
    // on time; nothing brings it back after.
    resetBattleBanners();
    expect([0, 600, 999, 1000, 5000].map((t) => bannerOn("k", 2000 + t, 1000))).toEqual([true, true, true, false, false]);
    // The funhouse: he plays your move for you (a move of yours like any other: its capture is yours), then thinks.
    const funhouse = play(freestyleBoard(0, QUEENS_W), "d1d8");
    expect(
      screens([
        { board: funhouse, screen: "move", ms: 3000 },
        { board: funhouse, screen: "thinking", ms: LONG },
        { board: funhouse, screen: "thinking", ms: LONG },
      ]),
    ).toEqual(["QUEEN SLAIN!"]);
  });

  it("only real captures (Eric, Nov 5): a power that changes the board around a queen gives none; a real capture during or right after one gives exactly one", () => {
    // G-REX's fire burns your queen; a Slam lifts it; a plant eats it: the board changes, nothing is captured.
    const burnt = burnOnBoard(freestyleBoard(0, QUEENS_B), "d1");
    expect(burnt.captures).toBeUndefined();
    expect(dueQueenBanner(view(burnt), "move")).toBeNull();
    // His move then lands on the square your queen stood on: it takes nothing (the old board look-up's kind of slip).
    const after = play(burnt, "d8d1");
    expect(after.captures).toBeUndefined();
    expect(screens([{ board: after, screen: "move", ms: LONG }])).toEqual([]);
    // A freeze or a step of his that moves a piece next to your queen (a base): no capture, no banner.
    const stepped = burnOnBoard(play(freestyleBoard(0, "3qk3/8/8/8/8/8/2p5/3QK3 b - - 0 1"), "e8e7"), "c2");
    expect(queenBanners(stepped, "w")).toEqual([]);
    expect(screens([{ board: stepped, screen: "move", ms: LONG }])).toEqual([]);
    // A real capture right after a power (a base on the board, then his move takes your queen): exactly one.
    const real = play(burnOnBoard(freestyleBoard(0, "3qk3/8/8/8/8/8/P7/3QK3 b - - 0 1"), "a2"), "d8d1");
    expect(real.captures).toEqual([{ ply: 1, side: "b", from: "d8", to: "d1", piece: "q", color: "w" }]);
    expect(screens([{ board: real, screen: "move", ms: LONG }])).toEqual(["QUEEN DOWN!"]);
    // A burn after the capture (G-REX's fire as your move lands) hides nothing: the record stands.
    const slain = burnOnBoard(play(freestyleBoard(0, "3qk3/7p/8/8/8/8/8/3QK3 w - - 0 1"), "d1d8"), "h7");
    expect(screens([{ board: slain, screen: "thinking", ms: LONG }])).toEqual(["QUEEN SLAIN!"]);
    // (The boss's clock reads the same record: he waits for QUEEN SLAIN! only for a real capture.)
    expect(queenSlain({ crowdSide: "w", crowdMoves: 1, board: slain })).toBe(true);
    expect(queenSlain({ crowdSide: "w", crowdMoves: 1, board: play(burnOnBoard(freestyleBoard(0, QUEENS_W), "d8"), "d1d8") })).toBe(false);
  });

  it("a move that's no longer the newest never brings its banner (a reload or a missed screen doesn't replay old captures)", () => {
    const took = play(freestyleBoard(0, "3qk3/8/8/8/8/8/P6K/3Q4 b - - 0 1"), "d8d1");
    const later = play(took, "a2a3");
    expect(newestCapture(later)).toBeNull();
    expect(screens([{ board: later, screen: "move", ms: LONG }, { board: later, screen: "thinking", ms: LONG }])).toEqual([]);
  });
});

// ---------------- Folio's Revision: a capture crossed out is no capture ----------------

/** A battle on one board for Folio's hooks (as packages/chess/test/folio.test.ts's stub): `fen` a base at ply 0, the crowd White. */
function folioBattle(fen: string, crowdMoves: number) {
  const board: BoardState = { ...freestyleBoard(0, fen), opening: BOSS_OPENING };
  const boards = new Map([[0, board]]);
  const boss = { id: "folio", crowdSide: "w", crowdMoves, elo: 1500, tier: 1500, sinceKill: 0, kills: [], powers: { ...initPowers(1, fen, "w"), turn: crowdMoves + 1, nextPassive: 99, folio: FOLIO_FRESH, judged: 0.5 } } as unknown as BossState;
  const settings = { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossMaxMoves: 60, bossPowerTest: "" } as Settings;
  const b: Battle & { state: MatchState } = {
    state: { boards: [0], boss } as unknown as MatchState,
    boards,
    settings,
    bossLast: null,
    engines: [],
    alive: () => [],
    finalGameOver: () => boardEnd(boards.get(0)!) !== null,
    bossToMove: () => sideToMove(boards.get(0)!.fen) !== "w",
    crowdAllowed: () => null,
    boardOf: () => null,
    afterCrowdMove: () => undefined,
    bossPassed: () => undefined,
    memo: new Map(),
    now: () => 0,
    random: () => 0.5,
  } as unknown as Battle & { state: MatchState };
  const his = (move: string) => {
    b.boards.set(0, playOnBoard(b.boards.get(0)!, move, 0.5));
    FOLIO.afterBossMove!(b, move, { crease: null });
    b.state = { ...b.state, boss: prepareTurn(b.state.boss!, b.boards.get(0)!.fen, "") };
  };
  const crowd = (move: string, judged: { best: number; played: number }) => {
    b.boards.set(0, playOnBoard(b.boards.get(0)!, move, judged.played));
    const s = b.state.boss!;
    b.state = { ...b.state, boss: { ...s, crowdMoves: s.crowdMoves + 1, powers: { ...s.powers!, judged: judged.played } } };
    FOLIO.afterCrowdMove!(b, move, judged);
  };
  return { b, his, crowd, board: () => b.boards.get(0)! };
}

describe("Folio's Revision", () => {
  it("crossing out your move that took its queen: the record goes, so no QUEEN SLAIN! and no wait for it; a reply it doesn't cross out keeps one", () => {
    // Its king steps (a blunder: your rook takes its queen on a8), your rook takes it, and Revision crosses both out.
    const revised = folioBattle("q5k1/5pp1/7p/8/8/8/5PPP/R5K1 b - - 0 30", 4);
    revised.his("g8h7");
    revised.crowd("a1a8", { best: 0.9, played: 0.9 });
    expect(revised.b.state.boss!.powers!.events.at(-1)?.kind).toBe("revision");
    expect(revised.board().history).toEqual(["g8h7", "a1a8"]);
    expect(revised.board().captures ?? []).toEqual([]);
    expect(queenBanners(revised.board(), "w")).toEqual([]);
    expect(screens([{ board: revised.board(), screen: "thinking", ms: LONG }])).toEqual([]);
    expect(queenSlain({ crowdSide: "w", crowdMoves: 5, board: revised.board(), powers: revised.b.state.boss!.powers })).toBe(false);
    // The same capture without a Revision (your reply found nothing it cost: no Revision): its banner, once.
    const kept = folioBattle("q5k1/5pp1/7p/8/8/8/5PPP/R5K1 b - - 0 30", 4);
    kept.his("g8h7");
    kept.crowd("a1a8", { best: 0.55, played: 0.55 });
    expect(kept.b.state.boss!.powers!.events.some((e) => e.kind === "revision")).toBe(false);
    expect(screens([{ board: kept.board(), screen: "thinking", ms: LONG }])).toEqual(["QUEEN SLAIN!"]);
  });
});

// ---------------- Each power's banner: once for each use ----------------

const UIS = [GINGER_UI, BOINGO_UI, GREX_UI, HOLLOW_UI, BIGBOY_UI, SAWYER_UI, PIG_UI, RECLUSE_UI, ALFIL_UI, HOPPER_UI, SMUDGY_UI, TIGER_UI, FOLIO_UI, TIMBER_UI, DASH_UI];
const BOSS_OF: Partial<Record<PowerEventKind, string>> = { warn: "bigboy" };
for (const ui of UIS) for (const kind of Object.keys(ui.moments)) BOSS_OF[kind as PowerEventKind] = ui.id;

/** Each of its banners' appearances (text) as PowerMoment draws a use of `kind` (at `turn`) every 10 ms through its moment and past it. */
function powerBanners(kind: PowerEventKind, turn: number): { texts: string[]; keys: Set<string> } {
  const id = BOSS_OF[kind]!;
  const boss = { id, name: id, crowdSide: "w", crowdMoves: turn, startMove: 1, board: { id: 0, fen: QUEENS_W, history: [], ply: 0, lastMove: null }, powers: { events: [], turn } } as unknown as BossView;
  const lead = bannerLeadMs(kind);
  // (As momentsOf keys it: its boss, its kind and its turn.)
  const moment = { kind, key: `${id}:${kind}:${turn}`, at: lead, ms: powerFxMs({ kind: kind as keyof typeof POWER_FX }) - lead, ...(lead ? { lead } : {}) };
  const texts: string[] = [];
  const keys = new Set<string>();
  let was = new Set<string>();
  for (let t = 0; t < moment.at + moment.ms + 3000; t += 10) {
    const now = new Set<string>();
    const walk = (n: unknown) => {
      if (Array.isArray(n)) n.forEach(walk);
      else if (n && typeof n === "object" && "type" in n) {
        const v = n as { type: unknown; key?: string; props: { text?: string; children?: unknown } };
        if (v.type === PowerBanner) {
          now.add(v.props.text!);
          keys.add(String(v.key));
        }
        walk(v.props.children);
      }
    };
    walk(t < moment.at + moment.ms ? PowerMoment({ boss, moment, now: t, orientation: "white", side: "w" }) : null);
    for (const x of now) if (!was.has(x)) texts.push(x);
    was = now;
  }
  return { texts, keys };
}

describe("each power's banner (the ults' among them): once for each use, keyed to it", () => {
  for (const kind of Object.keys(POWER_BANNERS) as PowerEventKind[]) {
    if (!BOSS_OF[kind]) continue;
    it(`${kind}: each of its banners once, keyed to its use`, () => {
      const one = powerBanners(kind, 6);
      expect(one.texts.length).toBe(POWER_BANNERS[kind as keyof typeof POWER_BANNERS]!.length);
      expect(new Set(one.texts).size).toBe(one.texts.length);
      // (Another use, another turn: its own key, so never mistaken for this one.)
      const two = powerBanners(kind, 7);
      expect([...two.keys].some((k) => one.keys.has(k))).toBe(false);
    });
  }
});
