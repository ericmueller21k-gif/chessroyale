import type { BossBrain, BounceResult, BurnEvent, Fusion, LassoDrag, LeapfrogHop, LightsOutTarget, LongPull, PowerEvent, PowerId, RepaintResult, SawCut, ShowdownResult, SlamLanding, SlamPiece, SlamResult, SplitPawn, StopReason, TusksCast } from "@chessroyale/core";
import type { Base } from "./rules.ts";
import type { ItemLook } from "@chessroyale/core";
import type { Augment, DrawRule, MaterialSlip } from "@chessroyale/core";
import type { LastStandRound } from "./runner.ts";
import type { JudgeJob, JudgeReport, JudgeRules } from "./judge.ts";
import type { CarrotRace } from "./bosses/carrots.ts";
import type { CarrotView } from "./bosses/hopper.ts";
import type { CamoView } from "./bosses/smudgy.ts";
import type { GardenView, WaterAsk } from "./bosses/gardener.ts";
import type { BalloonAsk, HoopsAsk, TigerView } from "./bosses/tiger.ts";
import type { CreaseAsk, FolioView } from "./bosses/folio.ts";
import type { WorkshopView } from "./bosses/timber.ts";
import type { MoveScore } from "./uci.ts";
/**
 * Messages between the browser and the lobby server (one Durable Object per
 * lobby), sent as JSON over a WebSocket. Times are server milliseconds; each
 * server message carries `now` so clients can correct for clock offset.
 *
 * Squads (its lobbies and parties) has its own, versioned messages: `squads/protocol.ts` (`@chessroyale/chess/squads`).
 */

export interface LobbyPlayer {
  id: string;
  name: string;
  isBot: boolean;
  connected: boolean;
  /** A person's account (their public profile: /api/profile/UID). */
  uid?: string;
  /** What they wear (sent once per player: keep the last one seen). */
  look?: ItemLook;
}

export interface NetBoard {
  id: number;
  fen: string;
  lastMove: string | null;
  openingName: string;
  openingMoves?: string[];
  /** Replacements this board slot has had (a new number means a new game). */
  generation: number;
  /** Moves played on this board so far. */
  ply: number;
  /** The last few moves (up to 5) and the position before them, to replay what a player missed. */
  recent: string[];
  recentFrom: string;
  /** Every move from the starting position, to step back through the game. */
  history: string[];
  /** Positions changed between moves (a piece G-REX's fire destroyed): the moves after each are played from it. */
  bases?: Base[];
}

/** A board at a glance, for the strip of tiny boards along the top (slots never move; closed ones stay grayed). */
export interface BoardSlot {
  id: number;
  fen: string;
  lastMove: string | null;
  live: boolean;
}

/** One row of the live leaderboard. */
export interface NetStanding {
  id: string;
  name: string;
  /** What the standings rank by: the stage score (move quality only). */
  points: number;
  stageScore: number;
  /** Average round score this stage. */
  avg: number;
  bankMs: number;
  /** Average thinking time per move over the match. */
  avgThinkMs: number;
  /** Engine-based rating estimate from every move so far (null until a few moves). */
  rating: number | null;
  powerUps: number;
  powerUpsUsed: number;
  practice: boolean;
  isBot: boolean;
  /** Knocked out (then `placement` is set). */
  out: boolean;
  /** Still in, but the stage's cut would take them if it came now (ties at the line go through). */
  cut?: boolean;
  /** Crowd 50 v 50: strong moves in a row, from CrowdScoring.streakFrom (the scoreboard's fire). */
  streak?: number;
  placement: number | null;
  /** Crowd 50 v 50: the player's team (the side they play all match). */
  team?: "w" | "b" | null;
  /** A person's crate items (shown on the cut screen). */
  look?: ItemLook;
  /** A person's account (a tap on their name opens /api/profile/UID). */
  uid?: string;
}

export interface NetPick {
  playerId: string;
  move: string | null;
  /** Raw loss against the best move (null: a miss). */
  loss: number | null;
  /** The loss as it counted for points, when the opening allowance took something off (see PlayerRoundResult). */
  counted?: number;
  /** The opening allowance applied on this move but not to this pick: it gave up material (see PlayerRoundResult). */
  material?: MaterialSlip;
  roundScore: number;
  /** Used a power-up this round (so the pick can't count as brilliant). */
  usedPowerUp?: boolean;
  /** Crowd 50 v 50 (PlayerRoundResult): gave up material so the minus score wasn't capped; the streak's and a find's bonus. */
  uncapped?: MaterialSlip;
  streak?: number;
  streakBonus?: number;
  brilliantBonus?: number;
}

/** What the host's browser computes for one board after picks lock. */
export interface BoardScore {
  boardId: number;
  bestMove: string;
  bestExpected: number;
  /** Mover's expected score after every picked move (bots included). */
  expectedAfter: Record<string, number>;
  botPicks: Record<string, string>;
  botThinkMs: Record<string, number>;
  /** Bots that used a power-up on this board. */
  botPowerUps?: string[];
  /**
   * From the same searches: each scored move's best reply, and a forced mate in its line (moves, from the mover's
   * side). The God King's Last Stand names what a blunder loses with them.
   */
  replies?: Record<string, string>;
  mates?: Record<string, number>;
}

export interface ScoreJob {
  boardId: number;
  fen: string;
  /** Human picks on this board (null = missed). */
  humanPicks: Record<string, string | null>;
  bots: { id: string; skill: number; powerUps: number }[];
  /** Crowd: bot picks decided at the start of the round (shown live); use these instead of choosing again. */
  botPlan?: Record<string, string>;
  botPlanPowerUps?: string[];
  /** Boss battle, the re-pick after the God King's Last Stand: the move he took back (no bot picks it; it isn't the best). */
  barred?: string;
  /** Boss battle, a power limits the crowd's moves: the moves allowed (the best and the bots' picks come from these). */
  allowed?: string[];
  /**
   * Boss battle, G-REX's fire: the tiles ablaze this turn. A crowd piece left on one after the move burns: the moves
   * that save it are scored too, and the bots count a piece left there as gone (the lobby's runner does the scoring).
   */
  burn?: string[];
  /**
   * Boss battle, Chub & Chirp's Carrot Patch (missing otherwise and from older servers; an older app ignores it): the race
   * as the crowd's judge weighs it (the carrots still in the ground, his count, the moves left). The moves that pull a
   * carrot are scored too, and the bots pick by every move's score with the race counted (raceRanked); the scores
   * themselves stay the engine's (the lobby's runner counts the race, once, for everyone).
   */
  race?: CarrotRace;
  /** Picks that can decide the cut (players near the cut line): re-checked first (recheckCut* in settings). */
  priority?: string[];
}

