import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";
import { AUTOCHESS, mulberry32, type AutoChessSettings } from "@chessroyale/core";
import { useAccount } from "./Profile.tsx";
import { Board } from "../components/Board.tsx";
import { BackButton } from "../components/FrontDoor.tsx";
import { cellOf, dragStarted, squareAtPoint } from "../board/logic.ts";
import { play } from "../sound.ts";
import { testParams } from "../test-switches.ts";
import { adjustBlock, adjustMove, adjustTargets, adjustWords, startAdjust, undoBlock, undoMove, type Adjusted } from "../autochess/adjust.ts";
import { botAdjust, botAt, botPlan } from "../autochess/bot.ts";
import {
  buy,
  buyBlock,
  buyWords,
  emptyArmy,
  kingSquares,
  moveOnBoard,
  placeBlock,
  placeFromBench,
  placeWords,
  priceOf,
  sellPiece,
  sellValue,
  toBench,
} from "../autochess/army.ts";
import {
  beginRound,
  goldBreakdown,
  incomeFor,
  matchWinner,
  newMatch,
  roundSeed,
  settleRound,
  youColor,
  type GoldBreakdown,
  type MatchState,
  type RoundResult,
} from "../autochess/economy.ts";
import { botEvaluator, enginePick, warmEngine } from "../autochess/engine.ts";
import { playFight } from "../autochess/fight.ts";
import { armiesFen, armyPieces, fenFrom, fightStart, piecesOn } from "../autochess/position.ts";
import { KIND_NAME, KINDS, other, type Army, type Color, type Kind } from "../autochess/types.ts";
import { clockWords, damageWords, endWords, goldWords, headline, matchWords, type EndKind } from "../autochess/words.ts";

/**
 * Auto chess, the demo (/autochess; docs/decisions/2026-10-19-autochess-demo.md, docs/areas/autochess.md): you against a
 * bot, all in this browser. Each round the game puts both kings down; you buy pieces onto a bench and place them on your
 * half (30 s, the last 3 locked) while the bot's pieces show as plain circles 2 s behind; then their real pieces show and
 * each of your pieces may make one legal chess move (15 s); then the engine plays both armies out. The rules are in
 * `autochess/` (pure, tested); this draws them. Nothing is recorded, rewarded or sent anywhere.
 */

/** How often the clock is read: the countdown, the circles 2 s behind and the end of each step. Nothing is drawn per frame. */
const TICK_MS = 120;
/** How long a message under the board stays. */
const SAY_MS = 4200;
/** At the end of the adjust step the fight waits at most this long for the bot's last look. */
const BOT_WAIT_MS = 2500;

type Phase = "buy" | "adjust" | "fight" | "result" | "over";

type BotPlan = ReturnType<typeof botPlan>;

/** Everything that belongs to one round (a new one every round: nothing carries over but gold, HP and the streak). */
interface RoundState {
  you: Army;
  /** Your adjust step: where your pieces stand and which have moved. */
  adj: Adjusted | null;
  plan: BotPlan;
  /** The bot's army after its adjust step (hidden until the fight). */
  botFinal: Army | null;
  gold: { you: GoldBreakdown; bot: GoldBreakdown };
}

interface Outcome {
  result: RoundResult;
  end: EndKind;
  /** Next round's gold, line by line (null when the match is over). */
  next: GoldBreakdown | null;
}

interface Game {
  match: MatchState;
  phase: Phase;
  /** When this step began (performance.now). */
  phaseStart: number;
  round: RoundState;
  fight: { fen: string; last: string | null; plies: number } | null;
  outcome: Outcome | null;
}

/** The bot's adjust step in progress: told to stop at the fight, and the army it has so far. */
interface BotRun {
  stop: boolean;
  done: Promise<void> | null;
  latest: Army;
}

/** A piece being held: picked up for a drag, or selected by a tap. */
interface Hold {
  kind: Kind | "k";
  at: { bench: number } | { square: string };
}
type Target = { square: string } | { bench: true } | { shop: true } | null;

