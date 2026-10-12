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
  BOSS_BRAIN,
  BOSS_DIFFICULTY,
  BOSS_POWERS,
  BOSS_ROSTER,
  BOSS_TIERS,
  BRILLIANT,
  CRATES,
  CRATES_FREE,
  CROWD_EVERYONE_KNOCKOUTS,
  CROWD_KNOCKOUTS,
  CROWD_SETTINGS,
  DEFAULT_SETTINGS,
  ENGINE_MIN_ELO,
  ITEM_COLORS,
  PRIOR_RATING,
  PURITY_BANDS,
  RAID_SETTINGS,
  RANKING,
  RATING_MIN_MOVES,
  SHOP_FREE,
  SQUADS,
  TIERS,
  VARIABLE_CLOCK,
  bossStrength,
  bossStumbleChance,
  clockStepRanges,
  isPlayable,
  kingCharges,
  lastStandBar,
  liveStrip,
  tierItems,
  maiaRatingFor,
  scoreGroup,
  speedOption,
  type BossBrainSettings,
  type BossDef,
  type BossPowerSettings,
  type ClockStep,
  type CrateDef,
  type FinalFormat,
  type Settings,
  type SquadsSettings,
} from "@chessroyale/core";
import { anchorsOf, parse, plainText, type Block } from "./markdown.ts";

/** Everything the FAQ quotes. The defaults are the game's; tests pass changed ones. */
export interface FaqSources {
  settings: Settings;
  crowd: Settings;
  raid: Settings;
  crowdKnockouts: Readonly<Record<FinalFormat, readonly number[]>>;
  everyoneKnockouts: readonly number[];
  powers: BossPowerSettings;
  brain: BossBrainSettings;
  difficulty: readonly { id: string; label: string; elo: number }[];
  tiers: readonly number[];
  roster: readonly BossDef[];
  engineMinElo: number;
  brilliant: { minPickers: number; nearBest: number; maxShare: number; minGap: number };
  priorRating: number;
  ratingMinMoves: number;
  rankedShare: number;
  crates: readonly CrateDef[];
  colors: readonly { id: string; name: string; weight: number }[];
  purity: readonly { low: number; high: number; weight: number }[];
  itemTiers: readonly { id: string; name: string }[];
  cratesFree: boolean;
  shopFree: boolean;
  squads: SquadsSettings;
  speeds: { normal: number; bullet: number; variable: readonly ClockStep[] };
}

