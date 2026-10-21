import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";
import { AUTOCHESS, botLook, mulberry32, type AutoChessSettings } from "@chessroyale/core";
import { account } from "../account.ts";
import { useAccount } from "./Profile.tsx";
import { Board } from "../components/Board.tsx";
import { BackButton } from "../components/FrontDoor.tsx";
import { Avatar } from "../components/Items.tsx";
import { cellOf, dragStarted, squareAtPoint } from "../board/logic.ts";
import { play, unlockAudio, warmSounds } from "../sound.ts";
import { FLOAT_MS, FloatGold, type FloatAt } from "../components/FloatGold.tsx";
import { testParams } from "../test-switches.ts";
import { adjustBlock, adjustMarks, adjustMove, adjustTargets, adjustWords, movesUsed, startAdjust, stepAfterBuy, undoAction, undoBlock, undoWords, type Adjusted } from "../autochess/adjust.ts";
import { botAdjust, botPlan } from "../autochess/bot.ts";
import { buyBlock, buyWords, carryBench, emptyArmy, heldBlock, heldWords, holdBlock, kingSquares, offerLabel, placeHeld, priceOf, sellHeld, sellPiece, sellValue } from "../autochess/army.ts";
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
import { addXp, buyXp, levelWords, xpBlock, xpToNext, xpWords } from "../autochess/level.ts";
import { bonusFor, botLocked, bothLocked, buyFreeze, freezeWords, noLocks, tickLocks, youLock, type Locks } from "../autochess/lockin.ts";
import { botSeen } from "../autochess/reveal.ts";
import { buyFromSlot, holdFromSlot, newShop, replaceTaken, rerollFor, rerollWords, shopSeed, type Shop } from "../autochess/shop.ts";
import { playFight, thinFight, withPiece } from "../autochess/fight.ts";
import { armiesFen, armyPieces, fenFrom, fightStart, piecesOn } from "../autochess/position.ts";
import { KIND_NAME, other, type Army, type Color, type Kind, type Offer } from "../autochess/types.ts";
import { clockWords, damageWords, endWords, fightRulesWords, goldWords, headline, matchWords, moveWords, type EndDetail, type EndKind } from "../autochess/words.ts";

/**
 * Auto chess, the demo (/autochess; docs/decisions/2026-10-19-autochess-demo.md, docs/areas/autochess.md): you against a
 * bot, all in this browser. Each round the game puts both kings down; the shop offers pieces, each with a square of your half
 * (30 s, the last 3 locked) while the bot's pieces show as plain circles 2 s behind; then their real pieces show and you get
 * one change (5 s: a piece to any empty square of your half); then the engine plays both armies out. The rules are in `autochess/` (pure, tested); this draws
 * them. Nothing is recorded, rewarded or sent anywhere.
 */

/** How often the clock is read: the countdown, the circles 2 s behind and the end of each step. Nothing is drawn per frame. */
const TICK_MS = 120;
/** How long a message under the board stays. */
const SAY_MS = 4200;
/** At the end of the adjust step the fight waits at most this long for the bot's last look. */
const BOT_WAIT_MS = 2500;
/** A pawn that cashes in stands on the last rank this long (its move's slide), then leaves the board. */
const CASH_LEAVE_MS = 220;
/** A press on a silhouette on the board is a tap while the pointer stays this close to where it went down (a finger always wobbles); farther, it is neither a tap nor a drag, and does nothing. */
const TAP_SLOP_PX = 10;

type Phase = "buy" | "adjust" | "fight" | "result" | "over";

type BotPlan = ReturnType<typeof botPlan>;

