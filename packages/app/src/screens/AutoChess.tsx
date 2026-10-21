import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";
import type { ComponentChildren } from "preact";
import { AUTOCHESS, botLook, mulberry32, type AutoChessSettings } from "@chessroyale/core";
import { account } from "../account.ts";
import { useAccount } from "./Profile.tsx";
import { Board } from "../components/Board.tsx";
import { COUNT_FROM_SECONDS, TimerBar } from "../components/Countdown.tsx";
import { BackButton } from "../components/FrontDoor.tsx";
import { Avatar } from "../components/Items.tsx";
import { cellOf, dragStarted, squareAtPoint } from "../board/logic.ts";
import { play, unlockAudio, warmSounds } from "../sound.ts";
import { FLOAT_MS, FloatGold, type FloatAt } from "../components/FloatGold.tsx";
import { testParams } from "../test-switches.ts";
import {
  adjustBlock,
  adjustMarks,
  adjustMove,
  adjustTargets,
  adjustWords,
  botMoveSeed,
  movesUsed,
  pickTargets,
  startAdjust,
  startMove,
  stepAfterBuy,
  undoAction,
  undoBlock,
  undoWords,
  youMoveSeed,
  type Adjusted,
} from "../autochess/adjust.ts";
import { botAdjust, botBenchAt, botMove, botPlan } from "../autochess/bot.ts";
import { buyBlock, buyWords, carryBench, emptyArmy, heldBlock, heldWords, holdBlock, kingSquares, placeHeld, priceOf, sellHeld, sellPiece, sellValue } from "../autochess/army.ts";
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
import { botEvaluator, enginePick, newFight, stallEngine, warmEngine } from "../autochess/engine.ts";
import { addXp, buyXp, xpBlock, xpToNext, xpWords } from "../autochess/level.ts";
import { bonusFor, botLocked, bothLocked, buyFreeze, freezeWords, noLocks, tickLocks, youLock, type Locks } from "../autochess/lockin.ts";
import { botSeen } from "../autochess/reveal.ts";
import { buyFromSlot, holdFromSlot, newShop, oddsFor, replaceTaken, rerollFor, rerollWords, shopSeed, type Shop } from "../autochess/shop.ts";
import { playFight, thinFight, withPiece } from "../autochess/fight.ts";
import { armiesFen, armyPieces, fenFrom, fightStart, piecesOn } from "../autochess/position.ts";
import { KIND_NAME, KINDS, other, type Army, type Color, type Kind, type Offer } from "../autochess/types.ts";
import { clockWords, damageWords, endWords, fightRulesWords, goldWords, headline, matchWords, moveWords, type EndDetail, type EndKind } from "../autochess/words.ts";

/**
 * Auto chess, the demo (/autochess; docs/decisions/2026-10-19-autochess-demo.md, docs/areas/autochess.md): you against a
 * bot, all in this browser. Each round the game puts both kings down; the shop offers pieces, each with a square of your half
 * (30 s, the last 3 locked) while the bot's pieces show as plain circles 2 s behind; then their real pieces show and you get
 * one move (7 s: one legal chess move with the piece picked for you, on your half); then the engine plays both armies out. The rules are
 * in `autochess/` (pure, tested); this draws them. Nothing is recorded, rewarded or sent anywhere.
 *
 * The screen is v7's (docs/decisions/2026-10-21-autochess-v7.md): their bench at the top left and their pawn (name, level, thin HP and XP
 * bars) at the top right, the board in its frame with the move clock's bars along its edges, your pawn under it at the left, the clock's
 * small numbers in the middle and your bench at the right, then a dock of gold (and the shop's odds in a pill), Buy XP, Reroll and the
 * four cards. Both pawns hop. The step's name comes as a banner on the board ("ACTION PHASE", the 3-2-1, "MOVE PHASE", "BATTLE PHASE").
 */

/** How often the clock is read: the countdown, the circles 2 s behind and the end of each step. Nothing is drawn per frame but the move clock's bars (their own small component). */
const TICK_MS = 120;
/** How long a message under the board stays. */
const SAY_MS = 4200;
/** At the end of the adjust step the fight waits at most this long for the bot's last look. */
const BOT_WAIT_MS = 2500;
/** A pawn that cashes in stands on the last rank this long (its move's slide), then leaves the board. */
const CASH_LEAVE_MS = 220;
/** A press on a silhouette on the board is a tap while the pointer stays this close to where it went down (a finger always wobbles); farther, it is neither a tap nor a drag, and does nothing. */
const TAP_SLOP_PX = 10;
/** A phase banner ("ACTION PHASE", "MOVE PHASE", "BATTLE PHASE") stays this long: its pop's length (styles.css, `.ac-phase`). */
const BANNER_MS = 1600;

type Phase = "buy" | "adjust" | "fight" | "result" | "over";

type BotPlan = ReturnType<typeof botPlan>;

/** Everything that belongs to one round (a new one every round: nothing carries over but gold, HP and the streak). */
interface RoundState {
  you: Army;
  /** The shop's offers (new every round, free). */
  shop: Shop;
  /** Lock in (end your buying, first gets the bonus; off since v7): when you locked, and who got the bonus. */
  locks: Locks;
  /** Your adjust step: where your pieces stand, the piece picked for you (the move step) and what you did (one move). */
  adj: Adjusted | null;
  /** The bot's army when buying ended. */
  botStart: Army | null;
  /** What the bot held when the round began (its bench, with the squares turned to this round's colors); its holds and placings come on top, by time. */
  botBench: Offer[];
  plan: BotPlan;
  /** The bot's army after its adjust step (hidden until the fight). */
  botFinal: Army | null;
  gold: { you: GoldBreakdown; bot: GoldBreakdown };
}

interface Outcome {
  result: RoundResult;
  end: EndKind;
  /** Who won the fight, your color and, for a stall or "too far ahead", what White gained during it (for the result's words). */
  detail: EndDetail;
  /** Next round's gold, line by line (null when the match is over). */
  next: GoldBreakdown | null;
}