export const FAQ_DEFAULTS: FaqSources = {
  settings: DEFAULT_SETTINGS,
  crowd: { ...DEFAULT_SETTINGS, ...CROWD_SETTINGS },
  raid: { ...DEFAULT_SETTINGS, ...RAID_SETTINGS },
  crowdKnockouts: CROWD_KNOCKOUTS,
  everyoneKnockouts: CROWD_EVERYONE_KNOCKOUTS,
  powers: BOSS_POWERS,
  brain: BOSS_BRAIN,
  difficulty: BOSS_DIFFICULTY,
  tiers: BOSS_TIERS,
  roster: BOSS_ROSTER,
  engineMinElo: ENGINE_MIN_ELO,
  brilliant: BRILLIANT,
  priorRating: PRIOR_RATING,
  ratingMinMoves: RATING_MIN_MOVES,
  rankedShare: RANKING.rankedMinHumanShare,
  crates: CRATES,
  colors: ITEM_COLORS,
  purity: PURITY_BANDS,
  itemTiers: TIERS,
  cratesFree: CRATES_FREE,
  shopFree: SHOP_FREE,
  squads: SQUADS,
  speeds: {
    normal: Number(speedOption("normal")?.patch.moveClockSeconds),
    bullet: Number(speedOption("bullet")?.patch.moveClockSeconds),
    variable: VARIABLE_CLOCK,
  },
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
  const steps = clockStepRanges(src.speeds.variable);
  const teamSizes = S.teamFinalSizes.map((x) => `${x}v${x}`);
  const clocks = Q.clocks.map((c) => `${c.label} ${num(c.bankSeconds / 60)} min`).join(", ");
  return {
    id: "modes",
    title: "The modes",
    body: `
### Crowd · 50 v 50 {#mode-crowd}

- **${C.lobbySize} players, one game of chess**, from the first move. Two teams of ${team}: your team plays White or Black all game.
- Each turn, everyone on the side to move picks a move before the clock runs out, and the **most popular pick is played** (a tie is settled at random).
- Every pick is scored (see [How your moves are scored](#scoring)). No one goes out for the first ${n(C.firstStageRounds / 2, "move")}; after that, the lowest scorers are cut after every move, the same number from each team. Scores carry over all game.
- **You vote on the ending** before move 1: a team final (the top ${left(src.crowdKnockouts.team)} play on: ${teamSizes.slice(0, -1).join(", ")}, then ${teamSizes.at(-1)} to the end), a boss battle (the top ${left(src.crowdKnockouts.boss)} team up against a boss, with the God King) or a duel (the best of each side, 1v1). Then on the speed: Normal (${src.speeds.normal} s a move), Bullet (${src.speeds.bullet} s) or Variable (${steps[0]?.seconds} s, rising to ${steps.at(-1)?.seconds} s).
- **${n(C.powerUpsAtStart, "power-up")}** each: a power-up shows the engine's top 3 moves for that turn.
- **Everyone moves** (Settings, Crowd) is the other way to play: everyone picks for whichever side is to move, down to a 2v2 final of the last ${left(src.everyoneKnockouts)}. It's for solo games and lobbies you create; PLAY is always 50 v 50.
- Matchmaking: **Default** fills empty seats with bots after a short wait, **Bots off** waits for real players, and **Solo** is you and bots, at once.

### Boss raid and Boss alone {#mode-boss}

- **Boss raid:** up to ${R.lobbySize} players pick the crowd's moves together against a [boss](#boss-brain); the most popular pick is played. Most bosses start from a named opening, ${n(R.openingMoves, "move")} in. An online raid is people only; a Solo raid fills the other seats with bots.
- **The boss strikes:** every ${n(S.bossKillEvery, "crowd move")} it knocks out the player who gave away the most points since its last strike (a missed move counts as ${n(S.finalMissLoss, "point")}), until half the raid is left (in the Crowd's boss battle, until ${S.bossMinSurvivors} are left).
- **The God King** fights on your side, with ${n(S.kingChargesMax, "charge")} ([more on him](#god-king)).
- The battle ends in checkmate or a draw, or after ${n(S.bossMaxMoves, "crowd move")}, when the engine judges the position.
- **Boss alone:** just you against a boss you choose from the boss menu, at a difficulty from ${src.difficulty[0]?.label} to ${src.difficulty.at(-1)?.label}. You pick every move.
- **The Crowd's boss battle** is the same fight for the last ${left(src.crowdKnockouts.boss)} of a 50 v 50.

### Squads {#mode-squads}

- **${Q.squadCount} squads of ${Q.squadSize}** play a knockout bracket. Come alone or with a party of up to ${Q.partyMax}; bots fill any empty seats.
- **Round 1, Relay:** ${n(Q.boards.relay, "board")}; your squad's players move from board to board, a different one each turn.
- **Round 2, Pairs:** ${n(Q.boards.pairs, "board")}, played in pairs that change partners: both partners pick a move, and a coin decides which is played.
- **The final, Pick and Block:** one board. On your squad's move, two of you pick moves while two of the other squad each block a move they expect; one block counts. If it hits a pick, the other pick is played; otherwise a coin decides.
- Every game is played to the end on the board (a win is ${n(Q.winPoints, "point")}, a draw ${num(Q.drawPoints)}). No engine scores Squads.
- Each squad has **one clock for the whole tournament** (${clocks}, topped up each round). When it runs out, every move must be made within ${n(Q.clocks[Q.clockDefault]?.delaySeconds ?? 3, "second")}. A drawn final is settled by one Armageddon game.

### Classic {#mode-classic}

The original mode (${S.lobbySize} players on ${n(S.lobbySize / S.groupSize, "board")}, rotating) is off the menu while it's being redesigned.
`,
  };
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

Every pick is scored by **Stockfish**, the chess engine (the judge). For any position, it gives the side to move an **expected score** from 0 to 1: the chance of a win plus half the chance of a draw. 0.50 is level; 0.62 means you'd expect to score 62 out of 100 from here. The eval bar beside the board shows the same number.

The judge looks at the same fixed amount for every pick (${num(S.engineNodes)} positions), so the same position always gets the same score.

### Points {#points}

A move's **loss** is what it gives away compared with the best move in that position, in points (1 point is 0.01 of expected score):

$ loss = 100 × (expected score after the best move − expected score after your move)

A loss is never below zero: if your move scores above the engine's own choice, yours counts as the best. Your **round score** then compares you with everyone who picked with you (in 50 v 50, your team):

$ round score = the group's average loss − your loss

Positive means you beat your group. A missed move scores ${num(S.missedMoveScore)} and is left out of the average. In Crowd your round scores add up all game, and every cut goes by the total.

### A worked example {#worked-example}

The best move leaves the side to move an expected score of ${es(best)}. Four players pick:

| Player | Expected score after their move | Loss | Round score |
|---|---|---|---|
${exRows}

The group's average loss is (${losses}) / ${picks.length} = ${num(avg)}. A found the best move and scores ${num(avg)} − 0 = ${signed(row("A").roundScore)}; D's blunder scores ${num(avg)} − ${num(row("D").loss!)} = ${signed(row("D").roundScore)}. In Crowd the move B and C share is the most popular, so it's the one played.

### Nearly as good costs almost nothing {#near-best}

In most positions several moves are close. If the best move keeps you at 0.55 and the natural developing move keeps you at 0.54, it gives away just 1 point. You don't have to find the engine's exact move: a sound human move costs a point or two, while a real blunder costs tens (hanging your queen in a level position typically costs 50 to 70 points).

### Every position is judged fresh {#fresh}

Each pick is compared only with the best move **in the position on the board now**. If the crowd went its own way a few moves ago, nobody is punished for being "off the engine's line": the judge simply asks what's best from here. A player handed a bad position can still top their group, because only the chances you give away count, not where you started.

### The deeper re-check {#recheck}

A quick search can now and then misjudge a close call, so close calls get a second, much deeper look (at least ${num(S.recheckNodes)} positions instead of ${num(S.engineNodes)}) before they cost anyone. In every round where a person picked, moves that give away from ${range(S.recheckLoss)} points are searched again, the most-picked first, up to ${n(S.recheckMax, "move")} a board. Online, before a cut, the picks of players within ${n(S.recheckCutPoints, "point")} of the cut line are re-checked first, over ${range(S.recheckCutLoss)} points, up to ${n(S.recheckCutMax, "move")} a board. The deeper numbers replace the quick ones.

### Brilliant moves {#brilliant}

A move is **brilliant** when it separated the field: among at least ${B.minPickers} pickers, the moves within ${num(B.nearBest)} points of the best were found by at most ${pct(B.maxShare, 0)} of them, and everyone else gave away ${num(B.minGap)} points or more on average. Everyone who found it gets the credit, unless they used a power-up that turn (it shows the engine's moves). A move the God King plays is never brilliant. Your brilliant moves show on your profile.

### Your rating {#rating}

Your rating comes from your moves, not from wins: from the average number of points your moves give away, matched against how many Stockfish gives away at each of its own strength settings (so it's on Stockfish's rating scale). It shows after ${n(src.ratingMinMoves, "move")}, starts near ${src.priorRating} and firms up as your moves come in. A match counts towards your ranking only when at least ${pct(src.rankedShare, 0)} of its seats are real players; solo games and practice mode never count.
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
  // Maia for players yet? (Until then it's marked "Being tested".) Which bosses default to it, and with what guard.
  const guardName: Record<string, string> = { "maia-raw": "no guard", "maia-light": "the light guard", "maia-full": "the full guard" };
  const maiaBosses = Object.entries(M.soloDefault)
    .filter(([, brain]) => brain !== "stockfish")
    .map(([id, brain]) => `${src.roster.find((b) => b.id === id)?.name ?? id} (${guardName[brain] ?? brain})`);
  const maiaNote = M.forPlayers
    ? `> **New.** In Boss alone, ${maiaBosses.join(", ") || "no boss yet"} ${maiaBosses.length === 1 ? "plays" : "play"} with Maia; online battles and every other boss play with Stockfish.`
    : `> **Being tested; coming soon.** Maia isn't switched on for players yet: until it is, every boss you meet plays with Stockfish, as above. In the test, only Boss alone uses it (online battles stay Stockfish), and the first ${maiaBosses.length === 1 ? "boss" : "bosses"} on it: ${maiaBosses.join(", ") || "none yet"}.`;
  // Maia's rating: the lines between BOSS_BRAIN.maiaRating's points, then held, then Stockfish.
  const pts = M.maiaRating;
  const lines: string[] = [];
  for (let i = 1; i < pts.length; i++) {
    const [xa, ya] = pts[i - 1]!;
    const [xb, yb] = pts[i]!;
    lines.push(`$ from ${xa} to ${xb}: Maia = ${ya} + ${num((yb - ya) / (xb - xa), 3)} × (strength − ${xa})`);
  }
  const [lastX, lastY] = pts.at(-1)!;
  if (lastX < M.stockfishFrom) lines.push(`$ from ${lastX} to ${M.stockfishFrom}: Maia = ${lastY}`);
  lines.push(`$ from ${M.stockfishFrom} up: Stockfish`);
  const strengths = [1000, 1200, 1400, 1600, 1800, 2000, 2200, 2400, 2500, 2600, 2700, M.stockfishFrom, 3000, ceiling].filter((x, i, a) => a.indexOf(x) === i).sort((a, b) => a - b);
  const handover = strengths.map((x) => `| ${x} | ${maiaRatingFor(x, M) ?? "Stockfish"} |`).join("\n");
  const exStrength = 2000;
  const seg = pts.findIndex(([x]) => x >= exStrength);
  const [ex0, ey0] = pts[Math.max(0, seg - 1)]!;
  const [ex1, ey1] = pts[Math.max(1, seg)]!;
  const exSlope = (ey1 - ey0) / (ex1 - ex0);
  const exMaia = maiaRatingFor(exStrength, M);
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

- **A boss raid** is matched to the people in it (bots never count): the boss comes in at the weakest of its tiers that's stronger than their average rating. The tiers: ${tiers.join(", ")}.
- **A Solo raid and Boss alone** work the same way from your own rating (unrated, ${src.priorRating}).
- **The Crowd's boss battle** comes from how the last ${finalists} played that match: a weighted average of their ratings (the best counts ${finalists} times, the next ${finalists - 1}, down to the weakest once), ${S.bossEloOffset < 0 ? "minus" : "plus"} ${Math.abs(S.bossEloOffset)} (a crowd picking together plays better than its average member), kept within ${range(S.bossEloRange)}. The weighting makes it a real fight for the best players.
- Then each boss's **offset** is added: bosses with nastier powers play a little weaker underneath.
- **Boss alone** adds your difficulty too: ${diffs}.
- The result always stays between ${floor} and ${ceiling}.

$ strength = tier + the boss's offset + your difficulty

| Boss | Offset |
|---|---|
${offsets}

**Worked example.** You're rated ${you}. The weakest tier above ${you} is ${tier}. ${ginger.name} at ${src.difficulty.find((d) => d.elo === 0)?.label ?? "Normal"}: ${tier} ${term(ginger.offset)} = **${gingerElo}**. ${bigBoy.name} at ${hard.label}: ${tier} ${term(bigBoy.offset)} ${term(hard.elo)} = **${bigBoyElo}**.

The boss menu shows each boss's strength and how far it is from yours ("+200 vs you"); in battle, 1 to 5 skulls show how dangerous it is.

### Brain 1: Stockfish at a set strength {#stockfish-brain}

${M.forPlayers ? "Most bosses play with Stockfish." : "Every boss you meet today plays with Stockfish."} Stockfish can hold itself back to a rating (from ${src.engineMinElo} up to ${ceiling}), and the boss asks it for a move at the boss's strength. Three safety rails keep it fair and fun:

- **The blunder guard.** Held-back Stockfish now and then simply hangs a piece. It's boss mode, not idiot mode: no boss move may give away more than ${n(S.bossMaxLoss, "point")} against the best move, nor more than ${num(S.bossMaxLogitLoss)} in **log-odds**. A move that would is swapped for a small slip.
- **Slips for weaker bosses.** Stockfish can't play below ${src.engineMinElo}, which is still too strong for a boss meant to be beatable at 1400. So below ${S.bossStumbleBelow} a boss sometimes slips on purpose: a small inaccuracy of ${range(S.bossSlipLoss)} points from its best few moves, never a blunder.
- **Powers.** When a power stops some of the boss's moves (a pie, a toy block), it plays the best move that's allowed.

$ slip chance = min(${pct(S.bossStumbleMax, 0)}, (${S.bossStumbleBelow} − strength) / 1000)

For example: ${stumbleAt.join(", ")}, and none from ${S.bossStumbleBelow}. Any move other than its best is double-checked against the best before it's played.

**Why log-odds?** In a game that's already won or lost, points shrink, so a disaster can look small. Log-odds measure the chances on a stretched scale:

$ log-odds of p = ln(p / (1 − p))

Going from ${pct(from, 0)} to ${pct(to, 0)} is only ${num(gPoints, 1)} points, but ${num(gLogit)} in log-odds, so the guard ${blocked ? "blocks it" : "lets it through"}.

### Brain 2: Maia-3, a human-like boss {#maia-brain}

${maiaNote}

**Maia-3**, by the CSSLab at the University of Toronto, learned from human games to predict the move a person of a given rating would play. Held-back Stockfish plays like a strong engine with sudden lapses; Maia plays like a person, plans and mistakes included. A Maia boss picks its move like this:

1. Maia is asked for its likeliest moves at the boss's Maia rating ([the handover](#handover)), and draws one from its own probabilities, a little sharper than a real person (temperature ${num(M.temperature)}) and never one of the rarest (only from the likeliest moves that together make up ${pct(M.topP, 0)} of the chances).
2. A **guard** may veto that move, judged against the boss's own Stockfish search of its best moves (a move outside that search is turned down). With a guard, Maia's next likeliest moves are tried in turn (at most ${M.candidates} in all, each at least ${pct(M.minP, 0)} likely); if none passes, the boss plays Stockfish's best.
3. If Maia hasn't loaded, fails, or takes more than ${num(M.timeoutMs / 1000)} s, the boss plays its usual Stockfish move. Nobody ever waits for it.

| Guard | Never gives away more than | Nor more log-odds than |
|---|---|---|
| None | no limit: Maia's mistakes are human ones | no limit |
| Light | ${guard(M.light)} |
| Full | ${guard(M.full)} |
| Full, at Maia ${M.strictFrom} or more | ${guard(M.strict)} |

### The handover: from Maia to Stockfish {#handover}

A boss's strength is on Stockfish's scale; Maia's ratings are on a human scale, and the two don't line up one to one. So a Maia boss plays at a Maia rating that rises with its strength, along straight lines:

${lines.join("\n")}

(Below ${pts[0]![0]} the first line carries on down, to no lower than ${M.maiaRatingMin}.) From ${M.stockfishFrom} the boss is always Stockfish: Maia models people, and even the strongest people stop well short of what a top boss must play.

| Boss strength | Maia plays at |
|---|---|
${handover}

**Worked example.** A boss at ${exStrength} plays Maia at ${ey0} + ${num(exSlope, 3)} × (${exStrength} − ${ex0}) = ${ey0} + ${num(exSlope * (exStrength - ex0))} = **${exMaia}**.

> **Planned: a gradual bridge.** Today Maia holds at ${lastY} from ${lastX} to ${M.stockfishFrom}, and Stockfish takes over at ${M.stockfishFrom}. The plan is a bridge band (around ${lastX} to ${M.stockfishFrom}) that ramps through Maia with the light guard, then Maia with the strict guard (perhaps with a share of Stockfish's moves), so a boss's strength never jumps. Not built yet.

These lines come from early test runs; calibrating every boss may move them.

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

/** One block per boss (by its BOSS_ROSTER id): its opening, passive and ultimate, in a player's words. */
export const BOSS_BLOCKS: Record<string, (p: BossPowerSettings, b: BossDef) => string> = {
  gingerbread: (p) => `
Plays from the game so far.

- **Freeze** (passive): from turn ${p.firstPassive}, one of your pieces that matters (one of your three most valuable, mobile pieces; never the king) is iced and can't move for ${n(p.freezeTurns, "turn")}. Then again every ${range(p.freezeEvery)} turns.
- **Blizzard** (ultimate): for one turn, only one of your pieces may move, picked at random from those that have a move (never your king nor the frozen piece, unless nothing else can move). Its banner names the piece. In check, only a piece that can get you out of it is picked.`,
  clown: (p) => `
Plays from the game so far.

- **Pie** (passive): from turn ${p.firstPassive}, an empty square near the centre (the one the fewest moves can reach) gets a pie for ${n(p.pieTurns, "turn")}: nobody, on either side, may move onto it. A new pie every ${n(p.pieEvery, "turn")}, up to ${p.pieMax} on the board at once, never two on one square.
- **Funhouse** (ultimate): as it comes, the board turns upside down and he plays your move for you: a weak but recoverable one (giving away ${range(p.funhouseLoss)} points, never more than ${num(p.funhouseMaxLogit)} in log-odds). Nobody is scored for it. Then he plays his own, and the board keeps turning, ${n(p.funhouseStepTurns, "turn")} a step (his move for you counts as the first): upside down, then a quarter turn to one side (left or right, at random), then a half turn to the other side, then back the right way up, where it stays. From then on you play your own moves (taps and drags work at every angle, and the coordinates name the real squares), scored as usual. Once the board is back, his meter fills again; each funhouse after that plays your move once more.`,
  grex: (p) => `
Plays from the game so far.

- **Sparkler** (passive): from turn ${p.firstPassive}, a square on your half catches fire and burns in ${n(p.fireStages, "stage")}, one a turn. A piece of yours still on it after your move on the last stage burns (never your king, nor a piece whose loss would leave a king in check: then it fizzles). The judge counts a piece left to burn as already gone, so moving it off is never a mistake. The next sparkler comes ${n(p.fireGap, "turn")} after a fire goes out.
- **Roman candle** (ultimate): ${p.candleShots} fireballs in waves of ${p.candleWaves.join(", ")}, one wave a turn, from ${n(p.candleDelay, "turn")} after he fires. About ${pct(p.candleOwnShare, 0)} of each wave falls on his own half (his pieces never burn: the first time one stands in that fire, he laughs about it), the rest on yours. Each wave's squares show as growing shadows ${n(p.candleAhead, "turn")} ahead, and each fireball lands as a fresh fire (never on your king's square as it's picked; if your king stands there when it lands, it fizzles). A piece of yours left on any of his fires burns, wherever it is.`,
  hollow: (p) => `
Always plays Black, from the starting position: if you'd have been Black, he claims the dark side before move 1.

- **The dark** (passive): after his first move he covers the square of the piece he moved; then another square on every ${ordinal(p.darkEvery)} move of his (his ${[1, 2, 3].map((k) => ordinal(1 + k * p.darkEvery)).join(", ")}…), a random occupied square, never a king's. Each stays dark for ${n(p.darkTurns, "turn")}, and pieces there are hidden. A move that touches the dark goes through unchecked: if it turns out illegal, it costs ${n(p.darkTryCost, "point")} and you pick again, and your ${ordinal(p.darkTries)} wrong try in a turn ends your turn as a missed move (a turn never costs more than a missed move).
- **Lights out** (ultimate): at the start of his turn, a memory test in ${n(p.lightsOutRounds.length, "round")}: find ${p.lightsOutRounds.map((r) => r.pieces).join(", then ")} of his pieces (${p.lightsOutRounds.map((r) => `${num(r.ms / 1000)} s`).join(", ")}; each tap adds ${num(p.lightsOutTapMs / 1000)} s). Each piece you miss costs ${n(p.lightsOutMiss, "point")}. If the crowd finds under ${pct(p.lightsOutHold, 0)} of them, he plays an extra quiet move straight after his own (no capture, check or promotion, worth at most ${n(p.lightsOutExtraGain, "point")} to him).`,
  bigboy: (p, b) => `
Plays from the starting position, less your d- or e-pawn, which he eats before move 1 (his snack). That pawn's head start is why he plays ${Math.abs(b.offset)} under the usual strength.

- **Toy blocks** (passive): from turn ${p.firstPassive}, every ${n(p.blockEvery, "turn")} a block lands on an empty square in your half that one of your pieces could move to, for ${n(p.blockTurns, "turn")}: nothing, on either side, may move onto it or slide through it (a knight jumps it). It never stops an attack.
- **Big Bounce** (ultimate): at the start of his turn, after the warning, ${range(p.bouncePieces)} of your pieces (never the king) bounce to empty squares up to ${n(p.bounceReach, "square")} away (pawns only sideways), into a position about ${n(p.bounceTarget, "pawn")} worse for you (from ${range(p.bounceLoss)} pawns).`,
  sawyer: (p, b) => `
Plays from the game so far, and his first move is a pawn's. Then the **split pawn**: that pawn is sawn in two, giving him a second pawn on an empty square beside it (never one that attacks your pieces or gives check). That head start is why he plays ${Math.abs(b.offset)} under the usual strength.

- **Saw cuts** (passive): from turn ${p.sawFirst}, every ${n(p.sawEvery, "turn")} he saws through the edge between two squares in your half that one of your moves would cross, for ${n(p.sawTurns, "turn")}: no straight move across it (a slide, a pawn's step, the king's step, castling), on either side. Knights and diagonal moves pass.
- **Board saw** (ultimate): once his meter is full, from turn ${p.boardSawFrom}, and while one half of the board (files a to d, or e to h) is his on material: the warning, then for ${n(p.boardSawTurns, "turn")} no move may cross between the d- and e-files, knights included, on either side. Then the halves rejoin.`,
};

function bossPowers(src: FaqSources): FaqSection {
  const p = src.powers;
  const playable = src.roster.filter(isPlayable);
  const later = src.roster.filter((b) => !playable.includes(b)).map((b) => b.name);
  const level = Math.ceil(p.rageFull / (p.ragePerMove || 1));
  const ahead = Math.ceil(p.rageFull / (p.ragePerMove + p.rageAheadMax || 1));
  const queen = 9 * p.ragePerMaterial >= p.rageFull;
  const speeds = playable.map((b) => `${b.name} ×${num(p.rageSpeed[b.id] ?? 1)}`).join(", ");
  const blocks = playable
    .map((b) => {
      const words = BOSS_BLOCKS[b.id];
      return `### ${b.name} {#boss-${b.id}}\n${words ? words(p, b) : ""}`;
    })
    .join("\n\n");
  return {
    id: "boss-powers",
    title: "Boss powers and the rage meter",
    tocSubs: true,
    body: `
### How powers work {#power-rules}

Every boss has a **passive** power that comes every few turns and an **ultimate** that comes whenever its rage meter is full, again and again. Turns count the crowd's moves: turn 1 is the crowd's first move of the battle. For every boss:

- Every power is decided by the game from the battle's own random draw and the position, so everyone sees exactly the same thing.
- A power never leaves anyone without a legal move and never stops you getting out of check: a limit that would lifts for that turn. Your king is never frozen.
- The judge plays by the same rules: while a power limits your moves, the best move is the best of the ones you're allowed.
- The clock stands still while a power plays out: it never costs you thinking time.

### The rage meter {#rage-meter}

The meter fills to ${p.rageFull}${p.rageOverTime ? `:\n\n- ${p.ragePerMove} for every crowd move,\n- up to ${p.rageAheadMax} more a move while the crowd is ahead (by the judge's expected score: nothing at 0.50, all of it from ${num(p.rageAheadFull)}),` : ":\n"}
- ${num(p.ragePerMaterial)} for every point of material the boss loses (a pawn is 1, a knight or bishop 3, a rook 5, a queen 9)${queen ? ": taking his queen fills it on its own" : `: taking his queen fills ${pct((9 * p.ragePerMaterial) / p.rageFull, 0)} of it`},
- ${p.rageStrike} each time the God King strikes the boss ([his strike](#king-charges)).

Each boss's meter fills at its own speed (everything above times it): ${speeds}. The ones whose ultimates last longer fill faster, so each gets about two in a typical battle (Jefferson about one and a half: his barrage lasts longest). These rates are estimates, not yet tested with bots.
${
  p.rageOverTime
    ? `
$ rage a crowd move = ${p.ragePerMove} + ${p.rageAheadMax} × the crowd's lead, where the lead = (expected score − 0.5) / ${num(p.rageAheadFull - 0.5)}, from 0 to 1

In a level game (at ×1) it's full after about ${n(level, "crowd move")}; with the crowd well ahead, after about ${ahead}.
`
    : ""
}
When it's full: **"RAGE!"** and a warning as the next turn begins, then the ultimate the turn after. Hollow's and Big Boy's ultimates come at the start of their own turn instead (Lights out's only warning is the full meter), and Sawyer's needs more than a full meter (below).

Then the meter empties and fills again for the next one. While an ultimate is still under way (the Roman candle's fireballs still falling or burning, the board flipped or sawn in two, Lights out and the extra move after it) the meter stays empty, dimmed, and nothing adds to it, so two ultimates never overlap.

${blocks}
${later.length ? `\n### Still to come {#bosses-later}\n\n${n(later.length, "more boss", "more bosses")} are waiting for their art and powers: ${later.join(", ")}.` : ""}
`,
  };
}

function godKing(src: FaqSources): FaqSection {
  const S = src.settings;
  const bar = (best: number, moves: number, charges: number) => (best * 100 < S.lastStandFrom ? "no save" : num(lastStandBar(best, moves, charges, S), 1));
  // Sample positions: comfortable, the edge of the weak band, two inside it, and just under the no-save line.
  const mid = (S.lastStandFrom + S.lastStandShareBelow) / 200;
  const rows = [0.6, S.lastStandShareBelow / 100, mid, mid - 0.05, S.lastStandFrom / 100 - 0.01]
    .map((x) => Math.round(x * 100) / 100)
    .filter((x, i, a) => x > 0 && a.indexOf(x) === i)
    .sort((a, b) => b - a)
    .map((b) => `| ${pct(b, 0)} | ${bar(b, 0, 1)} | ${bar(b, 0, 0)} | ${bar(b, S.lastStandDecayMoves, 0)} |`)
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

The crowd's champion in every boss battle: raids, the Crowd's boss battle and Boss alone. He stands by the board in your side's colours, talks now and then, and acts when the crowd calls him. He's there for the big moments, not to play the game for you.

### Strike or play: his charges {#king-charges}

He has up to ${n(S.kingChargesMax, "charge")}. In a raid or Boss alone he starts with ${S.kingChargesMax}. In the Crowd's boss battle, the finalists' leftover power-ups become his charges: one for every ${S.kingPowerUpsPerCharge}, rounded, at least ${kingCharges(0, S)} and at most ${S.kingChargesMax}. Tap him to open his menu:

- **Play this move:** he plays the engine's best move for the crowd, at full strength (stronger than the boss).
- **Strike the boss:** three bolts on the boss's king, and the boss's next move is one that gives away ${range(S.kingStrikeLoss)} points (never a piece for nothing). One strike a move. It enrages the boss too: ${src.powers.rageStrike} on its [rage meter](#rage-meter) (unless an ultimate is under way).

Either needs **more than half the crowd** to call him. Bots back a person's call ${pct(S.kingBotFollow, 0)} of the time, and call him to play themselves when the crowd's popular move would give away ${n(S.kingBotLoss, "point")} or more. In Boss alone, your call is enough. If you call him to play instead of picking, you sit that turn out: no score either way, and it isn't a miss. The clock stands still while he acts, and a move he plays is never brilliant.

### His save: the Last Stand {#last-stand}

Once per battle, with or without charges, he steps in to stop a disaster. When the crowd's move is played and the judge's numbers say it gave away at least **the bar** (points against the best move), he dives onto the board, takes the blow meant for your piece and falls. The move is undone, and the crowd picks again with a fresh clock (the move he took back is off the table). The round's scores stand: the picks that chose it still cost what they cost.

$ plain bar = ${S.lastStandLossFloor} + ${S.lastStandLoss - S.lastStandLossFloor} × max(0, 1 − crowd moves / ${S.lastStandDecayMoves}) + ${S.lastStandChargedExtra} while he has charges

So it starts at ${start} with charges (${S.lastStandLoss} without) and eases to ${end} (${S.lastStandLossFloor}) by crowd move ${S.lastStandDecayMoves}, then stays there. In a weak position there are fewer points to lose, so the chances left matter too (the chances left are the best move's expected score):

- **Under ${S.lastStandFrom}%:** no save. The game already counts as lost.
- **From ${S.lastStandFrom}% to ${S.lastStandShareBelow}%:** the bar is ${S.lastStandShare === 0.5 ? "half" : pct(S.lastStandShare, 0)} of the chances left, when that's lower than the plain bar.
- **From ${S.lastStandShareBelow}% up:** the plain bar.

$ bar = min(plain bar, ${num(S.lastStandShare)} × chances left)    (from ${S.lastStandFrom}% to ${S.lastStandShareBelow}%)

| Best move worth | First move, with charges | First move, none | Move ${S.lastStandDecayMoves} on, none |
|---|---|---|---|
${rows}

**Worked example.** On the first move, from a level position, the crowd hangs its queen: that gives away 50 to 70 points, well over ${start}, so he saves it. Later, with the crowd down to ${pct(weak, 0)}, a move that throws away ${num(lastStandBar(weak, 0, 1, S), 1)} points (half of what was left) calls him too. A sacrifice the engine likes gives nothing away, so it never calls him: he judges the chances, not the material.

**What you see:** a warning, everything freezes, he dives onto the piece's square with his cut-in, the piece slides back, he takes the blow (against Hollow, Hollow lashes him with his string of lights), staggers, falls and fades. Then the crowd picks again. He's gone for the rest of the battle, and the charges he fell with go to the crowd: everyone still in gets ${n(S.lastStandPowerUps, "power-up")} for each (a power-up shows the engine's top 3 moves). He never steps in when only one move was possible.
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
  return {
    id: "crates",
    title: "Crates and items",
    body: `
**Everything here is cosmetic.** Nothing you own changes how a match is played or scored. Items dress your pawn (head, face, skin and weapon) on the vote board, the cut screen and your profile.

Every item from a crate rolls three things, each on its own:

1. **Its tier, which decides the item.** The strip lands on a tier's box, which opens to one of that tier's items, each as likely as the others. Or it lands on **Fischer Random**, a second spin for the rarest items: ${fischerWords}.
2. **Its colour.**
3. **Its purity:** 100% less a blemish (blotches over that share of its colour). From 90% it's **shiny**.

| Box | ${src.crates.map((c) => c.name).join(" | ")} |
|${src.crates.map(() => "---|").join("")}---|
${stripRows}

${perDropWords}

| Colour | Chance |
|---|---|
${colors}

Some items take a second colour (a present's ribbon, a suit's tie), rolled the same way.

| Purity | Chance |
|---|---|
${purity}

Shiny comes about 1 time in ${num(1 / (shiny || 1), 0)}. Crates are opened by the game's server, never by your device, so nobody can roll themselves a Pearl crown. The shop sells God King effects (the colour of his bolts, beam and halo) and quick-chat packs.${src.cratesFree || src.shopFree ? " While HunChess is being tested, crates and the shop are free." : ""}
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
- **Practice mode** (Settings) gives you unlimited power-ups in the open: you're marked on the leaderboard, and practice never counts towards your ranking.
`,
  };
}

function credits(src: FaqSources): FaqSection {
  return {
    id: "credits",
    title: "Credits and licences",
    body: `
- **Stockfish**, the chess engine behind the judge, the bosses and the bots: free software under the GPL-3.0 ([stockfishchess.org](https://stockfishchess.org), [source](https://github.com/official-stockfish/Stockfish), [this build's source](https://github.com/nmrugg/stockfish.js): stockfish.js 19, [licence](/engine/COPYING.txt)). It runs as a separate program in your browser.
- **Maia-3**, the human-like model ${src.brain.forPlayers ? "behind [some bosses](#maia-brain)" : "[being tested](#maia-brain) for bosses"}: by the CSSLab, University of Toronto, under the AGPL-3.0 ([Maia-3](https://github.com/CSSLab/maia3)). It runs as its own separate program in your browser; the source of our Maia box is available on request ([notice](/engine/maia/NOTICE.txt), [licence](/engine/maia/LICENSE.txt)).
- **The chess pieces**: drawn by Colin M.L. Burnett, from [Wikimedia Commons](https://commons.wikimedia.org/wiki/Category:SVG_chess_pieces), under the BSD licence ([licence](/licenses/pieces.txt)).
- **The app** is built with Preact (MIT) and chess.js (BSD), in the Archivo, Archivo Black and Press Start 2P fonts (SIL Open Font Licence) ([licences](/licenses/third-party.txt)). Its sounds are free of rights (CC0) or the game's own.
- The same credits are at the foot of Settings.
`,
  };
}

/** The FAQ's sections, in order, built from `src` (the game's settings unless a test says otherwise). */
export function faqSections(src: FaqSources = FAQ_DEFAULTS): FaqSection[] {
  return [modes(src), scoring(src), bossBrain(src), bossPowers(src), godKing(src), crates(src), fairPlay(), credits(src)];
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
