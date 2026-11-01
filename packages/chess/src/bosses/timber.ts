/**
 * Timber, the beaver builder (BOSS_ROSTER "timber"; Eric's idea, Oct 20; his design approved Nov 1; docs/decisions/2026-11-01-timber.md).
 * A brown beaver in an orange hard hat and vest, planks on his back, a woodpecker foreman beside his workshop. He starts
 * from the game so far, as most bosses do (a raid and Boss alone: the starting position).
 *
 * His passive, Scraps (the Workshop):
 * - **Five pieces on his workbench** (WORKSHOP_PIECES, the strip above the board): a pawn, knight, bishop, rook and queen,
 *   each finished at its cost in scraps (workshopCosts: 2, 4, 4, 6, 12).
 * - **Scraps:** one every scrapEverySec seconds of real time (the real-time meter, base.ts `ticksAt`, on the battle's clock:
 *   the server's online, the page's visible time solo, the sims' own), whoever's turn it is; scrapsPerCapture more for each
 *   capture of his; gnawScraps for his Gnaw. Each scrap goes, at random (its roll: its index and the workshop's public seed
 *   `wseed`), to one of the pieces not yet finished; none open, it's wasted. The rules work the clock's scraps out when they
 *   need them (workshopAt: a pure function of the snapshot and the clock), and so does every screen: nothing is sent as one lands.
 * - **The drop:** at the end of his turn (after his move and any Gnaw), one finished piece, the first finished that he can
 *   have (never a position the engine refuses: a ninth pawn, more pieces than promotions could make), is dropped onto an empty
 *   square of his half (his own two back ranks first), the first of a seeded order the guards allow (the circus tiger's landing guards, `landCheck`: never
 *   the en passant square, a pawn never on a first or last rank, never a square you attack, never a check either way, never
 *   a mate in one for either side, never you without a move). At most one a turn; none allowed: it waits on the bench.
 *   Its slot starts over at 0. A base at its ply.
 * - **The cap:** workshopDropMax drops a battle (the sim's); after the last the workshop closes (no more scraps; the strip
 *   greys). From the starting position nothing can drop until he has lost a pawn or a piece (a ninth pawn, a third knight
 *   with eight pawns: positions the engine refuses), so the workshop fills while he has his whole army.
 *
 * His ultimate, Gnaw (the rage meter, `rageSpeed.timber`):
 * - The usual warning as a crowd turn begins; on his turn after it, after his move (he keeps his turn, as Babur's hoops): one of
 *   your pawns, at random (seeded), is eaten, and makes gnawScraps scraps for his workshop. Guards: never one whose going
 *   leaves your king attacked by more than before (a new check), never you without a move, never a position the engine
 *   refuses; the en passant square kept only while a capture there is still legal. You have pawns but none qualifies: it
 *   waits for his next turn (the meter stays full). You have none: it comes and eats nothing (the screens say so).
 * - The admins' trigger: after his next move, without the warning.
 *
 * Test switches (solo): `?power=scraps` starts from 1.e4 d5 2.exd5 Qxd5 (a pawn gone each side, so a piece can drop) with
 * his pawn finished, so it drops at the end of his first turn; `?power=gnaw` warns as the second turn begins.
 */
import { BOSS_POWERS, WORKSHOP_PIECES, type BossPowerSettings, type BossPowerState, type PowerEvent, type WorkshopPiece, type WorkshopState } from "@chessroyale/core";
import { BOSS_OPENING, newBoard } from "../boards.ts";
import { kingAttackers, legalMoves, pieceAt, sideToMove, withoutPiece } from "../rules.ts";
import { stockfishRefuses } from "../uci.ts";
import { crowdHalf, from, meterFull, other, powerRoll, testSwitch, ticksAt, to, unleashed, type Battle, type BossRules, type Side } from "./base.ts";
import { BALLOON_TEST_MOVES, landCheck, landRefused } from "./tiger.ts";

// ---------------- His moments ----------------

/**
 * His animations' lengths (ms; the art's, scripts/boss-art/out/boss-beaver on claude/boss-art, copied into
 * packages/app/src/characters/timber.ts): a scrap caught and hammered in (`scrap`), a plank off his back and down to the
 * board (`build`: its `drop` cue at buildDropAt, the piece goes on), the Gnaw (`gnaw`: four chomps, the last at gnawEatAt:
 * the pawn is gone; then a chew and a burp of sawdust), his nod and his big cheer.
 */