/** A pick shown live in Crowd once you've picked (or while your team watches): visible from `at` (server time). */
export interface LivePick {
  playerId: string;
  move: string;
  at: number;
}

/** The 2v2 final, for every screen: teams, whose turn, each finalist's move quality, and the last move. */
export interface NetFinal {
  board: NetBoard;
  /** teams[0] plays the side that was to move when the final started. */
  teams: [string[], string[]];
  /** Turn order (cycled). */
  order: string[];
  /** Moves made so far, and how many there will be in all. */
  turn: number;
  totalTurns: number;
  /** Whose turn it is (null once the final is over). */
  mover: string | null;
  /** Each finalist's average loss per move in the final (null before their first move) and moves made. */
  scores: Record<string, { avg: number | null; moves: number; matchLoss?: number | null; rating?: number | null }>;
  /** The move just played, with its loss (null loss = missed, then the engine's move was played). */
  last: null | { playerId: string; move: string; san: string; loss: number | null };
  /** classic (fixed moves each), team (4v4, 3v3, then 2v2 to the end) or duel (1v1 to the end). */
  format?: "classic" | "team" | "duel";
  /** Team final: turns until the next cut (null on the last step), and who has gone out so far. */
  cutIn?: number | null;
  out?: { id: string; turn: number }[];
  /** Team final: who went out just now (after the move in `last`). */
  justOut?: string[];
}

/** The boss battle, for every screen. */
export interface NetBoss {
  board: NetBoard;
  name: string;
  icon: string;
  /** 1 to 5: how scary the boss is (its Elo stays secret). */
  threat: number;
  /**
   * The level its bar shows now, "LVL 50" (core's bossLevelBase: its rating over 28 plus a random offset drawn once from the
   * battle's seed, so every screen and a reload show the same number; Eric, Oct 23). It follows the strength it plays its next
   * move at: the Full Moon's moves and the showdown's follow-up lift it, the King's strike slashes it (the runner's
   * bossStrengthNow), then it's back. `null`: unknown, "LVL ???" (the Hidden Boss). Missing from older servers: no level line.
   */
  level?: number | null;
  /** The level at its usual strength: the bar shows a lift or a slash as `level` against it (missing with `level`; none for "???"). */
  levelBase?: number;
  /** The side the crowd plays. */
  crowdSide: "w" | "b";
  crowdMoves: number;
  maxMoves: number;
  /** Crowd moves until the boss strikes again (null when it won't strike any more). */
  strikeIn: number | null;
  kills: { id: string; atMove: number }[];
  /** The move number the battle started from (a position from the game just played). */
  startMove: number;
  /** The King, the crowd's champion: charges left, the crowd moves he played, and after which he struck the boss. */
  kingCharges: number;
  kingMoves: number[];
  kingStrikes: number[];
  /** The King has struck: the boss's next move will be a weaker one. */
  staggerNext: boolean;
  /** Boss raid (its own mode), and the opening it starts from. */
  raid: boolean;
  openingName: string | null;
  /** The boss's last move, and who it struck down just now. */
  /**
   * `captured`: the piece it took ("q" for a queen: its banner). `through`: a power stops it, but it stopped every move
   * he had, so the limit lifted for the turn (the dock says so on the crowd's turn).
   */
  lastMove: null | { move: string; san: string; staggered?: boolean; captured?: string; through?: StopReason };
  justKilled?: string | null;
  /**
   * The God King's Last Stand, once it has happened (he has fallen): the crowd's move he took back, during which
   * crowd move, what it gave away, the bar it crossed, and the charges he still had (each player still in got
   * that many power-ups). For the results card: the position before the move, the best move, the crowd's chances
   * after the best move and after the blunder (0-1), the boss's best reply and a mate it allowed (boss's moves).
   */
  lastStand?: {
    atMove: number;
    move: string;
    loss: number;
    bar: number;
    charges: number;
    fen?: string;
    bestMove?: string;
    before?: number;
    after?: number;
    reply?: string;
    mateIn?: number;
  } | null;
  /** The re-pick after his Last Stand: the move he took back can't be picked. */
  barred?: string | null;
  /** Set when the battle is over. */
  result?: "crowd" | "boss" | "draw";
  /** Which boss (a BOSS_ROSTER id). */
  id?: string;
  /** Its powers as they stand (boss-powers.ts): the same on every screen. */
  powers?: NetBossPowers;
}