interface Game {
  match: MatchState;
  phase: Phase;
  /** When this step began (performance.now), and the same moment on the wall clock (the move clock's bars read it). */
  phaseStart: number;
  wallStart: number;
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

/** A piece being held: picked up for a drag, or selected by a tap; an offer pressed; or a piece on the bench pressed. */
interface Hold {
  kind: Kind | "k";
  at: { offer: number } | { square: string } | { held: number };
  /** Only ever tapped, never picked up, dragged or dropped: an offer's silhouette on the board (Eric, Oct 21), or a piece of yours the move step doesn't let you move. */
  tapOnly?: boolean;
}
type Target = { square: string } | { shop: true } | { bench: true } | null;

const sameHold = (a: Hold | null, b: Hold | null) => !!a && !!b && JSON.stringify(a.at) === JSON.stringify(b.at);
const isSquare = (h: Hold): h is Hold & { at: { square: string } } => "square" in h.at;
const isOffer = (h: Hold): h is Hold & { at: { offer: number } } => "offer" in h.at;
const isHeld = (h: Hold): h is Hold & { at: { held: number } } => "held" in h.at;

/** The two moments a step began: on the clock the screen reads (`performance.now`) and on the wall clock. */
const stamp = () => ({ phaseStart: performance.now(), wallStart: Date.now() });

function startRound(prev: MatchState, cfg: AutoChessSettings): { match: MatchState; round: RoundState } {
  const { match, gold } = beginRound(prev, cfg);
  const mine = youColor(match.round);
  const theirs = other(mine);
  const seed = roundSeed(match);
  const kings = kingSquares(seed, cfg);
  // (What each side held comes into the round on the same squares turned with the colors.)
  const botBench = carryBench(match.bot.bench);
  const plan = botPlan(theirs, kings[theirs], match.bot.gold, match.round, mulberry32(seed ^ 0x9e3779b9), cfg, botBench, { level: match.bot.level, xp: match.bot.xp });
  const you = emptyArmy(mine, kings[mine], carryBench(match.you.bench));
  // (The shop rolls by the level you have now, the free XP of this round's start counted.)
  return { match, round: { you, shop: newShop(shopSeed(seed), you, cfg, match.you.level), locks: noLocks, adj: null, botStart: null, botBench, plan, botFinal: null, gold } };
}

function newGame(seed: number, cfg: AutoChessSettings): Game {
  const { match, round } = startRound(newMatch(seed, cfg), cfg);
  return { match, phase: "buy", ...stamp(), round, fight: null, outcome: null };
}

/**
 * A phone's short steps for tests (`?quick=1`, a test switch): the same game in a few seconds a step. `?gold=N`: N more gold at the
 * start of round 1, to try a big army; `?adjust=0`: no adjust step, straight to the fight; `?lockin=1`: lock-in on (off since v7);
 * `?adjustmode=teleport`: the v6 adjust step in place of the move step; `?level=N` (5 to 10): both sides start at level N (to see
 * rooks and queens in the shop at once: the XP to each next level shifts with it).
 */
function settingsFor(quick: boolean, gold: number, adjust: boolean, lockIn: boolean, teleport: boolean, level: number): AutoChessSettings {
  // (Two seconds locked, so a test has time to try buying in the lock before the reveal.)
  const base = quick ? { ...AUTOCHESS, buySeconds: 7, lockSeconds: 2, circlesDelaySeconds: 0.5, revealSeconds: 1.5, fightMoveMs: 60, fightFastMoveMs: 30 } : AUTOCHESS;
  let out = gold > 0 ? { ...base, startGold: base.startGold + gold } : base;
  if (!adjust) out = { ...out, adjustStep: false };
  if (lockIn) out = { ...out, lockIn: true };
  if (teleport) out = { ...out, adjustMode: "teleport" };
  if (level > out.levels.start && level <= out.levels.max) out = { ...out, levels: { ...out.levels, start: level, xpToNext: out.levels.xpToNext.slice(level - out.levels.start) } };
  return out;
}

const colorName = (c: Color) => (c === "w" ? "White" : "Black");
/** The sounds this screen plays, made ahead (off the page's thread) once the audio is awake. */
const SOUNDS_USED = ["acPlace", "acHold", "acReroll", "sell", "acXp", "acLevel", "acLock", "acReveal", "acCash"] as const;
/** What the opponent is called: the same word as a bot in a 1 v 1. */
const BOT_NAME = "Bot";
/** The seed of a round's reveals (which of their pieces shows, and when: reveal.ts). */
const revealSeed = (match: MatchState) => (roundSeed(match) ^ 0x6b43a9b5) >>> 0;
/** Whether a square is a dark one (a bench tile takes the color of the square its piece keeps). */
const squareDark = (square: string) => (square.charCodeAt(0) - 96 + Number(square[1])) % 2 === 0;
const capital = (s: string) => s[0]!.toUpperCase() + s.slice(1);

/** A piece's picture: the board's own art, in a box that sizes it. */
function PieceIcon({ color, kind }: { color: Color; kind: Kind | "k" }) {
  return (
    <span class="hb-pieces ac-pc" aria-hidden="true">
      <piece class={`${color === "w" ? "white" : "black"} ${KIND_NAME[kind]}`} />
    </span>
  );
}

/**
 * A custom pawn (v7: the dressed pawn, big, with its shadow) hopping in place: a crouch, a rise, a squash on landing and a settle, the
 * shadow shrinking and fading as it rises (CSS animations of transforms and opacity on two boxes; off under reduced motion). `dur`
 * and `delay` put the two pawns out of step. `badge`: the level, on yours.
 */
function HopPawn({ look, side, dur, delay, badge }: { look?: Parameters<typeof Avatar>[0]["look"]; side: Color; dur: number; delay: number; badge?: ComponentChildren }) {
  return (
    <span class="fd-pawn ac-pawn" style={{ "--dur": `${dur}s`, "--delay": `${delay}s` } as Record<string, string>}>
      <span class="ac-shadow" aria-hidden="true" />
      <span class="ac-hop">
        <span class="fd-pawn-box">
          <Avatar look={look} side={side} />
        </span>
      </span>
      {badge}
    </span>
  );
}

/** Your level, a round gold badge on your pawn; the number pops (and a chime sounds, with the badge) when the level goes up. */
function LevelBadge({ level, xp, cfg }: { level: number; xp: number; cfg: AutoChessSettings }) {
  const last = useRef(level);
  const [pops, setPops] = useState(0);
  // (In a layout effect: the chime and the pop come with the number changing, not a paint later.)
  useLayoutEffect(() => {
    if (level > last.current) {
      setPops((n) => n + 1);
      play("acLevel");
    }
    last.current = level;
  }, [level]);
  const need = xpToNext(level, cfg);
  return (
    <i key={pops} class={`ac-badge${pops ? " pop" : ""}`} data-level={level} role="img" aria-label={`Your level ${level}${need === null ? ", the top level" : `, ${xp} of ${need} XP`}`}>
      {level}
    </i>
  );
}

/** A thin bar with its label and number: HP (green fading to red, as the move clock's) or XP. */
function Bar({ kind, frac, text, label, cls }: { kind: "hp" | "xp"; frac: number; text: string; label: string; cls: string }) {
  return (
    <div class={`ac-bar ${kind} ${cls}`} style={{ "--f": Math.max(0, Math.min(1, frac)) } as Record<string, number>} role="group" aria-label={label}>
      <small>{kind.toUpperCase()}</small>
      <i />
      <b>{text}</b>
    </div>
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
  const extraGold = Math.max(0, Math.floor(Number(params.get("gold")) || 0));
  const cfg = useMemo(() => settingsFor(quick, extraGold, params.get("adjust") !== "0", params.get("lockin") === "1", params.get("adjustmode") === "teleport", Math.floor(Number(params.get("level")) || 0)), []);
  const legal = cfg.adjustMode === "legal";
  const seedParam = Number(params.get("seed"));
  // (Test switches for the fight: `?stall=1` the engine never answers, so stand-in moves play; `?fightfen=` the fight starts from that position.)
  stallEngine(params.get("stall") === "1");
  const fightFen = params.get("fightfen");
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
  /** One of their bench pieces tapped (v7: a red ring on it, and its landing square lights red on their half): which one. Theirs never drag. */
  const [theirTap, setTheirTap] = useState<{ index: number; kind: Kind; square: string } | null>(null);
  const [floats, setFloats] = useState<{ id: number; amount: number; at: FloatAt }[]>([]);
  const floatId = useRef(0);
  const floatTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [msg, setMsg] = useState("");
  const msgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const say = (text: string) => {
    setMsg(text);
    if (msgTimer.current) clearTimeout(msgTimer.current);
    msgTimer.current = setTimeout(() => setMsg(""), SAY_MS);
  };
  const cancelled = useRef(false);
  /** The first tap wakes the audio (browsers need a tap), and the sounds are made ahead. */
  const wake = () => {
    unlockAudio();
    warmSounds(SOUNDS_USED);
  };
  const botRun = useRef<BotRun>({ stop: false, done: null, latest: game.round.plan.army });
  const layerRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const ghostAt = useRef({ x: 0, y: 0 });
  /** The press in progress: the pointer, the element that captured it, what was pressed, where, whether it became a drag (or, for a tap-only press, wandered off). */
  const press = useRef<{ id: number; el: Element; hold: Hold; x: number; y: number; started: boolean; wandered: boolean } | null>(null);

  /** The latest `endPress` and `cancelGesture` (the window's listeners are set once, and the board's turn each round: a stale copy would read the wrong way up). */
  const latest = useRef({ endPress: (_e: PointerEvent, _cancel?: boolean) => {}, cancelGesture: () => {} });

  const g = game;
  // The two avatars (v6): your pawn as home and your profile dress it (your name and items), and the bot's own, a plain look seeded by the match.
  const profile = account().profile;
  const myName = profile?.user.name || "You";
  const myLook = profile?.locker?.look;
  const theirLook = useMemo(() => botLook(`autochess:${game.match.seed}`).look, [game.match.seed]);
  const mine = youColor(g.match.round);
  const theirs = other(mine);
  const orientation = mine === "w" ? "white" : "black";
  // (Never negative: the clock was read a moment before this step began.)
  const elapsed = Math.max(0, now - g.phaseStart);
  // Frozen: the step's last seconds, or you locked in (your board, bench and shop stay as they are).
  const youLocked = g.phase === "buy" && g.round.locks.you !== null;
  const locked = g.phase === "buy" && buyFreeze(g.round.locks, elapsed, cfg) !== null;
  const botIsLocked = g.phase === "buy" && botLocked(g.round.plan.lockAt, elapsed, cfg);
  // (The bonus is still to be had while nobody has locked in.)
  const bonusOpen = cfg.lockIn && g.phase === "buy" && g.round.locks.bonus === null && !botIsLocked;

  useEffect(() => {
    warmEngine();
    const id = setInterval(() => {
      const cur = gref.current;
      const t = performance.now();
      setNow(t);
      if (cur.phase === "buy") {
        // With lock-in on, the bot locks in when its time comes (the first to lock gets the bonus), and both locked ends the step; the time up always does.
        const at = t - cur.phaseStart;
        const locks = tickLocks(cur.round.locks, at, cur.round.plan.lockAt, cfg);
        if (locks !== cur.round.locks) commit({ ...cur, round: { ...cur.round, locks } });
        if (at >= cfg.buySeconds * 1000 || bothLocked(locks, at, cur.round.plan.lockAt, cfg)) toAdjust();
      } else if (cur.phase === "adjust" && t - cur.phaseStart >= cfg.adjustSeconds * 1000) void toFight();
    }, TICK_MS);
    // A press ends with its pointer, whatever the element it began on has become (a card that left the screen with its step, a layer that stopped taking taps): the
    // pointer let go, cancelled, or lost its capture (a drag then ends with no action), and the window losing the pointer ends it too.
    const pointerEnd = (e: PointerEvent) => {
      const p = press.current;
      if (!p || e.pointerId !== p.id) return;
      // (The capture lost by its element being taken off the screen reaches the document; a capture lost on another element isn't this press's.)
      if (e.type === "lostpointercapture" && e.target !== p.el && p.el.isConnected) return;
      latest.current.endPress(e, e.type !== "pointerup");
    };
    const blurred = () => latest.current.cancelGesture();
    const types = ["pointerup", "pointercancel", "lostpointercapture"] as const;
    for (const t of types) window.addEventListener(t, pointerEnd);
    window.addEventListener("blur", blurred);
    return () => {
      clearInterval(id);
      for (const t of types) window.removeEventListener(t, pointerEnd);
      window.removeEventListener("blur", blurred);
      cancelled.current = true;
      botRun.current.stop = true;
      if (msgTimer.current) clearTimeout(msgTimer.current);
      floatTimers.current.forEach(clearTimeout);
    };
  }, []);

  // ---------------- The steps ----------------

  /**
   * The buying is over: their real pieces show (as they were when it locked), and you make your move (the move step: the piece picked
   * for you, or in the v6 step any piece). With the adjust step off, or no piece on either side able to move, straight to the fight.
   */
  function toAdjust() {
    const cur = gref.current;
    if (cur.phase !== "buy") return;
    cancelGesture();
    setMsg("");
    const you = cur.round.you;
    const botStart = cur.round.plan.army;
    // (What the bot spent is paid now, and its lock-in bonus if it locked first, with lock-in on; it sells nothing.)
    const locks = tickLocks(cur.round.locks, performance.now() - cur.phaseStart, cur.round.plan.lockAt, cfg);
    // (Both benches go into the match: what is held stays for the next round. The bot's plan was made with its bench already.)
    const match: MatchState = {
      ...cur.match,
      you: { ...cur.match.you, bench: you.bench },
      bot: { ...cur.match.bot, gold: cur.match.bot.gold - cur.round.plan.spent + bonusFor(locks, "bot", cfg), bench: botStart.bench, level: cur.round.plan.level.level, xp: cur.round.plan.level.xp },
    };
    const seed = roundSeed(match);
    const botColor = other(youColor(match.round));
    // The move step picks a piece at random for each side (seeded by the round), out of sight of the other; none that can move, no move for that side.
    const adj = legal ? startMove(you, botStart, youMoveSeed(seed), cfg) : startAdjust(you);
    const botCanMove = !legal || !!startMove(botStart, you, botMoveSeed(seed), cfg).pick;
    commit({ ...cur, match, phase: "adjust", ...stamp(), round: { ...cur.round, locks, adj, botStart } });
    // The bot moves out of sight, from your army as it stood when it locked, and its move shows at the fight.
    const run: BotRun = { stop: false, done: null, latest: botStart };
    botRun.current = run;
    if (stepAfterBuy(cfg) === "fight" || (legal && !adj.pick && !botCanMove)) {
      void toFight();
      return;
    }
    if (legal && !adj.pick) say(adjustWords("nomove"));
    else if (!legal) say("Tap a piece, then a square");
    const evaluate = botEvaluator(you, botColor, cfg);
    const stop = () => run.stop || cancelled.current;
    const look = legal ? botMove(botStart, you, botMoveSeed(seed), evaluate, stop, cfg, (army) => (run.latest = army)) : botAdjust(botStart, evaluate, mulberry32(seed ^ 0x51ed270b), stop, cfg, (army) => (run.latest = army));
    run.done = look.then(
      () => undefined,
      () => undefined,
    );
  }

  /** The adjust step is over: the bot's moves show, and the engine plays both armies out. */
  async function toFight() {
    const cur = gref.current;
    if (cur.phase !== "adjust") return;
    cancelGesture();
    const run = botRun.current;
    run.stop = true;
    commit({ ...cur, phase: "fight", ...stamp() });
    // (It stops at its next look; a slow engine gets a moment, then the bot keeps what it had.)
    await Promise.race([run.done, new Promise((r) => setTimeout(r, BOT_WAIT_MS))]);
    if (cancelled.current) return;
    const botFinal = run.latest;
    const at = gref.current;
    const you = at.round.adj?.army ?? at.round.you;
    const color = youColor(at.match.round);
    const start = fightFen ? { fen: fightFen, mover: "w" as Color, draw: false } : color === "w" ? fightStart(you, botFinal) : fightStart(botFinal, you);
    commit({ ...at, round: { ...at.round, botFinal }, fight: { fen: start.fen, last: null, plies: 0 } });
    if (start.draw) return finish(null, "both_checked", start.fen);
    newFight();
    const res = await playFight(start.fen, {
      pick: (game, allowed) => enginePick(game, allowed, cfg),
      rng: mulberry32(roundSeed(at.match) ^ 0x2545f491),
      cancelled: () => cancelled.current,
      onStep: (s) => {
        if (!s.cashIn) return commit({ ...gref.current, fight: { fen: s.fen, last: s.move, plies: s.ply } });
        // A cash-in: the pawn lands on the last rank, a coin sounds and "+5" floats up from the square; then it leaves the board.
        const square = s.move.slice(2, 4);
        commit({ ...gref.current, fight: { fen: withPiece(s.fen, square, s.cashIn === "w" ? "P" : "p"), last: s.move, plies: s.ply } });
        play("acCash");
        // (From the round's own colors: this runs from the timer made on the first render, whose `orientation` is round 1's.)
        addFloat(cfg.cashInGold, cellOf(square, color === "w" ? "white" : "black"));
        setTimeout(() => {
          const now = gref.current;
          if (now.fight?.plies === s.ply) commit({ ...now, fight: { ...now.fight, fen: s.fen } });
        }, CASH_LEAVE_MS);
      },
      cfg,
    });
    if (res) finish(res.winner, res.end, res.fen, res.cashIns, res.gain);
  }

  /** The fight is over: the loser loses HP, the refunds (and the cash-ins' gold) wait for the next round, and the result shows. */
  function finish(winner: Color | null, end: EndKind, fen: string, cashIns: { w: number; b: number } = { w: 0, b: 0 }, gain?: number) {
    const cur = gref.current;
    const color = youColor(cur.match.round);
    const on = piecesOn(fen);
    const who = winner === null ? "draw" : winner === color ? "you" : "bot";
    const { match, result } = settleRound(cur.match, who, { you: on[color], bot: on[other(color)] }, cfg, { you: cashIns[color], bot: cashIns[other(color)] });
    const won = matchWinner(match);
    const next = won ? null : goldBreakdown(match.round + 1, match.you, cfg);
    setTheirTap(null);
    commit({ ...cur, match, phase: won ? "over" : "result", ...stamp(), outcome: { result, end, next, detail: { winner, you: color, ...(gain !== undefined ? { gain } : {}) } } });
  }

  function nextRound() {
    const cur = gref.current;
    if (cur.phase !== "result") return;
    const { match, round } = startRound(cur.match, cfg);
    cancelGesture();
    setMsg("");
    setTheirTap(null);
    commit({ match, phase: "buy", ...stamp(), round, fight: null, outcome: null });
  }

  function playAgain() {
    cancelGesture();
    setMsg("");
    setTheirTap(null);
    commit(newGame((Math.random() * 2 ** 31) | 0, cfg));
  }

  // ---------------- Buying, selling ----------------

  /** Whether the buy step takes an action now (not locked, not over). Read from the clock, not from the last tick. */
  const buying = () => {
    const cur = gref.current;
    if (cur.phase !== "buy") return false;
    const freeze = buyFreeze(cur.round.locks, performance.now() - cur.phaseStart, cfg);
    if (freeze) {
      say(freezeWords(freeze));
      return false;
    }
    return true;
  };

  /** A gold amount floating up from a square or a bench slot (FloatGold), gone after its time. */
  function addFloat(amount: number, at: FloatAt) {
    const id = ++floatId.current;
    setFloats((f) => [...f, { id, amount, at }]);
    floatTimers.current.push(setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), FLOAT_MS + 150));
  }