export const TIMBER_ANIM = { scrap: 1190, build: 1630, buildDropAt: 860, gnaw: 1890, gnawEatAt: 750, cheer: 900, bigCheer: 1230 } as const;

/**
 * How long each of his moments holds the screen (ms; POWER_FX in boss-timing.ts, so the server waits for them): a drop
 * (his `build`, the piece going on at its `drop` cue) and the Gnaw (its banner's 1500 ms, POWER_BANNERS, then his chomps,
 * his teeth crossing the board to the pawn). Scraps landing play over whoever's turn it is and hold nothing (no moment).
 */
export const TIMBER_FX = { build: TIMBER_ANIM.build, gnaw: 1500 + TIMBER_ANIM.gnaw } as const;

type WorkshopSettings = Pick<BossPowerSettings, "scrapEverySec" | "scrapsPerCapture" | "workshopCosts" | "workshopDropMax" | "gnawScraps">;

// ---------------- The workshop ----------------

/** A piece's cost in scraps. */
export const costOf = (piece: WorkshopPiece, s: Pick<BossPowerSettings, "workshopCosts"> = BOSS_POWERS): number => s.workshopCosts[piece];

/** The workshop has made its last drop: it's closed (no more scraps). */
export const workshopClosed = (w: Pick<WorkshopState, "drops">, s: Pick<BossPowerSettings, "workshopDropMax"> = BOSS_POWERS): boolean => w.drops >= s.workshopDropMax;

/** A fresh workshop at clock time `now` (every piece at 0). */
export function freshWorkshop(seed: number, now: number): WorkshopState {
  return { prog: WORKSHOP_PIECES.map(() => 0), done: [], n: 0, since: now, wseed: Math.floor(powerRoll(seed, "workshop") * 2 ** 32), drops: 0, gnaws: 0 };
}

/**
 * Which piece scrap number `i` goes to (an index into WORKSHOP_PIECES), given the progress so far: at random among the
 * pieces not finished (its roll from the workshop's seed and `i`); -1 when none is open (it's wasted).
 */
export function scrapTarget(wseed: number, i: number, prog: readonly number[], s: Pick<BossPowerSettings, "workshopCosts"> = BOSS_POWERS): number {
  let open = 0;
  for (let k = 0; k < WORKSHOP_PIECES.length; k++) if (prog[k]! < costOf(WORKSHOP_PIECES[k]!, s)) open++;
  if (!open) return -1;
  let pick = Math.floor(powerRoll(wseed, "scrap", i) * open);
  for (let k = 0; k < WORKSHOP_PIECES.length; k++) if (prog[k]! < costOf(WORKSHOP_PIECES[k]!, s) && pick-- === 0) return k;
  return -1;
}

/**
 * `k` scraps more on the workbench (each to its roll's piece, in turn), into `prog` (changed in place) from roll number `n`;
 * each piece it finishes goes on the end of `done` (the finished pieces in the order they finished, changed in place). Returns
 * the next roll's number.
 */
export function addScraps(wseed: number, n: number, prog: number[], k: number, s: Pick<BossPowerSettings, "workshopCosts"> = BOSS_POWERS, done?: number[]): number {
  for (let j = 0; j < k; j++) {
    const t = scrapTarget(wseed, n + j, prog, s);
    if (t < 0) continue;
    prog[t]!++;
    if (prog[t] === costOf(WORKSHOP_PIECES[t]!, s)) done?.push(t);
  }
  return n + k;
}

/**
 * The workshop at clock time `now`: the snapshot `w` with every scrap the real-time meter has brought since (ticksAt), and when
 * the next lands (null: closed). Pure, so the rules and every screen agree. (A screen reads it on its own timer, never per frame.)
 */