/** A boss's powers, for every screen: what to draw and which moves the crowd may play. */
export interface NetBossPowers {
  passive: PowerId;
  ultimate: PowerId;
  /** The crowd turn they're set for (crowd moves + 1). */
  turn: number;
  /**
   * The rage meter, 0-1 (full on the ultimate's turn, empty while its effect runs, then filling again; null: no meter);
   * whether it's held empty now (an ultimate's effect still running: missing from older servers); the one-turn
   * warning; the turn the ultimate under way hit (null: none under way); how many ultimates have come this battle.
   */
  rage: number | null;
  paused?: boolean;
  warned: boolean;
  ultAt: number | null;
  ults?: number;
  /** A frozen piece's square, through which crowd turn; Boingo's pies (`pie`: the newest, for older screens). */
  frozen: { square: string; until: number } | null;
  pie: { square: string; until: number } | null;
  pies?: { square: string; until: number }[];
  /**
   * Squares that show ice now (the frozen piece; in Ginger's blizzard every crowd piece its ice holds, through the
   * boss's turn after too); and of those, the ones that thaw as the next crowd turn begins (cracked and dripping on
   * screen; missing for other bosses and from older servers).
   */
  iced: string[];
  thaw?: string[];
  /**
   * Boingo's funhouse: how far the board is turned clockwise from the crowd's own view this turn (0, 90, 180, 270;
   * missing from older servers), `flipped` when it's 180 (older screens), and the funhouse itself (the turn it came, the
   * side of its quarter turn, and the crowd's move he played for it as it came: `move`, `san`).
   */
  angle?: 0 | 90 | 180 | 270;
  flipped: boolean;
  funhouse: { turn: number; side: 90 | 270; move?: string; san?: string } | null;
  /** What happened as this turn began (a freeze, a pie, the warning, the blizzard, the funhouse): each plays once. */
  events: PowerEvent[];
  /** The crowd's turn: the moves it may play (null: any legal move). */
  allowed: string[] | null;
  /** G-REX's fire tiles (missing from older servers): each square, the crowd turn it landed, its stage (1-3) now. */
  fire?: { square: string; lit: number; stage: number }[];
  /** What the fire did after the crowd's last move: pieces destroyed, tiles that fizzled under the king. */
  burnt?: BurnEvent[];
  /** The Roman candle: the crowd turn he fired, and the shots still to fall (the pips by the board). */
  candle?: { at: number; left: number } | null;
  /**
   * Where the candle's fireballs are coming down (missing from older servers): each square, the crowd turn it's hit,
   * and its shadow's size (1 small, 3 turns out; 3 the biggest, the turn before it lands).
   */
  shadows?: { square: string; lands: number; stage: number }[];
  /** The first crowd turn a crowd piece stepped onto a burning tile (the God King's warning, once a match). */
  stepped?: number | null;
  /** The test trigger: the ultimate is on its way (it comes as the next crowd turn begins). */
  ultNext?: boolean;
  /**
   * Hollow's dark (missing for other bosses): each dark square, the crowd turn it fell as and its last turn (it thins
   * then); the squares whose dark cleared as this turn began; his bulbs still lit (his moves to his next cover); whether
   * he claimed the dark side before move 1; and after which crowd move his Lights out came (null: not yet).
   */
  dark?: { square: string; at: number; until: number }[];
  cleared?: string[];
  bulbs?: number;
  claimed?: boolean;
  lightsAt?: number | null;
  /**
   * After a failed Lights out (the crowd's find rate under lightsOutHold): his extra move after his own, before the
   * crowd's turn: "due", then "played" (the turn's `extra` event), or "skipped" (no quiet move within the cap).
   */
  lightsExtra?: "due" | "played" | "skipped";
  /**
   * Hollow's Christmas lights (looks only, Oct 11): which colors his bulbs take this battle, the same on every screen
   * (packages/app/src/characters/lights.ts). A number from 0 to 4095 drawn from the battle's seed; 12 bits of it, so it
   * gives nothing of the seed (and the powers it decides) away. Missing from older servers: each device picks its own.
   */
  lights?: number;
  /**
   * Big Boy (missing for other bosses): his toy block (its square, the crowd turn it landed and its last; nothing may
   * move onto it or through it), the crowd's center pawn he ate before move 1, and his Big Bounce once it has happened
   * (the position before it, the pieces it moved, where he bounced).
   */
  block?: { square: string; at: number; until: number } | null;
  snack?: string | null;
  bounce?: BounceResult | null;
  /**
   * Sawyer (missing for other bosses): his split pawn once his first move is played (the pawn, the new half beside it,
   * and the two halves' squares now), his saw cut (the edge between two squares, its first and last crowd turn), and
   * the board saw while it lasts (no move may cross between the d and e files).
   */
  split?: SplitPawn | null;
  cut?: SawCut | null;
  boardSaw?: { at: number; until: number } | null;
  /**
   * Wrangler (missing for other bosses): his long pull once his first move is played (null: an ordinary first move), his
   * last lasso drag (the piece, its squares, the crowd turn it set up; `ult`: the drag that stood in for the test
   * trigger's showdown), his last showdown (the pairs and where each came from, the crowd turn whose move must be one of
   * its duels, the position before the line-up; `outside`: the test trigger's, outside the band), his meter full and
   * waiting to fire (`ready`: which fill, for his line and his ready loop; null: not), and whether the device that works
   * out his moves scouts for line-ups while this crowd turn is picked (`scout`). His meter itself is `rage`.
   */
  pull?: LongPull | null;
  drag?: LassoDrag | null;
  showdown?: ShowdownResult | null;
  ready?: number | null;
  scout?: boolean;
  /**
   * Alfil (missing for other bosses and from older servers; an older app ignores them): his Tusks cast under way (his
   * turn and the crowd move it came after, and the two marked pawns' squares now: they glow; null: none), his last
   * fusion (his move: the two pawns' squares and the elephant's; `to` null: it failed, a marked pawn taken or no square
   * allowed, and he moved instead),
   * his elephants' squares now (bishops in the rules, drawn with their own art), his last Mammoth Slam (the pieces it
   * lifted from their squares, the crowd turn they land, the engine's measure of the swing when known here), the pieces
   * in the air now (each with its own square, where it lands: the shadow's square; the crowd turn it lands as it
   * begins; the crowd turns left, counting this one; the shadow's size, 1 to slamTurns), and their last landing (each
   * piece's own square and where it came down: the nearest empty square allowed when its own was taken; `early`: at the
   * start of his turn, a mate in one stopped).
   */
  tusks?: TusksCast | null;
  fusion?: Fusion | null;
  elephants?: string[];
  slam?: SlamResult | null;
  airborne?: { piece: string; square: string; lands: number; left: number; stage: number }[];
  landed?: SlamLanding | null;
  /**
   * Chub & Chirp (id hopper; missing for other bosses and from older servers; an older app ignores it): their last
   * Leapfrog hop, after the crowd's move `at` (at the start of his turn, before his move): his pawn from `from`, over the
   * crowd's pawn on `over`, to `to` (null: none yet).
   */
  hop?: LeapfrogHop | null;
  /**
   * Their Carrot Patch (missing for other bosses and from older servers; an older app ignores it), from its cast on: the
   * crowd move it came after, the carrots' squares and who pulled each (null: still in the ground), each side's count and
   * moves left in the race, whether it's over and why, his tier (his carrots), and his spin once rolled (his tier, the
   * prize rolled, the prize he got after any step down, where it went). Null: not cast.
   */
  carrots?: CarrotView | null;
  /**
   * Smudgy (missing for other bosses and from older servers; an older app ignores them): his Camouflage (the side of his
   * forced moves and how many are played, whether it's off this battle, the hidden rook's square now: draw a pawn there,
   * maskedFen; the swap, the crowd's move count from which it may strike, its reveal), his last Repaint (his pawn now the
   * crowd's, the crowd's piece now his, its kind) and how many he's made. As with Hollow's dark, the hidden square is in
   * the app's memory, not a secret: the screens hide it, and refuse a move it makes illegal (stopReason "paint").
   */
  camo?: CamoView | null;
  repaint?: RepaintResult | null;
  repaints?: number;
  /**
   * Moo & Moon (missing for other bosses and from older servers): the crowd's pieces a moonbeam holds now (they can't
   * move this crowd turn; in the order the beams landed; empty once the crowd's move lands), and the Full Moon under way
   * (`left`: his moves still at full strength, this one included while he thinks; null: none, he's himself).
   */
  stunned?: string[];
  fullMoon?: { left: number } | null;
  /**
   * The hippo gardener (missing for other bosses and from older servers; an older app ignores it): his seed meter (`since`
   * and `base`: seedsAt with the screens' clock gives the seeds waiting and the next one's time; the server's clock online,
   * the page's visible time solo; `fixed`, the test switch's set count), the plain plants on the board with the crowd
   * turns each still blocks (`left`: 3, 2, 1), his last watering's outcomes (`water`: what came up where, in the order it
   * plays) and how many he's made.
   */
  garden?: GardenView | null;
  /**
   * Timber (missing for other bosses and from older servers; an older app ignores it): his workshop as last settled (each
   * piece's scraps, the scraps' rolls so far and their seed, the real-time meter's `since`: workshopAt with the screens' clock
   * gives the scraps landed since), his drops and their cap, his last drop, Gnaw and bonus scraps.
   */
  workshop?: WorkshopView | null;
  /**
   * The circus tiger (missing for other bosses and from older servers; an older app ignores them): the balloon on his
   * nozzle (`balloon`: its shape as everyone sees it, a fake queen's "q"; its color; when it went on and when it's fully
   * blown, on the battle's clock: the server's online, the page's visible time solo, so every device draws the same stage;
   * `ready`, found ready at his turn's check), his last balloon's end (`balloonLast`: landed where, or popped), his counts,
   * and the hoops standing (`hoops`: each block by its corner, in throw order; the crowd moves they still stand for).
   * Nothing here says whether a balloon will pop.
   */
  balloon?: TigerView["balloon"];
  balloonLast?: TigerView["balloonLast"];
  balloons?: TigerView["balloons"];
  hoops?: TigerView["hoops"];
  /**
   * Folio (missing for other bosses and from older servers; an older app ignores them): the Draft's mark (`draft`: the
   * crowd's piece, the Folio piece attacking it, the squares between, its last crowd turn to answer it), the folded piece
   * (`folded`: its square while it's folded: refused moves say so), the Crease holding (`crease`: its line, "d|e" between
   * the d and e files or "4|5" between ranks 4 and 5, and its turns; none of the crowd's pieces crosses it; `side`, the side it stops; Folio's cross it) or warned of
   * (`creaseNext`: its line, until it lands), and Revision once it has come (`revision`: the two moves crossed out and their
   * names, its move in their place once played).
   */
  draft?: FolioView["draft"];
  folded?: FolioView["folded"];
  crease?: FolioView["crease"];
  creaseNext?: FolioView["creaseNext"];
  revision?: FolioView["revision"];
}

