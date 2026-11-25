/**
 * Play coins' per-day table (the payments design's section 6; PLAY_COINS in settings.ts; docs/decisions/2026-11-25-play-coins.md),
 * from the settings, one run, through core's own gameCoins, game by game: so a settings change shows its effect. Writes
 * reports/coin-report.md.
 *
 *   npx tsx packages/sim/scripts/coin-report.ts [out=reports/coin-report.md]
 *
 * Games average 15 minutes, 4 an hour. Each player's games cycle through five results: a weak player's bonus averages 4 a game, an
 * average player's 8, a strong player's 13 (the design's). No solo games, no boost (PR 4), no XP rewards: coins from play only.
 */
import { writeFileSync } from "node:fs";
import { PLAY_COINS, SHOP, XP, bonusFor, bonusMax, bonusPaidAt, gameCoins, gameXp, playCoinsFor, type CoinDay, type CoinResult } from "@chessroyale/core";

const args = process.argv.slice(2);
const arg = (k: string, d: string) => args.find((a) => a.startsWith(k + "="))?.slice(k.length + 1) ?? d;
const out = arg("out", "reports/coin-report.md");

const MINUTES = 15;
const PER_HOUR = 4;
const HOURS = [1, 3, 6];
const win: CoinResult = { won: true };
const winTop: CoinResult = { won: true, crowdTop: true };
const PLAYERS: { name: string; cycle: CoinResult[]; words: string }[] = [
  { name: "Weak", cycle: [win, { draw: true }, {}, {}, {}], words: "a win, a ranked draw, three losses" },
  { name: "Average", cycle: [winTop, win, {}, {}, {}], words: "a 50 v 50 win in its team's top 3, a win, three losses" },
  { name: "Strong", cycle: [winTop, win, win, { crowdTop: true }, {}], words: "a 50 v 50 win in the top 3, two wins, a top 3 in a loss, a loss" },
];

/** One player's day of `games` games, its cycle started at `from`: coins, play coins and bonus, through gameCoins. */
function dayFrom(cycle: CoinResult[], games: number, from: number): { play: number; bonus: number } {
  let d: CoinDay = { play: 0, bonus: 0 };
  for (let i = 0; i < games; i++) {
    const r = cycle[(from + i) % cycle.length]!;
    d = gameCoins({ xp: gameXp({ ms: MINUTES * 60_000, moves: 30, won: !!r.won }), result: r }, d).today;
  }
  return d;
}

/** One player's day, averaged over every place their cycle could start (so a short day isn't all wins or all losses), rounded. */
function day(cycle: CoinResult[], games: number): { coins: number; play: number; bonus: number } {
  const days = cycle.map((_, from) => dayFrom(cycle, games, from));
  const mean = (k: "play" | "bonus") => Math.round(days.reduce((n, d) => n + d[k], 0) / days.length);
  return { coins: mean("play") + mean("bonus"), play: mean("play"), bonus: mean("bonus") };
}

const keys = (n: number) => (n / SHOP.prices.key).toFixed(1);
const avg = (cycle: CoinResult[]) => {
  const earned = cycle.map((r) => (r.won ? PLAY_COINS.bonus.win : 0) + (r.draw && !r.won ? PLAY_COINS.bonus.draw : 0) + (r.crowdTop ? PLAY_COINS.bonus.crowdTop3 : 0));
  return earned.reduce((a, b) => a + b, 0) / cycle.length;
};
/** A win's bonus at the start of each step of a day, and past them (15, 8, 4, 0 by the design's steps). */
const winAt = [0, ...PLAY_COINS.bonusSteps.map((st) => Math.round(bonusPaidAt(st.upTo)))].map((paid) => bonusFor(paid, PLAY_COINS.bonus.win));
const total = (m: number, r: CoinResult) => {
  const c = gameCoins({ xp: gameXp({ ms: m * 60_000, moves: 30, won: !!r.won }), result: r }, { play: 0, bonus: 0 });
  return c.play + c.bonus;
};