/** Everything that belongs to one round (a new one every round: nothing carries over but gold, HP and the streak). */
interface RoundState {
  you: Army;
  /** The shop's offers (new every round, free). */
  shop: Shop;
  /** Lock in (end your buying, first gets the bonus): when you locked, and who got the bonus. */
  locks: Locks;
  /** Your adjust step: where your pieces stand and what you did (one move). */
  adj: Adjusted | null;
  /** The bot's army when buying ended. */
  botStart: Army | null;
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

/** A piece being held: picked up for a drag, or selected by a tap; an offer pressed; or a piece on the bench pressed. */
interface Hold {
  kind: Kind | "k";
  at: { offer: number } | { square: string } | { held: number };
  /** An offer's silhouette on the board (Eric, Oct 21): it is only ever tapped, never picked up, dragged or dropped. */
  tapOnly?: boolean;
}
type Target = { square: string } | { shop: true } | { bench: true } | null;

const sameHold = (a: Hold | null, b: Hold | null) => !!a && !!b && JSON.stringify(a.at) === JSON.stringify(b.at);
const isSquare = (h: Hold): h is Hold & { at: { square: string } } => "square" in h.at;
const isOffer = (h: Hold): h is Hold & { at: { offer: number } } => "offer" in h.at;
const isHeld = (h: Hold): h is Hold & { at: { held: number } } => "held" in h.at;

function startRound(prev: MatchState, cfg: AutoChessSettings): { match: MatchState; round: RoundState } {
  const { match, gold } = beginRound(prev, cfg);
  const mine = youColor(match.round);
  const theirs = other(mine);
  const seed = roundSeed(match);
  const kings = kingSquares(seed, cfg);
  // (What each side held comes into the round on the same squares turned with the colors.)
  const plan = botPlan(theirs, kings[theirs], match.bot.gold, match.round, mulberry32(seed ^ 0x9e3779b9), cfg, carryBench(match.bot.bench), { level: match.bot.level, xp: match.bot.xp });
  const you = emptyArmy(mine, kings[mine], carryBench(match.you.bench));
  return { match, round: { you, shop: newShop(shopSeed(seed), you, cfg), locks: noLocks, adj: null, botStart: null, plan, botFinal: null, gold } };
}

function newGame(seed: number, cfg: AutoChessSettings): Game {
  const { match, round } = startRound(newMatch(seed, cfg), cfg);
  return { match, phase: "buy", phaseStart: performance.now(), round, fight: null, outcome: null };
}

/** A phone's short steps for tests (`?quick=1`, a test switch): the same game in a few seconds a step. */
function settingsFor(quick: boolean, gold: number, adjust: boolean): AutoChessSettings {
  // (Two seconds locked, so a test has time to try buying in the lock before the reveal.)
  const base = quick ? { ...AUTOCHESS, buySeconds: 7, lockSeconds: 2, circlesDelaySeconds: 0.5, revealSeconds: 1.5, adjustSeconds: 8, fightMoveMs: 60, fightFastMoveMs: 30 } : AUTOCHESS;
  // (`?gold=N`: N more gold at the start of round 1, to try a big army; `?adjust=0`: no adjust step, straight to the fight.)
  const out = gold > 0 ? { ...base, startGold: base.startGold + gold } : base;
  return adjust ? out : { ...out, adjustStep: false };
}

const colorName = (c: Color) => (c === "w" ? "White" : "Black");
/** The sounds this screen plays, made ahead (off the page's thread) once the audio is awake. */
const SOUNDS_USED = ["acPlace", "acHold", "acReroll", "sell", "acXp", "acLevel", "acLock", "acReveal", "acCash"] as const;
/** What the opponent is called: the same word as a bot in a 1 v 1. */
const BOT_NAME = "Bot";
/** The seed of a round's reveals (which of their pieces shows, and when: reveal.ts). */
const revealSeed = (match: MatchState) => (roundSeed(match) ^ 0x6b43a9b5) >>> 0;

/** A piece's picture: the board's own art, in a box that sizes it. */
function PieceIcon({ color, kind }: { color: Color; kind: Kind | "k" }) {
  return (
    <span class="hb-pieces ac-icon" aria-hidden="true">
      <piece class={`${color === "w" ? "white" : "black"} ${KIND_NAME[kind]}`} />
    </span>
  );
}

/** A side's level and the XP toward the next ("Lv 4 · 2/4 XP"); the number pops when the level goes up. */
function LevelTag({ level, xp, who, cfg, chime = false }: { level: number; xp: number; who: string; cfg: AutoChessSettings; chime?: boolean }) {
  const last = useRef(level);
  const [pops, setPops] = useState(0);
  // (In a layout effect: the chime and the pop come with the number changing, not a paint later. `chime`: yours only.)
  useLayoutEffect(() => {
    if (level > last.current) {
      setPops((n) => n + 1);
      if (chime) play("acLevel");
    }
    last.current = level;
  }, [level]);
  const need = xpToNext(level, cfg);
  return (
    <span class="ac-lv" data-level={level} style={{ "--xp": need === null ? 1 : xp / need } as Record<string, number>} aria-label={`${who} level ${level}${need === null ? ", the top level" : `, ${xp} of ${need} XP`}`}>
      Lv{" "}
      <b key={pops} class={pops ? "pop" : undefined}>
        {level}
      </b>
      {need === null ? " · max" : ` · ${xp}/${need} XP`}
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
  const extraGold = Math.max(0, Math.floor(Number(params.get("gold")) || 0));
  const cfg = useMemo(() => settingsFor(quick, extraGold, params.get("adjust") !== "0"), []);
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
  /** The press in progress: the pointer, the element that captured it, what was pressed, where, whether it became a drag (or, for a silhouette, wandered off). */
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
  const lockedAt = (cfg.buySeconds - cfg.lockSeconds) * 1000;
  // Frozen: the step's last seconds, or you locked in (your board, bench and shop stay as they are).
  const youLocked = g.phase === "buy" && g.round.locks.you !== null;
  const locked = g.phase === "buy" && buyFreeze(g.round.locks, elapsed, cfg) !== null;
  const botIsLocked = g.phase === "buy" && botLocked(g.round.plan.lockAt, elapsed);
  // (The bonus is still to be had while nobody has locked in.)
  const bonusOpen = g.phase === "buy" && g.round.locks.bonus === null && !botIsLocked;

  useEffect(() => {
    warmEngine();
    const id = setInterval(() => {
      const cur = gref.current;
      const t = performance.now();
      setNow(t);
      if (cur.phase === "buy") {
        // The bot locks in when its time comes (the first to lock gets the bonus); both locked, or the time up, ends the step.
        const at = t - cur.phaseStart;
        const locks = tickLocks(cur.round.locks, at, cur.round.plan.lockAt);
        if (locks !== cur.round.locks) commit({ ...cur, round: { ...cur.round, locks } });
        if (at >= cfg.buySeconds * 1000 || bothLocked(locks, at, cur.round.plan.lockAt)) toAdjust();
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

  /** The buying is over: their real pieces show (as they were when it locked), and you may move one piece. With the adjust step off, straight to the fight. */
  function toAdjust() {
    const cur = gref.current;
    if (cur.phase !== "buy") return;
    cancelGesture();
    setMsg("");
    const you = cur.round.you;
    const botStart = cur.round.plan.army;
    // (What the bot spent is paid now, and its lock-in bonus if it locked first; it sells nothing.)
    const locks = tickLocks(cur.round.locks, performance.now() - cur.phaseStart, cur.round.plan.lockAt);
    // (Both benches go into the match: what is held stays for the next round. The bot's plan was made with its bench already.)
    const match: MatchState = {
      ...cur.match,
      you: { ...cur.match.you, bench: you.bench },
      bot: { ...cur.match.bot, gold: cur.match.bot.gold - cur.round.plan.spent + bonusFor(locks, "bot", cfg), bench: botStart.bench, level: cur.round.plan.level.level, xp: cur.round.plan.level.xp },
    };
    commit({ ...cur, match, phase: "adjust", phaseStart: performance.now(), round: { ...cur.round, locks, adj: startAdjust(you), botStart } });
    // The bot adjusts out of sight, from your army as it stood when it locked, and its change shows at the fight.
    const run: BotRun = { stop: false, done: null, latest: botStart };
    botRun.current = run;
    if (stepAfterBuy(cfg) === "fight") {
      void toFight();
      return;
    }
    const seed = roundSeed(match);
    run.done = botAdjust(botStart, botEvaluator(you, other(youColor(match.round)), cfg), mulberry32(seed ^ 0x51ed270b), () => run.stop || cancelled.current, cfg, (army) => (run.latest = army)).then(
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
    commit({ ...cur, phase: "fight", phaseStart: performance.now() });
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
    commit({ ...cur, match, phase: won ? "over" : "result", phaseStart: performance.now(), outcome: { result, end, next, detail: { winner, you: color, ...(gain !== undefined ? { gain } : {}) } } });
  }

  function nextRound() {
    const cur = gref.current;
    if (cur.phase !== "result") return;
    const { match, round } = startRound(cur.match, cfg);
    cancelGesture();
    setMsg("");
    commit({ match, phase: "buy", phaseStart: performance.now(), round, fight: null, outcome: null });
  }

  function playAgain() {
    cancelGesture();
    setMsg("");
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

  /** Buys the offer in a shop slot: the piece lands on its square, and a new offer is rolled into the slot. */
  function buySlot(slot: number) {
    if (!buying()) return;
    const cur = gref.current;
    const offer = cur.round.shop.slots[slot];
    if (!offer) return;
    const bought = buyFromSlot({ army: cur.round.you, gold: cur.match.you.gold, shop: cur.round.shop }, slot, shopSeed(roundSeed(cur.match)), cfg, boardRoom());
    if ("block" in bought) {
      const line = buyWords(bought.block, offer, cur.match.you.gold, cfg, boardRoom()).line;
      // (A board with no room still takes it on the bench: say so.)
      return say(bought.block === "limit" && !holdBlock(cur.round.you, cur.match.you.gold, offer, cfg) ? `${line} Drag the offer to the bench to hold it.` : line);
    }
    commit({ ...cur, match: { ...cur.match, you: { ...cur.match.you, gold: bought.gold } }, round: { ...cur.round, you: bought.army, shop: bought.shop } });
    setSel(null);
    // (Another offer that could no longer use its square rolled again: the player is told, so an offer doesn't change under their finger unexplained.)
    if (bought.replaced) say(`Another offer was on ${bought.from[0]}: it rolled again.`);
    else setMsg("");
    play("acPlace");
  }

  /** Buys the offer in a shop slot to hold it on the bench: it keeps its square, and a new offer is rolled into the slot. */
  function holdSlot(slot: number) {
    if (!buying()) return;
    const cur = gref.current;
    const offer = cur.round.shop.slots[slot];
    if (!offer) return;
    const held = holdFromSlot({ army: cur.round.you, gold: cur.match.you.gold, shop: cur.round.shop }, slot, shopSeed(roundSeed(cur.match)), cfg);
    if ("block" in held) return say(buyWords(held.block, offer, cur.match.you.gold, cfg).line);
    commit({ ...cur, match: { ...cur.match, you: { ...cur.match.you, gold: held.gold } }, round: { ...cur.round, you: held.army, shop: held.shop } });
    setSel(null);
    say(`Held the ${KIND_NAME[offer.kind]} for ${offer.square}. Tap it on the bench to place it.`);
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
    const { shop, replaced, from } = replaceTaken(cur.round.shop, shopSeed(roundSeed(cur.match)), army, cfg);
    commit({ ...cur, round: { ...cur.round, you: army, shop } });
    setSel(null);
    if (replaced) say(`Another offer was on ${from[0]}: it rolled again.`);
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
    say(next.level > you.level ? `Level ${next.level}: your board may hold ${next.level} pieces.` : `Bought ${cfg.levels.buyXp} XP.`);
    play("acXp");
  }

  /** Lock in: your buying is over (your board and shop freeze); the first side to do it gets the bonus, and both locked ends the step. */
  function lockIn() {
    if (!buying()) return;
    const cur = gref.current;
    const at = performance.now() - cur.phaseStart;
    const locks = youLock(cur.round.locks, at, cur.round.plan.lockAt);
    const bonus = bonusFor(locks, "you", cfg);
    cancelGesture();
    commit({ ...cur, match: { ...cur.match, you: { ...cur.match.you, gold: cur.match.you.gold + bonus } }, round: { ...cur.round, locks } });
    play("acLock");
    if (bothLocked(locks, at, cur.round.plan.lockAt)) return toAdjust();
    say(bonus ? `You locked in first: +${bonus} gold.` : "You locked in.");
  }

  /** Rolls the whole shop again for gold. */
  function reroll() {
    if (!buying()) return;
    const cur = gref.current;
    const next = rerollFor({ gold: cur.match.you.gold, shop: cur.round.shop, army: cur.round.you }, shopSeed(roundSeed(cur.match)), cfg);
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
    say(`Sold the ${KIND_NAME[hold.kind as Kind]} for ${gold}.`);
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

  /** Your one change: a piece of yours to any legal empty square of your half. */
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
      if (hold.kind === "k") return say("Your king is placed by the game.");
    } else if (!adjusting()) return;
    if (phase === "adjust" && hold.kind === "k") return say(adjustWords("kingfixed", cfg));
    if (phase === "adjust") {
      const adj = gref.current.round.adj!;
      // (A piece you moved takes its move back when tapped.)
      if (isSquare(hold) && adjustMarks(adj).some((m) => m.square === (hold.at as { square: string }).square)) return takeBack(hold.at.square);
    }
    if (sameHold(selRef.current, hold)) return setSel(null);
    setSel(hold);
    if (phase === "buy") say(`${KIND_NAME[hold.kind as Kind][0]!.toUpperCase()}${KIND_NAME[hold.kind as Kind].slice(1)} selected. Tap Sell to sell it for ${sellValue(hold.kind as Kind, cfg)}.`);
  }

  function tapSquare(square: string) {
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
      // (A silhouette on the board is only tapped: a pointer that wanders off it picks nothing up, drags nothing and drops nothing.)
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
    if (kind) return startPress(e, { kind, at: { square } });
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

  // The squares the picked piece may move to in the adjust step.
  const dots: string[] = [];
  if (sel && g.phase === "adjust" && g.round.adj && isSquare(sel) && movesUsed(g.round.adj) < cfg.adjustMoves) dots.push(...adjustTargets(g.round.adj.army, sel.at.square));

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
  const botGoldNow = g.phase === "buy" ? g.match.bot.gold - (seen?.spent ?? 0) + bonusFor(g.round.locks, "bot", cfg) : g.match.bot.gold;

  // The clock and the step's name.
  let clock = "";
  let label = "";
  if (g.phase === "buy") {
    clock = clockWords(cfg.buySeconds * 1000 - elapsed);
    label = youLocked ? "Locked in" : locked ? "Locked" : "Buy";
  } else if (g.phase === "adjust") {
    clock = clockWords(cfg.adjustSeconds * 1000 - elapsed);
    label = "Move";
  } else if (g.phase === "fight") {
    label = "Fight";
  } else label = g.phase === "over" ? "Match over" : "Round over";

  const held = sel ?? null;
  // What is being dragged while buying: an offer (to the bench) or a piece of yours (to the shop, to sell it).
  const dragOffer = g.phase === "buy" && drag && isOffer(drag) ? (g.round.shop.slots[drag.at.offer] ?? null) : null;
  const dragPiece = g.phase === "buy" && drag && drag.kind !== "k" && !isOffer(drag) ? drag : null;
  const hint =
    g.phase === "buy"
      ? youLocked
        ? "You're locked in. Your board, bench and shop are frozen until the step ends."
        : "Tap an offer to buy it: it lands on its square. Drag one to the bench to hold it."
      : g.phase === "adjust"
        ? "Move one piece to any empty square of your half. Tap a piece, then a square."
        : g.phase === "fight"
          ? moveWords(g.fight?.plies ?? 0, cfg, !!g.fight && thinFight(g.fight.fen, cfg))
          : "";

  const outcome = g.outcome;
  const matchEnd = g.phase === "over" && outcome ? matchWords(outcome.result.outcome === "you") : null;

  // The opponent's level, as far as you see it: while you buy, the XP it has bought so far (2 s behind, as its pieces are).
  const botLevelNow = seen ? addXp({ level: g.match.bot.level, xp: g.match.bot.xp }, seen.xpBuys * cfg.levels.buyXp, cfg) : { level: g.match.bot.level, xp: g.match.bot.xp };
  const xpOff = locked || !!xpBlock(g.match.you, goldNow, cfg);
  const botHp = Math.max(0, g.match.bot.hp);
  const myHp = Math.max(0, g.match.you.hp);

  return (
    <div class="fd-root ac-root" onPointerDownCapture={wake} data-phase={g.phase} data-round={g.match.round} data-you-locked={youLocked ? "1" : undefined} data-bot-locked={botIsLocked ? "1" : undefined} data-bonus={g.round.locks.bonus ?? undefined} data-you={mine} data-king={g.round.you.king} data-bot-king={botKing}>
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
          <span class="ac-avatar" aria-hidden="true">
            <Avatar look={theirLook} side={theirs} />
          </span>
          <span class="ac-who">
            <strong class="ac-name">{BOT_NAME}</strong>
            <LevelTag level={botLevelNow.level} xp={botLevelNow.xp} who={`${BOT_NAME}'s`} cfg={cfg} />
          </span>
          <span class="ac-stats">
            <span class="ac-line">
              <span class="ac-stat ac-hp-bot" aria-label="Opponent's HP">
                HP <b>{botHp}</b>
              </span>
              <span class="ac-stat ac-gold-bot" aria-label="Opponent's gold">
                Gold <b>{botGoldNow}</b>
              </span>
            </span>
            {botIsLocked && (
              <span class="ac-tag ac-bot-locked" aria-label="Opponent locked in">
                Locked in
              </span>
            )}
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
              {(seen?.circles ?? []).map((square) => (
                <span key={square} class={`ac-circle ${theirs}`} data-square={square} style={sq(square)} />
              ))}
              {(seen?.revealed ?? []).map((r) => (
                <span key={r.square} class="ac-ping" data-square={r.square} style={sq(r.square)} />
              ))}
              {offers.map((o, slot) => (
                <span key={`${slot}${o.kind}${o.square}`} class="ac-offers" data-square={o.square} style={sq(o.square)}>
                  <span class={`ac-sil${offerBlocks[slot] || locked ? " off" : ""}`} data-slot={slot} data-kind={o.kind}>
                    <i class={`ac-sil-shape ${KIND_NAME[o.kind]}`} />
                  </span>
                </span>
              ))}
              {held && isSquare(held) && <span class="ac-cell ac-picked" style={sq(held.at.square)} />}
              {floats.filter((f) => "col" in f.at).map((f) => (
                <FloatGold key={f.id} amount={f.amount} at={f.at} />
              ))}
              {dots.map((square) => (
                <span key={square} class="ac-cell ac-dot" style={sq(square)} />
              ))}
              {g.phase === "adjust" &&
                g.round.adj &&
                adjustMarks(g.round.adj).map(({ square, action }) => (
                  <span key={square} class="ac-cell ac-moved" data-square={square} data-action={action} style={sq(square)}>
                    <i aria-hidden="true">↩</i>
                  </span>
                ))}
              {g.phase === "adjust" && <div class="ac-theirs-line">Your opponent is moving their pieces…</div>}
            </div>
          </Board>
        </div>

        <div class="ac-side ac-me" aria-label="You">
          <span class="ac-avatar" aria-hidden="true">
            <Avatar look={myLook} side={mine} />
          </span>
          <span class="ac-who">
            <strong class="ac-name">{myName}</strong>
            <LevelTag level={g.match.you.level} xp={g.match.you.xp} who="Your" cfg={cfg} chime />
          </span>
          <span class="ac-stats">
            <span class="ac-line">
              <span class="ac-stat ac-hp-you" aria-label="Your HP">
                HP <b>{myHp}</b>
              </span>
              <span class="ac-stat ac-gold-you" aria-label="Your gold">
                Gold <b>{goldNow}</b>
              </span>
            </span>
            <span class="ac-stat ac-income" aria-label="This round's income">
              Income <b>+{incomeFor(g.match.round)}</b>
            </span>
          </span>
        </div>

        {g.phase === "buy" && (
          <div class="ac-msg" role="status" aria-live="polite">
            <span class="ac-msg-text">{msg || hint}</span>
            {!locked && held && isSquare(held) && held.kind !== "k" && g.round.you.board[held.at.square] === held.kind && (
              <button type="button" class="ac-sell" onClick={() => sell(held)}>
                Sell {sellValue(held.kind, cfg)}
              </button>
            )}
          </div>
        )}

        {g.phase === "buy" ? (
          <>
            <div
              class={`ac-bench${dragOffer ? " holding" : ""}`}
              data-ac-drop="bench"
              aria-label="Bench"
            >
              {Array.from({ length: cfg.benchSlots }, (_, i) => {
                const h = g.round.you.bench[i];
                if (!h) return <div key={`empty${i}`} class="ac-slot" />;
                const block = heldBlock(g.round.you, i, cfg, g.match.you.level);
                const lifted = !!drag && isHeld(drag) && drag.at.held === i;
                return (
                  <button
                    key={`${i}${h.kind}${h.square}`}
                    type="button"
                    class={`ac-slot has${block || locked ? " off" : ""}${lifted ? " lifted" : ""}`}
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
                    <small>{h.square}</small>
                  </button>
                );
              })}
              {dragOffer && <div class="ac-sell-drop">Drop to hold it for {priceOf(dragOffer.kind, cfg)}</div>}
              {floats.filter((f) => "slot" in f.at).map((f) => (
                <FloatGold key={f.id} amount={f.amount} at={f.at} />
              ))}
            </div>
            <div class={`ac-shop${dragPiece ? " selling" : ""}`} data-ac-drop="shop" aria-label="Shop">
              {g.round.shop.slots.map((offer, slot) => {
                const block = offerBlocks[slot] ?? null;
                const words = block ? buyWords(block, offer, goldNow, cfg, g.match.you.level) : null;
                const dim = (!!block && !holdOnly[slot]) || locked;
                return (
                  <button
                    key={slot}
                    type="button"
                    class={`ac-buy${dim ? " off" : ""}${holdOnly[slot] && !locked ? " hold-only" : ""}`}
                    data-slot={slot}
                    data-kind={offer.kind}
                    data-square={offer.square}
                    aria-disabled={!!block || locked}
                    aria-label={`Buy a ${KIND_NAME[offer.kind]} on ${offer.square}, ${priceOf(offer.kind)} gold${locked ? ", locked" : words ? `, ${words.short}` : ""}`}
                    onPointerDown={(e) => offerDown(e, slot, offer.kind)}
                    onPointerMove={movePress}
                    onPointerUp={(e) => endPress(e)}
                    onPointerCancel={(e) => endPress(e, true)}
                    onLostPointerCapture={(e) => endPress(e, true)}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), buySlot(slot))}
                  >
                    <PieceIcon color={mine} kind={offer.kind} />
                    <b>{priceOf(offer.kind)}</b>
                    <small>{locked ? "Locked" : (words?.short ?? offerLabel(offer))}</small>
                  </button>
                );
              })}
              {dragPiece && <div class="ac-sell-drop">Drop to sell for {sellValue(dragPiece.kind as Kind, cfg)}</div>}
            </div>
            <div class="ac-ctl">
              <button type="button" class={`ac-reroll${locked || goldNow < cfg.shop.rerollCost ? " off" : ""}`} aria-disabled={locked || goldNow < cfg.shop.rerollCost} aria-label={`Reroll the shop, ${cfg.shop.rerollCost} gold`} onClick={reroll}>
                Reroll <b>{cfg.shop.rerollCost}</b>
              </button>
              <button type="button" class={`ac-xp${xpOff ? " off" : ""}`} aria-disabled={xpOff} aria-label={`Buy ${cfg.levels.buyXp} XP, ${cfg.levels.buyXpCost} gold`} onClick={buyXpNow}>
                Buy XP <b>{cfg.levels.buyXpCost}</b>
              </button>
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
            </div>
          </>
        ) : (
          <div class={`ac-card ac-card-${g.phase}`}>
            {g.phase === "adjust" && (
              <>
                <p class="ac-card-say" role="status" aria-live="polite">
                  {msg || hint}
                </p>
                <p class="ac-card-text">Their pieces stay shown; yours stay hidden until the fight. Tap ↩ to take your move back.</p>
              </>
            )}
            {g.phase === "fight" && (
              <>
                <p class="ac-card-say">{hint}</p>
                <p class="ac-card-text">{fightRulesWords(cfg)}</p>
              </>
            )}
            {(g.phase === "result" || g.phase === "over") && outcome && (
              <>
                <p class="ac-card-head">{matchEnd ? matchEnd.head : headline(outcome.result)}</p>
                <p class="ac-card-text">
                  {endWords(outcome.end, outcome.result.outcome === "draw", cfg, outcome.detail)} {damageWords(outcome.result)}
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

      </div>
      {drag && (g.phase === "buy" || g.phase === "adjust") && (
        <div ref={ghostRef} class="hb-pieces ac-ghost" style={{ width: `${boxOf().width / 8}px`, height: `${boxOf().width / 8}px` }} aria-hidden="true">
          <piece class={`${mine === "w" ? "white" : "black"} ${KIND_NAME[drag.kind]}`} />
        </div>
      )}
    </div>
  );
}