/**
 * Hollow's Lights out, for every screen (each player sees their own taps judged). The clocks are stopped; every beat
 * follows from `at` (server time) by lightsOutTimeline (boss-timing.ts).
 */
export interface NetLightsOut {
  key: string;
  at: number;
  /**
   * Each round: the pieces he names (piece letters, and what exactly: `targets`), its seconds, and once it's over, when
   * (`endedAt`, ms from `at`: every player done, see lightsRoundEnd) and the squares that answered it.
   */
  rounds: { pieces: string[]; targets?: LightsOutTarget[]; ms: number; answers?: string[]; endedAt?: number }[];
  /** This player's taps judged, round by round: the squares found and the wrong ones, and how many tries used (each a second more). */
  mine: { found: string[]; wrong: string[]; used?: number }[];
  /** Once the lights are back: the pieces this player missed in all (each cost lightsOutMiss). */
  missed?: number;
  /**
   * The crowd's count, from the server's own judging, the same for everyone (Eric, Oct 10): pieces found by everyone in
   * the test, settled so far (found, or missed for good), and asked in all. The meter shows found over settled; once
   * every round is over, found over asked against lightsOutHold says whether he moves twice.
   */
  crowd?: { found: number; settled: number; asked: number };
}

/** A pre-game vote, for every screen: everyone's votes, each visible from `at` (server time). */
export interface NetVote {
  key: string;
  /** Which vote (index into PREGAME_VOTES) and how many there are. */
  index: number;
  count: number;
  startsAt: number;
  until: number;
  /**
   * Everyone's votes, each shown from `at`. Once counted, everyone who didn't vote joins the winner (`joined`: added
   * when time ran out, see closePregameVote), so the final counts and the pawns show them.
   */
  votes: { playerId: string; option: number; at: number; side: "w" | "b"; joined?: true }[];
  /** The winning option once counted (then shown until `nextAt`). */
  result: number | null;
  nextAt?: number;
  /** A player may move their pawn to another zone after voting (voteChangeAllowed; off: one vote each). */
  changeAllowed?: boolean;
  /**
   * The position the game starts from, once the start vote has made it anything but the usual one (Freestyle's
   * shuffled back rows): the pieces that drop in after the last vote. Unset: the usual starting position.
   */
  start?: string;
}

/**
 * Quick chat: one line said in the match (a phrase or emoji id from core/chat.ts; never free text). `team` is the
 * sender's team when they said it (null: everyone is one team, as in a raid). `at` (server time) is when to show it
 * (a bot's line comes a moment after what it reacts to). `icon` is the sender's pixel icon, sent with their first
 * line to each player (keep it). `lobby`: said in the lobby before the match (the queue, a private lobby), where
 * there are no teams yet: it went to everyone there (`to` "all", `team` null), and stays in the match's feed.
 */