  /** How many pieces your board may hold now: your level. */
  const boardRoom = () => gref.current.match.you.level;
  const withGold = (gold: number, army: Army) => {
    const cur = gref.current;
    commit({ ...cur, match: { ...cur.match, you: { ...cur.match.you, gold } }, round: { ...cur.round, you: army } });
  };

  /** Buys the offer in a shop slot: the piece lands on its square, and a new offer is rolled into the slot (at your level). */
  function buySlot(slot: number) {
    if (!buying()) return;
    const cur = gref.current;
    const offer = cur.round.shop.slots[slot];
    if (!offer) return;
    const bought = buyFromSlot({ army: cur.round.you, gold: cur.match.you.gold, shop: cur.round.shop, level: boardRoom() }, slot, shopSeed(roundSeed(cur.match)), cfg, boardRoom());
    if ("block" in bought) {
      const line = buyWords(bought.block, offer, cur.match.you.gold, cfg, boardRoom()).line;
      // (A board with no room still takes it on the bench: say so.)
      return say(bought.block === "limit" && !holdBlock(cur.round.you, cur.match.you.gold, offer, cfg) ? "Board full. Drag to bench" : line);
    }
    commit({ ...cur, match: { ...cur.match, you: { ...cur.match.you, gold: bought.gold } }, round: { ...cur.round, you: bought.army, shop: bought.shop } });
    setSel(null);
    // (Another offer that could no longer use its square rolled again: the player is told, so an offer doesn't change under their finger unexplained.)
    if (bought.replaced) say(`${bought.from[0]} rolled again`);
    else setMsg("");
    play("acPlace");
  }