export function workshopAt(w: Pick<WorkshopState, "prog" | "n" | "since" | "wseed" | "drops"> & { done?: readonly number[] }, now: number, s: WorkshopSettings = BOSS_POWERS): { prog: number[]; done: number[]; n: number; since: number; next: number | null; landed: number } {
  const prog = [...w.prog];
  const done = [...(w.done ?? [])];
  if (workshopClosed(w, s)) return { prog, done, n: w.n, since: w.since, next: null, landed: 0 };
  const every = s.scrapEverySec * 1000;
  // (A long hidden stretch can't run away with it: a few hundred scraps fill every piece many times over.)
  const { ticks, next } = ticksAt(w.since, now, every);
  const k = Math.min(ticks, 400);
  const n = addScraps(w.wseed, w.n, prog, k, s, done);
  return { prog, done, n, since: w.since + ticks * every, next, landed: k };
}

/** The finished pieces (WORKSHOP_PIECES' indices) in the order they finished: `done`, then any finished piece it misses. */
export function finished(prog: readonly number[], done: readonly number[] = [], s: Pick<BossPowerSettings, "workshopCosts"> = BOSS_POWERS): number[] {
  const out = done.filter((k, i) => prog[k]! >= costOf(WORKSHOP_PIECES[k]!, s) && done.indexOf(k) === i);
  for (let k = 0; k < WORKSHOP_PIECES.length; k++) if (prog[k]! >= costOf(WORKSHOP_PIECES[k]!, s) && !out.includes(k)) out.push(k);
  return out;
}

/** His half of the board (ranks 5 to 8 when he's Black, 1 to 4 when White). */
const halfOf = (his: Side): string[] => crowdHalf(his);

/** How far a square of his half is from his own back rank (0 on it, 3 on his half's front rank). */
const fromHome = (sq: string, his: Side): number => (his === "w" ? Number(sq[1]) - 1 : 8 - Number(sq[1]));

/**
 * Where a finished piece drops (`fen`: the crowd to move, after his move): a square of his half that the landing guards allow
 * (landCheck), his own two back ranks first (he sets it down by his workshop: a piece he builds starts at home, not in your
 * face; the sim's call, reports/timber-sim.md), in a seeded order within them (the workshop's seed and the drop's number).
 * With the position after, or null.
 */
export function dropSquare(fen: string, piece: WorkshopPiece, wseed: number, drop: number): { square: string; fen: string } | null {
  const his = other(sideToMove(fen));
  if (landRefused(fen, piece, his)) return null;
  const order = halfOf(his)
    .filter((sq) => !pieceAt(fen, sq))
    .map((sq) => ({ sq, k: (fromHome(sq, his) >= 2 ? 1 : 0) + powerRoll(wseed, "drop", drop, sq) }))
    .sort((a, b) => a.k - b.k);
  for (const { sq } of order) {
    const after = landCheck(fen, piece, sq, []);
    if (after) return { square: sq, fen: after };
  }
  return null;
}

/** The position with the en passant square kept only while a capture there is still legal (as the engine keeps it). */
export function tidyEnPassant(fen: string): string {
  const parts = fen.split(" ");
  const ep = parts[3];
  if (!ep || ep === "-") return fen;
  const takes = legalMoves(fen).some((m) => to(m) === ep && pieceAt(fen, from(m))?.type === "p" && m[0] !== m[2]);
  if (takes) return fen;
  parts[3] = "-";
  return parts.join(" ");
}

/**
 * The Gnaw's pawn (`fen`: the crowd to move, after his move): the crowd's pawns in a seeded order (the battle's seed and his
 * gnaw's number), the first whose going the guards allow: no new attack on the crowd's king, a move left for the crowd,
 * a position the engine plays. `none`: the crowd has no pawn at all; null with pawns left: none qualifies now (it waits).
 */
export function gnawPick(fen: string, seed: number, gnaw: number): { square: string; fen: string } | "none" | null {
  const crowd = sideToMove(fen);
  const pawns: string[] = [];
  for (const f of "abcdefgh") for (let r = 2; r <= 7; r++) if (pieceAt(fen, `${f}${r}`)?.type === "p" && pieceAt(fen, `${f}${r}`)?.color === crowd) pawns.push(`${f}${r}`);
  if (!pawns.length) return "none";
  const before = kingAttackers(fen, crowd).length;
  const order = pawns.map((sq) => ({ sq, k: powerRoll(seed, "gnaw", gnaw, sq) })).sort((a, b) => a.k - b.k);
  for (const { sq } of order) {
    const after = tidyEnPassant(withoutPiece(fen, sq));
    if (stockfishRefuses(after)) continue;
    if (kingAttackers(after, crowd).length > before) continue;
    if (!legalMoves(after).length) continue;
    return { square: sq, fen: after };
  }
  return null;
}