export interface NetChatLine {
  n: number;
  from: string;
  say: string;
  to: "team" | "all";
  team: "w" | "b" | null;
  at: number;
  icon?: string;
  lobby?: true;
}

/**
 * Why the server dropped a chat line (the app mirrors the limits, so this is rare). "mod": the sender has a
 * moderator's chat ban (see ChatBlock).
 */
export type ChatRefusal = "unknown" | "locked" | "team" | "gap" | "burst" | "repeat" | "closed" | "off" | "mod";

/** A moderator's chat ban: the player can't send (they still read) until `until` (server time; null: no end). */
export interface ChatBlock {
  until: number | null;
}

export type ClientMessage =
  /** `look`: the crate items you wear (others see them on the cut screen). */
  /** `lastBoss`: the boss this player met last (a BOSS_ROSTER id), so a raid can avoid the one most of the lobby met. */
  /** No rating: the lobby reads the one stored on the player's account (one an older app still sends is ignored). */
  /** `party`, `seat`: a Boss Battle party's battle, its pass (from the party's `placed`) and this member's seat in it. */
  | { t: "hello"; token?: string; name?: string; device?: "phone" | "computer"; practice?: boolean; look?: unknown; lastBoss?: string | null; evalBar?: boolean; party?: string; seat?: number }
  | { t: "start" }
  /** A Boss Battle party's AFK kick: `playerId` hasn't picked a minute after the turn's first pick (the lobby's partyKickable). */
  | { t: "kick"; playerId: string }
  /**
   * `away`: times the page was hidden or lost focus during this move's clock before the pick (fair play). `premove`: a
   * premove played as the turn opened (fair play leaves its time out only if `premove` named it before the turn opened).
   */
  | { t: "pick"; key: string; move: string; away?: number; premove?: true }
  /**
   * Your first premove (chess.com's: a move made ahead while it isn't your turn; null: none now), sent as it changes. The
   * server keeps it only while you can't pick (no turn of yours open, or you've picked in it), for your next turn, and
   * counts it only if it came before any browser could know that turn's position (the lobby's premoveAhead).
   */
  | { t: "premove"; move: string | null }
  | { t: "powerUp"; key: string }
  | { t: "scores"; key: string; boards: BoardScore[] }
  | { t: "crossCheck"; key: string; boardId: number; ok: boolean; detail?: string }
  /** Crowd: the host's early bot picks for this round. */
  | { t: "botPlan"; key: string; picks: Record<string, string>; powerUps: string[] }
  /** Crowd augments: this player's vote on the next round's move clock. */
  | { t: "augment"; choice: Augment }
  /**
   * Boss battle: this player calls the King. To play this move (their whole turn: no pick of their own), or
   * (`strike`) to strike the boss right now, after which the move goes on and they still pick.
   */
  | { t: "king"; key: string; strike?: boolean }
  /** A pre-game vote (Crowd 50 v 50): the option this player pushed a pawn into. */
  | { t: "vote"; key: string; option: number }
  /**
   * Boss battle, host only: the boss's move (Wrangler's long pull written as its three squares), and what its turn was
   * asked to work out besides (Wrangler's): the lasso drag after it ("c3c4", "" none) and the showdown's line-up after it
   * (checkLineup's spec, "" none). The server checks each against the rules. `beam` (Moo's Moonbeam, asked with
   * `beam`): the crowd's top moves after his move, best first (beamLines); the server checks each. `balloon` (the circus
   * tiger's, asked with `balloon`): the square his balloon lands on after his move (landFrom); the server checks it. `hoops`
   * (the circus tiger's, asked with `hoops`): the cast after his move, its blocks by their corners in throw order
   * (hoopsAnswer's, "c3 f5 b6"; "" none); the server checks it (hoopsCheck). `crease` (Folio's, asked with `crease`): the
   * Crease's line after his move (creaseAnswer's, "d|e" or "4|5"; "" none); the server checks it (creaseCheck).
   */
  | { t: "bossMove"; key: string; move: string; drag?: string; showdown?: string; outside?: boolean; beam?: string[]; balloon?: string; hoops?: string; crease?: string }
  /** Leaving before the match starts (Cancel in the queue): the seat is freed. */
  | { t: "leave" }
  /**
   * Resign: this player leaves the match for good (settings.ts, LEAVING). Mid-match it's a loss, out in the last place
   * still open, and a bot plays the seat; before move 1, just Leave; already out, they go with their result as it
   * stands. The server answers "resigned" and closes the socket. (An app from before Oct 13 never sends it: it just
   * goes, and the away rule, LEAVING.awayMs, does the same for it.)
   */
  | { t: "resign" }
  /** Quick chat: say a line (a phrase or emoji id) to your team or, for Hello and Sporting lines and emoji, to everyone. */
  | { t: "chat"; say: string; to?: "team" | "all" }
  /**
   * Quick chat, this device's choices: chat off (nothing is sent to it, and it can't send), and the players muted
   * for this match (their lines aren't sent to it).
   */
  | { t: "chatPrefs"; off?: boolean; muted?: string[] }
  /** Many judges: this device's engine speed (nodes per second), from its speed check on joining. */
  | { t: "speed"; nps: number }
  /** Many judges: this device's answer to one scoring job. */
  | { t: "judged"; key: string; id: string; report: JudgeReport }
  /** Many judges, deep checks: this device's re-check of the job's close calls (sent after its "judged"). */
  | { t: "judgedDeep"; key: string; id: string; deep: MoveScore[] }
  /** Boss battle, admins only (testing): bring the boss's ultimate as the next crowd turn begins. */
  | { t: "ultimate" }
  /**
   * Hollow's dark: a move attempt that touches a dark square, sent unchecked (the app can't show what's there). The
   * server judges it: a legal move is this player's pick; an illegal one costs points and they pick again.
   */
  | { t: "darkTry"; key: string; move: string; away?: number }
  /** Hollow's Lights out: this player taps a square in round `round` (0-based). */
  | { t: "lightsTap"; key: string; round: number; square: string };

/** Why a lobby closed (see LOBBY_LIFE in settings.ts). */
export type LobbyCloseReason = "ended" | "idle" | "abandoned";