  /** Buys the offer in a shop slot to hold it on the bench: it keeps its square, and a new offer is rolled into the slot. */
  function holdSlot(slot: number) {
    if (!buying()) return;
    const cur = gref.current;
    const offer = cur.round.shop.slots[slot];
    if (!offer) return;
    const held = holdFromSlot({ army: cur.round.you, gold: cur.match.you.gold, shop: cur.round.shop, level: boardRoom() }, slot, shopSeed(roundSeed(cur.match)), cfg);
    if ("block" in held) return say(buyWords(held.block, offer, cur.match.you.gold, cfg).line);
    commit({ ...cur, match: { ...cur.match, you: { ...cur.match.you, gold: held.gold } }, round: { ...cur.round, you: held.army, shop: held.shop } });
    setSel(null);
    say(`Held ${offer.square}`);
    play("acHold");
  }

  /** Places a held piece on the square it kept, when that square is free and the board has room. */
  function placeHeldAt(index: number) {
    if (!buying()) return;
    const cur = gref.current;
    const held = cur.round.you.bench[index];
    if (!held) return;
    const block = heldBlock(cur.round.you, index, cfg, boardRoom());
    if (block) return say(heldWords(block, held.square, cfg, boardRoom()));
    const army = placeHeld(cur.round.you, index);
    // (Offers on that square roll again, as when an offer is bought onto it.)
    const { shop, replaced, from } = replaceTaken(cur.round.shop, shopSeed(roundSeed(cur.match)), army, cfg, boardRoom());
    commit({ ...cur, round: { ...cur.round, you: army, shop } });
    setSel(null);
    if (replaced) say(`${from[0]} rolled again`);
    else setMsg("");
    play("acPlace");
  }

  /** Buys XP for gold: a level when there is enough, which is room for another piece. */
  function buyXpNow() {
    if (!buying()) return;
    const cur = gref.current;
    const you = cur.match.you;
    const block = xpBlock(you, you.gold, cfg);
    if (block) return say(xpWords(block, you.gold, cfg));
    const next = buyXp(you, you.gold, cfg);
    commit({ ...cur, match: { ...cur.match, you: { ...you, level: next.level, xp: next.xp, gold: next.gold } } });
    say(next.level > you.level ? `Level ${next.level}: ${next.level} pieces` : `+${cfg.levels.buyXp} XP`);
    play("acXp");
  }

  /** Lock in (off since v7): your buying is over (your board and shop freeze); the first side to do it gets the bonus, and both locked ends the step. */
  function lockIn() {
    if (!cfg.lockIn || !buying()) return;
    const cur = gref.current;
    const at = performance.now() - cur.phaseStart;
    const locks = youLock(cur.round.locks, at, cur.round.plan.lockAt, cfg);
    const bonus = bonusFor(locks, "you", cfg);
    cancelGesture();
    commit({ ...cur, match: { ...cur.match, you: { ...cur.match.you, gold: cur.match.you.gold + bonus } }, round: { ...cur.round, locks } });
    play("acLock");
    if (bothLocked(locks, at, cur.round.plan.lockAt, cfg)) return toAdjust();
    say(bonus ? `First: +${bonus} gold` : "You locked in");
  }

  /** Rolls the whole shop again for gold (at your level). */
  function reroll() {
    if (!buying()) return;
    const cur = gref.current;
    const next = rerollFor({ gold: cur.match.you.gold, shop: cur.round.shop, army: cur.round.you, level: boardRoom() }, shopSeed(roundSeed(cur.match)), cfg);
    if ("block" in next) return say(rerollWords(cur.match.you.gold, cfg));
    commit({ ...cur, match: { ...cur.match, you: { ...cur.match.you, gold: next.gold } }, round: { ...cur.round, shop: next.shop } });
    setMsg("");
    play("acReroll");
  }