const lines = [
  "# Play coins: a day's coins by player and hours",
  "",
  `Written by \`packages/sim/scripts/coin-report.ts\` from the settings (\`PLAY_COINS\`), through core's \`gameCoins\`, game by game.`,
  "Run it again after changing the settings to see their effect. The design: `docs/decisions/2026-11-17-payments-design.md`, section 6.",
  "",
  "## The settings",
  "",
  `- Play coins: ${PLAY_COINS.perMinute} of a game's XP minutes (at most ${XP.maxMinutes} a game: ${playCoinsFor(XP.maxMinutes)} coins), at least 1 online, ${PLAY_COINS.perDay} a day.`,
  `- Bonus: a win ${PLAY_COINS.bonus.win}, a ranked draw ${PLAY_COINS.bonus.draw}, a 50 v 50 team's top ${PLAY_COINS.crowdTopPlaces} ${PLAY_COINS.bonus.crowdTop3}, Squads 1st ${PLAY_COINS.bonus.squads[1]}, 2nd ${PLAY_COINS.bonus.squads[2]}, 3rd-4th ${PLAY_COINS.bonus.squads[3]}, 5th-8th ${PLAY_COINS.bonus.squads[5]}. Solo: none.`,
  `- Steps of the day's earned bonus: ${PLAY_COINS.bonusSteps.map((s) => `to ${s.upTo} at ${s.rate}`).join(", ")}, then none: ${bonusMax()} bonus at most.`,
  `- The most a day: **${PLAY_COINS.perDay + bonusMax()} coins** (${keys(PLAY_COINS.perDay + bonusMax())} keys at ${SHOP.prices.key} coins a key). Solo alone: ${playCoinsFor(XP.soloMinutesPerDay, true)} (XP's ${XP.soloMinutesPerDay} solo minutes).`,
  `- A win's bonus through a day, step by step: ${winAt.join(", then ")}.`,
  "",
  "## A day",
  "",
  `Games of ${MINUTES} minutes, ${PER_HOUR} an hour. Coins (keys at ${SHOP.prices.key}).`,
  "",
  `| Player | Bonus a game | ${HOURS.map((h) => `${h} h a day`).join(" | ")} |`,
  `| --- | --- | ${HOURS.map(() => "---").join(" | ")} |`,
  ...PLAYERS.map((p) => `| ${p.name} | ${avg(p.cycle)} | ${HOURS.map((h) => day(p.cycle, h * PER_HOUR)).map((d) => `${d.coins} (${keys(d.coins)})`).join(" | ")} |`),
  "",
  "Each player's games cycle through five results (each day averaged over the five places the cycle could start):",
  "",
  ...PLAYERS.map((p) => `- ${p.name}: ${p.words}.`),
  "",
  "Play coins and bonus, the same days:",
  "",
  `| Player | ${HOURS.map((h) => `${h} h: play + bonus`).join(" | ")} |`,
  `| --- | ${HOURS.map(() => "---").join(" | ")} |`,
  ...PLAYERS.map((p) => `| ${p.name} | ${HOURS.map((h) => day(p.cycle, h * PER_HOUR)).map((d) => `${d.play} + ${d.bonus}`).join(" | ")} |`),
  "",
  "## The design's examples",
  "",
  `- A 15-minute ranked win: ${total(15, win)}; a loss: ${total(15, {})}; a draw: ${total(15, { draw: true })}.`,
  `- A 30-minute Squads lobby: 1st ${total(30, { won: true, squads: 1 })}, 2nd ${total(30, { squads: 2 })}, 3rd-4th ${total(30, { squads: 3 })}, last ${total(30, { squads: 5 })}.`,
  `- A 20-minute 50 v 50 win in the team's top 3: ${total(20, winTop)}.`,
  "",
];
writeFileSync(out, lines.join("\n"));
console.log(lines.join("\n"));