/**
 * How someone left a match (LEAVING in settings.ts): they resigned; they were gone longer than LEAVING.awayMs ("away",
 * counted as resigning); they left before move 1 ("early": nothing recorded); or they left after they were already
 * out ("out": their result as it stands, recorded when the match ends).
 */
/** `kicked`: a Boss Battle party's AFK kick (the leader's, or a teammate's who had picked). */
export type LeftHow = "resigned" | "away" | "early" | "out" | "kicked";

/**
 * Someone who left: how, and their result as it was recorded then (`placement` of `players`; a loss unless they were
 * already out). Null result: nothing recorded (before move 1), or not yet (already out: it's recorded with everyone's).
 */
export interface NetLeft {
  how: LeftHow;
  result: { placement: number; players: number; ranked: boolean } | null;
}

/** A battle on the Maia brain, as the lobby tells the host's device (bossBrainFor's plan). */
export interface NetBossBrain {
  brain: BossBrain;
  rating: number;
  /** The bridge band's share of moves that are today's Stockfish move. */
  stockfishShare?: number;
}

export type ServerMessage = { now: number } & (
  | { t: "welcome"; playerId: string; token: string; code: string }
  | {
      t: "lobby";
      players: LobbyPlayer[];
      hostId: string | null;
      started: boolean;
      lobbySize: number;
      /** Matchmade ("Play now"): no host start; the match starts when full or at `fillAt` (server time), bots filling the rest. */
      auto?: boolean;
      fillAt?: number | null;
      /** Matchmade, Bots off: no bots; it waits until it's full (a raid: or `fillAt` with enough people). */
      botsOff?: true;
      /** Matchmade: the seats were filled then (bots in the empty ones); the match begins a moment later. */
      filledAt?: number;
      /** A Boss Battle party's battle: each member's seat (player id → seat: their color), and its leader now. */
      party?: { seats: Record<string, number>; leader: string | null };
    }
  /**
   * Can't join (or play on). `ended`: the match is over (or long gone), so the app goes home with a note. `banned`:
   * the account is banned for fair play (the app shows the ban notice and its appeal). `left`: this seat left the
   * match (resigned, or gone longer than LEAVING.awayMs), and how: the app goes home with its own note.
   */
  | { t: "error"; message: string; ended?: true; banned?: true; left?: NetLeft }
  /**
   * The lobby is closing: its results have been up long enough (`ended`), it never started and nothing happened in it
   * for a long time (`idle`), or nobody had been in its match for hours (`abandoned`). The socket closes next, and
   * the lobby's code is free again. The app goes home with a note.
   */
  | { t: "closed"; reason: LobbyCloseReason }
  /** The answer to "resign": you've left the match (how, and your result as recorded). The socket closes next. */
  | ({ t: "resigned" } & NetLeft)
  | { t: "opening"; boards: NetBoard[]; until: number }
  | {
      t: "round";
      key: string;
      stage: number;
      round: number;
      /** When the move clock starts (after the new board's settling-in countdown). */
      startsAt: number;
      /** This player's deadline (from their own time bank). */
      deadline: number;
      board: NetBoard | null;
      standings: NetStanding[];
      cutoff: number;
      alive: boolean;
      /** When each bot finishes thinking (ms after the round starts), for the leaderboard's "done" marks. */
      botsDoneIn: Record<string, number>;
      slots: BoardSlot[];
      /** Crowd 50 v 50: the other team is choosing; this player watches (`board` is still sent). */
      watching?: boolean;
      /** The move clock this round (seconds), which augment votes can change. */
      moveClock?: number;
      /**
       * The seconds added to every bank at the start of this move: the time control's increment (Crowd 50 v 50's clock
       * vote sets it), for the bank the screen runs down. Optional: an older server doesn't send it.
       */
      increment?: number;
      /** Boss battle: the battle as it stands (the God King's charges, a Last Stand's barred move). */
      boss?: NetBoss;
    }
  /** A human has made their move this round (sent to everyone, for the leaderboard). */
  | { t: "moved"; key: string; playerId: string }
  | { t: "locked"; key: string }
  /**
   * Many judges: scoring jobs for this device (positions and picks, no names). Answer each with "judged". A job
   * with `referee` is a second opinion after two judges disagreed (it doesn't hold up the round).
   */
  | { t: "judge"; key: string; jobs: JudgeJob[] }
  /** `serverRecheck`: the engine server re-checks the close calls, so the host skips its own re-check. */
  | { t: "scoreRequest"; key: string; jobs: ScoreJob[]; serverRecheck?: boolean }
  /** To the host at the start of a round: every board, so it can search them while players think. */
  | {
      t: "prefetch";
      fens: string[];
      /** Crowd: the bots picking this round, so the host can decide their picks now (sent back as botPlan). */
      plan?: {
        key: string;
        fen: string;
        bots: { id: string; skill: number; powerUps: number }[];
        barred?: string;
        /** Boss battle, a power limits the crowd's moves: the bots pick from these. */
        allowed?: string[];
        /** Boss battle, G-REX's fire: the tiles ablaze (the bots count a piece left there as gone). */
        burn?: string[];
        /** Boss battle, Chub & Chirp's Carrot Patch: the race (the bots pick with it counted). */
        race?: CarrotRace;
        /** Many judges: the bots pick from this seed and these rules (judgeBotPicks), so the scoring job agrees. */
        seed?: number;
        rules?: JudgeRules;
      };
    }
  /** Crowd: the picks so far (bots appear at their thinking time), to players who've picked and to the watching team. */
  | { t: "tally"; key: string; picks: LivePick[] }
  /**
   * Boss battle: calls for the King's strike so far this move, and how many it takes (more than half the crowd).
   * When he strikes, `at` to `until` is the strike on screen: the move clock stands still and `deadline` is this
   * player's new deadline, pushed back by that long.
   */
  | { t: "strike"; key: string; calls: number; needed: number; at?: number; until?: number; deadline?: number }
  | {
      t: "reveal";
      key: string;
      stage: number;
      roundsPlayed: number;
      board: NetBoard | null;
      fenBefore: string | null;
      bestMove: string | null;
      playedMove: string | null;
      picks: NetPick[];
      /** How the played move was chosen from the group's picks. */
      drawRule: DrawRule;
      /** Crowd 50 v 50: a rare brilliant find, for the shoutout (GroupResult.brilliant). */
      brilliant?: { moves: string[]; players: string[] };
      /** Boss battle: the King played the move, and how many called him; or he struck the boss. */
      king?: boolean;
      kingCalls?: number;
      /**
       * Boss battle: the God King's Last Stand on this move. The played move is shown, then taken back (it isn't on
       * `board`); the clock stands still through it (lastStandMs, already in `until`), then the crowd picks again.
       */
      lastStand?: LastStandRound;
      /** Boss battle: the battle after this move (his charges, whether he has fallen). */
      boss?: NetBoss;
      /** Scored by two judges (and the engine server where they disagreed): no cross-check needed. */
      judged?: true;
      /** For the cross-check: the group's evaluation as the host computed it. */
      expectedAfter: Record<string, number>;
      bestExpected: number | null;
      standings: NetStanding[];
      cutoff: number;
      until: number;
      /** Every board after this round's moves. */
      slots: BoardSlot[];
    }
  | {
      t: "stageBreak";
      stage: number;
      standings: NetStanding[];
      knockedOut: string[];
      cutoff: number;
      nextBoards: NetBoard[];
      until: number;
      placements: Record<string, number>;
      slots: BoardSlot[];
      /** Crowd: players may vote on the next round's move clock until `until`. */
      augments?: boolean;
      moveClock?: number;
    }
  | { t: "spectate"; boards: NetBoard[]; standings: NetStanding[]; stage: number; round: number; slots: BoardSlot[] }
  /** The final's state, sent to everyone after each move and when a new turn starts. */
  | { t: "final"; final: NetFinal; standings: NetStanding[]; slots: BoardSlot[] }
  /** A pre-game vote: sent when it opens (with the bots' votes and their moments) and with its result. */
  | { t: "vote"; vote: NetVote; standings: NetStanding[] }
  /** A human's vote in the open vote. */
  | { t: "voteCast"; key: string; playerId: string; option: number; at: number; side: "w" | "b" }
  /**
   * Boss battle: the boss's move or strike (`until`: when the next crowd move starts). `fall`: beaten, a boss with a fall
   * (the Hidden Boss, BossRules.fallMs) collapses on the board until `until`, then the results come (an older app shows
   * the board with the result in it meanwhile).
   */
  | { t: "boss"; boss: NetBoss; standings: NetStanding[]; until: number; thinking?: boolean; intro?: boolean; fall?: boolean }
  /**
   * Hollow's dark, to the player who tried: `ok` the attempt was legal and is their pick (`move`, as played); else it
   * cost darkTryCost (`tries` wrong so far this turn) and they pick again, or (`out`) their turn is over, as a miss.
   * `refused`: not judged (it didn't touch the dark), nothing lost.
   */
  | { t: "darkTry"; key: string; move: string; ok: boolean; tries?: number; out?: boolean; refused?: boolean }
  /** Hollow's Lights out: as it begins, at each round's end (the answers) and on each of this player's taps. */
  | { t: "lights"; lights: NetLightsOut; boss: NetBoss; standings: NetStanding[] }
  /** Lights out: the crowd's count, to everyone, as anyone's tap changes it (the round's end sends it in `lights`). */
  | { t: "lightsCrowd"; key: string; crowd: NonNullable<NetLightsOut["crowd"]> }
  /** To the host: play the boss's move. */
  | {
      t: "bossRequest";
      key: string;
      fen: string;
      elo: number;
      nodes: number;
      stumble?: boolean;
      stagger?: boolean;
      /**
       * A power's follow-up its engine search scored (Wrangler's reply to the showdown's duel): the engine's best move at
       * full strength (bossMoveFrom's "best"), never the brain's nor a slip; no `brain` is sent with it.
       */
      best?: boolean;
      /** A boss power limits the boss's moves (a pie): play one of these. */
      allowed?: string[];
      /** Boingo's funhouse: play the crowd's move for it, a weak but recoverable one (funhouseMoveFrom) from `allowed`. */
      funhouse?: boolean;
      /** Hollow's extra move (a failed Lights out): a quiet one within the cap (extraMoveFrom); "" if there's none. */
      extra?: boolean;
      /**
       * Big Boy's Big Bounce: score these candidate positions (him to move) and answer with the one picked (bounceFrom),
       * as `move`; "" when none is within the cap (nothing moves).
       */
      bounce?: string[];
      /** The boss's own move on the Maia brain (BOSS_BRAIN): with Maia, at this rating (the lobby decides, once a battle). */
      brain?: NetBossBrain;
      /**
       * Wrangler's turn (BossAsks): his long pulls to choose from (his first move: answer one of them as `move`, or an
       * ordinary move), his showdown's line-up after his move (`showdown`: "try", one that qualifies, else ""; "test",
       * the admins' trigger: the best found even outside the band, answered with `outside`, or a stand-in drag), a lasso
       * drag after it when no showdown comes (`drag`); `seed` orders the engine's candidates (never the battle's own seed).
       */
      pull?: string[];
      drag?: true;
      showdown?: "try" | "test";
      seed?: number;
      /**
       * Alfil's Tusks: positions with an elephant, the crowd to move (the fusion is his move): for his fusion, the
       * elephant on each square allowed; for his cast (before his move), each pair's ways to go as if it fused now.
       * Answer the one picked (fuseFrom: the one best for him) as `move`, or "" (no engine: the fusion's first square,
       * the cast's first pair). An older app ignores it and plays a move, which isn't one of these: the same as "".
       */
      fuse?: string[];
      /**
       * Alfil's Mammoth Slam: the candidate lifts (him to move, the crowd's pieces up); answer the one picked (slamFrom:
       * the turns played out, the swing within the cap) as `move`, or "" when none is (nothing lifts).
       */
      slam?: string[];
      /**
       * Alfil's Slam's pieces in the air (each one's letter and own square) land as the crowd's turn after this move, or
       * this fusion, begins: judge it with them down (the landing guard: bossMoveFrom's `ahead`, fuseFrom's, from
       * slamAhead; for the fusion landingAhead, on the position before it too; the moves still come from `fen`). Sent
       * with his move and his fusion only. An older app ignores it and judges on `fen` alone, as before.
       */
      land?: SlamPiece[];
      /**
       * Chub & Chirp's Leapfrog (id hopper): the positions after each hop he could make now (his pawn over the crowd's,
       * him still to move: the hop comes before his move). Answer the one picked (hopFrom: the one best for him) as
       * `move`, or "" (no engine: the first). An older app ignores it and plays a move, which isn't one of these: the
       * same as "".
       */
      hop?: string[];
      /**
       * The step spends his whole turn: Alfil's fusion (with `fuse`, its squares) or Chub & Chirp's Carrot Patch cast
       * (alone: the turn passed, passTurn of `fen`). The pass guard (passLoses; docs/decisions/2026-10-18-turn-passing-guard.md):
       * answer PASS_WAIT ("wait") when even the best way it can go loses real material against his move; then it waits
       * and he plays his move (asked for anew). Else the fusion's square as ever, or for the cast anything else ("": it
       * comes). An older app ignores it: the fusion as before, and for the cast a move of his, which isn't "wait": it comes.
       */
      pass?: true;
      /**
       * Chub & Chirp's Carrot Patch (id hopper), his ordinary move in the race: the race as his brain weighs it (the
       * carrots still in the ground, his count, the moves left, how much the race weighs at his strength). Play his move
       * through the race brain (bossMoveFrom's `race`: raceGuard, at BOSS_POWERS.carrotNodes on carrotLooks of his top
       * moves). An older app ignores it and plays his move without it: he races worse, nothing breaks.
       */
      race?: CarrotRace;
      /**
       * Smudgy's Repaint (his whole turn): the positions after each pair he could paint (the crowd to move). Answer the one
       * picked (repaintFrom: within BOSS_POWERS.repaintBand, the nearest repaintTarget) as `move`, or "" when none is (no
       * Repaint this turn: his move is asked for next). `repaintAny`: the test switch or the admins' trigger, the nearest
       * even outside the band. An older app ignores it and plays a move, which isn't one of these: the same as "".
       */
      repaint?: string[];
      repaintAny?: true;
      /**
       * The hippo gardener's watering (his whole turn): what the seeds rolled, the plain plants on the board, the order the
       * squares are tried in. Answer the placement as `move` (waterAnswer: waterFrom's, as its letters and squares, "none"
       * for nothing at all; PASS_WAIT when passing would lose real material, unless `waterAny`: the test switch or the
       * admins' trigger; "" with no engine). The server checks it (waterCheck). An older app ignores it and plays a move,
       * which isn't a placement: the watering waits for his next turn.
       */
      water?: WaterAsk;
      waterAny?: true;
      /**
       * The circus tiger's hoops are due after this move (he keeps his turn): the order the blocks are tried in. Play his
       * move as ever, then answer the cast as the move's `hoops` (hoopsAnswer, on the position after his move: hoopsFrom's
       * blocks by their corners in throw order, "c3 f5 b6"; "" with no engine or no block that fits). The server checks it
       * (hoopsCheck). An older app ignores it and sends his move alone: the hoops wait for his next move.
       */
      hoops?: HoopsAsk;
      /**
       * Folio's Crease is wanted with this move (its warning, or the admins' trigger, as the crowd's next turn begins): the
       * order ties are broken in. Play its move as ever, then answer the line as the move's `crease` (creaseAnswer, on the
       * position after the move: the line costing the crowd nearest the band's middle; "" with no engine or none allowed).
       * The server checks it (creaseCheck). An older app ignores it and sends the move alone: the warning waits for its
       * next move.
       */
      crease?: CreaseAsk;
      /**
       * The circus tiger's balloon is due at the end of this turn: where it lands (landFrom, on the position after his move,
       * with the cast's hoops when `hoops` is asked too: hoopsAnswer), answered as the move's `balloon`. Asked the same for a
       * balloon that will pop: nothing here says which. An older app ignores it: the balloon waits ready for his next turn.
       */
      balloon?: BalloonAsk;
      /**
       * Moo & Moon's Moonbeam (or his Full Moon's flurry) lands after this move: list the crowd's top this-many moves in
       * the position after it (beamLines, at BOSS_POWERS.moonbeamNodes) as the answer's `beam`. An older app ignores it:
       * the beams then take the crowd's pieces by value (the server's own fallback).
       */
      beam?: number;
    }
  /**
   * The boss's brain for this battle, to the host as the battle begins (on the Maia brain only): it starts loading
   * Maia during the intro, so the first move can be Maia's.
   */
  | { t: "bossBrain"; brain: NetBossBrain }
  /** Quick chat: a line for you (your own included, echoed back). */
  | { t: "chat"; line: NetChatLine }
  /**
   * Quick chat, on joining (or rejoining) a lobby or a match, and as the match begins: the recent lines you can see,
   * and the chat packs the server knows you own (the buttons to show).
   */
  | { t: "chatLog"; lines: NetChatLine[]; packs: string[] }
  /**
   * Quick chat: your line was dropped; `retryAt` (server time) is when it (or anything, for the gap and burst limits)
   * could go. `block`: your chat ban (reason "mod").
   */
  | { t: "chatNo"; say: string; reason: ChatRefusal; retryAt: number; block?: ChatBlock }
  | {
      t: "results";
      placements: Record<string, number>;
      winner: string;
      lossesByStage: Record<string, number[][]>;
      /** The final leaderboard (ratings, time, power-ups), for the results screen. */
      standings: NetStanding[];
      /** Crowd: who won the game on the board (the side that mated, or the side clearly ahead), null for a draw. */
      gameWinner?: "w" | "b" | null;
      /** Boss battle: who won it. */
      bossResult?: "crowd" | "boss" | "draw";
      /** Boss battle: the boss won on time (the Hidden Boss's bullet clock ran out). Missing: not on time, or an older server. */
      timeout?: boolean;
      /** Boss battle: the boss won by his last carrot (Chub & Chirp's Carrot Patch). Missing: not so, or an older server. */
      carrots?: boolean;
      /** It counted for ranking (real players filled at least RANKING.rankedMinHumanShare of the seats). Missing: an older server. */
      ranked?: boolean;
    }
);