const sameHold = (a: Hold | null, b: Hold | null) => !!a && !!b && JSON.stringify(a.at) === JSON.stringify(b.at);
const isSquare = (h: Hold): h is Hold & { at: { square: string } } => "square" in h.at;

function startRound(prev: MatchState, cfg: AutoChessSettings): { match: MatchState; round: RoundState } {
  const { match, gold } = beginRound(prev, cfg);
  const mine = youColor(match.round);
  const theirs = other(mine);
  const seed = roundSeed(match);
  const kings = kingSquares(seed, cfg);
  const plan = botPlan(theirs, kings[theirs], match.bot.gold, match.round, mulberry32(seed ^ 0x9e3779b9), cfg);
  return { match, round: { you: emptyArmy(mine, kings[mine]), adj: null, plan, botFinal: null, gold } };
}

function newGame(seed: number, cfg: AutoChessSettings): Game {
  const { match, round } = startRound(newMatch(seed, cfg), cfg);
  return { match, phase: "buy", phaseStart: performance.now(), round, fight: null, outcome: null };
}

/** A phone's short steps for tests (`?quick=1`, a test switch): the same game in a few seconds a step. */
function settingsFor(quick: boolean): AutoChessSettings {
  return quick ? { ...AUTOCHESS, buySeconds: 6, lockSeconds: 1, circlesDelaySeconds: 0.5, adjustSeconds: 5, fightMoveMs: 60 } : AUTOCHESS;
}

const colorName = (c: Color) => (c === "w" ? "White" : "Black");

/** A piece's picture: the board's own art, in a box that sizes it. */
function PieceIcon({ color, kind }: { color: Color; kind: Kind | "k" }) {
  return (
    <span class="hb-pieces ac-icon" aria-hidden="true">
      <piece class={`${color === "w" ? "white" : "black"} ${KIND_NAME[kind]}`} />
    </span>
  );
}

/**
 * The screen waits for the app's answer about test switches (a moment, never an account: a failed one answers too), so
 * `?quick=1` and `?seed=` are read once they are known.
 */
export function AutoChessScreen({ onBack }: { onBack: () => void }) {
  const { config } = useAccount();
  if (!config) return <div class="fd-splash" />;
  return <AutoChessGame onBack={onBack} />;
}