  /**
   * Sells a piece standing on your board, or one held on your bench: 75% of its price back. Only a piece of yours that is there now, of the kind the
   * hold says, is sold (a hold can go stale: the piece was sold some other way while it was held): no gold for anything else, never for the king or an offer.
   */
  function sell(hold: Hold) {
    if ((!isSquare(hold) && !isHeld(hold)) || !buying()) return;
    const cur = gref.current;
    const sold = isSquare(hold) ? sellPiece(cur.round.you, hold.at.square, hold.kind, cfg) : sellHeld(cur.round.you, hold.at.held, hold.kind, cfg);
    setSel(null);
    if (!sold) return;
    const { army, gold } = sold;
    withGold(cur.match.you.gold + gold, army);
    play("sell");
    say(`Sold for ${gold}`);
    // The gold floats up from where the piece stood: its square, or its slot on the bench.
    addFloat(gold, isSquare(hold) ? cellOf(hold.at.square, orientation) : { slot: hold.at.held, of: cfg.benchSlots });
  }

  /** A piece let go on a target, while buying: the shop takes a piece of yours (a sale), the bench takes an offer (you hold it). */
  function dropWhileBuying(hold: Hold, target: Target) {
    if (!target || !buying()) return;
    if ("shop" in target && !isOffer(hold)) return sell(hold);
    if ("bench" in target && isOffer(hold)) return holdSlot(hold.at.offer);
    setSel(null);
  }

  // ---------------- Adjusting ----------------

  const adjusting = () => gref.current.phase === "adjust" && performance.now() - gref.current.phaseStart < cfg.adjustSeconds * 1000;

  /** Your one change: the lit piece one legal chess move, or (the v6 step) a piece of yours to any legal empty square of your half. */
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

