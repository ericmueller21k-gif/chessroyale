# Residents: the program and ranked 1 v 1 (PR 2)

Nov 25, 2026. Eric: "have 200 bots made which just sit on the server and play ranked ... so like any time of day I can login and see
games played". The design is `notes/residents-design.md` on `claude/director-notes` (§1 "What the program reuses", "Engines"; §3
"PR 2"); the server side (the flag, the route, `PAUSE_RESIDENTS`) is PR 1. How to run it: [ops.md](../areas/ops.md), "Residents, the
program". The calls made while building it:

- **Topping up past 1-3 sessions a day.** 200 accounts at 1-3 sessions of 10-60 minutes give about 6 online, not 30. The schedule
  draws keen residents first (today is one of their days, sessions left), then tops up from the rest, still within 6 hours per
  local day and 20 minutes' rest between sessions. Measured on a planned day: 15 to 48 online, about 30 on average; the median
  resident plays about 4 hours. More accounts (`--accounts`, up to the 200 names) spread it thinner, as the design says.
- **Waves.** The online target is `--target-online` times the residents' own daily shape (their local hours' weights summed, over
  the day's average) times a slow swell (±25% every 90 minutes, its phase seeded by the day), held between 0.5 and 1.8 times the
  target. At most 3 sessions begin a minute.
- **The same day after a restart.** Each UTC day is planned minute by minute from an hour before midnight, seeded by resident, day
  and minute, and nothing else; a restart plans it again and puts residents back into the sessions still running. Yesterday's
  sessions that cross midnight carry over, and today's plan's hour before midnight only stands in for them while planning, so the
  two days join without doubling.
- **Two residents sometimes queue alone.** Read as: one resident is often alone in line. A gate lets residents into the 1 v 1
  queue at most 3 unpaired at a time, 2-25 s apart (1-4 s when more than two are waiting), so a person who queues usually finds one
  there within seconds, and residents still pair among themselves quickly.
- **Maia only, and required.** The program won't start without Maia (moves would stop being people's). If Maia dies mid-run it's
  restarted (at most once a minute) and moves meanwhile are random legal ones, counted (`fallbackMoves`, "not Maia's"). No
  Stockfish: 1 v 1 has no judging.
- **Behaviors in 1 v 1:** AFK misses its first move in 8% of games (an abort, a dodge) and stops moving midgame in 8% (it flags);
  a leaver walks away from 10% of its games after 10-30 moves and logs off (it flags while gone, a leave); a rage-quitter resigns
  sooner (4 down in material from its 4th move) and logs off after 60% of its losses; a slow resident thinks 2.2 times longer,
  likes Rapid, and runs its clock out on 1% of moves; chatty says hello, gg and the odd "Nice move!"/"Wow" (presets only). Anyone
  resigns a game 8 down in material from its 12th move now and then (material, not an engine's eval: no Stockfish), and 2% of
  games drop the socket once and come back.
- **Stopping resigns.** SIGTERM resigns games in progress (an abort before both first moves) rather than waiting for them: the
  container's stop grace is short, and an honest resignation is what a person closing the tab mid-game amounts to.
- **Every account at the start**, four at a time, so the 200 are on the leaderboards and searchable from the first run, not as
  each is first scheduled.
- **Names:** 200 handles in `names.json`. Openings named after people (the Ruy Lopez, Alekhine, Petrov, Philidor, Pirc, …) were
  left out as hints of real people; so was anything tied to a known streamer's meme.
- **Access:** the token goes only to `hunchess.com` (and hosts under it) and comes from `CF_ACCESS_CLIENT_ID` /
  `CF_ACCESS_CLIENT_SECRET`, as the brief says. Until PR 3's token exists, PR 1 also lets in the test accounts' token: set these two
  to its values for tonight's first run.
- **Where it's tested:** vitest only runs `packages/*/test`, so the program's tests are `packages/server/test/residents-program.test.ts`
  (it also checks the names against the server's own `cleanName` and the icons against `ICONS`), and `packages/sim`'s tsconfig
  includes `scripts/residents` so `npm run typecheck` covers it (`ws.d.ts`: the few `ws` types it uses).