function AutoChessGame({ onBack }: { onBack: () => void }) {
  const params = testParams();
  const quick = params.get("quick") === "1";
  const cfg = useMemo(() => settingsFor(quick), []);
  const seedParam = Number(params.get("seed"));
  const [game, setGame] = useState<Game>(() => newGame(Number.isFinite(seedParam) && params.get("seed") ? seedParam : (Math.random() * 2 ** 31) | 0, cfg));
  const gref = useRef(game);
  const commit = (g: Game) => {
    gref.current = g;
    setGame(g);
  };
  const [now, setNow] = useState(() => performance.now());
  const [sel, setSelState] = useState<Hold | null>(null);
  const selRef = useRef<Hold | null>(null);
  const setSel = (h: Hold | null) => {
    selRef.current = h;
    setSelState(h);
  };
  const [drag, setDrag] = useState<Hold | null>(null);
  const [msg, setMsg] = useState("");
  const msgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const say = (text: string) => {
    setMsg(text);
    if (msgTimer.current) clearTimeout(msgTimer.current);
    msgTimer.current = setTimeout(() => setMsg(""), SAY_MS);
  };
  const cancelled = useRef(false);
  const botRun = useRef<BotRun>({ stop: false, done: null, latest: game.round.plan.army });
  const layerRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const ghostAt = useRef({ x: 0, y: 0 });
  const press = useRef<{ id: number; hold: Hold; x: number; y: number; started: boolean } | null>(null);

  const g = game;
  const mine = youColor(g.match.round);
  const theirs = other(mine);
  const orientation = mine === "w" ? "white" : "black";
  // (Never negative: the clock was read a moment before this step began.)
  const elapsed = Math.max(0, now - g.phaseStart);
  const lockedAt = (cfg.buySeconds - cfg.lockSeconds) * 1000;
  const locked = g.phase === "buy" && elapsed >= lockedAt;

  useEffect(() => {
    warmEngine();
    const id = setInterval(() => {
      const cur = gref.current;
      const t = performance.now();
      setNow(t);
      if (cur.phase === "buy" && t - cur.phaseStart >= cfg.buySeconds * 1000) toAdjust();
      else if (cur.phase === "adjust" && t - cur.phaseStart >= cfg.adjustSeconds * 1000) void toFight();
    }, TICK_MS);
    return () => {
      clearInterval(id);
      cancelled.current = true;
      botRun.current.stop = true;
      if (msgTimer.current) clearTimeout(msgTimer.current);
    };
  }, []);

  // ---------------- The steps ----------------

  /** The buying is over: their real pieces show (as they were when it locked), and your pieces may move once each. */
  function toAdjust() {
    const cur = gref.current;
    if (cur.phase !== "buy") return;
    setSel(null);
    setDrag(null);
    press.current = null;
    const you = cur.round.you;
    // (What the bot spent is paid now; it sells nothing.)
    const match: MatchState = { ...cur.match, bot: { ...cur.match.bot, gold: cur.match.bot.gold - cur.round.plan.spent } };
    commit({ ...cur, match, phase: "adjust", phaseStart: performance.now(), round: { ...cur.round, adj: startAdjust(you) } });
    // The bot adjusts out of sight, from your army as it stood when it locked, and its moves show at the fight.
    const run: BotRun = { stop: false, done: null, latest: cur.round.plan.army };
    botRun.current = run;
    const seed = roundSeed(match);
    run.done = botAdjust(cur.round.plan.army, botEvaluator(you, other(youColor(match.round)), cfg), mulberry32(seed ^ 0x51ed270b), () => run.stop || cancelled.current, cfg, (army) => (run.latest = army)).then(
      () => undefined,
      () => undefined,
    );
  }

  /** The adjust step is over: the bot's moves show, and the engine plays both armies out. */
  async function toFight() {
    const cur = gref.current;
    if (cur.phase !== "adjust") return;
    setSel(null);
    press.current = null;
    const run = botRun.current;
    run.stop = true;
    commit({ ...cur, phase: "fight", phaseStart: performance.now() });
    // (It stops at its next look; a slow engine gets a moment, then the bot keeps what it had.)
    await Promise.race([run.done, new Promise((r) => setTimeout(r, BOT_WAIT_MS))]);
    if (cancelled.current) return;
    const botFinal = run.latest;
    const at = gref.current;
    const you = at.round.adj?.army ?? at.round.you;
    const color = youColor(at.match.round);
    const start = color === "w" ? fightStart(you, botFinal) : fightStart(botFinal, you);
    commit({ ...at, round: { ...at.round, botFinal }, fight: { fen: start.fen, last: null, plies: 0 } });
    if (start.draw) return finish(null, "both_checked", start.fen);
    const res = await playFight(start.fen, {
      pick: (fen) => enginePick(fen, cfg),
      rng: mulberry32(roundSeed(at.match) ^ 0x2545f491),
      cancelled: () => cancelled.current,
      onStep: (s) => commit({ ...gref.current, fight: { fen: s.fen, last: s.move, plies: s.ply } }),
      cfg,
    });
    if (res) finish(res.winner, res.end, res.fen);
  }

  /** The fight is over: the loser loses HP, the refunds wait for the next round, and the result shows. */
  function finish(winner: Color | null, end: EndKind, fen: string) {
    const cur = gref.current;
    const color = youColor(cur.match.round);
    const on = piecesOn(fen);
    const who = winner === null ? "draw" : winner === color ? "you" : "bot";
    const { match, result } = settleRound(cur.match, who, { you: on[color], bot: on[other(color)] }, { you: cur.round.you.bench, bot: [] }, cfg);
    const won = matchWinner(match);
    const next = won ? null : goldBreakdown(match.round + 1, match.you, cfg);
    commit({ ...cur, match, phase: won ? "over" : "result", phaseStart: performance.now(), outcome: { result, end, next } });
  }

  function nextRound() {
    const cur = gref.current;
    if (cur.phase !== "result") return;
    const { match, round } = startRound(cur.match, cfg);
    setSel(null);
    setMsg("");
    commit({ match, phase: "buy", phaseStart: performance.now(), round, fight: null, outcome: null });
  }

  function playAgain() {
    setSel(null);
    setMsg("");
    commit(newGame((Math.random() * 2 ** 31) | 0, cfg));
  }

  // ---------------- Buying, placing, selling ----------------

  /** Whether the buy step takes an action now (not locked, not over). Read from the clock, not from the last tick. */
  const buying = () => {
    const cur = gref.current;
    if (cur.phase !== "buy") return false;
    if (performance.now() - cur.phaseStart >= lockedAt) {
      say("Locked: no buying, selling or moving.");
      return false;
    }
    return true;
  };

  const withArmy = (army: Army) => commit({ ...gref.current, round: { ...gref.current.round, you: army } });
  const withGold = (gold: number, army: Army) => {
    const cur = gref.current;
    commit({ ...cur, match: { ...cur.match, you: { ...cur.match.you, gold } }, round: { ...cur.round, you: army } });
  };

  function buyPiece(kind: Kind) {
    if (!buying()) return;
    const cur = gref.current;
    const block = buyBlock(cur.round.you, cur.match.you.gold, kind);
    if (block) return say(buyWords(block, kind, cur.match.you.gold).line);
    withGold(cur.match.you.gold - priceOf(kind), buy(cur.round.you, kind));
    setMsg("");
    play("pop");
  }

  function sell(hold: Hold) {
    if (hold.kind === "k" || !buying()) return;
    const cur = gref.current;
    const { army, gold } = sellPiece(cur.round.you, hold.at);
    withGold(cur.match.you.gold + gold, army);
    setSel(null);
    play("sell");
    say(`Sold the ${KIND_NAME[hold.kind]} for ${gold}.`);
  }

  /** A held piece let go on a target, while buying. */
  function dropWhileBuying(hold: Hold, target: Target) {
    if (hold.kind === "k" || !target || !buying()) return;
    const army = gref.current.round.you;
    if ("shop" in target) return sell(hold);
    if ("bench" in target) {
      if (!isSquare(hold)) return;
      if (army.bench.length >= cfg.benchSlots) return say(buyWords("bench", hold.kind, 0).line);
      withArmy(toBench(army, hold.at.square));
      setSel(null);
      setMsg("");
      return play("move");
    }
    const from = isSquare(hold) ? hold.at.square : undefined;
    if (from === target.square) return setSel(null);
    const block = placeBlock(army, hold.kind, target.square, from, cfg);
    if (block) return say(placeWords(block, cfg));
    withArmy(isSquare(hold) ? moveOnBoard(army, hold.at.square, target.square) : placeFromBench(army, (hold.at as { bench: number }).bench, target.square));
    setSel(null);
    setMsg("");
    play("move");
  }

  // ---------------- Adjusting ----------------

  const adjusting = () => gref.current.phase === "adjust" && performance.now() - gref.current.phaseStart < cfg.adjustSeconds * 1000;

  function adjustTo(from: string, to: string) {
    if (!adjusting()) return;
    const cur = gref.current;
    const adj = cur.round.adj!;
    if (from === to) return setSel(null);
    const block = adjustBlock(adj, from, to, cfg);
    if (block) return say(adjustWords(block, cfg));
    commit({ ...cur, round: { ...cur.round, adj: adjustMove(adj, from, to) } });
    setSel(null);
    setMsg("");
    play("move");
  }

  function takeBack(at: string) {
    if (!adjusting()) return;
    const cur = gref.current;
    const adj = cur.round.adj!;
    const block = undoBlock(adj, at);
    if (block === "taken") return say("Another piece is on that square now. Take its move back first.");
    if (block) return;
    commit({ ...cur, round: { ...cur.round, adj: undoMove(adj, at) } });
    setSel(null);
  }

  // ---------------- Taps and drags ----------------

  /** What one of your pieces stands on this square, in this step (the king too, while adjusting). */
  function pieceOf(square: string): Kind | "k" | null {
    const cur = gref.current;
    if (cur.phase === "buy") return square === cur.round.you.king ? "k" : (cur.round.you.board[square] ?? null);
    if (cur.phase === "adjust" && cur.round.adj) {
      const a = cur.round.adj.army;
      return square === a.king ? "k" : (a.board[square] ?? null);
    }
    return null;
  }

  function tapPiece(hold: Hold) {
    const phase = gref.current.phase;
    if (phase === "buy") {
      if (!buying()) return;
      if (hold.kind === "k") return say("Your king is placed by the game.");
    } else if (!adjusting()) return;
    // (Adjusting: a piece that has moved takes its move back when tapped.)
    if (phase === "adjust" && isSquare(hold) && gref.current.round.adj?.moved[hold.at.square] !== undefined) return takeBack(hold.at.square);
    if (sameHold(selRef.current, hold)) return setSel(null);
    setSel(hold);
    if (phase === "buy") say(`${KIND_NAME[hold.kind as Kind][0]!.toUpperCase()}${KIND_NAME[hold.kind as Kind].slice(1)} picked up. Tap a square of your half to place it.`);
  }

  function tapSquare(square: string) {
    const hold = selRef.current;
    if (!hold) return;
    if (gref.current.phase === "buy") dropWhileBuying(hold, { square });
    else if (isSquare(hold)) adjustTo(hold.at.square, square);
  }

  function dropped(hold: Hold, target: Target) {
    if (gref.current.phase === "buy") dropWhileBuying(hold, target);
    else if (target && "square" in target && isSquare(hold)) adjustTo(hold.at.square, target.square);
    else setSel(null);
  }

  const boxOf = () => layerRef.current!.getBoundingClientRect();

  /** Where a point is: a square of the board, the bench, or the shop. */
  function targetAt(x: number, y: number): Target {
    const square = squareAtPoint(x, y, boxOf(), orientation);
    if (square) return { square };
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-ac-drop]");
    if (el?.dataset.acDrop === "bench") return { bench: true };
    if (el?.dataset.acDrop === "shop") return { shop: true };
    return null;
  }

  function startPress(e: PointerEvent, hold: Hold) {
    if (press.current || !e.isPrimary || (e.pointerType === "mouse" && e.button !== 0)) return;
    press.current = { id: e.pointerId, hold, x: e.clientX, y: e.clientY, started: false };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  }

  function movePress(e: PointerEvent) {
    const p = press.current;
    if (!p || e.pointerId !== p.id) return;
    ghostAt.current = { x: e.clientX, y: e.clientY };
    if (!p.started && dragStarted(e.clientX - p.x, e.clientY - p.y) && (p.hold.kind !== "k" || gref.current.phase === "adjust")) {
      p.started = true;
      // (A piece picked up to drag is the selected one too.)
      setSel(p.hold);
      setDrag(p.hold);
    }
    if (p.started) placeGhost();
  }

  function placeGhost() {
    const el = ghostRef.current;
    if (!el) return;
    const half = el.offsetWidth / 2;
    el.style.transform = `translate(${ghostAt.current.x - half}px, ${ghostAt.current.y - half}px)`;
  }

  function endPress(e: PointerEvent, cancel = false) {
    const p = press.current;
    if (!p || e.pointerId !== p.id) return;
    press.current = null;
    if (p.started) {
      setDrag(null);
      if (!cancel) dropped(p.hold, targetAt(e.clientX, e.clientY));
      else setSel(null);
    } else if (!cancel) tapPiece(p.hold);
  }

  function layerDown(e: PointerEvent) {
    const cur = gref.current;
    if (cur.phase !== "buy" && cur.phase !== "adjust") return;
    if ((e.target as Element).closest("button")) return;
    const square = squareAtPoint(e.clientX, e.clientY, boxOf(), orientation);
    if (!square) return;
    const kind = pieceOf(square);
    // (The king can't be picked up while buying: with a piece in hand, its square is a square that refuses it.)
    if (kind === "k" && cur.phase === "buy" && selRef.current) return tapSquare(square);
    if (kind) return startPress(e, { kind, at: { square } });
    tapSquare(square);
  }

  function slotDown(e: PointerEvent, index: number, kind: Kind) {
    if (gref.current.phase !== "buy") return;
    startPress(e, { kind, at: { bench: index } });
  }

  // The dragged piece's first place, before the pointer moves again.
  useLayoutEffect(() => {
    if (drag) placeGhost();
  }, [drag]);

  // ---------------- What to draw ----------------

  const you = g.phase === "adjust" || g.phase === "fight" ? (g.round.adj?.army ?? g.round.you) : g.round.you;
  const botArmy = g.round.botFinal && g.phase !== "buy" && g.phase !== "adjust" ? g.round.botFinal : g.round.plan.army;
  const botKing = g.round.plan.army.king;
  const delayed = Math.max(0, elapsed / 1000 - cfg.circlesDelaySeconds);
  const seen = g.phase === "buy" ? botAt(g.round.plan.events, delayed) : null;

  let fen: string;
  let lastMove: string | null = null;
  if ((g.phase === "fight" || g.phase === "result" || g.phase === "over") && g.fight) {
    fen = g.fight.fen;
    lastMove = g.fight.last;
  } else if (g.phase === "buy") fen = fenFrom([...armyPieces(you), { square: botKing, color: theirs, kind: "k" }]);
  else fen = mine === "w" ? armiesFen(you, botArmy) : armiesFen(botArmy, you);

  const sq = (square: string) => {
    const { col, row } = cellOf(square, orientation);
    return { "--sq-x": col, "--sq-y": row } as Record<string, number>;
  };

  // The squares the held piece may go to (while buying: any empty one of your half it may stand on).
  const dots: string[] = [];
  if (sel && isSquare(sel) && g.phase === "adjust" && g.round.adj) dots.push(...adjustTargets(g.round.adj.army, sel.at.square));
  else if (sel && sel.kind !== "k" && g.phase === "buy" && !locked) {
    const from = isSquare(sel) ? sel.at.square : undefined;
    for (let rank = 1; rank <= 8; rank++)
      for (const f of "abcdefgh") if (!placeBlock(g.round.you, sel.kind, `${f}${rank}`, from, cfg)) dots.push(`${f}${rank}`);
  }

  const interactiveLayer = (g.phase === "buy" && !locked) || (g.phase === "adjust" && elapsed < cfg.adjustSeconds * 1000);
  const goldNow = g.match.you.gold;
  const botGoldNow = g.phase === "buy" ? g.match.bot.gold - (seen?.spent ?? 0) : g.match.bot.gold;

  // The clock and the step's name.
  let clock = "";
  let label = "";
  if (g.phase === "buy") {
    clock = clockWords(cfg.buySeconds * 1000 - elapsed);
    label = locked ? "Locked" : "Buy & place";
  } else if (g.phase === "adjust") {
    clock = clockWords(cfg.adjustSeconds * 1000 - elapsed);
    label = "Move your pieces";
  } else if (g.phase === "fight") {
    label = "Fight";
  } else label = g.phase === "over" ? "Match over" : "Round over";

  const held = sel ?? null;
  const hint =
    g.phase === "buy"
      ? "Tap a piece to buy it. Drag it onto your half, or tap a square."
      : g.phase === "adjust"
        ? "Each piece may make one chess move on your half. Tap a piece, then a square."
        : g.phase === "fight"
          ? `Move ${Math.max(1, Math.ceil(((g.fight?.plies ?? 0) + 1) / 2))} of ${cfg.moveCap}`
          : "";

  const outcome = g.outcome;
  const matchEnd = g.phase === "over" && outcome ? matchWords(outcome.result.outcome === "you") : null;

  const botHp = Math.max(0, g.match.bot.hp);
  const myHp = Math.max(0, g.match.you.hp);

  return (
    <div class="fd-root ac-root" data-phase={g.phase} data-round={g.match.round} data-you={mine} data-king={g.round.you.king} data-bot-king={botKing}>
      <div class="ac-col">
        <header class="ac-top">
          <BackButton onClick={onBack} label="Back to home" />
          <div class="ac-title">
            <strong>Auto chess</strong>
            <span>
              Round {g.match.round} · you play {colorName(mine)}
            </span>
          </div>
          <div class={`ac-clock${locked ? " locked" : ""}`} role="timer" aria-label="Time left in this step">
            <b>{clock}</b>
            <span>{label}</span>
          </div>
        </header>

        <div class="ac-side ac-opp" aria-label="Your opponent">
          <span class={`ac-chip ${theirs}`} aria-hidden="true" />
          <strong>Opponent</strong>
          <span class="ac-stat ac-hp-bot" aria-label="Opponent's HP">
            HP <b>{botHp}</b>
          </span>
          <span class="ac-stat ac-gold-bot" aria-label="Opponent's gold">
            Gold <b>{botGoldNow}</b>
          </span>
        </div>

        <div class="ac-board">
          <Board fen={fen} orientation={orientation} lastMove={lastMove} animate={g.phase === "adjust" || g.phase === "fight"} silent={g.phase !== "fight"}>
            <div
              ref={layerRef}
              class={`ac-layer${interactiveLayer ? " live" : ""}`}
              onPointerDown={layerDown}
              onPointerMove={movePress}
              onPointerUp={(e) => endPress(e)}
              onPointerCancel={(e) => endPress(e, true)}
              onLostPointerCapture={(e) => endPress(e, true)}
            >
              {(g.phase === "buy" || g.phase === "adjust") && <div class="ac-theirs" />}
              {seen && Object.entries(seen.squares).map(([square]) => <span key={square} class={`ac-circle ${theirs}`} data-square={square} style={sq(square)} />)}
              {held && isSquare(held) && <span class="ac-cell ac-picked" style={sq(held.at.square)} />}
              {dots.map((square) => (
                <span key={square} class="ac-cell ac-dot" style={sq(square)} />
              ))}
              {g.phase === "adjust" &&
                g.round.adj &&
                Object.entries(g.round.adj.moved).map(([at, from]) => (
                  <span key={at} class="ac-cell ac-moved" data-square={at} data-from={from} style={sq(at)}>
                    <i aria-hidden="true">↩</i>
                  </span>
                ))}
              {g.phase === "adjust" && <div class="ac-theirs-line">Your opponent is moving their pieces…</div>}
            </div>
          </Board>
        </div>

        {g.phase === "buy" && (
          <div class="ac-msg" role="status" aria-live="polite">
            <span class="ac-msg-text">{msg || hint}</span>
            {!locked && held && held.kind !== "k" && (
              <button type="button" class="ac-sell" onClick={() => sell(held)}>
                Sell {sellValue(held.kind)}
              </button>
            )}
          </div>
        )}

        {g.phase === "buy" ? (
          <>
            <div class="ac-bench" data-ac-drop="bench" aria-label="Your bench" onClick={(e) => (e.target as Element).closest(".ac-slot.has") === null && held && isSquare(held) && dropWhileBuying(held, { bench: true })}>
              {Array.from({ length: cfg.benchSlots }, (_, i) => {
                const kind = g.round.you.bench[i];
                const picked = !!held && "bench" in held.at && held.at.bench === i;
                return kind ? (
                  <button
                    key={i}
                    type="button"
                    class={`ac-slot has${picked ? " picked" : ""}${drag && sameHold(drag, { kind, at: { bench: i } }) ? " lifted" : ""}`}
                    aria-label={`Bench: ${KIND_NAME[kind]}`}
                    aria-pressed={picked}
                    onPointerDown={(e) => slotDown(e, i, kind)}
                    onPointerMove={movePress}
                    onPointerUp={(e) => endPress(e)}
                    onPointerCancel={(e) => endPress(e, true)}
                    onLostPointerCapture={(e) => endPress(e, true)}
                  >
                    <PieceIcon color={mine} kind={kind} />
                  </button>
                ) : (
                  <span key={i} class="ac-slot" aria-hidden="true" />
                );
              })}
            </div>
            <div class={`ac-shop${drag ? " selling" : ""}`} data-ac-drop="shop" aria-label="Shop">
              {KINDS.map((kind) => {
                const block = buyBlock(g.round.you, goldNow, kind);
                const words = block ? buyWords(block, kind, goldNow) : null;
                return (
                  <button
                    key={kind}
                    type="button"
                    class={`ac-buy${block || locked ? " off" : ""}`}
                    aria-disabled={!!block || locked}
                    aria-label={`Buy a ${KIND_NAME[kind]}, ${priceOf(kind)} gold${locked ? ", locked" : words ? `, ${words.short}` : ""}`}
                    onClick={() => buyPiece(kind)}
                  >
                    <PieceIcon color={mine} kind={kind} />
                    <b>{priceOf(kind)}</b>
                    <small>{locked ? "Locked" : (words?.short ?? "")}</small>
                  </button>
                );
              })}
              {drag && drag.kind !== "k" && <div class="ac-sell-drop">Drop to sell for {sellValue(drag.kind)}</div>}
            </div>
          </>
        ) : (
          <div class={`ac-card ac-card-${g.phase}`}>
            {g.phase === "adjust" && (
              <>
                <p class="ac-card-say" role="status" aria-live="polite">
                  {msg || hint}
                </p>
                <p class="ac-card-text">
                  Their real pieces stay shown. Your moves stay hidden from them until the fight. Tap a piece you moved (↩) to take its move back.
                  {g.round.you.bench.length > 0 && ` ${g.round.you.bench.length} on your bench sit out and are refunded in full.`}
                </p>
              </>
            )}
            {g.phase === "fight" && (
              <>
                <p class="ac-card-say">{hint}</p>
                <p class="ac-card-text">The engine plays both armies at the same strength, until mate, stalemate, a draw by the rules or {cfg.moveCap} moves each.</p>
              </>
            )}
            {(g.phase === "result" || g.phase === "over") && outcome && (
              <>
                <p class="ac-card-head">{matchEnd ? matchEnd.head : headline(outcome.result)}</p>
                <p class="ac-card-text">
                  {endWords(outcome.end, outcome.result.outcome === "draw", cfg)} {damageWords(outcome.result)}
                  {matchEnd ? ` ${matchEnd.sub}` : ""}
                </p>
                {outcome.next && <p class="ac-card-gold">{goldWords(outcome.next)}</p>}
                <div class="ac-card-buttons">
                  {g.phase === "result" ? (
                    <button type="button" class="ac-go" onClick={nextRound}>
                      Next round
                    </button>
                  ) : (
                    <>
                      <button type="button" class="ac-go" onClick={playAgain}>
                        Play again
                      </button>
                      <button type="button" class="ac-go ac-go-2" onClick={onBack}>
                        Home
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        <div class="ac-side ac-me" aria-label="You">
          <span class={`ac-chip ${mine}`} aria-hidden="true" />
          <strong>You</strong>
          <span class="ac-stat ac-hp-you" aria-label="Your HP">
            HP <b>{myHp}</b>
          </span>
          <span class="ac-stat ac-gold-you" aria-label="Your gold">
            Gold <b>{goldNow}</b>
          </span>
          <span class="ac-stat ac-income" aria-label="This round's income">
            Income <b>+{incomeFor(g.match.round)}</b>
          </span>
        </div>
      </div>
      {drag && (
        <div ref={ghostRef} class="hb-pieces ac-ghost" style={{ width: `${boxOf().width / 8}px`, height: `${boxOf().width / 8}px` }} aria-hidden="true">
          <piece class={`${mine === "w" ? "white" : "black"} ${KIND_NAME[drag.kind]}`} />
        </div>
      )}
    </div>
  );
}