/** His workshop's state (null before his battle has set it up). */
export const workshopOf = (p: Pick<BossPowerState, "workshop"> | null | undefined): WorkshopState | null => p?.workshop ?? null;

/** His reaction to a drop: a big cheer for a queen, a nod for any other. */
export const buildReaction = (piece: WorkshopPiece): "bigCheer" | "cheer" => (piece === "q" ? "bigCheer" : "cheer");

// ---------------- His rules ----------------

/**
 * The test switches: ?power=gnaw warns as the second turn begins, the Gnaw after his move on his turn after it; ?power=scraps
 * starts from BALLOON_TEST_MOVES with his pawn finished (it drops at the end of his first turn).
 */
export const TIMBER: BossRules = {
  id: "timber",
  // Gnaw: the meter full as a turn begins, its warning that turn; on his turn after it, after his move (afterBossMove). The
  // trigger (`ultNext`, kept): after his next move, without the warning.
  ultimateOnHisTurn: true,
  ultimate(next, t) {
    if (next.warnAt !== undefined || t.ultNext) return false;
    if (meterFull(next, t) || testSwitch(t, next)) {
      next.warnAt = t.turn;
      t.events.push({ kind: "warn", turn: t.turn });
    }
    return false;
  },
  // (The Gnaw is his turn's end: over as the crowd's next turn begins.)
  ultimateRunning: (p, turn) => turn <= (p.ultAt ?? 0),
  // As the crowd's turn after his turn's end begins: his Gnaw, then his drop.
  everyTurn(next, t) {
    const w = next.workshop;
    if (!w) return;
    if (w.gnaw && w.gnaw.at + 1 === t.turn) t.events.push({ kind: "gnaw", turn: t.turn, ...(w.gnaw.square ? { square: w.gnaw.square } : {}), scraps: w.gnaw.scraps });
    if (w.last && w.last.at + 1 === t.turn) t.events.push({ kind: "build", turn: t.turn, square: w.last.square, shape: w.last.piece });
  },
  // (His scraps come by the clock and his captures; his drops at his turn's end: afterBossMove.)
  passive() {},
  // The turn a piece dropped or a pawn was eaten (the board changed outside a move) doesn't count for fair play.
  powerTurn: (boss) => {
    const w = boss.powers?.workshop;
    return !!w && (w.last?.at === boss.crowdMoves || w.gnaw?.at === boss.crowdMoves);
  },
  opening: {
    setUp(b, at) {
      const test = b.settings.bossPowerTest === "scraps";
      if (test) b.boards.set(at.boardId, newBoard(at.boardId, { ...BOSS_OPENING, moves: [...BALLOON_TEST_MOVES] }, BALLOON_TEST_MOVES.length, at.generation));
      const w = freshWorkshop(at.seed, b.now());
      if (test) {
        w.prog[0] = costOf("p");
        w.done = [0];
      }
      return { workshop: w };
    },
  },
  afterBossMove(b) {
    timberBattle.endOfTurn(b);
  },
  view: (p) => ({ workshop: workshopView(p) }),
};

/**
 * His fields for the screens (NetBossPowers' `workshop`): the snapshot (workshopAt with the screens' clock gives the scraps
 * landed since), the cap, his last drop, his last Gnaw and his last bonus scraps.
 */
export interface WorkshopView {
  prog: number[];
  done: number[];
  n: number;
  since: number;
  wseed: number;
  drops: number;
  max: number;
  last: WorkshopState["last"];
  gnaw: WorkshopState["gnaw"];
  bonus: WorkshopState["bonus"];
}

export function workshopView(p: BossPowerState): WorkshopView | null {
  const w = p.workshop;
  if (!w) return null;
  return { prog: [...w.prog], done: [...(w.done ?? [])], n: w.n, since: w.since, wseed: w.wseed, drops: w.drops, max: BOSS_POWERS.workshopDropMax, last: w.last ?? null, gnaw: w.gnaw ?? null, bonus: w.bonus ?? null };
}

