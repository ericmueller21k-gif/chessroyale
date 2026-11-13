/**
 * The FAQ ("How HunChess works"), opened from Settings. Its words live here, one entry per section, in the small
 * Markdown-like format of `markdown.ts`; the screen (`screens/Faq.tsx`) draws them and builds the table of contents.
 *
 * Keeping it true:
 * - **Every number comes from the game's own settings** (the `FaqSources` below), never typed in, so a tuned setting
 *   changes the FAQ with it. A test builds the FAQ from changed settings and checks the words follow
 *   (`packages/app/test/faq.test.ts`).
 * - **A rule that changes changes its words here too**, in the same PR (docs/areas/hub.md, "The FAQ"). Every playable
 *   boss needs its block in `BOSS_BLOCKS` (a test fails without one).
 * - **Only how the game works for a player.** Never how the app talks to the server (messages, routes, who computes
 *   what), limits, secrets, admin or test controls, or how cheating is detected.
 * - Something built but not yet on for players is marked "Being tested"; something only planned, "Planned".
 */
import {
  BOT_LEVELS,
  CROWD_PARTY_MAX,
  BOSS_BRAIN,
  BOSS_CLOCK,
  BOSS_CRATES,
  BOSS_CRATE_PRICE,
  BOSS_TOKENS,
  XP,
  QUESTS,
  BOSS_PARTY,
  HIDDEN_ROOM,
  BOSS_DIFFICULTY,
  BOSS_LEVEL,
  BOSS_POWERS,
  BOSS_ROSTER,
  BOSS_TIERS,
  BRILLIANT,
  CRATES,
  CROWD_KNOCKOUTS,
  CROWD_SETTINGS,
  DEFAULT_SETTINGS,
  ENGINE_MIN_ELO,
  ITEM_COLORS,
  LEAVES,
  LEAVING,
  OPENING_ALLOWANCE,
  CROWD_SCORING,
  type CrowdScoring,
  type CrowdMisses,
  PREGAME_VOTES,
  PRIOR_RATING,
  PURITY_BANDS,
  RAID_SETTINGS,
  RANKED_1V1,
  RANKING,
  RECLUSE_CHILD,
  RECLUSE_PHASE2,
  GLOBAL_CHAT,
  TOWN_CHAT,
  TOWN_AFK,
  RATING_MIN_MOVES,
  SQUADS,
  SQUADS_LOBBY,
  TIERS,
  bossBrainFor,
  bossInText,
  bossStrength,
  bossStumbleChance,
  crowdFinalBoss,
  crowdFinalists,
  fixedLevel,
  isPlayable,
  adminFirst,
  maiaTopRating,
  rankedMinHumans,
  roundsInStage,
  kingCharges,
  lastStandBar,
  liveStrip,
  tierItems,
  itemDef,
  maiaRatingFor,
  scoreGroup,
  type BossBrainSettings,
  type BossCrateDef,
  type BossDef,
  type BossPowerSettings,
  type CrateDef,
  type FinalFormat,
  type PregameVote,
  type Settings,
  type SquadsSettings,
  controlLabel,
  rankView,
  divisionsEnd,
  emblemId,
  votedControl,
  zoneControl,
} from "@chessroyale/core";
import { clockLabel, defaultClock, minutesName } from "@chessroyale/chess/squads";
import { anchorsOf, parse, plainText, type Block } from "./markdown.ts";
import { JUMP_NEXT_LABEL } from "../squads-view.ts";
import { REFUSED } from "../refused.ts";
import { averageWorth, oddsWords } from "../carrot-race.ts";

/** Everything the FAQ quotes. The defaults are the game's; tests pass changed ones. */
export interface FaqSources {
  settings: Settings;
  crowd: Settings;
  raid: Settings;
  crowdKnockouts: Readonly<Record<FinalFormat, readonly number[]>>;
  powers: BossPowerSettings;
  brain: BossBrainSettings;
  difficulty: readonly { id: string; label: string; elo: number; maia: number }[];
  /** The level in a boss's bar: its rating's divisor, how far a battle's draw moves it, its top, how far a weakened move drops it. */
  level: { divisor: number; spread: number; max: number; weakDrop: number };
  tiers: readonly number[];
  roster: readonly BossDef[];
  engineMinElo: number;
  brilliant: { minPickers: number; nearBest: number; maxShare: number; minGap: number };
  priorRating: number;
  ratingMinMoves: number;
  rankedShare: number;
  crates: readonly CrateDef[];
  /** Boss crates (sold in the bosses' shops for their tokens), boss tokens' rules and a boss crate's price. */
  bossCrates: readonly BossCrateDef[];
  bossTokens: typeof BOSS_TOKENS;
  xp: typeof XP;
  /** Quests (Nov 9, phase 3): how many, the carry-over, the reroll, the pool. */
  quests: typeof QUESTS;
  bossCratePrice: typeof BOSS_CRATE_PRICE;
  colors: readonly { id: string; name: string; weight: number }[];
  purity: readonly { low: number; high: number; weight: number }[];
  itemTiers: readonly { id: string; name: string }[];
  squads: SquadsSettings;
  /** Crowd 50 v 50's clock vote: its time controls (each option's patch has the bank, increment and cap) and default. */
  clockVote: Pick<PregameVote, "options" | "defaultOption">;
  /** Crowd 50 v 50's start vote ("How does it start?"): its options (each patch has the start and its opening moves) and default. */
  startVote: Pick<PregameVote, "options" | "defaultOption">;
  /** Resigning and leaving: how long someone may be gone from a match and still have their seat. */
  leaving: { awayMs: number };
  /** Squads' "Jump to my next board" (Relay): on for a device that hasn't set it. */
  squadsWatching: { jumpToNext: boolean };
  /** The Hidden Boss's second phase (the Crowd's boss final, solo): its boards, clock and ultimate. */
  phase2: typeof RECLUSE_PHASE2;
  /** The opening allowance: points off each early move's loss, through which move, gone by which, the material bar. */
  allowance: { points: number; flatThrough: number; goneBy: number; materialPawns: number };
  /** Ranked 1 v 1: the time controls and their vote, the game's timings, the ladder, rank points, placements, coins. */
  ranked: typeof RANKED_1V1;
  /** Ranked's leave rules (L1): dodges, leaves, the lockouts and the delayed queue. */
  leaves: typeof LEAVES;
  /** Crowd 50 v 50's scoring: the soft limit by stage, pieces hung, shared blunders, streaks, rare finds, the bubble. */
  crowdScoring: CrowdScoring;
}

export const FAQ_DEFAULTS: FaqSources = {
  settings: DEFAULT_SETTINGS,
  crowd: { ...DEFAULT_SETTINGS, ...CROWD_SETTINGS },
  raid: { ...DEFAULT_SETTINGS, ...RAID_SETTINGS },
  crowdKnockouts: CROWD_KNOCKOUTS,
  powers: BOSS_POWERS,
  brain: BOSS_BRAIN,
  difficulty: BOSS_DIFFICULTY,
  level: BOSS_LEVEL,
  tiers: BOSS_TIERS,
  roster: BOSS_ROSTER,
  engineMinElo: ENGINE_MIN_ELO,
  brilliant: BRILLIANT,
  priorRating: PRIOR_RATING,
  ratingMinMoves: RATING_MIN_MOVES,
  rankedShare: RANKING.rankedMinHumanShare,
  crates: CRATES,
  // (Not the crate of a boss in the game for admins first, Timber's: his block shows once he's live for everyone.)
  bossCrates: BOSS_CRATES.filter((c) => !adminFirst({ id: c.boss })),
  bossTokens: BOSS_TOKENS,
  xp: XP,
  quests: QUESTS,
  bossCratePrice: BOSS_CRATE_PRICE,
  colors: ITEM_COLORS,
  purity: PURITY_BANDS,
  itemTiers: TIERS,
  squads: SQUADS,
  clockVote: PREGAME_VOTES.find((v) => v.id === "speed")!,
  startVote: PREGAME_VOTES.find((v) => v.id === "start")!,
  leaving: LEAVING,
  squadsWatching: SQUADS_LOBBY.watching,
  phase2: RECLUSE_PHASE2,
  allowance: OPENING_ALLOWANCE,
  ranked: RANKED_1V1,
  leaves: LEAVES,
  crowdScoring: CROWD_SCORING,
};

// ---------------- Numbers as words ----------------

/** A number as players read it: thousands separated, at most `dp` decimals, no trailing zeros. */
export const num = (x: number, dp = 2) => {
  const r = Number(x.toFixed(dp));
  const [i, f] = String(Math.abs(r)).split(".");
  const whole = Math.abs(r) >= 10_000 ? i!.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : i!;
  return `${r < 0 ? "−" : ""}${whole}${f ? `.${f}` : ""}`;
};
/** A share (0-1) as a percentage. */
export const pct = (x: number, dp = 1) => `${num(x * 100, dp)}%`;
/** A score change with its sign (+10, −22). */
const signed = (x: number) => (x > 0 ? `+${num(x)}` : num(x));
/** A term in a sum ("+ 250", "− 100"). */
const term = (x: number) => (x < 0 ? `− ${num(-x)}` : `+ ${num(x)}`);
/** An expected score as the eval reads it (0.30, not 0.3). */
const es = (x: number) => x.toFixed(2);
/** "1 turn", "3 turns". */
const n = (x: number, word: string, plural = `${word}s`) => `${num(x)} ${x === 1 ? word : plural}`;
/** "a to b" for a range. */
const range = (r: readonly [number, number] | readonly number[], unit = "") => `${num(r[0]!)}${unit} to ${num(r[1]!)}${unit}`;
const ordinal = (x: number) => `${x}${x % 100 >= 11 && x % 100 <= 13 ? "th" : (["th", "st", "nd", "rd"][x % 10] ?? "th")}`;
const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);
const logit = (p: number) => Math.log(p / (1 - p));
/** The usual rating formula: the expected score of a player `d` points stronger. */
export const eloExpected = (d: number) => 1 / (1 + 10 ** (-d / 400));

// ---------------- The sections ----------------

export interface FaqSection {
  id: string;
  title: string;
  /** Its sub-headings go in the table of contents too. */
  tocSubs?: boolean;
  body: string;
}