  /** Takes your move back. */
  function takeBack(at: string) {
    if (!adjusting()) return;
    const cur = gref.current;
    const adj = cur.round.adj!;
    const block = undoBlock(adj, at);
    if (block === "needed") return say(undoWords(block));
    if (block) return;
    commit({ ...cur, round: { ...cur.round, adj: undoAction(adj, at) } });
    setSel(null);
    setMsg("");
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
      if (isOffer(hold)) return buySlot(hold.at.offer);
      if (isHeld(hold)) return placeHeldAt(hold.at.held);
      if (hold.kind === "k") return say("King: set by game");
    } else if (!adjusting()) return;
    if (phase === "adjust" && hold.kind === "k") return say(adjustWords("kingfixed", cfg));
    if (phase === "adjust") {
      const adj = gref.current.round.adj!;
      // (A piece you moved takes its move back when tapped.)
      if (isSquare(hold) && adjustMarks(adj).some((m) => m.square === (hold.at as { square: string }).square)) return takeBack(hold.at.square);
      // (The move step: the lit piece is already the one to move, and any other piece of yours says so.)
      if (legal) return isSquare(hold) && adj.pick?.square === hold.at.square ? undefined : say(adjustWords(adj.pick ? "notpicked" : "nomove", cfg));
    }
    if (sameHold(selRef.current, hold)) return setSel(null);
    setSel(hold);
  }

  function tapSquare(square: string) {
    if (gref.current.phase === "adjust" && legal) {
      // The move step: a tap on a square plays the lit piece there if that is a legal move (and says why not if it isn't).
      const adj = gref.current.round.adj!;
      if (adj.pick) adjustTo(adj.pick.square, square);
      else if (adjusting()) say(adjustWords("nomove", cfg));
      return;
    }
    const hold = selRef.current;
    if (!hold) return;
    if (gref.current.phase === "buy") setSel(null);
    else if (isSquare(hold)) adjustTo(hold.at.square, square);
  }

  function dropped(hold: Hold, target: Target) {
    if (gref.current.phase === "buy") dropWhileBuying(hold, target);
    else if (target && "square" in target && isSquare(hold)) adjustTo(hold.at.square, target.square);
    else setSel(null);
  }

  const boxOf = () => layerRef.current!.getBoundingClientRect();

  /** Where a point is: a square of the board, the shop or the bench. */
  function targetAt(x: number, y: number): Target {
    const square = squareAtPoint(x, y, boxOf(), orientation);
    if (square) return { square };
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-ac-drop]");
    if (el?.dataset.acDrop === "shop") return { shop: true };
    if (el?.dataset.acDrop === "bench") return { bench: true };
    return null;
  }

  function startPress(e: PointerEvent, hold: Hold) {
    if (press.current || !e.isPrimary || (e.pointerType === "mouse" && e.button !== 0)) return;
    const el = e.currentTarget as Element;
    press.current = { id: e.pointerId, el, hold, x: e.clientX, y: e.clientY, started: false, wandered: false };
    el.setPointerCapture?.(e.pointerId);
  }

  /**
   * A gesture is over with no action, whatever it was: the press is let go (and its pointer capture released), the drag's ghost goes, and nothing stays selected.
   * Every step's end does this (the lock, lock in, the reveal, the adjust step's end, the result, the next round), so a finger still down across one
   * can't carry a drag into the next.
   */
  function cancelGesture() {
    const p = press.current;
    press.current = null;
    if (p) {
      try {
        p.el.releasePointerCapture?.(p.id);
      } catch {
        // (The pointer is already gone.)
      }
    }
    setDrag(null);
    setSel(null);
  }

  function movePress(e: PointerEvent) {
    const p = press.current;
    if (!p || e.pointerId !== p.id) return;
    if (p.hold.tapOnly) {
      // (A tap-only press (a silhouette on the board, a piece the move step won't let you move) picks nothing up, drags nothing and drops nothing: a pointer that wanders off does nothing.)
      if (!p.wandered && (e.clientX - p.x) ** 2 + (e.clientY - p.y) ** 2 >= TAP_SLOP_PX ** 2) p.wandered = true;
      return;
    }
    ghostAt.current = { x: e.clientX, y: e.clientY };
    // (While buying you drag an offer from the shop to the bench to hold it, and a piece of yours (on the board or the bench) to the shop to sell it; the king stays put.)
    // (Nothing is picked up in the last seconds or once you've locked in: a press there is a tap, and says why nothing happens.)
    const cur = gref.current;
    const frozen = cur.phase === "buy" && buyFreeze(cur.round.locks, performance.now() - cur.phaseStart, cfg) !== null;
    const dragsNow = !frozen && (cur.phase === "adjust" || isOffer(p.hold) || isHeld(p.hold) || (isSquare(p.hold) && p.hold.kind !== "k"));
    if (!p.started && dragStarted(e.clientX - p.x, e.clientY - p.y) && dragsNow) {
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
    } else if (!cancel && !p.wandered) tapPiece(p.hold);
  }

  /** The offer on a square (a shop slot), or -1: one offer to a square, and never on a square one of your pieces stands on. */
  const offerOn = (square: string) => (pieceOf(square) ? -1 : gref.current.round.shop.slots.findIndex((o) => o.square === square));

  function layerDown(e: PointerEvent) {
    const cur = gref.current;
    if (cur.phase !== "buy" && cur.phase !== "adjust") return;
    if ((e.target as Element).closest("button")) return;
    const box = boxOf();
    const square = squareAtPoint(e.clientX, e.clientY, box, orientation);
    if (!square) return;
    // An offer's silhouette: a tap buys it, and that is all it does: it is never picked up, dragged or sold.
    const slot = cur.phase === "buy" ? offerOn(square) : -1;
    if (slot >= 0) return startPress(e, { kind: cur.round.shop.slots[slot]!.kind, at: { offer: slot }, tapOnly: true });
    const kind = pieceOf(square);
    if (kind) {
      // In the move step only the lit piece (while its move is unused) is picked up and dragged; any other piece is only tapped (it says so), and a piece you moved is tapped to take the move back.
      const adj = cur.phase === "adjust" ? cur.round.adj : null;
      const movable = !legal || !adj || (adj.pick?.square === square && movesUsed(adj) < cfg.adjustMoves);
      return startPress(e, { kind, at: { square }, ...(movable ? {} : { tapOnly: true }) });
    }
    tapSquare(square);
  }

  function offerDown(e: PointerEvent, slot: number, kind: Kind) {
    if (gref.current.phase !== "buy") return;
    startPress(e, { kind, at: { offer: slot } });
  }

  function heldDown(e: PointerEvent, index: number, kind: Kind) {
    if (gref.current.phase !== "buy") return;
    startPress(e, { kind, at: { held: index } });
  }

  latest.current = { endPress, cancelGesture };

  // The dragged piece's first place, before the pointer moves again.
  useLayoutEffect(() => {
    if (drag) placeGhost();
  }, [drag]);

  // ---------------- What to draw ----------------

  const you = g.phase === "adjust" || g.phase === "fight" ? (g.round.adj?.army ?? g.round.you) : g.round.you;
  const botArmy = g.round.botFinal && g.phase !== "buy" && g.phase !== "adjust" ? g.round.botFinal : g.phase === "buy" ? g.round.plan.army : (g.round.botStart ?? g.round.plan.army);
  const botKing = g.round.plan.army.king;
  // While buying you see every piece of theirs (pawns too) as a plain circle, 2 s behind, and every few seconds one of them is revealed at random and stays shown.
  const seen = g.phase === "buy" ? botSeen(g.round.plan.events, revealSeed(g.match), elapsed / 1000, cfg) : null;
  // Their bench shows real pieces, each with the square it keeps (Eric, Oct 21: intentional): what it came in with and what it has held since, 2 s behind as the circles are.
  const theirBench: Offer[] = g.phase === "buy" ? botBenchAt(g.round.plan.events, g.round.botBench, Math.max(0, elapsed / 1000 - cfg.circlesDelaySeconds)) : (g.round.botStart ?? g.round.plan.army).bench;
  // (A tap on one of their bench pieces holds only while that piece is still there, in that slot.)
  const theirTapped = theirTap && theirBench[theirTap.index]?.kind === theirTap.kind && theirBench[theirTap.index]?.square === theirTap.square && (g.phase === "buy" || g.phase === "adjust") ? theirTap : null;

  // A piece of theirs revealed: a ping as its circle turns into the piece (a layout effect: it comes with the piece, whatever the screen does next).
  const revealCount = seen?.revealed.length ?? 0;
  const lastReveals = useRef(0);
  useLayoutEffect(() => {
    if (revealCount > lastReveals.current) play("acReveal");
    lastReveals.current = revealCount;
  }, [revealCount, g.match.round]);

  let fen: string;
  let lastMove: string | null = null;
  if ((g.phase === "fight" || g.phase === "result" || g.phase === "over") && g.fight) {
    fen = g.fight.fen;
    lastMove = g.fight.last;
  } else if (g.phase === "buy") fen = fenFrom([...armyPieces(you), { square: botKing, color: theirs, kind: "k" }, ...(seen?.revealed ?? []).map((r) => ({ square: r.square, color: theirs, kind: r.kind }))]);
  else fen = mine === "w" ? armiesFen(you, botArmy) : armiesFen(botArmy, you);

  const sq = (square: string) => {
    const { col, row } = cellOf(square, orientation);
    return { "--sq-x": col, "--sq-y": row } as Record<string, number>;
  };

  // The squares to light in the adjust step: the lit piece's legal moves (the move step), or where the tapped piece may go (the v6 step).
  const adj = g.phase === "adjust" ? g.round.adj : null;
  const adjOver = g.phase === "adjust" && elapsed >= cfg.adjustSeconds * 1000;
  const dots: string[] = [];
  if (adj && !adjOver) {
    if (legal) dots.push(...pickTargets(adj, cfg));
    else if (sel && isSquare(sel) && movesUsed(adj) < cfg.adjustMoves) dots.push(...adjustTargets(adj.army, sel.at.square));
  }
  // The piece picked for you glows while its move is still to make.
  const lit = legal && adj && !adjOver && adj.pick && movesUsed(adj) < cfg.adjustMoves ? adj.pick.square : null;

  // The offers: each a glowing silhouette on its own square (one offer to a square).
  const offers = g.phase === "buy" ? g.round.shop.slots : [];
  const offerBlocks = offers.map((o) => buyBlock(g.round.you, g.match.you.gold, o, cfg, g.match.you.level));
  // (An offer the board has no room for can still be held: its card isn't greyed, it says why it can't be tapped.)
  const holdOnly = offers.map((o, slot) => offerBlocks[slot] === "limit" && !holdBlock(g.round.you, g.match.you.gold, o, cfg));

  const interactiveLayer = (g.phase === "buy" && !locked) || (g.phase === "adjust" && elapsed < cfg.adjustSeconds * 1000);
  // A press, drag or selection never outlives the moment it can act: when the step changes, the round turns, or the board stops taking presses (the last seconds of buying locked, the adjust step's time up) it is over, with no action.
  useLayoutEffect(() => {
    if (!interactiveLayer) cancelGesture();
  }, [interactiveLayer]);
  useLayoutEffect(() => {
    cancelGesture();
  }, [g.phase, g.match.round]);
  const goldNow = g.match.you.gold;

  // The clock's numbers under the board, and the step's name under them (a message takes the name's place for a moment).
  const remaining = g.phase === "buy" ? cfg.buySeconds * 1000 - elapsed : g.phase === "adjust" ? cfg.adjustSeconds * 1000 - elapsed : 0;
  let clock = "";
  let label = "";
  if (g.phase === "buy") {
    clock = clockWords(remaining);
    label = youLocked ? "Locked in" : locked ? "Locked" : "Buy";
  } else if (g.phase === "adjust") {
    clock = clockWords(remaining);
    label = "Move";
  } else if (g.phase === "fight") {
    clock = "Fight";
    label = moveWords(g.fight?.plies ?? 0, cfg, !!g.fight && thinFight(g.fight.fen, cfg));
  } else {
    clock = g.phase === "over" ? "Match" : "Round";
    label = "Over";
  }
  const timerBars = g.phase === "buy" || (g.phase === "adjust" && adj !== null && !adjOver);

  // The banner on the board's middle: "ACTION PHASE" as buying begins, the big 3-2-1 for its last seconds, "MOVE PHASE", "BATTLE PHASE".
  let banner: { words: string } | { n: number } | null = null;
  if (g.phase === "buy") {
    if (remaining > 0 && remaining <= COUNT_FROM_SECONDS * 1000) banner = { n: Math.ceil(remaining / 1000) };
    else if (elapsed < BANNER_MS) banner = { words: "ACTION PHASE" };
  } else if (g.phase === "adjust" && elapsed < BANNER_MS) banner = { words: "MOVE PHASE" };
  else if (g.phase === "fight" && elapsed < BANNER_MS) banner = { words: "BATTLE PHASE" };

  const held = sel ?? null;
  // What is being dragged while buying: an offer (to the bench) or a piece of yours (to the shop, to sell it).
  const dragOffer = g.phase === "buy" && drag && isOffer(drag) ? (g.round.shop.slots[drag.at.offer] ?? null) : null;
  const dragPiece = g.phase === "buy" && drag && drag.kind !== "k" && !isOffer(drag) ? drag : null;

  const outcome = g.outcome;
  const matchEnd = g.phase === "over" && outcome ? matchWords(outcome.result.outcome === "you") : null;

  // The opponent's level, as far as you see it: while you buy, the XP it has bought so far (2 s behind, as its pieces are).
  const botLevelNow = seen ? addXp({ level: g.match.bot.level, xp: g.match.bot.xp }, seen.xpBuys * cfg.levels.buyXp, cfg) : { level: g.match.bot.level, xp: g.match.bot.xp };
  const xpOff = locked || !!xpBlock(g.match.you, goldNow, cfg);
  const botHp = Math.max(0, g.match.bot.hp);
  const myHp = Math.max(0, g.match.you.hp);
  const myNeed = xpToNext(g.match.you.level, cfg);
  const botNeed = xpToNext(botLevelNow.level, cfg);
  // The shop's odds at your level (v7): each kind's percent, in a small pill in the gold row.
  const odds = oddsFor(g.match.you.level, cfg);
  const oddsWordsLine = KINDS.map((k) => `${KIND_NAME[k]} ${odds[k]}%`).join(", ");
  const shopShut = g.phase !== "buy" || locked;
  const wins = g.match.you.wins;

  return (
    <div
      class="fd-root ac-root"
      onPointerDownCapture={wake}
      data-phase={g.phase}
      data-round={g.match.round}
      data-you-locked={youLocked ? "1" : undefined}
      data-bot-locked={botIsLocked ? "1" : undefined}
      data-bonus={cfg.lockIn ? (g.round.locks.bonus ?? undefined) : undefined}
      data-lockin={cfg.lockIn ? "1" : undefined}
      data-move={legal ? "legal" : "teleport"}
      data-you={mine}
      data-king={g.round.you.king}
      data-bot-king={botKing}
    >
      <div class="ac-col">
        <section class="ac-top">
          <header class="ac-titlebar">
            <BackButton onClick={onBack} label="Back to home" />
            <div class="ac-title">
              <strong>Auto chess</strong>
              <span>
                Round {g.match.round} · you play {colorName(mine)}
              </span>
            </div>
          </header>
          <div class="ac-bench them" aria-label="Their bench">
            {Array.from({ length: cfg.benchSlots }, (_, i) => {
              const h = theirBench[i];
              if (!h) return <div key={`empty${i}`} class="ac-slot empty" aria-hidden="true" />;
              const tapped = theirTapped?.index === i;
              return (
                <button
                  key={`${i}${h.kind}${h.square}`}
                  type="button"
                  class={`ac-slot has ${squareDark(h.square) ? "d" : "l"}${tapped ? " tapped" : ""}`}
                  data-kind={h.kind}
                  data-square={h.square}
                  aria-pressed={tapped}
                  aria-label={`Their ${KIND_NAME[h.kind]}, held for ${h.square}. Tap to light ${h.square}`}
                  onClick={() => {
                    if (g.phase !== "buy" && g.phase !== "adjust") return;
                    setTheirTap(tapped ? null : { index: i, kind: h.kind, square: h.square });
                  }}
                >
                  <PieceIcon color={theirs} kind={h.kind} />
                  <em>{h.square}</em>
                </button>
              );
            })}
          </div>
          <span class="ac-who" aria-label="Your opponent">
            <strong class="ac-name">{BOT_NAME}</strong>
            <span class="ac-lv" data-level={botLevelNow.level} aria-label={`${BOT_NAME}'s level ${botLevelNow.level}`}>
              Lv <b>{botLevelNow.level}</b>
            </span>
            {botIsLocked && (
              <span class="ac-tag ac-bot-locked" aria-label="Opponent locked in">
                Locked in
              </span>
            )}
          </span>
          <div class="ac-side ac-opp" aria-label="Your opponent's pawn">
            <div class="ac-stage">
              <HopPawn look={theirLook} side={theirs} dur={2.1} delay={-0.8} />
            </div>
            <div class="ac-bars">
              <Bar kind="hp" cls="ac-hp-bot" frac={botHp / cfg.hp} text={String(botHp)} label="Opponent's HP" />
              <Bar kind="xp" cls="ac-xp-bot" frac={botNeed === null ? 1 : botLevelNow.xp / botNeed} text={botNeed === null ? "max" : `${botLevelNow.xp}/${botNeed}`} label="Opponent's XP" />
            </div>
          </div>
        </section>

        <div class="ac-frame">
          {timerBars && <TimerBar key={`${g.match.round}-${g.phase}`} startsAt={g.wallStart} deadline={g.wallStart + (g.phase === "buy" ? cfg.buySeconds : cfg.adjustSeconds) * 1000} total={(g.phase === "buy" ? cfg.buySeconds : cfg.adjustSeconds) * 1000} quiet />}
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
                {(seen?.circles ?? []).map((square) => (
                  <span key={square} class={`ac-circle ${theirs}`} data-square={square} style={sq(square)} />
                ))}
                {(seen?.revealed ?? []).map((r) => (
                  <span key={r.square} class="ac-ping" data-square={r.square} style={sq(r.square)} />
                ))}
                {theirTapped && <span class="ac-cell ac-red" data-square={theirTapped.square} style={sq(theirTapped.square)} />}
                {offers.map((o, slot) => (
                  <span key={`${slot}${o.kind}${o.square}`} class="ac-offers" data-square={o.square} style={sq(o.square)}>
                    <span class={`ac-sil${offerBlocks[slot] || locked ? " off" : ""}`} data-slot={slot} data-kind={o.kind}>
                      <i class={`ac-sil-shape ${KIND_NAME[o.kind]}`} />
                    </span>
                  </span>
                ))}
                {lit && <span class="ac-cell ac-pick" data-square={lit} style={sq(lit)} />}
                {held && isSquare(held) && (g.phase === "buy" || !legal) && <span class="ac-cell ac-picked" style={sq(held.at.square)} />}
                {floats.filter((f) => "col" in f.at).map((f) => (
                  <FloatGold key={f.id} amount={f.amount} at={f.at} />
                ))}
                {dots.map((square) => (
                  <span key={square} class="ac-cell ac-dot" data-square={square} style={sq(square)} />
                ))}
                {adj &&
                  adjustMarks(adj).map(({ square, action }) => (
                    <span key={square} class="ac-cell ac-moved" data-square={square} data-action={action} style={sq(square)}>
                      <i aria-hidden="true">↩</i>
                    </span>
                  ))}
              </div>
              {banner && (
                <div class="center-count ac-banner" role="status" aria-live="polite" data-banner={"words" in banner ? "words" : "count"}>
                  {"words" in banner ? (
                    <div class="cc-num ac-phase" key={banner.words}>
                      {banner.words}
                    </div>
                  ) : (
                    <div class="cc-num" key={banner.n}>
                      {banner.n}
                    </div>
                  )}
                </div>
              )}
            </Board>
          </div>
        </div>

        <section class="ac-bottom">
          <div class="ac-side ac-me" aria-label="You">
            <div class="ac-stage">
              <HopPawn look={myLook} side={mine} dur={1.8} delay={0} badge={<LevelBadge level={g.match.you.level} xp={g.match.you.xp} cfg={cfg} />} />
            </div>
            <div class="ac-bars" title={myName}>
              <Bar kind="hp" cls="ac-hp-you" frac={myHp / cfg.hp} text={String(myHp)} label="Your HP" />
              <Bar kind="xp" cls="ac-xp-you" frac={myNeed === null ? 1 : g.match.you.xp / myNeed} text={myNeed === null ? "max" : `${g.match.you.xp}/${myNeed}`} label="Your XP" />
            </div>
          </div>
          <div class={`ac-timer${locked ? " low" : ""}${g.phase === "fight" || g.phase === "result" || g.phase === "over" ? " quiet" : ""}`}>
            <b>{clock}</b>
            {msg ? (
              <span class="say" role="status" aria-live="polite">
                {msg}
              </span>
            ) : (
              <span>{label}</span>
            )}
            {g.phase === "buy" && !locked && held && isSquare(held) && held.kind !== "k" && g.round.you.board[held.at.square] === held.kind && (
              <button type="button" class="ac-sell" onClick={() => sell(held)}>
                Sell {sellValue(held.kind, cfg)}
              </button>
            )}
          </div>
          <div class={`ac-bench you${dragOffer ? " lit" : ""}`} data-ac-drop="bench" aria-label="Bench">
            {Array.from({ length: cfg.benchSlots }, (_, i) => {
              const h = g.round.you.bench[i];
              if (!h) return <div key={`empty${i}`} class="ac-slot empty" aria-hidden="true" />;
              const tone = squareDark(h.square) ? "d" : "l";
              if (g.phase !== "buy")
                return (
                  <div key={`${i}${h.kind}${h.square}`} class={`ac-slot has ${tone}`} data-held={i} data-kind={h.kind} data-square={h.square} aria-label={`Held ${KIND_NAME[h.kind]} for ${h.square}`}>
                    <PieceIcon color={mine} kind={h.kind} />
                    <em>{h.square}</em>
                  </div>
                );
              const block = heldBlock(g.round.you, i, cfg, g.match.you.level);
              const lifted = !!drag && isHeld(drag) && drag.at.held === i;
              return (
                <button
                  key={`${i}${h.kind}${h.square}`}
                  type="button"
                  class={`ac-slot has ${tone}${block || locked ? " off" : ""}${lifted ? " lifted" : ""}`}
                  data-held={i}
                  data-kind={h.kind}
                  data-square={h.square}
                  aria-disabled={!!block || locked}
                  aria-label={`Place the ${KIND_NAME[h.kind]} held for ${h.square}${locked ? ", locked" : block ? `, ${heldWords(block, h.square, cfg, g.match.you.level)}` : ""}`}
                  onPointerDown={(e) => heldDown(e, i, h.kind)}
                  onPointerMove={movePress}
                  onPointerUp={(e) => endPress(e)}
                  onPointerCancel={(e) => endPress(e, true)}
                  onLostPointerCapture={(e) => endPress(e, true)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), placeHeldAt(i))}
                >
                  <PieceIcon color={mine} kind={h.kind} />
                  <em>{h.square}</em>
                </button>
              );
            })}
            {floats.filter((f) => "slot" in f.at).map((f) => (
              <FloatGold key={f.id} amount={f.amount} at={f.at} />
            ))}
          </div>
        </section>

        <section class="ac-dock" aria-label="Shop">
          {/* (The result's box takes the gold row's room too: its line says the next round's gold.) */}
          {g.phase !== "result" && g.phase !== "over" && (
          <div class="ac-goldrow">
            <div class="ac-purse">
              <span class="ac-gold-you" aria-label="Your gold">
                <i class="ac-coin" />
                <b>{goldNow}</b>
              </span>
              <span class="ac-income" aria-label="This round's income">
                <span class="ac-income-word">Income</span> <b>+{incomeFor(g.match.round, cfg)}</b>
              </span>
            </div>
            <div class="ac-odds" role="img" aria-label={`Chance of each piece in the shop at level ${g.match.you.level}: ${oddsWordsLine}`} data-level={g.match.you.level}>
              {KINDS.map((k) => (
                <span key={k} class={`ac-od${odds[k] === 0 ? " none" : ""}`} data-kind={k} data-odds={odds[k]}>
                  <PieceIcon color={mine} kind={k} />
                  <b>{odds[k]}%</b>
                </span>
              ))}
            </div>
            {wins >= 2 && (
              <span class="ac-streak" title="Win streak" aria-label={`Win streak: ${wins}`}>
                W{wins}
              </span>
            )}
          </div>
          )}

          {g.phase === "buy" || g.phase === "adjust" ? (
            <div class={`ac-shop${shopShut ? " shut" : ""}${dragPiece ? " selling" : ""}`} data-ac-drop="shop">
              <div class="ac-btns">
                <button type="button" class={`ac-btn ac-xp${xpOff || shopShut ? " off" : ""}`} aria-disabled={xpOff || shopShut} aria-label={`Buy ${cfg.levels.buyXp} XP, ${cfg.levels.buyXpCost} gold`} onClick={buyXpNow}>
                  <span>Buy XP</span>
                  <span class="ac-cost">
                    <i class="ac-coin" />
                    <b>{cfg.levels.buyXpCost}</b>
                  </span>
                </button>
                <button
                  type="button"
                  class={`ac-btn ac-reroll${shopShut || goldNow < cfg.shop.rerollCost ? " off" : ""}`}
                  aria-disabled={shopShut || goldNow < cfg.shop.rerollCost}
                  aria-label={`Reroll the shop, ${cfg.shop.rerollCost} gold`}
                  onClick={reroll}
                >
                  <span>Reroll</span>
                  <span class="ac-cost">
                    <i class="ac-coin" />
                    <b>{cfg.shop.rerollCost}</b>
                  </span>
                </button>
              </div>
              <div class="ac-cards">
                {g.round.shop.slots.map((offer, slot) => {
                  const block = g.phase === "buy" ? (offerBlocks[slot] ?? null) : null;
                  const words = block ? buyWords(block, offer, goldNow, cfg, g.match.you.level) : null;
                  const dim = (!!block && !holdOnly[slot]) || shopShut;
                  return (
                    <button
                      key={slot}
                      type="button"
                      class={`ac-buy${dim ? " off" : ""}${holdOnly[slot] && !shopShut ? " hold-only" : ""}`}
                      data-slot={slot}
                      data-kind={offer.kind}
                      data-square={offer.square}
                      aria-disabled={!!block || shopShut}
                      aria-label={`Buy a ${KIND_NAME[offer.kind]} on ${offer.square}, ${priceOf(offer.kind)} gold${shopShut ? (locked ? ", locked" : "") : words ? `, ${words.short}` : ""}`}
                      onPointerDown={(e) => offerDown(e, slot, offer.kind)}
                      onPointerMove={movePress}
                      onPointerUp={(e) => endPress(e)}
                      onPointerCancel={(e) => endPress(e, true)}
                      onLostPointerCapture={(e) => endPress(e, true)}
                      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), buySlot(slot))}
                    >
                      <span class={`ac-tile ${squareDark(offer.square) ? "d" : "l"}`}>
                        <PieceIcon color={mine} kind={offer.kind} />
                      </span>
                      <span class="ac-nm">
                        {capital(KIND_NAME[offer.kind])} <em>{offer.square}</em>
                      </span>
                      <span class="ac-cost">
                        <i class="ac-coin" />
                        <b>{priceOf(offer.kind)}</b>
                      </span>
                    </button>
                  );
                })}
              </div>
              {dragPiece && <div class="ac-sell-drop">Drop to sell for {sellValue(dragPiece.kind as Kind, cfg)}</div>}
            </div>
          ) : (
            <div class={`ac-card ac-card-${g.phase}`}>
              {g.phase === "fight" && <p class="ac-card-text">{fightRulesWords(cfg)}</p>}
              {(g.phase === "result" || g.phase === "over") && outcome && (
                <>
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
                  <div class="ac-card-body">
                    <p class="ac-card-head">{matchEnd ? matchEnd.head : headline(outcome.result)}</p>
                    <p class="ac-card-text">
                      {endWords(outcome.end, outcome.result.outcome === "draw", cfg, outcome.detail)} {damageWords(outcome.result)}
                      {matchEnd ? ` ${matchEnd.sub}` : ""}
                    </p>
                    {outcome.next && <p class="ac-card-gold">{goldWords(outcome.next)}</p>}
                  </div>
                </>
              )}
            </div>
          )}

          {cfg.lockIn && g.phase === "buy" && (
            <button
              type="button"
              class={`ac-lock${youLocked ? " done" : locked ? " off" : ""}${bonusOpen && !locked ? " bonus" : ""}`}
              aria-disabled={locked}
              aria-label={youLocked ? "Locked in" : `Lock in${bonusOpen ? `, the first to lock in gets ${cfg.lockInBonus} gold` : ""}`}
              onClick={lockIn}
            >
              {youLocked ? (
                "Locked in"
              ) : (
                <>
                  Lock in {bonusOpen && <small>+{cfg.lockInBonus} gold</small>}
                </>
              )}
            </button>
          )}
        </section>
      </div>
      {drag && (g.phase === "buy" || g.phase === "adjust") && (
        <div ref={ghostRef} class="hb-pieces ac-ghost" style={{ width: `${boxOf().width / 8}px`, height: `${boxOf().width / 8}px` }} aria-hidden="true">
          <piece class={`${mine === "w" ? "white" : "black"} ${KIND_NAME[drag.kind]}`} />
        </div>
      )}
    </div>
  );
}