// ---------------- His part in the match runner ----------------

const boardOf = (b: Battle) => b.boards.get(b.state.boards[0]!)!;

/** The board changed outside a move (a pawn eaten, a piece dropped): the new position, a base at its ply. */
function setBoard(b: Battle, fen: string): void {
  const id = b.state.boards[0]!;
  const board = boardOf(b);
  const ply = board.history.length;
  b.boards.set(id, { ...board, fen, bases: [...(board.bases ?? []).filter((x) => x.ply !== ply), { ply, fen }] });
}

export const timberBattle = {
  /** His Gnaw is due at the end of this turn: from the turn the meter warned (the crowd has moved since), or after the admins' trigger. */
  gnawDue(p: BossPowerState, crowdMoves: number): boolean {
    if (p.ultAt !== undefined) return false;
    return !!p.ultNext || (p.warnAt !== undefined && p.warnAt <= crowdMoves);
  },

  /**
   * The end of his turn (after his move): the clock's scraps worked in (workshopAt), then his Gnaw if it's due (a pawn eaten,
   * its scraps), then his capture's scraps, then one drop if a finished piece can go anywhere. Not once the battle is over on
   * the board. Returns what happened, for the tests and the sims.
   */
  endOfTurn(b: Battle, s: WorkshopSettings = BOSS_POWERS): { gnaw: WorkshopState["gnaw"]; drop: WorkshopState["last"]; bonus: number } | null {
    const boss = b.state.boss;
    const p = boss?.powers;
    const w0 = workshopOf(p);
    if (!boss || !p || !w0 || boss.id !== "timber" || boss.result) return null;
    let fen = boardOf(b).fen;
    if (sideToMove(fen) !== boss.crowdSide || !legalMoves(fen).length) return null;
    const at = boss.crowdMoves;
    const now = workshopAt(w0, b.now(), s);
    const w: WorkshopState = { ...w0, prog: now.prog, done: now.done, n: now.n, since: now.since };
    const open = !workshopClosed(w, s);
    let next: BossPowerState = p;
    let gnaw: WorkshopState["gnaw"] = null;
    let bonus = 0;
    let src: "capture" | "gnaw" | "both" | null = null;
    // His Gnaw: a pawn eaten, its scraps (the meter spent); none qualifying with pawns left: it waits.
    if (timberBattle.gnawDue(p, at)) {
      const pick = gnawPick(fen, p.seed, w.gnaws);
      if (pick) {
        const square = pick === "none" ? null : pick.square;
        if (pick !== "none") {
          fen = pick.fen;
          setBoard(b, fen);
        }
        const scraps = square && open ? s.gnawScraps : 0;
        gnaw = { at, square, scraps };
        w.gnaw = gnaw;
        w.gnaws++;
        if (scraps) {
          bonus += scraps;
          src = "gnaw";
        }
        const { ultNext: _trigger, ...rest } = p;
        next = unleashed({ ...rest, ultAt: at });
      }
    }
    // His capture: scrapsPerCapture.
    if (b.bossLast?.captured && open) {
      bonus += s.scrapsPerCapture;
      src = src ? "both" : "capture";
    }
    if (bonus) {
      w.n = addScraps(w.wseed, w.n, w.prog, bonus, s, w.done);
      w.bonus = { at, scraps: bonus, from: src! };
    }
    // One drop: the first finished piece that can go somewhere.
    let drop: WorkshopState["last"] = null;
    if (open) {
      for (const k of finished(w.prog, w.done, s)) {
        const piece = WORKSHOP_PIECES[k]!;
        const sq = dropSquare(fen, piece, w.wseed, w.drops);
        if (!sq) continue;
        setBoard(b, sq.fen);
        w.prog[k] = 0;
        w.done = (w.done ?? []).filter((x) => x !== k);
        w.drops++;
        drop = { at, piece, square: sq.square };
        w.last = drop;
        break;
      }
    }
    b.state = { ...b.state, boss: { ...b.state.boss!, powers: { ...next, workshop: w } } };
    return { gnaw, drop, bonus };
  },
};

/** His events for a turn (the sims and tests read them). */
export const timberEvents = (events: readonly PowerEvent[]) => events.filter((e) => e.kind === "build" || e.kind === "gnaw");