function modes(src: FaqSources): FaqSection {
  const C = src.crowd;
  const R = src.raid;
  const S = src.settings;
  const Q = src.squads;
  const team = C.lobbySize / 2;
  const left = (k: readonly number[]) => C.lobbySize - sum(k);
  // The clock vote's time controls: "Bullet 3+2 (3 minutes, +2 s a move, at most 10 s on a move)".
  const V = src.clockVote;
  const timeControl = (p: Partial<Settings>) => `${n(Number(p.timeBankSeconds) / 60, "minute")}, +${num(Number(p.timeIncrementSeconds))} s a move, at most ${num(Number(p.moveClockSeconds))} s on a move`;
  const timeControls = V.options.map((o) => `**${o.label}** (${timeControl(o.patch)})`);
  // A mode's own clock by the vote's name for it ("Rapid 10+5"), or in full if no option matches.
  const namedClock = (p: Settings) => {
    const o = V.options.find((x) => x.patch.timeBankSeconds === p.timeBankSeconds && x.patch.timeIncrementSeconds === p.timeIncrementSeconds && x.patch.moveClockSeconds === p.moveClockSeconds);
    return o ? `**${o.label}**` : timeControl(p);
  };
  const teamSizes = S.teamFinalSizes.map((x) => `${x}v${x}`);
  // The cuts (CROWD_KNOCKOUTS, CROWD_STAGE_ROUNDS): how many go at each and after which move the teams play (a stage's
  // rounds are plies, one move from each team). The team final's cuts, then the ones the boss final and the duel add.
  const cutAfter = (i: number) => Math.ceil(sum(Array.from({ length: i + 1 }, (_, j) => roundsInStage(C, j))) / 2);
  const andList = (xs: readonly string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}` : (xs[0] ?? ""));
  const TK = src.crowdKnockouts.team;
  const cutsFrom = (f: FinalFormat, from: number) => andList(src.crowdKnockouts[f].slice(from).map((k, i) => `${k} after move ${cutAfter(from + i)}`));
  // The start vote's options by their id (their labels and opening moves from the vote's data).
  const SV = src.startVote;
  const startBy = (id: string) => SV.options.find((o) => o.patch.crowdStart === id);
  const startLabel = (id: string) => `**${startBy(id)?.label ?? id}**`;
  const randomMoves = Number(startBy("random")?.patch.openingMoves ?? 0);
  const clocks = squadsClocks(Q);
  // The boss final's boss (Eric, Oct 14: always the Hidden Boss), by his roster name, linked to his block.
  const finalBoss = crowdFinalBoss(src.roster);
  const finalFoe = finalBoss ? `[${bossInText(finalBoss.name, false, src.roster)}](#boss-${finalBoss.id})` : "a boss, with the God King";
  return {
    id: "modes",
    title: "The modes",
    body: `
### Crowd · 50 v 50 {#mode-crowd}

- **${C.lobbySize} players, one game of chess**, from the first move. Two teams of ${team}: your team plays White or Black all game.
- Each turn, everyone on the side to move picks a move before the clock runs out, and **one of the ${n(C.crowdPlayedFromTop, "most popular pick")} is played**, drawn by how many picked each: if 30 pick one move, 15 another and 5 a third, they're played 60%, 30% and 10% of the time. Moves tied for the last of those places are left out. So the crowd's favorite usually plays, but not always.${C.crowdSureShare < 1 ? ` **A big majority always wins:** a move ${pct(C.crowdSureShare, 0)} or more of the team picked is always played, even a blunder (of 10 picks, ${Math.ceil(C.crowdSureShare * 10 - 1e-9)} on one move always play it; ${Math.ceil(C.crowdSureShare * 10 - 1e-9) - 1} on it can still lose to another).` : ""}${C.crowdMisses ? ` Pick nothing and a move is picked for you, one of the engine's top ${C.crowdMisses.defaultFromTop}, but it doesn't count in the vote ([a missed move](#crowd-scoring)).` : ""}
- Every pick is scored (see [How your moves are scored](#scoring)). No one goes out for the first ${n(cutAfter(0), "move")}. Then the lowest scorers are cut, the same number from each team: ${cutsFrom("team", 0)}, which leaves ${left(TK)} for the team final. A boss final adds ${n(src.crowdKnockouts.boss.length - TK.length, "more cut")} (${cutsFrom("boss", TK.length)}); a duel adds ${n(src.crowdKnockouts.duel.length - TK.length, "more cut")} (${cutsFrom("duel", TK.length)}). The moves count from the first one the teams play (a Random opening's own moves don't count). Scores carry over all game.
- **A tie at the cut line goes through:** everyone tied exactly with the last player through stays in, and the cuts still to come take the extra, a little at each. So does anyone within ${n(src.crowdScoring.cutGrace, "point")} of that player ([the bubble](#crowd-scoring)). Only the last cut before the ending breaks a tie, so the ending has its size: fewer points given away before the [opening allowance](#opening-allowance) go through, then less thinking time.
- **You vote on the ending** before move 1: a team final (the top ${left(src.crowdKnockouts.team)} play on: ${teamSizes.slice(0, -1).join(", ")}, then ${teamSizes.at(-1)} to the end), a boss final (the top ${left(src.crowdKnockouts.boss)} team up against ${finalFoe}) or a duel (the best of each side, 1v1). Then on how it starts, then on the clock.
- **How it starts**, voted on before move 1: ${startLabel("normal")}, the usual starting position; ${startLabel("random")}, a real, balanced opening already ${n(randomMoves, "move")} in for each side, so the game picks up at move ${randomMoves + 1}; or ${startLabel("freestyle")}: the pieces on the back row start shuffled, the same for both sides and different every game. To castle in Freestyle, move your king onto its rook: the king lands on the g- or c-file with the rook beside it, as usual. Nobody voting means ${SV.options[SV.defaultOption]?.label}. Both teams play from that start; a boss final is played from the usual starting position.
- **The clock is a chess time control**, voted on before move 1: ${timeControls.slice(0, -1).join(", ")} or ${timeControls.at(-1)}. Nobody voting means ${V.options[V.defaultOption]?.label}. Your minutes last the whole game, and each of your moves adds its seconds as it starts; the time you take comes out of your bank, so what a quick move doesn't use is saved for later, as on a chess clock. No move can go past its cap, because your whole team picks together; with an empty bank you still get the added seconds. Your bank is beside the board's clock and in the scoreboard's Bank column. A group Boss Battle is ${namedClock(R)}.
- **${n(C.powerUpsAtStart, "power-up")}** each: a power-up shows the engine's top 3 moves for that turn.
- How you play, under the modes on the home screen: **Solo queue** puts you in a lobby, with bots filling empty seats after a short wait; **Party** (coming soon) will queue you with up to ${CROWD_PARTY_MAX - 1} friends into the same matchmaking (sides drawn at random); **Bots** is you and ${C.lobbySize - 1} bots, at once, at the level you pick: ${BOT_LEVELS.filter((l) => l.mean !== null).map((l) => `${l.label} (about ${l.mean})`).join(", ")}, My level (about your rating) or Random (every bot's rating random). A level is the bots' average: each bot is a few hundred points either side of it.
- **Bots are a lobby of players.** Each bot has its own rating, the same every match (most between 800 and 1500, a few above or below), and picks from the engine's moves about as loosely as a player of that rating would.

### Boss Battle {#mode-boss}

- **A group Boss Battle:** up to ${R.lobbySize} players pick the crowd's moves together against a [boss](#boss-brain); the most popular pick is played. Every boss starts from the starting position.
- **Where:** **Boss Battle** on the home screen. The bosses are at the top: tap one to see it on the stage below, with you and, behind you, two spots for friends (tap one to invite them), or **?** for a random one. Under the boss's name, the arrows pick its difficulty (${src.difficulty.length} levels, shown by the dots), and **START** meets the boss you picked. Group Boss Battles (**Join a Boss Battle**, **People only**, **Play with bots** and **Play with friends**) are moving to Chess Town's Colosseum and aren't on the home screen for now.
- **Scoring:** the [50 v 50 way](#raid-scoring), its limit widening with the crowd's moves (Boss alone scores as before).
- **The boss strikes:** every ${n(S.bossKillEvery, "crowd move")} in a group battle it knocks out the player who gave away the most points since its last strike (as the judge counts them, before the [scoring's limit](#raid-scoring), after the [opening allowance](#opening-allowance); a missed move counts as ${n(S.finalMissLoss, "point")}, and a tie goes against the weaker player over the match), until half the group is left${finalBoss ? "" : ` (in the Crowd's boss final, until ${S.bossMinSurvivors} are left)`}. If two are still tied for the worst, nobody is struck: it strikes after the next crowd move instead.
- **The God King** fights on your side, with ${n(S.kingChargesMax, "charge")} ([more on him](#god-king)).
- The battle ends in checkmate or a draw, or after ${n(S.bossMaxMoves, "crowd move")}, when the engine judges the position.
- **With friends** (up to ${BOSS_PARTY.max} of you): invite them from the spots behind you. The leader (with the crown) picks the boss and the difficulty; everyone else taps **READY**, and the leader's **START** works once everyone is ready. In the battle everyone picks every move and sees the others' picks as they come. Two or more on one move: it's played. Otherwise the engine's best pick is played, or, if two are within ${BOSS_PARTY.closeCp} centipawns, one of those at random. The team shares one ${BOSS_CLOCK.bankSeconds / 60} + ${BOSS_CLOCK.incrementSeconds} clock, and the turn waits for everyone: ${BOSS_PARTY.afkKickSec} seconds after the turn's first pick, the leader can remove someone who hasn't picked. The boss never strikes anyone down.
- **Boss alone** (**START** on the Boss Battle screen): just you against the boss you picked there, at a difficulty from ${src.difficulty[0]?.label} to ${src.difficulty.at(-1)?.label}. You pick every move, on a ${BOSS_CLOCK.bankSeconds / 60} + ${BOSS_CLOCK.incrementSeconds} clock: ${BOSS_CLOCK.bankSeconds / 60} minutes for the battle, and ${BOSS_CLOCK.incrementSeconds} seconds added as each move begins. The boss has no clock, and never strikes you down. If your clock runs out, the boss wins on time.
- **The Crowd's boss final** is ${finalBoss ? `always ${finalFoe}, for` : "the same fight for"} the last ${left(src.crowdKnockouts.boss)} of a 50 v 50.${finalBoss ? ` He's met in one other place: [his room in Chess Town](#boss-${finalBoss.id}).` : ""}

### Squads {#mode-squads}

- **${Q.squadCount} squads of ${Q.squadSize}** play a knockout bracket. Come alone or with a party of up to ${Q.partyMax}; bots fill any empty seats.
- **Two modes, voted first:** **Classic** is just chess: same-move tokens in Pairs, no blocks, no coins. **Mercenary** adds coins, a team shop between rounds and items, blocks among them (see [Squads: Mercenary](#mode-mercenary)). A third mode is coming soon. Nobody voting means Classic.
- **Round 1, Relay:** ${n(Q.boards.relay, "board")} and ${Q.squadSize} of you, so your squad moves in a fixed order: each move goes to the next of you, one board along from your last, and one of you waits each turn to slot in. Best 2 of 3 boards wins; a level score goes to the squad with more boards drawn as Black, then more team clock left. Under the board, the **turn order** lists all ${2 * Q.squadSize} players in the order they'll move on the board you're looking at, the next on top, each with their rank and rating and when they move there ("next", "in 3"; your row says "Your turn · play now" when it's yours); on a phone it scrolls when they don't all fit; tap a row to see the position after that player's last move. Once you've moved you can watch any board (tap its tiny board; tap yours to come back), and **${JUMP_NEXT_LABEL}** (${src.squadsWatching.jumpToNext ? "on unless you switch it off" : "off unless you switch it on"}, in the gear's list and Settings) takes you straight to the board you play next, to study it while you wait. An eye and pawns over a board show who else is watching it.
- **Round 2, Pairs:** ${n(Q.boards.pairs, "board")}, played in pairs that change partners: both partners pick a move, and a coin decides which is played.
- **Same-move tokens (Pairs):** pick the same move as your partner and it's played for sure, using one of your squad's ${n(Q.tokens.perMatch, "token")} for the match (both squads' tokens show under the board). If the engine then finds it was the only good move, every other move about ${n(Math.round(Q.tokens.refundGap / Q.tokens.pawnWorth), "pawn")} worse, the token comes back a few seconds later. The engine runs on players' devices; if none can judge it, there's no refund. With no tokens left, partners must pick different moves. After the match, a breakdown lists every token used, refunded or not, and why.
- **The final, the team vote:** one board. On your squad's move all of you pick, you see your teammates' picks as they come (the other squad doesn't), and you can copy one. The most picked move is played; a tie is settled by a coin between the tied moves.
- **Blocks (Mercenary${Q.blocks.bankPerMatch > 0 ? "" : ", after round 1"}):** ${Q.blocks.bankPerMatch > 0 ? `each squad has ${n(Q.blocks.bankPerMatch, "block point")} a match, and more from the shop.` : "no squad starts with block points: buy them in the shop between rounds, for your next match (so round 1 has none)."} On your turn, before your squad's move is settled, tap Block, one of their pieces and a square it could go to: that move can't be played on their next turn on that board (the piece's other moves can). It costs ${num(Q.blocks.cost.p)} for a pawn's move, ${num(Q.blocks.cost.n)} for a knight's, bishop's or rook's, ${num(Q.blocks.cost.q)} for a queen's${Q.blocks.castlingCost === null ? "" : ` and ${num(Q.blocks.castlingCost)} for castling`}; the king's other moves can't be blocked. ${Q.blocks.maxPerTurn === null ? "Block as many moves in one turn as your points allow." : `Up to ${n(Q.blocks.maxPerTurn, "block")} a turn on a board.`} Both squads see every blocked move as an arrow with a lock until it's their move and they've played. A block that wouldn't do anything (your own move already took the piece or shut its way) is lifted and the points come back, and so is one that would leave them no move${Q.blocks.liftBeforeMate ? ", or only moves that allow mate in one (the most recent first)" : ""}${Q.blocks.liftInCheck ? ", or that lands while they're in check" : ""}.
- Every game is played to the end on the board (a win is ${n(Q.winPoints, "point")}, a draw ${num(Q.drawPoints)}). No engine scores Squads; it only judges whether a same-move token comes back (and, in Mercenary, whether a move was brilliant).
- ${clocks} A drawn final is settled by one Armageddon game.

${mercenary(Q)}

${ranked1v1(src.ranked, src.leaves)}

${leaving(src)}

### Classic {#mode-classic}

The original mode (${S.lobbySize} players on ${n(S.lobbySize / S.groupSize, "board")}, rotating) is off the menu while it's being redesigned.
`,
  };
}

/**
 * Squads' team clock, every number from settings: the three time controls (chess form, the bank, the increment, the
 * cap), the default, the free seconds, the increment banking, the top-up and sudden death.
 */
function squadsClocks(Q: SquadsSettings): string {
  const cs = Q.clocks;
  const one = <T>(f: (c: (typeof cs)[number]) => T) => cs.every((c) => f(c) === f(cs[0]!));
  const mins = (sec: number) => (sec % 60 ? `${minutesName(sec)} minutes` : n(sec / 60, "minute"));
  const option = (c: (typeof cs)[number]) => `**${clockLabel(c)}** (${mins(c.bankSeconds)}, +${num(c.incrementSeconds)} s a move, at most ${num(c.capSeconds)} s on a move)`;
  const options = cs.map(option);
  const list = `${options.slice(0, -1).join(", ")} or ${options.at(-1)}`;
  const perOption = (f: (c: (typeof cs)[number]) => string) => cs.map((c) => `${c.label} ${f(c)}`).join(", ");
  const free = one((c) => c.delaySeconds) ? `The first ${num(cs[0]!.delaySeconds)} s of every move are free` : `The first few seconds of every move are free (${perOption((c) => `${num(c.delaySeconds)} s`)})`;
  const topUp = (c: (typeof cs)[number]) => (c.topUpSeconds % 60 ? `${num(c.topUpSeconds)} s` : n(c.topUpSeconds / 60, "minute"));
  const topUps = one((c) => c.topUpSeconds) ? `plus ${topUp(cs[0]!)}` : `plus a top-up (${perOption(topUp)})`;
  const def = defaultClock(Q);
  return `Each squad has **one clock for the whole tournament**, a chess time control voted before round 1: ${list}. Nobody voting means ${clockLabel(def)}. ${free}; then your squad's clock runs, twice as fast while two of you are moving (in Relay, your squad moves on two boards in one half and one in the other). Every move made in time adds its seconds back, so a quick move saves time for later, as on a chess clock. What's left carries into the next round, ${topUps} as you go through. When it runs out, it's **sudden death**: every move within the free seconds, until moves made in time earn some back. **Move replay:** when the rotation brings you back to a board (Relay, Pairs), your free seconds grow by ${num(Q.replaySecondsPerMove)} s for each move played there since you last played it (3 moves: +${num(3 * Q.replaySecondsPerMove)} s), so catching up never costs your squad time. The replay button by the gear sets what plays back as your move there starts: off (the first time), the last 2 moves (your teammate's and the reply), or all of them; a tap steps through. Nothing replays if you watched both of the last two moves there live. A tap on the board skips the replay (the extra time stays). The countdown tick sounds only as your squad's real clock runs out, never in the free seconds.`;
}

/**
 * Ranked 1 v 1 (Eric, Oct 16; RANKED_1V1): the mode, the time-control vote and its rule (every pair of picks worked out
 * by the game's own rule, votedControl), the clocks, how a game ends, ranks, rank points, placements and coins.
 */
export function ranked1v1(R: typeof RANKED_1V1, L: typeof LEAVES = LEAVES): string {
  const z = (id: "bullet" | "blitz" | "rapid") => controlLabel(zoneControl(id, R));
  const meet = (a: "bullet" | "blitz" | "rapid", b: "bullet" | "blitz" | "rapid") => `**${controlLabel(votedControl(a, b, R))}**`;
  const def = R.controls.find((c) => c.id === R.defaultControl) ?? R.controls[0]!;
  const blitz = zoneControl("blitz", R);
  const tiers = R.tiers.map((t) => t.name);
  const top = rankView({ games: R.placements.games, ladder: R.placements.maxLadder }, R);
  const [lowTop, highTop] = [...R.topTiers].sort((a, b) => b.top - a.top);
  const last = tiers.at(-1)!;
  // (Where the top tiers' floor sits in the last division: Radiant 1's 80 RP.)
  const floorRp = R.topFloor - (divisionsEnd(R) - R.pointsPerDivision);
  const emblems = (ids: readonly string[]) => `!emblems ${ids.join(" ")}`;
  const example = R.tiers[Math.min(2, R.tiers.length - 1)]!.name;
  const C = R.coins;
  return `### 1 v 1 · Classic chess {#mode-1v1}

- **Normal chess against one other person, ranked.** Checkmate wins, the clocks are real, and nothing else: no power-ups, no scoring of your moves. One tap on **1 v 1** finds you an opponent near your strength; the longer you wait, the wider the search. If nobody turns up within ${n(R.fewPlayersSeconds, "second")}, you can keep waiting or **play a bot** (unranked: nothing on your record, no coins).
- **The time control, voted on the board:** before move 1, three zones appear in the middle of the board, **${z("bullet")}** on the left, **${z("blitz")}** in the middle and **${z("rapid")}** on the right, and you both have ${n(R.voteSeconds, "second")} to drag your pawn into one. The same pick plays that control. Picks next to each other meet in between: Bullet and Blitz make ${meet("bullet", "blitz")}, Blitz and Rapid ${meet("blitz", "rapid")}. Bullet against Rapid makes ${meet("bullet", "rapid")}. If only one of you picks, that pick counts; if neither does, it's **${controlLabel(def)}**.
- **The clocks:** "${controlLabel(blitz)}" means ${n(blitz.baseSeconds / 60, "minute")} each, plus ${n(blitz.incrementSeconds, "second")} after every move. They start after Black's first move. Each side has ${n(R.firstMoveSeconds, "second")} for its first move, or the game is called off (no result; for the side that didn't move, it's a dodge: leaving early, below).
- **How a game ends:** checkmate; resigning; running out of time, a loss (but a draw if the other player has only a king, or a king and one knight or one bishop, so they couldn't mate); or a draw, by stalemate, threefold repetition, the 50-move rule, too little material for either side to mate, or agreement. **Offer a draw** is under the board: the other player accepts or declines, and after a decline you can offer again once you've made ${n(R.drawOfferEveryMoves, "more move")}.
- **Lost your connection?** Your clock keeps running: open the app again (or reload) and you're straight back in the game.
- **Ranks:** ${tiers.slice(0, -1).join(", ")} and ${last}, each with divisions ${R.divisions} (the lowest) to 1. A division is ${n(R.pointsPerDivision, "rank point")} (RP): reach ${num(R.pointsPerDivision)} and you go up a division, the extra carried over; drop below 0 and you go down one. There are no promotion series, and nobody goes below ${tiers[0]} ${R.divisions} with 0 RP. Each tier has its emblem, and each division up adds to it, up to a crown and a glow in division 1:

${emblems(R.tiers.map((t) => emblemId(t.name, R.divisions)))}
${emblems(Array.from({ length: R.divisions }, (_, i) => emblemId(example, R.divisions - i)))}

- **The top two tiers,** with no divisions: **${lowTop!.name}**, the ${num(lowTop!.top)} highest ranks, and above it **${highTop!.name}**, the ${num(highTop!.top)} highest, both from ${floorRp} RP in ${last} 1 (their RP count from there). Equal ranks share a place, and your place is brought up to date within a minute. At ${floorRp} RP or more in ${last} 1 but outside the top ${num(lowTop!.top)}, you stay ${last} 1 and your RP keeps counting past ${floorRp}. Their emblems shimmer:

${emblems([emblemId(lowTop!.name, null), emblemId(highTop!.name, null)])}

- **Rank points:** about +${num(R.points.perGame)} for a win and −${num(R.points.perGame)} for a loss against a player at your level, about 0 for a draw; more for beating someone stronger, less for beating someone weaker. Behind them is a hidden rating, worked out from your results and whom you played them against: when your rank is lower than it, you gain more and lose less (up to ${n(R.points.maxAdjust, "RP", "RP")} more or less), so your rank settles where your play is. A win never costs you points.
- **Placements:** your first ${n(R.placements.games, "game")} show "Placement 1/${R.placements.games}", "2/${R.placements.games}" and so on; after the last of them you're placed by your hidden rating, at most ${top.label.replace(/ · .*/, "")}.
- **Coins:** a game pays ${num(C.perMinute.win)} coins a minute for a win, ${num(C.perMinute.draw)} for a draw and ${num(C.perMinute.loss)} for a loss, at least 1 and at most ${num(C.maxPerGame)}, once both sides have made ${n(C.minMoves, "move")}. Up to ${n(C.perDay, "game")} a day pay coins; after that they still count for your rank. A called-off game and a bot game pay nothing.
- **Quick chat** works as in other online matches, and you can mute the other player.

${rankedLeaving(L)}`;
}

/** "a", "a and b", "a, b and c". */
const andList = (xs: readonly string[]) => (xs.length < 2 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);

/** A lockout's length in words ("5 minutes", "2 hours"). */
const lockoutWords = (min: number) => (min >= 60 && min % 60 === 0 ? n(min / 60, "hour") : n(min, "minute"));

/**
 * Ranked's leave rules (L1, Nov 9; LEAVES): a dodge before the game starts, a leave after, the lockouts and the delayed queue.
 * Every number from LEAVES, every rule as the server applies it (duel rules' conductOf, core's ranked-leaves.ts).
 */
export function rankedLeaving(L: typeof LEAVES): string {
  const [first, again] = [L.dodgeRp[0]!, L.dodgeRp[L.dodgeRp.length - 1]!];
  const locks = L.dodgeLockoutMin.filter((m) => m > 0);
  const [d1, d2] = [L.delayed[0]!, L.delayed[L.delayed.length - 1]!];
  return `- **Leaving early, before the game starts** (from "Opponent found" until both first moves: Abort, leaving during the vote, closing the app, not making your first move in time, or not turning up once your device was told a match was found) is a **dodge**. The game is called off, with no result for anyone and no change to your hidden rating, but each dodge raises your dodge level by one (each ${n(L.dodgeDecayHours, "hour")} without a dodge lowers it by one again). A dodge to level 1 costs ${num(first)} RP; from level 2 it costs ${num(again)} RP and locks you out of 1 v 1 for ${lockoutWords(locks[0]!)}${locks.length > 1 ? `, then ${andList(locks.slice(1).map(lockoutWords))} at most` : ""}. If your opponent was the one who left, you lose nothing. Pressing Cancel the moment a match is found, before the game opens on your screen, isn't a dodge; once it has opened, Cancel is the same as Abort. A moment away isn't leaving: you count as gone only after ${n(L.goneGraceMs / 1000, "second")} without a connection (the app in the background, a dropped signal, a reload), so Abort pressed while your opponent is only briefly away is yours.
- **Leaving early, after it starts:** resigning is an honest loss, unless it's before your ${ordinal(L.quickResignMoves)} move: that, or letting your clock run out while you've been gone ${n(L.goneGraceMs / 1000, "second")} or more and your opponent is still there, is a **leave**: a loss, then ${n(L.leaveRp, "RP", "RP")} more.
- **Leaving early adds up:** dodges and leaves are counted over your last ${num(L.window)} ranked games and dodges. With ${num(d1.at)} or more, every 1 v 1 search waits ${lockoutWords(d1.waitSec / 60)} longer before you can be matched (${lockoutWords(d2.waitSec / 60)} with ${num(d2.at)} or more). With ${num(L.lockAt)} or more, 1 v 1 is locked for ${n(L.lockHours, "hour")}. Every ranked game you finish that counts for your rank pushes an old one out of the count.
- **In placements** there are no rank points to lose yet: a dodge or a leave just goes on your record. Home says when a lockout (with its countdown) or a longer wait applies. Each dodge and leave is kept ${n(L.keepDays, "day")}.`;
}

/** Leaving or resigning a match, in every mode (LEAVING in settings.ts; Eric, Oct 13). */
function leaving(src: FaqSources): string {
  const away = src.leaving.awayMs / 1000;
  const gone = away % 60 ? n(away, "second") : n(away / 60, "minute");
  return `### Leaving or resigning {#leaving}

- **To resign:** tap the **gear** at the top right of the match (on a computer, click it), then **Resign**. It asks once more, so a stray tap never resigns. (There's no undo; only [1 v 1](#mode-1v1) has draw offers.)
- **1 v 1:** resigning ends the game, a loss. Before both first moves are made it's **Leave** instead: the game is called off, with no result, but leaving a ranked game before it starts, or resigning very early, costs rank points ([1 v 1](#mode-1v1), leaving early).
- **Solo games and Boss alone:** the game ends there, and it counts as a loss.
- **Online (Crowd, Boss Battles, Squads):** you can't end the game for everyone else, so resigning means you leave it. You're out in the last place still open, it counts as a loss (in a match that counts for ranking, for your ranking too), and a bot plays your seat so your team isn't a player short (with Bots off, only when your side would otherwise have nobody left). In Squads your squad plays on with a bot in your seat, and your record has the worst place your squad could still finish.
- **Before the first move** (the votes, a boss's entrance), it's just **Leave**: you go home, a bot takes your seat, and nothing goes on your record.
- **Already out** (cut, or struck down by the boss)? **Leave the match** takes you home, and your place stands.
- **Closed the app or lost your connection?** Back within ${gone}, you're still in your seat (a reload is fine). Gone longer, it counts as resigning. When everyone has left a match, it ends there, and its lobby code stops working.`;
}

/** Squads' Mercenary mode: earning, the shop, the items, every number from settings. */
function mercenary(Q: SquadsSettings): string {
  const M = Q.mercenary;
  const times = (k: number) => (k === 2 ? "double" : `${num(k)} times as much`);
  const prices = M.items.chip.prices ?? [M.items.chip.price];
  const chipPrices = `${prices.map((p) => num(p)).join(", ")}, then ${n(prices[prices.length - 1]!, "coin")} each`;
  const item = (name: string, it: keyof typeof M.items, what: string) => {
    const list = M.items[it].prices;
    const price = list ? `${list.map((p) => num(p)).join(", ")}, then ${n(list[list.length - 1]!, "coin")} each` : n(M.items[it].price, "coin");
    return `- **${name}** (${price}, up to ${num(M.items[it].cap)} a round): ${what}`;
  };
  return `### Squads: Mercenary {#mode-mercenary}

- **One wallet per squad**, shared by its players, for the whole tournament: coins you don't spend carry on to the next round.
- **Earning:** every match your squad plays pays ${n(M.played, "coin")} when it ends, win or lose, and winning it pays ${num(M.matchWin)} more: that's most of your coins. Playing well adds to it: a capture pays by the piece taken (a pawn ${num(M.capture.p)}, a knight or bishop ${num(M.capture.n)}, a rook ${num(M.capture.r)}, a queen ${num(M.capture.q)}); a board won ${num(M.boardWin)}, ${num(M.mate)} more for a checkmate; a drawn board ${num(M.boardDraw)} to each squad. Those are Relay's: with fewer boards, a board pays ${times(M.roundScale[1])} in Pairs and ${times(M.roundScale[2])} in the final, so every round is worth about the same. A **brilliant move** pays ${num(M.brilliant.coins)}, at most ${n(M.brilliant.capPerMatch, "time")} per squad per match (a quiet move the engine rates the only good one, every other move about ${n(Math.round(M.brilliant.gap / Q.tokens.pawnWorth), "pawn")} worse, in a game still in the balance).
- **Catch-up:** when your next match is set, if your squad has earned fewer coins in the tournament than its opponent, it gets ${Math.round(M.catchUp.share * 100)}% of the difference (at most ${num(M.catchUp.max)}), so the rich don't just get richer.
- **The shop** opens after each round for the squads still in, while you wait for the next match (the other match finishing, then the break before it), so it adds no time. Anyone on your squad can buy from the wallet, and the whole squad sees each purchase. Both squads can see each other's coins and what they've bought.
- **Items last for your next match only** (Time chips apart): use them or lose them. Each costs more for every one of it your squad has already bought in the tournament (${n(M.priceStep, "coin")} more, unless it says otherwise), and there's a limit to how many of each you can bring to one match.
${item("Stockfish token", "stockfish", `for one of your own decisions, your top ${num(M.stockfish.lines)} moves as arrows with their evaluations. Never the other squad's moves or replies. In Pairs only you see it; in the final your whole squad does. A move made with it is allowed help: it never counts against you.`)}
${item("Block points", "blocks", Q.blocks.bankPerMatch > 0 ? `${n(M.blockPoints, "more block point")} for the match.` : `${n(M.blockPoints, "block point")} for the match: squads start with none, so this is the only way to block.`)}
${item("Shield", "shield", "cancels the next block against your squad that would take effect; they still pay for it. A block lifted anyway (by the rules above) doesn't use it.")}
- **Time chip** (${chipPrices}; your squad holds up to ${num(M.items.chip.cap)}): tap it during your squad's move, on the board you're playing: ${n(M.chipSeconds, "second")} more for that move, and your team clock stands still while they run (20 s left becomes ${num(20 + M.chipSeconds)}). Seconds you don't use are lost; they never go into your clock. You can put several on one move, it works when you're out of time too, and in Pairs it counts for both partners on that board. Chips you don't use are kept for the next round. Both squads see each other's chips.
`;
}

/**
 * The opening allowance in two sentences (Eric, Oct 15: cut players should think "yeah, I messed up"): what it forgives
 * and what it never does, with the reveal's own words. Every number from OPENING_ALLOWANCE.
 */
/**
 * Crowd 50 v 50's scoring in a player's words (docs/decisions/2026-10-24-crowd-scoring.md): the soft limit by stage,
 * pieces hung, shared blunders, streaks, rare brilliant finds, a miss and the bubble. Every number from CrowdScoring.
 */
export function crowdScoringWords(cs: CrowdScoring, misses?: CrowdMisses | null): string {
  const limit = (cap: number | null) => (cap === null ? "no limit" : `about ±${num(cap)}`);
  const when = (from: number) => (from === 0 ? "before the first cut" : from === 1 ? "from the first cut" : `from the ${ordinal(from)} cut`);
  const caps = cs.cap.map((c, i) => `${limit(c)} ${when(cs.capFrom[i] ?? 0)}`);
  const ramp = cs.streakBonus.map((b, i) => `+${num(b)} at ${cs.streakFrom + i}`);
  const last = cs.streakBonus.at(-1) ?? 0;
  const firstCap = cs.cap[0] ?? null;
  return `In 50 v 50 each move's round score is eased into a range, so no single move makes or breaks you early, and the range widens as the game goes on:

- **A soft limit on every move:** ${caps.slice(0, -1).join(", ")} and ${caps.at(-1)}. It's a smooth curve, not a wall: a small score is barely changed, and a bigger mistake still scores a little worse than a smaller one. Scores show to 2 decimals.
- **Hanging a piece isn't softened:** a move that gives up ${n(cs.uncapPawns, "pawn")}' worth of material or more against the best move, by the same exchange check as the opening allowance, takes its whole minus score.
- **When everyone fell for it:** when ${cs.sharedMin} or more of your team (or ${pct(cs.sharedShare, 0)} of it) pick the same move and it gives away ${n(cs.sharedFrom, "point")} or more, it counts less for each of them: the bigger their share, the less it costs, down to ${pct(cs.sharedFloor, 0)} of it.
- **Streaks:** a move within ${n(cs.streakStrong, "point")} of the engine's best is a strong move. ${cs.streakFrom} strong moves in a row put you on a streak, shown by the fire and its count on your place number on the scoreboard (orange, then red from ${cs.streakFrom + 2}, then white-blue from ${cs.streakFrom + 4}). Each strong move on it adds a bonus on top of its score: ${ramp.join(", ")} in a row${cs.streakBonus.length > 1 ? `, and +${num(last)} from then on` : " and after"}. Any other move, or a missed one, ends it. From the usual start, streaks count from your ${ordinal(cs.streakFromMove)} move; in a Random opening or Freestyle, from your first.
- **Rare brilliant finds:** a [brilliant move](#brilliant) that ${cs.brilliantMaxFound} or fewer of your team found (just one, when ${cs.brilliantFewLeft} or fewer are picking), while the rest gave away ${n(cs.brilliantMinGap, "point")} or more on average, earns +${num(cs.brilliantBonus)} and a shoutout naming who found it. It doesn't change the move played.
${
    misses
      ? `- **A missed move** (no pick in time): a move is picked for you, one of the engine's top ${misses.defaultFromTop} at random, but it never counts in your team's vote. You score the lowest score anyone on your team who picked got that move, so missing is never better than the worst real pick (if nobody on your team picked, ${cs.missCaps} times the limit below zero). The reveal tells you each time ("Missed: a move was picked for you (1 of ${misses.allowed})"). **Miss more than ${n(misses.allowed, "move")} in a game and you're removed for being away**: it counts as resigning, a loss, out in the last place still open, and a bot takes your seat.`
      : `- **A missed move** scores ${cs.missCaps} times the limit below zero${firstCap === null ? "" : ` (${num(-cs.missCaps * firstCap)} before the first cut)`}.`
  }
- **The bubble:** at a cut, anyone within ${n(cs.cutGrace, "point")} of the last player through goes through too, like a tie (except at the last cut before the ending).`;
}

/**
 * A boss raid's scoring in a player's words (docs/decisions/2026-10-25-raid-scoring.md): 50 v 50's, its limit widening
 * by crowd move (CrowdScoring.capFromMove), no bubble; the strike as before; Boss alone as before. Numbers from RAID_SCORING.
 */
export function raidScoringWords(cs: CrowdScoring | undefined, missed: number): string {
  if (!cs) return `A group Boss Battle scores like Classic: no limit and no streaks. A missed move scores ${num(missed)}.`;
  const from = cs.capFromMove ?? [];
  const caps = cs.cap.map((c, i) => `${c === null ? "no limit" : `about ±${num(c)}`} from the ${ordinal(from[i] ?? 1)} crowd move`);
  const firstCap = cs.cap[0] ?? null;
  return `A group Boss Battle scores the [50 v 50 way](#crowd-scoring), the whole crowd counting as your team (the limit, a piece hung, everyone falling for it, streaks and the fire, rare brilliant finds), but a Boss Battle has no cuts, so the limit widens with the crowd's moves instead: ${caps.slice(0, -1).join(", ")} and ${caps.at(-1)}. A missed move scores ${cs.missCaps} times the limit below zero${firstCap === null ? "" : ` (${num(-cs.missCaps * firstCap)} at first)`}.${cs.streakMinAverage ? ` A move that plays itself (the crowd giving away less than ${n(cs.streakMinAverage, "point")} on average, as in a game already decided) neither adds to a streak nor ends it.` : ""} Nobody is cut, so there's no bubble.

- **The boss's strike** still goes by the points you gave away since its last strike, before the limit and the streaks: the [player who played worst](#mode-boss) is struck, never a tie on a coin flip.
- **Boss alone** scores as before (no limit, no streaks, 1 decimal): with nobody to compare with, a move scores 0 and a missed one ${num(missed)}.`;
}

export function openingAllowanceWords(A: FaqSources["allowance"]): string {
  return `Through move ${A.flatThrough}, the first ${n(A.points, "point")} a move gives away don't count (less each move after that, and none from move ${A.goneBy}), so a sound move off the engine's line costs nothing early on: the reveal shows it as "1.2 forgiven · opening". A move that gives up ${A.materialPawns === 1 ? "a pawn" : n(A.materialPawns, "pawn")} or more by a simple exchange check, by leaving something to be taken or by missing a capture, gets no allowance, so all of it counts ("no allowance · gave up material", "no allowance · missed a capture").`;
}

function scoring(src: FaqSources): FaqSection {
  const S = src.settings;
  const B = src.brilliant;
  // The worked example, scored by the game's own scoring code.
  const best = 0.62;
  const after: Record<string, number> = { a: 0.62, b: 0.58, d: 0.3 };
  const picks = [
    { playerId: "A", move: "a" },
    { playerId: "B", move: "b" },
    { playerId: "C", move: "b" },
    { playerId: "D", move: "d" },
  ];
  const ex = scoreGroup(picks, { bestExpected: best, bestMove: "a", expectedAfter: after }, () => 0, S, "popular");
  const row = (id: string) => ex.players.find((p) => p.playerId === id)!;
  const exRows = picks
    .map((p) => {
      const r = row(p.playerId);
      const note = p.playerId === "C" ? " (the same move as B)" : "";
      return `| ${p.playerId} | ${es(after[p.move]!)}${note} | ${num(r.loss!)} | ${signed(r.roundScore)} |`;
    })
    .join("\n");
  const avg = ex.averageLoss!;
  const losses = picks.map((p) => num(row(p.playerId).loss!)).join(" + ");
  return {
    id: "scoring",
    title: "How your moves are scored",
    body: `
### The judge {#judge}

Every pick is scored by **Stockfish**, the chess engine (the judge). For any position, it gives the side to move an **expected score** from 0 to 1: the chance of a win plus half the chance of a draw. 0.50 is level; 0.62 means you'd expect to score 62 out of 100 from here.

The judge looks at the same fixed amount for every pick (${num(S.engineNodes)} positions), so the same position always gets the same score.

### Points {#points}

A move's **loss** is what it gives away compared with the best move in that position, in points (1 point is 0.01 of expected score):

$ loss = 100 × (expected score after the best move − expected score after your move)

A loss is never below zero: if picks score above the engine's own choice, the highest-scored pick counts as the best move, and every other pick, the engine's choice included, is measured against it. Your **round score** then compares you with everyone who picked with you (in 50 v 50, your team):

$ round score = the group's average loss − your loss

Positive means you beat your group (early in a game, every loss here is after the [opening allowance](#opening-allowance)). A missed move scores ${num(S.missedMoveScore)} (in 50 v 50 and a group Boss Battle, [less](#crowd-scoring)) and is left out of the average. In Crowd your round scores add up all game, and every cut goes by the total.

### The opening allowance {#opening-allowance}

${openingAllowanceWords(src.allowance)}

### Scoring in 50 v 50 {#crowd-scoring}

${crowdScoringWords(src.crowdScoring, src.crowd.crowdMisses)}

### Scoring in a group Boss Battle {#raid-scoring}

${raidScoringWords(src.raid.crowdScoring, S.missedMoveScore)}

### A worked example {#worked-example}

The best move leaves the side to move an expected score of ${es(best)}. Four players pick:

| Player | Expected score after their move | Loss | Round score |
|---|---|---|---|
${exRows}

The group's average loss is (${losses}) / ${picks.length} = ${num(avg)}. A found the best move and scores ${num(avg)} − 0 = ${signed(row("A").roundScore)}; D's blunder scores ${num(avg)} − ${num(row("D").loss!)} = ${signed(row("D").roundScore)}. In Crowd the move B and C share is the most popular, so it's the likeliest to be played.

### Nearly as good costs almost nothing {#near-best}

In most positions several moves are close. If the best move keeps you at 0.55 and the natural developing move keeps you at 0.54, it gives away just 1 point. You don't have to find the engine's exact move: a sound human move costs a point or two, while a real blunder costs tens (hanging your queen in a level position typically costs 50 to 70 points).

### Every position is judged fresh {#fresh}

Each pick is compared only with the best move **in the position on the board now**. If the crowd went its own way a few moves ago, nobody is punished for being "off the engine's line": the judge simply asks what's best from here. A player handed a bad position can still top their group, because only the chances you give away count, not where you started.

### The deeper re-check {#recheck}

A quick search can now and then misjudge a close call, so close calls get a second, much deeper look (at least ${num(S.recheckNodes)} positions instead of ${num(S.engineNodes)}) before they cost anyone. In every round where a person picked, moves that give away from ${range(S.recheckLoss)} points are searched again, the most-picked first, up to ${n(S.recheckMax, "move")} a board. Online, before a cut, the picks of players within ${n(S.recheckCutPoints, "point")} of the cut line are re-checked first, over ${range(S.recheckCutLoss)} points, up to ${n(S.recheckCutMax, "move")} a board. A pick scored above the engine's own choice is searched again too, alongside it, whenever there's a re-check. The deeper numbers replace the quick ones.

### Brilliant moves {#brilliant}

A move is **brilliant** when it separated the field: among at least ${B.minPickers} pickers, the moves within ${num(B.nearBest)} points of the best were found by at most ${pct(B.maxShare, 0)} of them, and everyone else gave away ${num(B.minGap)} points or more on average. Everyone who found it gets the credit, unless they used a power-up that turn (it shows the engine's moves). A move the God King plays is never brilliant. Your brilliant moves show on your profile.

### Your rating {#rating}

Your rating comes from your moves, not from wins: from the average number of points your moves give away, matched against how many Stockfish gives away at each of its own strength settings (so it's on Stockfish's rating scale). It shows after ${n(src.ratingMinMoves, "move")}, starts near ${src.priorRating} and firms up as your moves come in. A match counts toward your ranking only when at least ${pct(src.rankedShare, 0)} of its seats are real players; solo games and practice mode never count. Your ranking changes only in a match with at least ${rankedMinHumans(src.crowd.lobbySize, src.rankedShare)} real players (${rankedMinHumans(src.raid.lobbySize, src.rankedShare)} in a group Boss Battle). Solo games never change it.
`,
  };
}

function bossBrain(src: FaqSources): FaqSection {
  const S = src.settings;
  const M = src.brain;
  const tiers = src.tiers;
  const playable = src.roster.filter(isPlayable);
  const bossById = (id: string) => playable.find((b) => b.id === id) ?? playable[0]!;
  const finalists = src.crowd.lobbySize - sum(src.crowdKnockouts.boss);
  // The Crowd's boss final (always the Hidden Boss): his brain and strength are fixed (BOSS_BRAIN.fixed).
  const finalBoss = crowdFinalBoss(src.roster);
  const fixed = finalBoss && M.fixed[finalBoss.id] ? finalBoss : null;
  const floor = bossStrength(-1e9, null);
  const ceiling = bossStrength(1e9, null);
  // The worked example: a player rated 1750.
  const you = 1750;
  const tierFor = (r: number) => tiers.find((t) => t > r) ?? tiers.at(-1)!;
  const tier = tierFor(you);
  const ginger = bossById("gingerbread");
  const bigBoy = bossById("bigboy");
  const hard = src.difficulty.find((d) => d.id === "hard") ?? src.difficulty.at(-1)!;
  const gingerElo = bossStrength(tier, ginger, 0);
  const bigBoyElo = bossStrength(tier, bigBoy, hard.elo);
  const offsets = playable.map((b) => `| ${b.name} | ${signed(b.offset)} |`).join("\n");
  const diffs = src.difficulty.map((d) => `${d.label} ${d.elo ? signed(d.elo) : "0"}`).join(", ");
  // The blunder guard's log-odds, shown on a won game thrown half away.
  const [from, to] = [0.97, 0.9];
  const gPoints = (from - to) * 100;
  const gLogit = logit(from) - logit(to);
  const blocked = !(gPoints <= S.bossMaxLoss && (gLogit <= S.bossMaxLogitLoss || gPoints <= 2));
  const stumbleAt = [1500, 1900, 2000].filter((e) => e < S.bossStumbleBelow).map((e) => `${pct(bossStumbleChance(e, S), 0)} at ${e}`);
  // Maia for players yet? (Until then it's marked "Being tested".) Every boss is on it (BOSS_BRAIN.brain), unless one
  // has its own brain (byBoss).
  const guardName: Record<string, string> = { "maia-raw": "no guard", "maia-light": "the light guard", "maia-full": "the full guard", "maia-strict": "the strict guard", stockfish: "Stockfish" };
  const others = Object.entries(M.byBoss)
    .filter(([id, brain]) => brain !== M.brain && playable.some((b) => b.id === id))
    .map(([id, brain]) => `${bossById(id).name} (${brain === "stockfish" ? "Stockfish" : `Maia with ${guardName[brain]}`})`);
  const everyBoss = M.brain === "stockfish" ? "no boss" : `every boss${others.length ? ` except ${others.join(", ")}` : ""}`;
  const maiaNote = M.forPlayers
    ? `> ${everyBoss[0]!.toUpperCase()}${everyBoss.slice(1)} plays with Maia, ${guardName[M.brain]}, up to a level of ${M.bridgeFrom}; then [the bridge](#handover) hands it over to Stockfish, which plays from ${M.stockfishFrom} up.`
    : `> **Being tested; coming soon.** Maia isn't switched on for players yet: until it is, every boss you meet plays with Stockfish, as above. In the test, ${everyBoss} plays with Maia, ${guardName[M.brain]}, in every mode, with [the bridge](#handover) up to Stockfish.`;
  // Maia's rating: the lines between BOSS_BRAIN.maiaRating's points, held at the last (its ceiling).
  const pts = M.maiaRating;
  const lines: string[] = [];
  for (let i = 1; i < pts.length; i++) {
    const [xa, ya] = pts[i - 1]!;
    const [xb, yb] = pts[i]!;
    lines.push(`$ from ${xa} to ${xb}: Maia = ${ya} + ${num((yb - ya) / (xb - xa), 3)} × (level − ${xa})`);
  }
  const [lastX, lastY] = pts.at(-1)!;
  lines.push(`$ from ${lastX} up: Maia = ${lastY}`);
  const margin = M.crowdMargin;
  // The handover table: a boss's strength, Maia's rating alone and for a crowd, the guard and Stockfish's share.
  const plan = (x: number, crowd: boolean) => bossBrainFor("", x, "", true, { crowd }, M);
  const strengths = [1000, 1200, 1400, 1600, 1800, 2000, 2100, 2200, 2400, 2500, 2600, 2700, M.stockfishFrom - 1, M.stockfishFrom, 3000, ceiling]
    .filter((x, i, a) => a.indexOf(x) === i && x >= floor && x <= ceiling)
    .sort((a, b) => a - b);
  const shortGuard: Record<string, string> = { "maia-raw": "", "maia-light": ", light guard", "maia-full": ", full guard", "maia-strict": ", strict guard", stockfish: "" };
  const cell = (p: ReturnType<typeof plan>) => (p.brain === "stockfish" ? "Stockfish" : `Maia ${p.rating}${shortGuard[p.brain]}`);
  const handover = strengths
    .map((x) => {
      const a = plan(x, false);
      const c = plan(x, true);
      return `| ${x} | ${cell(a)} | ${cell(c)} | ${a.brain === "stockfish" ? "all" : a.stockfishShare ? pct(a.stockfishShare, 0) : "none"} |`;
    })
    .join("\n");
  // The worked example: a raid's boss at 2000, alone and for a crowd.
  const exStrength = 2000;
  const exLevel = exStrength + margin;
  const seg = Math.max(1, pts.findIndex(([x]) => x >= exLevel));
  const [ex0, ey0] = pts[Math.min(seg, pts.length - 1) - 1]!;
  const [ex1, ey1] = pts[Math.min(seg, pts.length - 1)]!;
  const exSlope = (ey1 - ey0) / (ex1 - ex0);
  const exMaia = maiaRatingFor(exLevel, M);
  const exHeld = exLevel >= lastX;
  // The bridge's worked example: its middle.
  const midBridge = Math.round((M.bridgeShareFrom + M.stockfishFrom) / 2);
  const midPlan = plan(midBridge, true);
  const guard = (g: { maxLoss: number; maxLogitLoss: number }) => `${n(g.maxLoss, "point")} | ${num(g.maxLogitLoss)}`;
  const gaps = [0, 100, 200, 400].map((d) => `| ${d} | ${es(eloExpected(d))} | ${es(1 - eloExpected(d))} |`).join("\n");
  const youVs = gingerElo - you;
  return {
    id: "boss-brain",
    title: "Bosses: how a boss decides its moves",
    tocSubs: true,
    body: `
A boss is a chess engine with a character. Two things decide how it plays: **how strong** it is (a rating it plays at), and **which brain** picks its moves at that strength.

### How strong a boss is {#boss-strength}

A boss's strength is a rating on Stockfish's scale, set as the battle starts:

- **A group Boss Battle** is matched to the people in it (bots never count): the boss comes in at the weakest of its tiers that's stronger than their average rating. The tiers: ${tiers.join(", ")}.
- **Play with bots and Boss alone** work the same way from your own rating (unrated, ${src.priorRating}).
${
  fixed
    ? `- **The Crowd's boss final** is always ${bossInText(fixed.name, false, src.roster)}. He starts as a boy: Maia at ${num(RECLUSE_CHILD.startRating)}, ${num(RECLUSE_CHILD.stepRating)} stronger every ${n(RECLUSE_CHILD.everyPlies, "move")} on the board, up to ${num(maiaTopRating(M))}. Beat the boy and the man comes next, whose strength is fixed at ${fixedLevel(M)}. Neither follows anyone's rating: no tier, offset or difficulty ([his block](#boss-${fixed.id})).`
    : `- **The Crowd's boss final** comes from how the people among the last ${finalists} played that match (bots count only if no person is left among them): a weighted average of their ratings (the best counts ${finalists} times, the next ${finalists - 1}, down to the weakest once), ${S.bossEloOffset < 0 ? "minus" : "plus"} ${Math.abs(S.bossEloOffset)} (a crowd picking together plays better than its average member), kept within ${range(S.bossEloRange)}. The weighting makes it a real fight for the best players.`
}
- Then each boss's **offset** is added: bosses with nastier powers play a little weaker underneath.
- **Boss alone** adds your difficulty too: ${diffs}. In Boss alone the difficulty also sets how well the boss plays its moves, whatever your rating: Maia at a human's rating, ${src.difficulty.map((d) => `${d.label} ${d.maia}`).join(", ")} (its powers on top; [Brain 2](#maia-brain)).
- The result always stays between ${floor} and ${ceiling}.

$ strength = tier + the boss's offset + your difficulty

| Boss | Offset |
|---|---|
${offsets}

**Worked example.** You're rated ${you}. The weakest tier above ${you} is ${tier}. ${ginger.name} at ${src.difficulty.find((d) => d.elo === 0)?.label ?? "Medium"}: ${tier} ${term(ginger.offset)} = **${gingerElo}**. ${bigBoy.name} at ${hard.label}: ${tier} ${term(bigBoy.offset)} ${term(hard.elo)} = **${bigBoyElo}**.

The Boss Battle screen shows the boss you picked by its name, with your difficulty's name and its five dots under it. Play with bots has no difficulty on top.

### Brain 1: Stockfish at a set strength {#stockfish-brain}

${M.forPlayers ? `A boss at ${M.stockfishFrom} or more plays with Stockfish, and so do some of the moves in [the bridge](#handover) below it.` : "Every boss you meet today plays with Stockfish."} Stockfish can hold itself back to a rating (from ${src.engineMinElo} up to ${ceiling}), and the boss asks it for a move at the boss's strength. Three safety rails keep it fair and fun:

- **The blunder guard.** Held-back Stockfish now and then simply hangs a piece. It's boss mode, not idiot mode: no boss move may give away more than ${n(S.bossMaxLoss, "point")} against the best move, nor more than ${num(S.bossMaxLogitLoss)} in **log-odds**. A move that would is swapped for a small slip.
- **Slips for weaker bosses.** Stockfish can't play below ${src.engineMinElo}, which is still too strong for a boss meant to be beatable at 1400. So below ${S.bossStumbleBelow} a boss sometimes slips on purpose: a small inaccuracy of ${range(S.bossSlipLoss)} points from its best few moves, never a blunder.
- **Powers.** When a power stops some of the boss's moves (a pie, a toy block), it plays the best move that's allowed. And [Alfil](#boss-alfil) sees his Mammoth Slam's pieces coming: on his move just before they land, his moves are weighed with them back down.

$ slip chance = min(${pct(S.bossStumbleMax, 0)}, (${S.bossStumbleBelow} − strength) / 1000)

For example: ${stumbleAt.join(", ")}, and none from ${S.bossStumbleBelow}. Any move other than its best is double-checked against the best before it's played.

**Why log-odds?** In a game that's already won or lost, points shrink, so a disaster can look small. Log-odds measure the chances on a stretched scale:

$ log-odds of p = ln(p / (1 − p))

Going from ${pct(from, 0)} to ${pct(to, 0)} is only ${num(gPoints, 1)} points, but ${num(gLogit)} in log-odds, so the guard ${blocked ? "blocks it" : "lets it through"}.

### Brain 2: Maia-3, a human-like boss {#maia-brain}

${maiaNote}
${
  M.forPlayers
    ? `
**Why Maia, and its download.** Maia is a human-like engine, so a boss plays more like a person than Stockfish does. It's a bigger download, about ${M.downloadMb} MB, fetched once the first time you meet a boss and then kept on your device; on a slow connection, or if it can't load, the boss plays Stockfish instead.
`
    : ""
}
**Maia-3**, by the CSSLab at the University of Toronto, learned from human games to predict the move a person of a given rating would play. Held-back Stockfish plays like a strong engine with sudden lapses; Maia plays like a person, plans and mistakes included. There's no blunder guard by default: Maia's mistakes are human ones, and a boss's edge comes from its powers. A Maia boss picks its move like this:

1. Maia is asked for its likeliest moves at the boss's Maia rating ([the handover](#handover)), and draws one from its own probabilities, a little sharper than a real person (temperature ${num(M.temperature)}) and never one of the rarest (only from the likeliest moves that together make up ${pct(M.topP, 0)} of the chances).
2. **Powers:** Maia only picks among the moves a power leaves the boss (a pie, a toy block, a saw cut, Sawyer's first pawn move). If none of its likeliest moves is allowed, the boss plays its usual Stockfish move. On [Alfil](#boss-alfil)'s move just before his Mammoth Slam's pieces land, Maia's move is weighed with them back down, and gives way to his best move there if it would give away more than the blunder guard allows.
3. A **guard**, where there is one ([the bridge](#handover)), may veto that move, judged against the boss's own Stockfish search of its best moves (a move outside that search is turned down). Maia's next likeliest moves are then tried in turn (at most ${M.candidates} in all, each at least ${pct(M.minP, 0)} likely); if none passes, the boss plays Stockfish's best.
4. If Maia hasn't loaded, fails, or takes more than ${num(M.timeoutMs / 1000)} s for a move (an older phone, say), the boss plays its usual Stockfish move. In Solo games and Boss alone, a boss battle waits for Maia to load before it starts, ${num(M.loadGateMs / 1000)} s at most; online, nobody waits for it. Online, two players' devices play each boss move with the same seed, so they agree, and the server compares them; a computer may load Maia for this, a phone only if it already has it.

${fixed ? `**${bossInText(fixed.name, true, src.roster)}** has a brain of his own: Maia at its top rating, ${maiaTopRating(M)}, with no guard and none of Stockfish's moves, whatever the crowd (Stockfish only while Maia loads, or where it can't run). The boy he starts as has the same brain at his own rating, climbing to that top as he grows.

` : ""}A Maia boss doesn't slip on purpose: its own mistakes take the slips' place. Its special moments keep their own engine picks: the move it makes when the God King strikes it, Boingo's move for the crowd as his Funhouse comes, Hollow's extra move after Lights Out and Big Boy's Big Bounce.

| Guard | Never gives away more than | Nor more log-odds than |
|---|---|---|
| None (every boss's own) | no limit: Maia's mistakes are human ones | no limit |
| Light | ${guard(M.light)} |
| Full | ${guard(M.full)} |
| Strict | ${guard(M.strict)} |

Maia runs in your browser as its own program. Its license and source code are in [Copyright, credits and licenses](#credits).

### The handover: from Maia to Stockfish {#handover}

A boss's strength is on Stockfish's scale, the one your rating is on; Maia's ratings are on a human scale, and the two don't line up one to one. So a Maia boss plays at a Maia rating that rises with its **level**, along straight lines. The level is the boss's strength${margin ? `, plus ${num(margin)} when a crowd plays it (a group Boss Battle${fixed ? "" : " or the Crowd's boss final"}: a crowd voting together plays above its average member); in Boss alone it's the strength itself` : ""}.

$ level = strength${margin ? ` + ${num(margin)} (a crowd)` : ""}
${lines.join("\n")}

(Below ${pts[0]![0]} the first line carries on down, to no lower than ${M.maiaRatingMin}.) Maia models people, and even the strongest people stop well short of what a top boss must play, so its rating stops rising at ${lastY}, and Stockfish takes over at the top. In between, **the bridge** hands the boss over gradually, so its strength never jumps:

- **A level below ${M.bridgeFrom}:** Maia, ${guardName[M.brain]}.
- **A level from ${M.bridgeFrom}:** Maia with the light guard; **from ${M.bridgeStrictFrom}:** Maia with the strict guard. The guard follows the level, so a crowd meets it sooner than one player: where Maia alone could no longer hold a strong crowd, the guard keeps the boss a challenge.
- **A strength over ${M.bridgeShareFrom}:** a growing share of the boss's moves are its usual Stockfish move instead, up to ${pct(M.bridgeStockfishShare, 0)} just under ${M.stockfishFrom}:

$ Stockfish's share = ${pct(M.bridgeStockfishShare, 0)} × (strength − ${M.bridgeShareFrom}) / ${M.stockfishFrom - M.bridgeShareFrom}

- **A strength from ${M.stockfishFrom} up:** Stockfish, with its blunder guard, as above.

| Boss strength | Boss alone | A crowd | Stockfish's moves |
|---|---|---|---|
${handover}

**Worked example.** A group Boss Battle's boss at ${exStrength}: its level is ${exStrength}${margin ? ` + ${num(margin)} = ${exLevel}` : ""}, so it plays Maia at ${exHeld ? `its ceiling, **${exMaia}**` : `${ey0} + ${num(exSlope, 3)} × (${exLevel} − ${ex0}) = ${ey0} + ${num(exSlope * (exLevel - ex0))} = **${exMaia}**`}${plan(exStrength, true).brain === M.brain ? "" : `, with ${guardName[plan(exStrength, true).brain]}`}. A group Boss Battle's boss at ${midBridge} plays Maia at ${midPlan.rating}${shortGuard[midPlan.brain]}, and ${pct(midPlan.stockfishShare, 0)} of its moves are Stockfish's.

These numbers come from simulated battles against crowds of bots, and may be tuned as real battles come in.

### What a rating gap means {#rating-gap}

Ratings predict results. Between two players d points apart, the stronger one's expected score (a win plus half a draw) is:

$ E = 1 / (1 + 10^(−d / 400))

| Gap (d) | Stronger side's expected score | Weaker side's |
|---|---|---|
${gaps}

So a boss 200 above you expects about ${pct(eloExpected(200), 0)} in a straight game, and at 400 above (the boss menu calls it brutal) about ${pct(eloExpected(400), 0)}. In the example above, ${ginger.name} at ${gingerElo} is ${Math.abs(youVs)} ${youVs < 0 ? "below" : "above"} you: you'd expect ${es(eloExpected(-youVs))}. A boss's powers, the God King and the crowd's own teamwork all move the real odds.
`,
  };
}

// ---------------- The bosses, one block each ----------------

/** Ginger's blizzard in a player's words: its turns, how many pieces are free on each, the thaw (BOSS_POWERS). */
function blizzardWords(p: BossPowerSettings): string {
  const turns = Math.max(2, Math.round(p.blizzardTurns));
  const free = (k: number) => p.blizzardFree[Math.min(k, p.blizzardFree.length - 1)] ?? ([1, 1] as const);
  const count = ([lo, hi]: readonly [number, number]) => (lo === hi ? num(lo) : hi === lo + 1 ? `${num(lo)} or ${num(hi)}` : `${num(lo)} to ${num(hi)}`);
  const nth = (k: number) => ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth"][k] ?? ordinal(k + 1);
  const first = free(0);
  const parts = [
    first[0] === 1 && first[1] === 1
      ? "On its first turn, only one of your pieces may move, picked at random from those that have a move (never your king nor the frozen piece, unless nothing else can move); its banner names it."
      : `On its first turn, ${count(first)} of your pieces may move, picked at random, those with a move first (never your king nor the frozen piece, unless nothing else can move).`,
  ];
  for (let k = 1; k < turns - 1; k++)
    parts.push(`On its ${nth(k)}, ${count(free(k))} may move in all: the pieces already free stay free, and more thaw, picked at random, those with a move first (never your king, unless it's the only piece that can move); the banner names them.`);
  parts.push(`On its ${nth(turns - 1)}, the ice is gone and every piece moves again.`);
  return `it lasts ${n(turns, "turn")}. ${parts.join(" ")} The pieces that thaw next turn show cracked, dripping ice the turn before. A piece that can move is always free: in check, one that can get you out of it. The Freeze waits until the Blizzard is over.`;
}

/** One block per boss (by its BOSS_ROSTER id): its opening, passive and ultimate, in a player's words. */
export const BOSS_BLOCKS: Record<string, (p: BossPowerSettings, b: BossDef) => string> = {
  gingerbread: (p) => `
Plays from the game so far.

- **Freeze** (passive): from turn ${p.firstPassive}, one of your pieces that matters (one of your three most valuable, mobile pieces; never the king) is iced and can't move for ${n(p.freezeTurns, "turn")}. Then again every ${range(p.freezeEvery)} turns.
- **Blizzard** (ultimate): ${blizzardWords(p)}`,
  clown: (p) => `
Plays from the game so far.

- **Pie** (passive): from turn ${p.firstPassive}, every ${n(p.pieEvery, "turn")}, he throws a pie in the face of one of your pieces (never your king) whose two squares diagonally behind it (toward your side) are both empty, and it splits onto those two squares: for ${n(p.pieTurns, "turn")}, nobody, on either side, may move onto them (a castling rook included). He picks at random among the three pieces whose pies would take away the most of your moves (the piece's own way back counts double). No such piece: no pie that turn, and he tries again the next. The piece he hits gets a small cream splat mark that stays on it wherever it goes; ${p.pieSplatsToFreeze === 2 ? "a second splat" : `splat number ${p.pieSplatsToFreeze}`} freezes it for ${n(p.pieFreezeTurns, "turn")} (it can't move, nor castle if it's a rook) and wipes the mark off. He never pies or freezes a piece if that would leave you without a legal move (in check too).
- **Funhouse** (ultimate): as it comes, the board turns upside down and he plays your move for you: a weak but recoverable one (giving away ${range(p.funhouseLoss)} points, never more than ${num(p.funhouseMaxLogit)} in log-odds). Nobody is scored for it. Then he plays his own, and the board keeps turning, ${n(p.funhouseStepTurns, "turn")} a step (his move for you counts as the first): upside down, then a quarter turn to one side (left or right, at random), then a half turn to the other side, then back the right way up, where it stays. From then on you play your own moves (taps and drags work at every angle, and the coordinates name the real squares), scored as usual. Once the board is back, his meter fills again; each Funhouse after that plays your move once more.`,
  grex: (p) => `
Plays from the game so far.

- **Sparkler** (passive): from turn ${p.firstPassive}, a square on your half catches fire and burns in ${n(p.fireStages, "stage")}, one a turn. A piece of yours still on it after your move on the last stage burns (never your king, nor a piece whose loss would leave a king in check: then it fizzles). The judge counts a piece left to burn as already gone, so moving it off is never a mistake. The next Sparkler comes ${n(p.fireGap, "turn")} after a fire goes out.
- **Roman Candle** (ultimate): ${p.candleShots} fireballs in waves of ${p.candleWaves.join(", ")}, one wave a turn, from ${n(p.candleDelay, "turn")} after he fires. About ${pct(p.candleOwnShare, 0)} of each wave falls on his own half (his pieces never burn: the first time one stands in that fire, he laughs about it), the rest on yours. Each wave's squares show as growing shadows ${n(p.candleAhead, "turn")} ahead, and each fireball lands as a fresh fire (never on your king's square as it's picked; if your king stands there when it lands, it fizzles). A piece of yours left on any of his fires burns, wherever it is.`,
  hollow: (p) => `
Always plays Black, from the starting position: if you'd have been Black, he claims the dark side before move 1.

- **The Dark** (passive): after his first move he covers the square of the piece he moved; then another square on every ${ordinal(p.darkEvery)} move of his (his ${[1, 2, 3].map((k) => ordinal(1 + k * p.darkEvery)).join(", ")}…), a random occupied square, never a king's. Each stays dark for ${n(p.darkTurns, "turn")}, and pieces there are hidden. A move that touches the dark goes through unchecked: if it turns out illegal, it costs ${n(p.darkTryCost, "point")} and you pick again, and your ${ordinal(p.darkTries)} wrong try in a turn ends your turn as a missed move (a turn never costs more than a missed move). Each wrong move gets a dry word from him.
- **Your ${p.darkBulbs} bulbs** (Boss alone): no points when you play him alone. You get a string of ${p.darkBulbs} of his bulbs instead, by his bar, and each wrong move into the dark puts one out (no limit a turn). When the ${p.darkBulbForced.map(ordinal).join(" and the ")} go out, the dark plays that turn's move for you: a bad one (giving away ${range(p.darkForcedLoss)} points against the best move; never one that lets him force mate, nor one that mates or stalemates on the spot). When the last one goes out, the screen goes black and you lose. Crowds, group Boss Battles and parties keep the points.
- **Deeper Dark** (passive): after his ${p.darkBlockAt.map(ordinal).join(", ")} moves a 2×2 block of squares goes dark for ${n(p.darkBlockTurns, "turn")}, and once a game, after his ${ordinal(p.darkBigAt)}, a 3×3 block for ${n(p.darkBigTurns, "turn")}. Whatever is in a block is hidden, and so is anything that moves inside it. A block never covers a king (so a king always keeps a square of escape in the light) and holds some pieces when it can. A square that was already dark stays dark until the later of its two ends.
- **Lights Out** (ultimate): at the start of his turn, a memory test in ${n(p.lightsOutRounds.length, "round")}: find ${p.lightsOutRounds.map((r) => r.pieces).join(", then ")} of his pieces (${p.lightsOutRounds.map((r) => `${num(r.ms / 1000)} s`).join(", ")}; each tap adds ${num(p.lightsOutTapMs / 1000)} s). Each piece you miss costs ${n(p.lightsOutMiss, "point")}. If the crowd finds under ${pct(p.lightsOutHold, 0)} of them, he plays an extra quiet move straight after his own (no capture, check or promotion, worth at most ${n(p.lightsOutExtraGain, "point")} to him).`,
  bigboy: (p, b) => `
Plays from the starting position, less your d- or e-pawn, which he eats before move 1 (his snack). That pawn's head start is why he plays ${Math.abs(b.offset)} under the usual strength.

- **Toy Blocks** (passive): from turn ${p.firstPassive}, every ${n(p.blockEvery, "turn")} a block lands on an empty square in your half that one of your pieces could move to, for ${n(p.blockTurns, "turn")}: nothing, on either side, may move onto it or slide through it (a knight jumps it). It never stops an attack.
- **Big Bounce** (ultimate): at the start of his turn, after the warning, ${range(p.bouncePieces)} of your pieces (never the king) bounce to empty squares up to ${n(p.bounceReach, "square")} away (pawns only sideways), into a position about ${n(p.bounceTarget, "pawn")} worse for you (from ${range(p.bounceLoss)} pawns).`,
  sawyer: (p, b) => `
Plays from the game so far, and his first move is a pawn's. Then the **Split Pawn**: that pawn is sawn in two, giving him a second pawn on an empty square beside it (never one that attacks your pieces or gives check). That head start is why he plays ${Math.abs(b.offset)} under the usual strength.

- **Saw Cuts** (passive): from turn ${p.sawFirst}, every ${n(p.sawEvery, "turn")} he saws through the edge between two squares in your half that one of your moves would cross, for ${n(p.sawTurns, "turn")}: no straight move across it (a slide, a pawn's step, the king's step, castling), on either side. Knights and diagonal moves pass.
- **Board Saw** (ultimate): once his meter is full, from turn ${p.boardSawFrom}, and while one half of the board (files a to d, or e to h) is his on material: the warning, then for ${n(p.boardSawTurns, "turn")} no move may cross between the d- and e-files, knights included, on either side. Then the halves rejoin.`,
  pig: (p, b) => `
Plays from the starting position. His first move, after yours, is the **Long Pull**: a center pawn's double step, then he lassos it one square further, three squares in one move (d7 to d4 or e7 to e4; if you're Black, e2 to e5 or d2 to d5). The engine picks the pawn that suits the position; if neither would be safe there (it would just be taken, or its way is blocked), he plays an ordinary first move. It's worth about nothing either way: flavor. His lassos are why he plays ${Math.abs(b.offset)} under the usual strength.

- **Lasso Drag** (passive): from turn ${p.dragFirst}, every ${n(p.dragEvery, "turn")}, after his move he ropes one of your pieces (never your king or a bishop) and drags it one square up, down, left or right onto an empty square. It never leaves you in check or without a move, and a pawn never ends on the first or last rank. The engine picks a drag that costs you only a little: between ${num(p.dragLoss[0])} and ${num(p.dragLoss[1])} of a pawn. If none fits (or the game is already decided), there's no drag that turn and he tries again after his next move.
- **SHOWDOWN!** (ultimate): Wrangler has a meter of his own instead of the rage meter. His moves fill it, ${n(p.showdownMeterTurns, "move")} from empty to full, and nothing else adds to it. When it's full he says "I've got you in my sights." and swings both ropes. From then on, after the first of his moves where he finds a line-up that suits him, he fires with no other warning: three pairs facing each other anywhere on the board off the back ranks, a rook against a rook, a bishop against a bishop and a knight against a knight (two pairs when three won't work; never queens). His pieces are always protected. **Your next move must be one of the duels**: one of your pieces takes the one facing it. The duels glow, and nothing else can be played. The engine sets it up so that even the right duel leaves the game about where it was or tips it his way (${p.showdownEdge[0] < 0 ? `from ${num(-p.showdownEdge[0])} of a pawn your way to ${num(p.showdownEdge[1])} his way` : `${num(p.showdownEdge[0])} to ${num(p.showdownEdge[1])} of a pawn his way`}), and a wrong one costs you ${num(p.showdownTrap)} pawns or more on top, so look before you take. He answers your duel with the engine's best move, and keeps playing the engine's moves while pieces from the line-up can still be taken (up to ${n(p.showdownEngineMoves, "move")}). Then his meter empties and fills again: at most ${n(p.showdownMax, "Showdown")} a battle.`,
  alfil: (p, b) => `
Plays from the game so far. A woolly mammoth, the bishop's ancestor: in old Persian and Arabic chess, the bishop's square held an elephant, the *alfil*. His powers are why he plays ${Math.abs(b.offset)} under the usual strength.

- **Tusks** (passive): on his ${ordinal(p.tusksFirst)} turn, then every ${n(p.tusksEvery, "turn")}, he points his ankus at two of his pawns, anywhere on the board, and they glow; then he plays his move. Take either glowing pawn on your turn and the fusion fails. If you don't, his next turn is the fusion: both pawns lift off, meet in a white flash, and an **elephant** lands on one of their two squares (the one the engine likes best for him). It's a bishop in every way, drawn as an elephant, and the fusion is his whole move that turn. If he's in check when it's due, it waits until he isn't, the pawns still glowing. It waits the same way when spending his turn on it would cost him ${n(p.passGuardPawns, "pawn")}' worth or more (a piece of his left hanging, say): he moves instead, and it comes on a later turn. If the God King strikes him just before a fusion, the elephant lands on the worse of the two squares for him. At most ${n(p.tusksMax, "elephant")} a battle.
- **Mammoth Slam** (ultimate): at the start of his turn, after the warning, he slams the board and ${n(p.slamPawns, "of your pawns", "of your pawns")} and ${n(p.slamMinors, "of your knights or bishops", "of your knights or bishops")} fly up (never your queen, a rook or your king; fewer if you have fewer). They're gone for ${n(p.slamTurns, "of your turns", "of your turns")}, then land back on their own squares as the next one begins; a growing shadow on each square shows where and when. If its square is taken by then, a piece lands on the nearest empty square: a bishop on its own color, a pawn never on the first or last rank, never giving check, and never where it would just be taken when another square avoids that. The engine picks the pieces so the hit is real but capped: about ${num(p.slamTarget)} of a pawn (from ${range(p.slamLoss)}), the turns they're up played out; if nothing fits, nothing flies, and he tries again at the start of his next turn. They never leave you mated in one: if he could mate only because they're up, they land at once. He sees them coming, though: on his move just before they land (his fusion too), his move still comes from the board as it is, but it's weighed with them back down, and a move that would give away more than [the blunder guard](#stockfish-brain) allows once they land gives way to his best one there, whichever brain picked it. The judge scores your moves on the board as it stands (it doesn't know they're coming back).`,
  hopper: (p, b) => {
    const tiers = Array.from({ length: p.carrotCount + 1 }, (_, k) => k);
    const rows = tiers.map((k) => `| ${k} | ${oddsWords(k, p)} | ${k >= p.carrotCount ? "" : num(Math.round(averageWorth(k, p) * 100) / 100)} |`).join("\n");
    return `
Plays from the game so far. Chub, a rabbit, riding his best friend Chirp, a grasshopper; Chub does the talking. Their powers are why they play ${Math.abs(b.offset)} under the usual strength.

- **Leapfrog** (passive): at the start of their turn, when one of their pawns stands nose to nose with one of yours (yours on the square in front of it) and the square beyond yours is empty, Chirp hops their pawn over yours onto it, and then they play their move as usual. Never onto your last two ranks, never with a pinned pawn, never while they're in check (it waits), and never a hop that gives check, frees a pawn of theirs to promote, leaves them without a move or hands them a mate in one they didn't already have. When more than one pawn can, the engine picks the hop best for them. At most ${n(p.hopMax, "hop")} a battle, one a turn. A hop clears the en passant square and starts the fifty-move count again.
- **Carrot Patch** (ultimate, **once a battle**): at the start of their turn, after the warning, Chub plants ${n(p.carrotCount, "carrot")} on empty squares (at least one on each half of the board, no two touching), and that's their whole turn, so you move first in the race. A piece pulls a carrot by ending its move on it: any piece, a capture there and a castling rook count, and so does their hop landing on one (but a hop never pulls their last carrot, nor brings one into reach of the move that follows). A pulled carrot stays pulled, and the dock counts them. Each side has ${n(p.carrotMoves, "move")}; the race ends when every carrot is pulled or both sides' moves are done, and carrots still in the ground count for nobody. **Their ${["first", "second", "third", "fourth", "fifth", "sixth", "seventh"][p.carrotCount - 1] ?? ordinal(p.carrotCount)} carrot wins them the battle on the spot.** Otherwise, after their move, they spin a reel for a prize by how many carrots they pulled (you get no prize: every carrot you pull lowers theirs):

| Their carrots | Their spin | Average (pawns) |
|---|---|---|
${rows}

The reel shows each prize as often as its odds and stops where the roll says (the server rolls it online, so everyone sees the same spin); it only ever comes from this power and has nothing to do with coins or anything you can buy. The prize pieces go on their side: pawns on their second row, then their third; other pieces on their back row, then their second, nearest the middle first; never giving check, a bishop on the color their bishops lack first. If the engines can't take a prize (more than 8 pawns a side, or more pieces than promotions could make), it steps down to the next one that fits. If the battle ends before the race does, there's no spin. The judge weighs the race too: a move that pulls a carrot, or gets to one first, can be your best move. After the Carrot Patch, their meter is gone for the rest of the battle.`;
  },
  smudgy: (p, b) => `
Always plays from the starting position, whichever side he has. A chameleon who never could blend in, so he learned to paint. ${b.offset < 0 ? `His powers are why he plays ${Math.abs(b.offset)} under the usual strength.` : b.offset > 0 ? `He plays ${b.offset} over the usual strength.` : "He plays at the usual strength: his forced opening costs him what his powers gain."}

- **Camouflage** (passive, once a battle): his first two moves are always the same: an end pawn (the a- or h-pawn) two squares, then the rook behind it out through the gap to its third rank. Before your move, paint covers his pawns and the rook swaps places with one of them: a real pawn now stands where the rook was, and the rook hides as one of his pawns. You don't know which. It moves like a pawn (one square forward, or two from its first row, never a capture) until his ${ordinal(p.camoStrikeTurn)} turn after the swap; from then on it can strike with any rook move, and the paint drips off. It's also revealed at once if it gives check, and if you take it, you've taken a rook. The board hides it only while the battle lasts: once it's over, the board shows the real position. A move of yours that the hidden rook makes illegal (your king into its line, a piece of yours it pins) is refused, and you pick again at no cost. The judge scores your moves on the real board, rook and all. If his first two moves can't be played (he's in check, a square is taken), they wait for a later turn; after ${n(p.camoTries, "turn")} without them, there's no Camouflage that battle.
- **Repaint** (ultimate, at most ${n(p.repaintMax, "time")} a battle): at the start of his turn, after the warning, he paints one of his pawns your color and one of your knights or bishops his, and that's his whole turn, so you move next. The engine picks the pair to leave you about ${n(p.repaintTarget, "pawn")} worse (between ${num(p.repaintBand[0])} and ${num(p.repaintBand[1])} when a pair fits that, else the nearest), counting what you could take at once. Never your queen, rooks or king, never one of his pawns one step from promoting for you, never anything that puts either side in check or hands either a mate in one, and never a ninth pawn for anyone (so not while you still have all eight). A painted pawn marches the other way now, toward its new side's last row. He warns only when a pair is there to paint, and once warned it comes: if your move leaves no pair, he paints on his next turn that has one. After his last, his meter is gone for the rest of the battle.`,
  moo: (p, b) => `
Plays from the game so far. Moo is a cow who can't talk; the Moon, his best friend, talks for both of them. ${b.offset < 0 ? `Their powers are why they play ${Math.abs(b.offset)} under the usual strength.` : b.offset > 0 ? `They play ${b.offset} over the usual strength.` : "They play at the usual strength."}

- **Moonbeam** (passive): after every ${ordinal(p.moonbeamEvery)} move of his, at the end of his turn, a beam of moonlight lands on one of your pieces. That piece glows, with a crescent moon burned into its square, and can't move on your next turn (tap it and the dock tells you); then it's free. It still attacks and defends. ${p.moonbeamTarget === "best" ? "The beam takes the piece you'd most want to move (the one in the engine's best move for you)." : p.moonbeamTarget === "valuable" ? "The beam takes one of your three most valuable pieces that can move, at random." : "The beam takes one of your pieces that can move, at random."} Never your king, and never a beam that leaves you no move: then it takes another piece, or none that turn.
- **Full Moon** (ultimate): at the start of his turn, after the warning, Moo takes in the moon's power (his fur turns gold and flames flare round him), then plays his move. For ${n(p.fullMoonMoves, "move")} of his, that one first, he plays the engine's best move at full strength. That first turn ends with a flurry: ${n(p.flurryBeams, "moonbeam")} on ${num(p.flurryBeams)} different pieces of yours, ${p.moonbeamTarget === "best" ? "your most useful first" : "picked the same way"}, each stuck for your next turn (never your king, and fewer if you'd have no move left). It takes the place of that turn's Moonbeam. After his last move at full strength he's dazed and back to his usual strength. His meter stays empty while the Full Moon lasts.`,
  gardener: (p, b) => {
    const o = p.waterOdds;
    return `
Always plays from the starting position, whichever side he has. A hippo with a garden hose: he plants seeds as the clock runs and waters them when he's angry. ${b.offset < 0 ? `His powers are why he plays ${Math.abs(b.offset)} under the usual strength.` : b.offset > 0 ? `He plays ${b.offset} over the usual strength.` : "He plays at the usual strength."}

- **Seeds** (passive): ${num(p.seedsAtStart)} seeds go in as the battle begins, then one more every ${num(p.seedEverySec)} seconds of real time, whoever's turn it is, up to ${num(p.seedMax)} waiting. His seed meter shows how many are waiting and fills toward the next. Where they are isn't decided until he waters, so there's nothing to spot: the seeds you see him toss and sink in are only for show. Online the server's clock counts; playing alone, it counts only while the game is on your screen. Take your time if you like, but every ${num(p.seedEverySec)} seconds is another seed.
- **Watering** (ultimate): at the start of his turn, after the warning, he waters the board, and that's his whole turn, so you move next. Every waiting seed comes up, and his seed meter starts again from none. Each seed is a roll: nothing (${o.nothing}%), a plain plant (${o.plant}%), a killer plant (${o.killer}%), a pawn for him (${o.pawn}%), a knight, bishop or rook for him (${o.piece}%), or a queen for him (${o.queen}%). A plain plant grows on an empty square and blocks it for ${n(p.plantTurns, "turn")} of yours (green, then fall colors, then dropping its leaves), then it's gone: nothing can move onto it or through it, his pieces included; a knight jumps it, and it never stops a check or an attack. A killer plant eats a piece, yours or his (never a king). A grown piece is his, on an empty square (a pawn never on the first or last row, and never a ninth). The engine decides where everything comes up, so that what he gains is about ${n(p.waterTarget, "pawn")} (at most ${num(p.waterBand[1])}); anything that can't come up without gaining him more than that comes up as nothing instead. A queen is his jackpot, and it has no cap: the engine puts it where it does him real good, and whatever else comes up with it takes his gain no further than ${n(p.jackpotMax, "pawn")}, or than the queen alone did. While all eight of his pawns are on the board, he can't grow a piece he still has a full set of (a second queen, a third rook, bishop or knight): that seed comes up as nothing. Never anything that puts either side in check, hands either a mate in one, or leaves you without a move. If watering would cost him real material (a piece of his left hanging), it waits for his next turn.`;
  },
  tiger: (p, b) => {
    const o = p.balloonOdds;
    const pop = p.balloonPops;
    const popped = (Object.keys(o) as (keyof typeof o)[]).reduce((t, k) => t + (o[k] * pop[k]) / 100, 0);
    const queens = o.queen + o.fakeQueen;
    return `
Plays from the game so far. A circus tiger who hated his act (the roaring, the jumping through hoops): he'd rather blow up balloons shaped like chess pieces. ${b.offset < 0 ? `His powers are why he plays ${Math.abs(b.offset)} under the usual strength.` : b.offset > 0 ? `He plays ${b.offset} over the usual strength.` : "He plays at the usual strength."}

- **Balloons** (passive): at the start of his turn, if his pump is empty, he puts a new balloon on it. It blows up in ${num(p.balloonStages)} stages of ${num(p.balloonStageSec)} seconds of real time, looking a little more like its piece at each, then waits, ready. Online the server's clock counts; playing alone, it counts only while the game is on your screen. At the end of his turn a ready balloon either flies onto the board as one of his pieces, or pops. Most are pawns (${o.pawn}%), then knights and bishops (${o.knight}% and ${o.bishop}%), rooks (${o.rook}%) and queens (${queens}%), and many pop: a pawn ${pop.pawn}% of the time, a knight, bishop or rook ${pop.knight}%. Most queen balloons are duds that always pop (${o.fakeQueen} in every ${queens}), and you can't tell which until it pops or lands. In all, about ${Math.round(popped)}% of his balloons pop, and he never lands more than ${num(p.balloonLandsInRow)} in a row: after ${num(p.balloonLandsInRow)} landings, the next one pops, unless it's a real queen. Where one lands, the engine decides: never a square you attack (you can't take it at once), never a check, never a mate in one for either side, never inside a hoop, never a position that leaves you without a move; of the squares left, the one that helps him least, about a piece's worth. If no square fits, it waits, ready, until the end of his next turn. A balloon he couldn't have in a real game pops instead: a ninth pawn, or an extra piece (a second queen, a third rook, bishop or knight) beyond what his missing pawns could have promoted into. So while all eight of his pawns are on the board, only a piece he has lost can come back.
- **Hoops** (ultimate): on his turn after the warning, he plays his move as usual, then throws ${num(p.hoopsCount)} burning hoops onto the board before your turn. Each hoop rings a block of 2×2 squares, never on the first or last row, with room between them. For your next ${n(p.hoopsCrowdMoves, "move")}, and his move between them, nothing moves or captures across a hoop: no piece moves into a block, out of it or through it (a knight neither). Pieces inside can still move within their block. Attacks across a hoop still count for the kings: a king can't step onto a square attacked across one, a piece pinned across one stays pinned, and no move may give check across one. If the hoops would leave a side with no move at all, they stop nothing that turn. The engine picks where they land, the ones that hem you in the most, never leaving you without a move or handing either side a mate in one. As your second move lands, the hoops burn out. If his move puts your king in check, they wait until after his next move.`;
  },

  folio: (p, b) => `
Plays from the game so far. A paper crane folded from a page of handwriting. It tells you the truth, but it never takes anything back for you. ${b.offset < 0 ? `Its powers are why it plays ${Math.abs(b.offset)} under the usual strength.` : b.offset > 0 ? `It plays ${b.offset} over the usual strength.` : "It plays at the usual strength."}

- **Draft** (passive): from turn ${p.draftFirst}, every ${n(p.draftEvery, "turn")}, Folio writes an ink mark under one of your pieces that one of its pieces attacks, and the line of that attack shows faintly. The piece is the most valuable one that you defend and that no cheaper piece of Folio's attacks (never your king; between pieces of equal value, one at random). You have ${n(p.draftWindow, "move")} to end that attack: move the piece, block the line, take the attacker, or anything else that stops it. If the same piece of Folio's still attacks it after your ${ordinal(p.draftWindow)} move, your piece is folded: it can't move for ${n(p.foldTurns, "turn")} (tap it and the line under the board says so). The mark goes as soon as the attack ends, even when Folio moves its own piece away. One mark at a time.
- **Crease** (ultimate): when the rage meter fills, the warning shows a faint line on the board: where the crease will fall. As your next turn begins, the board is creased along that line (between two files, or two rows) for ${n(p.creaseTurns, "turn")}: none of your pieces may move across it, knights included, and no castling whose king or rook would cross it. Folio folds the board toward itself: its own pieces cross it freely. Attacks still cross it, so checks and pins work as usual. The engine picks the line when the warning shows: the one that costs you nearest ${num(p.creaseLossMin)} to ${num(p.creaseLossMax)} pawns as the board stands then, never more. It never picks a line that leaves you without a move, takes away your mate in one or hands Folio one, and it checks that again as the crease falls: if the board has changed so that it would, the crease doesn't fall. While it holds, if every move you have crosses it (say, your only way out of check), it lifts for that turn, as Sawyer's board saw does.
- **Revision** (once a battle): when your move punishes a blunder of Folio's (its move cost it ${n(p.revisionDrop, "pawn")} or more against its best, and your reply found it), it crosses out both moves: the board goes back to before its move, it plays the engine's best move there instead, and you move again. Your picks on the crossed-out move keep their points. Never before turn ${p.revisionFrom}, and never after a move that ends the battle. It only ever rewrites its own mistake, never yours.`,

  // (Timber is in the game for admins first, BOSS_ADMIN_FIRST: his block shows in the FAQ once he's live for everyone.)
  timber: (p, b) => {
    const c = p.workshopCosts;
    return `
Plays from the game so far. A beaver builder in an orange hard hat, planks on his back, a woodpecker foreman at his workshop. ${b.offset < 0 ? `His powers are why he plays ${Math.abs(b.offset)} under the usual strength.` : b.offset > 0 ? `He plays ${b.offset} over the usual strength.` : "He plays at the usual strength."}

- **Scraps** (passive): his workshop, the strip in his bar, builds a pawn (${num(c.p)} scraps), a knight (${num(c.n)}), a bishop (${num(c.b)}), a rook (${num(c.r)}) and a queen (${num(c.q)}). He gets a scrap every ${num(p.scrapEverySec)} seconds of real time, whoever's turn it is, and ${num(p.scrapsPerCapture)} more for every piece of yours he takes; each scrap goes to one of the pieces not yet finished, at random. Online the server's clock counts; playing alone, it counts only while the game is on your screen. At the end of his turn, one finished piece, the first finished that he could have in a real game (never a ninth pawn, nor an extra piece beyond what his missing pawns could have promoted into: while he has his whole army, nothing can drop), is dropped onto an empty square of his half of the board: never one you attack, never a pawn on the last row, never a check, never a mate in one for either side, never leaving you without a move, and never one that would put him more than ${n(p.workshopLeadMax, "pawn")} ahead of you on material (he rebuilds what he lost): it waits. One a turn, at most ${n(p.workshopDropMax, "piece")} a battle; then his workshop closes. A finished piece's slot starts again from none.
- **Gnaw** (ultimate): on his turn after the warning, he plays his move, then gnaws one of your pawns, at random: it's gone, and makes ${n(p.gnawScraps, "scrap")} for his workshop. Never a pawn whose going would put your king in check or leave you without a move. If you have no pawns, there's nothing to gnaw. At most ${n(p.maxUltimates["timber"] ?? 0, "Gnaw")} a battle: after that his rage meter stays empty.`;
  },
  // (Don Dough is in the game for admins first, BOSS_ADMIN_FIRST: his block shows in the FAQ once he's live for everyone.)
  zebra: (p, b) => {
    const t = p.doughTimers;
    return `
Plays from the game so far. A pudgy zebra kingpin in a fedora who runs a bakery, "just a bakery", and fires his bread roll like a rifle. Really, he and his crew are chess nuts: about 4 moves in, he says what he thinks of your opening. ${b.offset < 0 ? `His powers are why he plays ${Math.abs(b.offset)} under the usual strength.` : b.offset > 0 ? `He plays ${b.offset} over the usual strength.` : "He plays at the usual strength."}

- **Rising Dough** (passive): a few times early in the battle (at most ${n(p.doughDrops, "time")}, ${num(p.doughLive)} on the board at once), at the end of his turn he drops a lump of dough on an empty square of his half of the board, shaped like the piece it will become. An oven timer in his bar counts down for it: pawn ${num(t.p)}, knight and bishop ${num(t.n)}, rook ${num(t.r)}, queen ${num(t.q)}, one off for every move, yours and his. At 00:00 his piece rises there. Land any piece of yours on the dough to squash it (a pawn can push onto it too); his pieces never step on it, and it never blocks a move across it. A pawn is most likely, rooks and queens are rare and go nearer his side. It's never a piece he couldn't have in a real game (a ninth pawn, or an extra piece his missing pawns couldn't have promoted into), and never one that would put him more than ${n(p.doughLeadMax, "pawn")} ahead of you on material (a queen is the rare exception). A piece never rises with check, into a mate in one for either side, or leaving a side with no move: then it waits at 00:00 for the next move.
- **Gold Plate** (ultimate, at most ${n(p.maxUltimates["zebra"] ?? 0, "time")} a battle): after the warning, at the start of his turn, he glazes his queen in gold (if he has no queen, or it's gold already, his strongest other piece), then plays his move. For the rest of the battle your pawns can't capture that piece; your other pieces can. If the only legal move you have is a pawn taking it, that move is allowed.`;
  },
  dash: (p, b) => `
Plays from the game so far. A lanky, cocky cheetah in a backwards orange cap and a teal and orange track jacket, a chess clock under his arm, his tortoise Tick asleep on the clock in his bar. He never stops to think: his moves come at once. ${b.offset < 0 ? `His powers are why he plays ${Math.abs(b.offset)} under the usual strength.` : b.offset > 0 ? `He plays ${b.offset} over the usual strength.` : "He plays at the usual strength."}

Your time is the clock at the right of the box under the board: alone or in a party it's your time bank for the battle (the team's one bank in a party); in a group Boss Battle it's each move's timer.
- **Clock Slap** (passive): every time he takes one of your pieces he slaps his clock and steals your time: ${n(p.slapBankSeconds, "second")} off your bank, or in a group Boss Battle your next move's timer ${n(p.slapMoveSeconds, "second")} shorter (never under ${n(p.slapMoveMin, "second")}). Tick, in his bar, keeps count of what he's stolen.
- **Time Scramble** (ultimate, at most ${n(p.maxUltimates["dash"] ?? 0, "time")} a battle): after the warning, your next ${n(p.scrambleMoves, "move")} get ${n(p.scrambleSeconds, "second")} each, counted down over the board. They still come out of your bank, which still gets its extra seconds.
- **Scramble Rush** (once a battle, never before move ${num(p.dashScramble.from)}, warned a turn ahead: "Next turn: Scramble Rush"): "1.00" counts down to "0.00" over ${n(p.dashScramble.countdownMs / 1000, "second")} while his copies race across the board, moving ${n(p.dashScramble.pieces, "piece")} of yours and ${num(p.dashScramble.pieces)} of his (never a king). Then you have ${n(p.dashScramble.placeMs / 1000, "second")} to drag or tap them back, each piece at most ${n(p.dashScramble.movesPerPiece, "time")}: a green edge where one is right, a red edge where it isn't. Fewer than ${num(p.dashScramble.needCorrect)} of the ${num(p.dashScramble.pieces * 2)} back (solo, yours alone; online with a crowd, on average) and he plays an extra move at once: the move list shows both of his moves. Either way the board goes back exactly as it was: only the screen showed them moved.
- **Out of time** against him is never a loss: a move is played for you instead, picked at random from the ${n(p.flagTop, "best move")} (in a group Boss Battle, only if nobody picked in time). Your bank can run down to nothing; each move then has just its extra seconds.`,
};

/**
 * The Crowd's boss final's boss (Eric, Oct 14: always the Hidden Boss; since Nov 13 also from his room in the town, HIDDEN_ROOM): his opening, his
 * passive and ultimate, and his second phase, every number from the settings (BOSS_POWERS, RECLUSE_PHASE2, BOSS_BRAIN).
 */
function crowdFinalBlock(src: FaqSources, b: BossDef): string {
  const p = src.powers;
  const P = src.phase2;
  const n2 = crowdFinalists("boss", src.crowdKnockouts, src.crowd.lobbySize);
  const clock = (sec: number) => (sec % 60 ? `${num(sec)} s` : n(sec / 60, "minute"));
  const increment = p.bulletIncrementSeconds > 0 ? `; the first ${n(p.bulletPlainMoves, "move")} on it add no time, then each move made in time adds ${num(p.bulletIncrementSeconds)} s` : ", and nothing adds time";
  return `
Met in the Crowd's boss final, where it's always him, against the top ${n2}, and in Chess Town: up the stairs of his walk-up to the top floor, where up to ${n(HIDDEN_ROOM.players, "player")} in his room challenge him together (each taps **Challenge**; at ${HIDDEN_ROOM.players} you fight him as one team: the move most of you picked is played, and a tie goes to the stronger move; if ${HIDDEN_ROOM.players} haven't challenged within ${n(HIDDEN_ROOM.capSec / 60, "minute")}, the request ends). He plays from the starting position (he has no memorized openings), with the crowd as White, and his strength never follows anyone's rating: Maia at its top, raw. More in [his strength and brain](#boss-strength).

- **First, the child**: he begins as a boy with no powers at all (no No Help, no Bullet: the God King's help works), Maia at ${num(RECLUSE_CHILD.startRating)}, ${num(RECLUSE_CHILD.stepRating)} stronger every ${n(RECLUSE_CHILD.everyPlies, "move")} on the board (yours and his), up to ${num(maiaTopRating())}, the man's own strength. His level climbs with it, and he grows older as it does. Beat him and he grows up: a new game starts from the beginning, against the man below. If the boy wins or it's a draw, the fight is over.
- **No Help** (passive): the God King's help doesn't work against him: his move, his strike and his Last Stand never come. Calling him spends a charge all the same, and ${bossInText(b.name, false, src.roster)} mocks it. He never strikes anyone down either: all ${n2} of you play to the end.
- **Bullet** (ultimate): a meter of his own, full as turn ${p.bulletTurn} begins, when it comes with no warning. From then on every bank is ${clock(p.bulletBankSeconds)}, with no cap on a move${increment}. If everyone still in runs out of time, he wins on time.
- **Beaten:** his second phase follows, online and in a Solo game: he absorbs the God King (gone for the rest of the fight), then ${n(P.boards, "board")} of Freestyle chess at once (the back-row pieces shuffled), each from its own start, one for each of you who fought him (bots on any left over; online, a bot plays on for anyone who leaves), against Stockfish at ${num(P.elo)}. A ${num(P.change.countdownSeconds)}-second countdown on every board, then ${clock(P.bankSeconds)} a board with no added time, and a board whose clock runs out is lost; all ${num(P.boards)} must be won. A move slower than ${num(P.slowMoveSeconds)} s counts against the team, and the team's ${ordinal(P.slowMovesForUlt)} brings his last power: from then on ${num(P.ultMoveSeconds)} s a move on every board, and a move out of time is played at random for you.`;
}

function bossPowers(src: FaqSources): FaqSection {
  const p = src.powers;
  const playable = src.roster.filter(isPlayable);
  // (Still to come: those without their art and powers. The Crowd's boss final's boss has his own block, after the rest.)
  const later = src.roster.filter((b) => b.kit === null || b.powers === null).map((b) => b.name);
  const finalBoss = crowdFinalBoss(src.roster);
  const level = Math.ceil(p.rageFull / (p.ragePerMove || 1));
  const ahead = Math.ceil(p.rageFull / (p.ragePerMove + p.rageAheadMax || 1));
  const queen = 9 * p.ragePerMaterial >= p.rageFull;
  // (Wrangler's meter is his own: below.)
  const speeds = playable.filter((b) => b.id !== "pig").map((b) => `${b.name} ×${num(p.rageSpeed[b.id] ?? 1)}`).join(", ");
  const blocks = playable
    .map((b) => {
      const words = BOSS_BLOCKS[b.id];
      return `### ${b.name} {#boss-${b.id}}\n${words ? words(p, b) : ""}`;
    })
    .concat(finalBoss && !playable.includes(finalBoss) ? [`### ${finalBoss.name} {#boss-${finalBoss.id}}\n${crowdFinalBlock(src, finalBoss)}`] : [])
    .join("\n\n");
  return {
    id: "boss-powers",
    title: "Boss powers and the rage meter",
    tocSubs: true,
    body: `
### How powers work {#power-rules}

Every boss has a **passive** power that comes every few turns and an **ultimate** that comes whenever its rage meter is full, again and again. Turns count the crowd's moves: turn 1 is the crowd's first move of the battle. For every boss:

- Every power is decided by the game from the battle's own random draw and the position, so everyone sees exactly the same thing.
- A power never leaves anyone without a legal move and never stops you getting out of check: a limit that would lifts for that turn. Your king is never frozen. The boss is no different: when Sawyer's saw or cut, a pie or a toy block stops every move he has (say, his only way out of check), he plays one anyway, and the line under the board says so.
- A move of yours that a power stops stays where it was, and the line under the board says why ("${REFUSED.boardsaw}").
- The judge plays by the same rules: while a power limits your moves, the best move is the best of the ones you're allowed.
- The clock stands still while a power plays out: it never costs you thinking time.

### The rage meter {#rage-meter}

The meter fills to ${p.rageFull}${p.rageOverTime ? `:\n\n- ${p.ragePerMove} for every crowd move,\n- up to ${p.rageAheadMax} more a move while the crowd is ahead (by the judge's expected score: nothing at 0.50, all of it from ${num(p.rageAheadFull)}),` : ":\n"}
- ${num(p.ragePerMaterial)} for every point of material the boss loses (a pawn is 1, a knight or bishop 3, a rook 5, a queen 9)${queen ? ": taking his queen fills it on its own" : `: taking his queen fills ${pct((9 * p.ragePerMaterial) / p.rageFull, 0)} of it`},
- ${p.rageStrike} each time the God King strikes the boss ([his strike](#king-charges)).

Each boss's meter fills at its own speed (everything above times it): ${speeds}. The ones whose ultimates last longer fill faster, so each gets about two in a typical battle (Jefferson about one and a half: his barrage lasts longest). These rates are estimates, and may be tuned as real battles come in.
${
  p.rageOverTime
    ? `
$ rage a crowd move = ${p.ragePerMove} + ${p.rageAheadMax} × the crowd's lead, where the lead = (expected score − 0.5) / ${num(p.rageAheadFull - 0.5)}, from 0 to 1

In a level game (at ×1) it's full after about ${n(level, "crowd move")}; with the crowd well ahead, after about ${ahead}.
`
    : ""
}
When it's full: **"RAGE!"** and a warning as the next turn begins, then the ultimate the turn after. Hollow's, Big Boy's, Alfil's and Chub & Chirp's ultimates come at the start of their own turn instead (Lights Out's only warning is the full meter), Sawyer's needs more than a full meter, and Wrangler has a meter of his own with no warning (below).

Then the meter empties and fills again for the next one. While an ultimate is still under way (the Blizzard's ${n(Math.max(2, Math.round(p.blizzardTurns)), "turn")}, the Roman Candle's fireballs still falling or burning, the board flipped or sawn in two, Lights Out and the extra move after it, Alfil's Slam while your pieces are up) the meter stays empty, dimmed, and nothing adds to it, so two ultimates never overlap. Chub & Chirp's Carrot Patch comes once a battle: after it, their meter is gone.

### The level in a boss's bar {#boss-level}

Under each boss's name the bar shows a level, like "LVL 54": a number from 1 to ${src.level.max} for how strong the boss plays. It starts from the boss's strength (its rating over ${src.level.divisor}) and moves up or down by up to ${src.level.spread} for each battle, so the same boss can show a different level next time; it's the same for everyone in a battle. It follows his strength as it changes: while the boss plays at full strength (Moo & Moon's Full Moon, Wrangler's reply to his showdown) the level rises, gold with a small arrow, and for the one move the God King's strike weakens it falls ${src.level.weakDrop / src.level.divisor} levels, red with a slash, then it's back. The Crowd's final boss shows "LVL ???" (as the child, his first form, his level shows and climbs a step at a time).

${blocks}
${later.length ? `\n### Still to come {#bosses-later}\n\n${n(later.length, "more boss", "more bosses")} are waiting for their art and powers: ${later.join(", ")}.` : ""}
`,
  };
}

function godKing(src: FaqSources): FaqSection {
  const S = src.settings;
  // (The Crowd's boss final's boss, the Hidden Boss: the God King's help doesn't work against him.)
  const finalBoss = crowdFinalBoss(src.roster);
  // (The crowd's moves played before the first one he can save: none on its first lastStandFromMove moves.)
  const from = S.lastStandFromMove;
  const first = from + 1;
  const bar = (best: number, moves: number, charges: number) => (best * 100 < S.lastStandFrom ? "no save" : num(lastStandBar(best, moves, charges, S), 1));
  // Sample positions: comfortable, the edge of the weak band, two inside it, and just under the no-save line.
  const mid = (S.lastStandFrom + S.lastStandShareBelow) / 200;
  const rows = [0.6, S.lastStandShareBelow / 100, mid, mid - 0.05, S.lastStandFrom / 100 - 0.01]
    .map((x) => Math.round(x * 100) / 100)
    .filter((x, i, a) => x > 0 && a.indexOf(x) === i)
    .sort((a, b) => b - a)
    .map((b) => `| ${pct(b, 0)} | ${bar(b, from, 1)} | ${bar(b, from, 0)} | ${bar(b, Math.max(from, S.lastStandDecayMoves), 0)} |`)
    .join("\n");
  const start = S.lastStandLoss + S.lastStandChargedExtra;
  const end = S.lastStandLossFloor + S.lastStandChargedExtra;
  const weak = 0.25;
  return {
    id: "god-king",
    title: "The God King",
    tocSubs: true,
    body: `
### Who he is {#king-who}

The crowd's champion in every Boss Battle (alone, in a party or in a group) and the Crowd's boss final. He stands by the board in your side's colors, talks now and then, and acts when the crowd calls him. He's there for the big moments, not to play the game for you.${finalBoss ? ` His help doesn't work against [${bossInText(finalBoss.name, false, src.roster)}](#boss-${finalBoss.id}), the Crowd's boss, once he's grown up: calling him then only spends a charge. Against the boy he starts as, it works.` : ""}

### Strike or play: his charges {#king-charges}

He has up to ${n(S.kingChargesMax, "charge")}. In a Boss Battle he starts with ${S.kingChargesMax}. In the Crowd's boss final, the finalists' leftover power-ups become his charges: one for every ${S.kingPowerUpsPerCharge}, rounded, at least ${kingCharges(0, S)} and at most ${S.kingChargesMax}.${finalBoss ? ` Once [${bossInText(finalBoss.name, false, src.roster)}](#boss-${finalBoss.id}) has grown up there, a call only spends one: his help doesn't work against the man.` : ""} Tap him to open his menu:

- **Play this move:** he plays the judge's best move for the crowd (stronger than the boss).
- **Strike the boss:** three bolts on the boss's king, and the boss's next move is one that gives away ${range(S.kingStrikeLoss)} points (never a piece for nothing). One strike a move. It enrages the boss too: ${src.powers.rageStrike} on its [rage meter](#rage-meter) (unless an ultimate is under way; Wrangler's meter is his own, and a strike adds nothing to it).

Either needs **more than half the crowd** to call him. Bots back a person's call ${pct(S.kingBotFollow, 0)} of the time, and call him to play themselves when the crowd's popular move would give away ${n(S.kingBotLoss, "point")} or more. In Boss alone, your call is enough. If you call him to play instead of picking, you sit that turn out: no score either way, and it isn't a miss. The clock stands still while he acts, and a move he plays is never brilliant.

### His save: the Last Stand {#last-stand}

Once per battle, with or without charges, he steps in to stop a disaster. When the crowd's move is played and the judge's numbers say it gave away at least **the bar** (points against the best move), he dives onto the board, takes the blow meant for your piece and falls. The move is undone, and the crowd picks again with a fresh clock (the move he took back is off the table). The round's scores stand: the picks that chose it still cost what they cost.

${from > 0 ? `**Not before move ${first}.** He never steps in on the crowd's first ${n(from, "move")} of the battle: he's ready from its ${ordinal(first)} move on. The moves count from the battle's start, however it began (a Random opening, Freestyle, or a battle that picks up a game in progress).\n` : ""}
$ plain bar = ${S.lastStandLossFloor} + ${S.lastStandLoss - S.lastStandLossFloor} × max(0, 1 − crowd moves / ${S.lastStandDecayMoves}) + ${S.lastStandChargedExtra} while he has charges

So it starts at ${start} with charges (${S.lastStandLoss} without)${from > 0 ? `, is ${num(lastStandBar(0.5, from, 1, S), 1)} (${num(lastStandBar(0.5, from, 0, S), 1)}) on move ${first}, the first he can save,` : ""} and eases to ${end} (${S.lastStandLossFloor}) by crowd move ${S.lastStandDecayMoves}, then stays there. In a weak position there are fewer points to lose, so the chances left matter too (the chances left are the best move's expected score):

- **Under ${S.lastStandFrom}%:** no save. The game already counts as lost.
- **From ${S.lastStandFrom}% to ${S.lastStandShareBelow}%:** the bar is ${S.lastStandShare === 0.5 ? "half" : pct(S.lastStandShare, 0)} of the chances left, when that's lower than the plain bar.
- **From ${S.lastStandShareBelow}% up:** the plain bar.

$ bar = min(plain bar, ${num(S.lastStandShare)} × chances left)    (from ${S.lastStandFrom}% to ${S.lastStandShareBelow}%)

| Best move worth | ${from > 0 ? `Move ${first}` : "First move"}, with charges | ${from > 0 ? `Move ${first}` : "First move"}, none | Move ${Math.max(from, S.lastStandDecayMoves)} on, none |
|---|---|---|---|
${rows}

**Worked example.** On move ${first}, from a level position, the crowd hangs its queen: that gives away 50 to 70 points, well over ${num(lastStandBar(0.5, from, 1, S), 1)}, so he saves it${from > 0 ? ` (the same queen hung on move ${from} would stand)` : ""}. Later, with the crowd down to ${pct(weak, 0)}, a move that throws away ${num(lastStandBar(weak, from, 1, S), 1)} points (half of what was left) calls him too. A sacrifice the engine likes gives nothing away, so it never calls him: he judges the chances, not the material.

**What you see:** a warning, everything freezes, he dives onto the piece's square with his cut-in, the piece slides back, he takes the blow (the boss drops in and attacks him: Hollow lashes him with his string of lights, Alfil jabs him with his ankus, Sawyer saws at him, Wrangler cracks his lasso at him, Boingo pies him, Big Boy bonks him with his lollipop, Ginger jabs him with his candy cane and Jefferson fires his Roman candle at him), staggers, falls and fades. Then the crowd picks again. He's gone for the rest of the battle, and the charges he fell with go to the crowd: everyone still in gets ${n(S.lastStandPowerUps, "power-up")} for each (a power-up shows the engine's top 3 moves). He never steps in when only one move was possible.

He also sits out while a boss's power has changed the board (hoops, blocks, plants, frozen or hidden squares…): your move stands, nothing is spent, and once the board is back to normal he's ready again.
`,
  };
}

function crates(src: FaqSources): FaqSection {
  const name = (id: string) => (id === "fischer" ? "Fischer Random" : (src.itemTiers.find((t) => t.id === id)?.name ?? id));
  const strips = src.crates.map((c) => {
    const live = liveStrip(c);
    const total = sum(live.map((x) => x.weight)) || 1;
    return new Map(live.map((x) => [x.tier as string, x.weight / total]));
  });
  const tiers = [...new Set(src.crates.flatMap((c) => c.strip.map((x) => x.tier as string)))];
  const stripRows = tiers.map((t) => `| ${name(t)} | ${strips.map((m) => (m.has(t) ? pct(m.get(t)!) : "–")).join(" | ")} |`).join("\n");
  // Fischer Random's own odds (its tiers with items), and what that makes each tier per item, crate by crate.
  const fischerOf = (c: CrateDef) => c.fischer.filter((f) => tierItems(c, f.tier).length > 0);
  const fischerWords = [...new Set(src.crates.map((c) => {
    const f = fischerOf(c);
    const total = sum(f.map((x) => x.weight)) || 1;
    return f.map((x) => `${name(x.tier)} ${pct(x.weight / total, 0)}`).join(", ");
  }))].join("; ");
  const perDrop = src.crates.map((c, i) => {
    const f = fischerOf(c);
    const total = sum(f.map((x) => x.weight)) || 1;
    const share = strips[i]?.get("fischer") ?? 0;
    return f.map((x) => `${name(x.tier)} ${pct((share * x.weight) / total, 2)}`).join(" and ");
  });
  const allSame = new Set(perDrop).size <= 1;
  const perDropWords = allSame ? `Altogether, an item is ${perDrop[0] || "never Legendary or Mythic"} of the time.` : src.crates.map((c, i) => `From ${c.name}, an item is ${perDrop[i]} of the time.`).join(" ");
  const cTotal = sum(src.colors.map((c) => c.weight)) || 1;
  const colors = src.colors.map((c) => `| ${c.name} | ${pct(c.weight / cTotal)} |`).join("\n");
  const pTotal = sum(src.purity.map((b) => b.weight)) || 1;
  const purity = src.purity.map((b) => `| ${num(b.low, 1)}% to ${num(b.high, 1)}% | ${pct(b.weight / pTotal, 3)} |`).join("\n");
  const shiny = sum(src.purity.filter((b) => b.low >= 90).map((b) => b.weight)) / pTotal;
  // Boss tokens and boss crates (Nov 2): each boss crate's ride, the only item behind its Fischer Random.
  const bt = src.bossTokens;
  const bp = src.bossCratePrice;
  const fischerShare = (c: CrateDef) => {
    const live = liveStrip(c);
    return (live.find((x) => x.tier === "fischer")?.weight ?? 0) / (sum(live.map((x) => x.weight)) || 1);
  };
  const bossCrates = src.bossCrates
    .map((c) => `**${c.name}** holds ${itemDef(c.ride)?.name ?? c.ride} (${pct(fischerShare(c), 0)} of the time: the only item behind its Fischer Random) and ${c.items.length - 1} Common to Epic items`)
    .join("; ");
  const n = (k: number, one: string) => `${k} ${one}${k === 1 ? "" : "s"}`;
  return {
    id: "crates",
    title: "Crates and items",
    body: `
**Everything here is cosmetic.** Nothing you own changes how a match is played or scored. Items dress your pawn (head, face, skin and weapon) on the vote board, the cut screen and your profile.

**Crates and keys.** Each crate in the Crates tab opens with **one crate key**: you need the crate and a key. You earn crates from [leveling up and the daily reward](#xp) (${src.xp.levelCrates} crates and ${n(src.xp.levelKeys, "key")} each level, and a crate for the day's first game), and from Squads placements. Crates come often; keys are scarcer, so you'll usually have a few crates waiting. A crate with a padlock is one you can't open yet: you have none, or no key. Crates and keys are never sold for now.

Every item from a crate rolls three things, each on its own:

1. **Its tier, which decides the item.** The strip lands on a tier's box, which opens to one of that tier's items, each as likely as the others. Or it lands on **Fischer Random**, a second spin for the rarest items: ${fischerWords}.
2. **Its color.**
3. **Its purity:** 100% less a blemish (blotches over that share of its color). From 90% it's **shiny**.

| Box | ${src.crates.map((c) => c.name).join(" | ")} |
|${src.crates.map(() => "---|").join("")}---|
${stripRows}

${perDropWords}

| Color | Chance |
|---|---|
${colors}

Some items take a second color (a present's ribbon, a suit's tie), rolled the same way.

| Purity | Chance |
|---|---|
${purity}

**Boss tokens and boss crates.** A boss battle, won or lost, counts once it reaches ${bt.moves} of your moves or ${bt.minutes} minutes. In any ${bt.windowHours} hours, your first counted battle always gives you a boss's token (one of the bosses you can meet, each as likely), and each one after that gives one ${pct(bt.chance, 0)} of the time, up to ${bt.cap}. Our server decides, never your device, and it times a solo battle itself (${bt.minutes} minutes from its start to its end). A boss's shop in the town sells its crate for ${n(bp.tokens, "token")} of that boss, or ${n(bp.withKey.tokens, "token")} and ${n(bp.withKey.keys, "crate key")}: ${bossCrates}, in the same boxes at the same odds as above. A crate you buy goes into your inventory (the Crates tab), where you open it like any crate, once.

Shiny comes about 1 time in ${num(1 / (shiny || 1), 0)}. Crates are opened by the game's server, never by your device, so nobody can roll themselves a Pearl crown. The shop sells God King effects (the color of his bolts, beam and halo) and quick-chat packs.
`,
  };
}

/**
 * XP and levels (Nov 9): every number from XP in settings.ts. No minutes and no per-minute numbers (Eric, Nov 9: "we dont want
 * players to know they could just stall to get more XP"): more for a longer game, a win bonus, a cap per game. The rules are the same.
 */
export function xpAndLevels(src: FaqSources): FaqSection {
  const X = src.xp;
  const Q = src.quests;
  const most = X.maxMinutes * X.perMinute + X.win;
  const nth = (k: number) => `${k}${k % 100 >= 11 && k % 100 <= 13 ? "th" : (["th", "st", "nd", "rd"][k % 10] ?? "th")}`;
  const n = (k: number, one: string) => `${k} ${one}${k === 1 ? "" : "s"}`;
  const things = (q: { xp: number; crates?: number; keys?: number }) =>
    [`**+${q.xp.toLocaleString("en-US")} XP**`, q.crates ? `**${n(q.crates, "crate")}**` : "", q.keys ? `**${n(q.keys, "crate key")}**` : ""].filter(Boolean).join(", ").replace(/, ([^,]*)$/, " and $1");
  const dailyXp = [...new Set(Q.daily.map((q) => q.xp))];
  const dailyPays = `a daily quest gives ${dailyXp.length === 1 ? `**+${dailyXp[0]!.toLocaleString("en-US")} XP**` : "XP"}${Q.daily.some((q) => q.crates) ? " (some also a crate)" : ""}`;
  const weeklyPays = Q.weekly[0] ? `gives ${things(Q.weekly[0])}` : "pays too";
  return {
    id: "xp",
    title: "XP and levels",
    body: `
**Every game you finish earns XP, and XP raises your level.** Each level takes ${X.perLevel.toLocaleString("en-US")} XP, the same for every level, with no top level. You start at Level 1. Your level and how far you are into it show on home (the ring round your icon) and on your profile.

**A game's XP:** finishing a game earns XP, more for a longer game, plus ${X.win} XP for a win. A game earns at most ${most} XP. A win is: beating the boss, winning your ranked 1 v 1, your team winning a 50 v 50, your squad winning its Squads lobby, or 1st place in Classic.

- **What counts is your own game,** as our server measured it, up to your last move: knocked out early, watching the rest adds nothing. A game played on your device (against bots, or a boss alone) our server times itself.
- **A game counts from your ${nth(X.minMoves)} move.** Over sooner, it earns no XP for anyone in it ("No XP: the game ended before move ${X.minMoves}."), and resigning sooner says so ("No XP: you resigned before move ${X.minMoves}."). A resign after that is a loss that counts.
- **No XP** if you left the match (gone too long, or removed for being away), in a test game, for a banned account, or as a guest: sign in to earn XP. Auto chess, and a 1 v 1 against a bot (here or in the town), earn none for now.
- **Wins that pay less often:** in a lobby you make with friends, the win's XP comes once a day for each opponent: beat someone and wins against them pay nothing more that day (the game's own XP always counts). In games on your device, ${X.soloWinsPerDay} wins a day, and a very quick win pays no win bonus.
- **Games on your device** earn XP up to a daily limit (${(X.soloMinutesPerDay * X.perMinute).toLocaleString("en-US")} XP a day before win bonuses); past that the box says "Daily solo limit". Online games have no daily limit, except one that only one device checked (one device scoring a round alone, a boss move no second device played): it pays as a solo game, and its results say so. A day starts at ${String(X.dayStartUtcHour).padStart(2, "0")}:00 UTC (midnight Pacific), the same for everyone.

**The daily reward:** your first game of the day that counts and has at least ${X.dailyMinMoves} of your own moves gives you **+${X.dailyBonus} XP** ("Daily reward +${X.dailyBonus}") and **${n(X.dailyCrates, "crate")}**, once a day. In a game on your device it must also last a little while (our server times it). The day starts at ${String(X.dayStartUtcHour).padStart(2, "0")}:00 UTC.

**Level-up rewards:** every level you reach gives you **${n(X.levelCrates, "crate")} and ${n(X.levelKeys, "crate key")}**, and every ${nth(X.bossCrateEvery)} level (${X.bossCrateEvery}, ${2 * X.bossCrateEvery}, ${3 * X.bossCrateEvery}, …) also **a boss crate you choose**: pick whose in the Crates tab ("Choose your boss crate"). It opens like any boss crate you hold, with nothing more to pay. Each level pays once, at the end of the game that reached it (a level reached some other way is paid at your next game that counts). The crates are from the newest series.

**Quests:** you get **${n(Q.dailyPerDay, "daily quest")}** each day and **${n(1, "weekly quest")}** each week, in the Quests window (it opens by itself the first time you come to the home screen each day when you're signed in, and from the **Quests** button any time). Each shows what to do ("${Q.daily[0]?.goal ?? ""}", "${Q.weekly[0]?.goal ?? ""}"), how far you are and what it pays.
- **Rewards:** ${dailyPays}; the weekly quest ${weeklyPays}. They're paid the moment a game finishes the quest, and its XP joins that game's XP ("Quest +${Q.daily[0]?.xp ?? 0}"); the result says which quest ("Quest done: …").
- **What counts:** only games that earn XP (the same rules as above), each game once per quest. Quests ask for modes you can always play: Squads, 50 v 50, Boss Battles (alone counts too), and any game. A win counts when it earns its win XP. Games on your device count toward "finish games" quests, and a Boss Battle on your device toward the Boss Battle quests too, but only once they've lasted a little while (our server times them).
- **New dailies** come each day at ${String(X.dayStartUtcHour).padStart(2, "0")}:00 UTC; the weekly resets on Mondays at the same time. **Unfinished dailies stay**, up to ${Q.maxDailies} waiting, so missing a day doesn't waste them. A new weekly replaces the old one, finished or not.
- **One free reroll a day for each daily:** the arrows on a daily you haven't finished swap it for another quest (only that one). The new quest's arrows come back the next day.

After each game the result screen's XP box fills from your old XP to the new, with what it was for ("Win +${X.win} · Daily reward +${X.dailyBonus}"), or says why there was none. A level-up, the daily reward or a finished quest then shows what it gave you. If rewards are paused for a moment (we're fixing something), the box says so and the game earns no XP, daily reward, level rewards or quest progress; levels you reach are paid at your next game.
`,
  };
}

function fairPlay(): FaqSection {
  return {
    id: "fair-play",
    title: "Fair play",
    body: `
- **Every move is checked by the server.** Illegal moves are refused, the server keeps the clock and the score, and crates are opened there too.
- **Engine help is cheating, and we look for it.** Using an engine, another device or anyone else's help to pick your moves is against the rules. We watch for engine assistance and act on it. We don't explain how, so it stays hard to dodge.
- **What happens:** while an account is under review, its online results are held off the rankings. A confirmed cheater is banned from online play (solo stays open). Borderline cases go to a person, never straight to a ban, and a ban can be appealed.
- **Reporting:** tap a player's name to report them. A report never bans anyone by itself: it puts their games in front of a reviewer sooner.
- **Chat** is typed in the global chat (a computer's right column), the town square, and match and lobby chat once you turn chat on (until then, and for guests, matches and lobbies use preset lines and emoji). Chat is off until you turn it on (its gear, or Settings: a short notice shows once), and guests can read it but not post. Typing needs a free account, and a device that answered the age question "too young" keeps the preset lines: up to ${GLOBAL_CHAT.maxChars} characters, one message every ${GLOBAL_CHAT.gapMs / 1000} seconds in the global chat and in matches (${TOWN_CHAT.gapMs / 1000} in the town square). When the global chat is very busy a message may show a few seconds late, or you're asked to try again. Type :crown:, :knight: and the rest for our own pixel emoji (the smiley button lists them). Slurs, swearing, links and contact details are refused. Town square messages aren't kept, and the global chat keeps its last ${GLOBAL_CHAT.keep} lines for a day (if someone reports a town square message, the report keeps its words and when it was said, for a moderator to read). Tap a name in a chat to mute that player on your device, or to open their profile and report them; tap a message in the town square to report it. A moderator can turn a player's chat off, take a town square message down, or reset their name and icon. Names with slurs or hate in them aren't allowed.
- **Away in the town square:** after ${TOWN_AFK.zzzAfterSec / 60} minute without a tap, drag or key, a "zzz" floats over your pawn for everyone; after ${TOWN_AFK.bootAfterSec / 60} minutes, or ${TOWN_AFK.hiddenBootAfterSec / 60} with the app in the background, you're dropped from the town and back on the home page. A boss challenge or the claw machine never counts as away. Guests can look round the town for ${TOWN_AFK.guestTownSec} seconds and read its chat; walking on and chatting need a free account.
- **Practice mode** is for our testers: unlimited power-ups, in the open. A tester practicing is marked 💡 on the leaderboard, and practice never counts toward any ranking.
`,
  };
}

/**
 * The last section (Eric, Nov 6): every credit, attribution and license notice in the app. The Settings page used to
 * carry these too; they live here now, linked from the contents.
 */
function credits(src: FaqSources): FaqSection {
  return {
    id: "credits",
    title: "Copyright, credits and licenses",
    body: `
- **Stockfish**, the chess engine behind the judge, the bosses and the bots: free software under the GPL-3.0 ([stockfishchess.org](https://stockfishchess.org), [source](https://github.com/official-stockfish/Stockfish), this build: [stockfish.js](https://github.com/nmrugg/stockfish.js) 19, [its source](/engine/stockfish-source.tar.gz), [license](/engine/COPYING.txt)). It runs as a separate program in your browser.
- **Maia-3**, the human-like model ${src.brain.forPlayers ? "behind [the bosses](#maia-brain)" : "[being tested](#maia-brain) for bosses"}: by the CSSLab, University of Toronto, under the AGPL-3.0 ([Maia-3](https://github.com/CSSLab/maia3)). It runs as its own separate program in your browser; our Maia box's [source code](/engine/maia/maia-box-source.tar.gz) is free to download ([notice](/engine/maia/NOTICE.txt), [license](/engine/maia/LICENSE.txt)).
- **The chess pieces**: drawn by Colin M.L. Burnett, from [Wikimedia Commons](https://commons.wikimedia.org/wiki/Category:SVG_chess_pieces), under the BSD license ([license](/licenses/pieces.txt)). Alfil's elephant is drawn for HunChess on the bishop's base.
- **Classic piece sounds** and their variations: [PyChess](https://github.com/pychess/pychess/tree/master/sounds) (GPL-3.0). The variations are made from PyChess's sounds by our own script ([license](/engine/COPYING.txt), [how each was made](/sounds/SOURCES.md), [their source](/sounds/pychess-sounds-source.tar.gz)). Like the engines, they're separate files the game plays, not part of its code.
- **The Colosseum's crowd cheer**: [Free Crowd Cheering Sounds](https://opengameart.org/content/free-crowd-cheering-sounds) by Gregor Quendel, under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), trimmed, layered and leveled by HunChess ([credits](/sounds/colosseum/CREDITS.md)).
- **The app** is built with Preact (MIT) and chess.js (BSD), in the Archivo, Archivo Black and Press Start 2P fonts (SIL Open Font License) ([licenses](/licenses/third-party.txt)). Its other sounds are free of rights (CC0), royalty free or the game's own.
`,
  };
}

function privacyAndTerms(): FaqSection {
  return {
    id: "privacy",
    title: "Privacy and terms",
    body: `
- [Privacy policy](/privacy): what we keep about you, why, for how long, and how to see or delete it.
- [Terms of service](/terms): the rules for accounts, fair play, chat, names and icons, and virtual items.
- [Copyright](/copyright): how to report a name or icon that copies your work.

> Both are drafts until they're reviewed.
`,
  };
}

/** The FAQ's sections, in order, built from `src` (the game's settings unless a test says otherwise). */
export function faqSections(src: FaqSources = FAQ_DEFAULTS): FaqSection[] {
  return [modes(src), scoring(src), bossBrain(src), bossPowers(src), godKing(src), xpAndLevels(src), crates(src), fairPlay(), privacyAndTerms(), credits(src)];
}

/** The line under the title. */
export const FAQ_INTRO = "How HunChess works, from how your moves are scored to how a boss picks its moves. Every number here is read from the game's own settings. Tap a heading to jump to it.";

export interface FaqTocEntry {
  id: string;
  title: string;
  subs: { id: string; title: string }[];
}

export interface FaqPage {
  sections: (FaqSection & { blocks: Block[] })[];
  toc: FaqTocEntry[];
}

/** The page: each section's blocks, and the table of contents (every section; the sub-headings of those that list them). */
export function faqPage(src: FaqSources = FAQ_DEFAULTS): FaqPage {
  const sections = faqSections(src).map((s) => ({ ...s, blocks: parse(s.body) }));
  const toc = sections.map((s) => ({
    id: s.id,
    title: s.title,
    subs: s.tocSubs ? s.blocks.flatMap((b) => (b.kind === "heading" ? [{ id: b.id, title: b.text }] : [])) : [],
  }));
  return { sections, toc };
}

/** Every anchor the page has: each section's id and its headings'. */
export const faqAnchors = (page: FaqPage) => page.sections.flatMap((s) => [s.id, ...anchorsOf(s.blocks)]);

/** The whole FAQ as plain text (for review, and anywhere there's no screen). */
export function faqPlainText(src: FaqSources = FAQ_DEFAULTS): string {
  const page = faqPage(src);
  const toc = page.toc.map((t, i) => [`${i + 1}. ${t.title}`, ...t.subs.map((s) => `   - ${s.title}`)].join("\n")).join("\n");
  const body = page.sections.map((s, i) => `${i + 1}. ${s.title.toUpperCase()}\n${"=".repeat(s.title.length + 4)}\n\n${plainText(s.blocks)}`).join("\n\n\n");
  return `FAQ · HOW HUNCHESS WORKS\n\n${FAQ_INTRO}\n\nCONTENTS\n${toc}\n\n\n${body}\n`;
}
