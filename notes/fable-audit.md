# HunChess: an outside review (read-only)

You're looking at HunChess with fresh eyes. It's a phone-first, multiplayer chess battle royale, live at hunchess.com (deployed to its owner, Eric, only, until launch). Almost all of it was built by Claude agents: a "director" session hands jobs to helper sessions, reviews what comes back, and merges. Eric decides the design and playtests. **Please don't change anything.** Read, then write up what you see.

We aren't asking you to confirm the work. We want what we're missing: what's wrong, risky, overbuilt, or will hurt at launch, and what you'd do differently. Be blunt. "This whole area is a mistake" is a useful answer if it's true.

## The game, in short
- **Modes:**
  - **Crowd**: 100 players on one board, 50 v 50 by team turns, with the most popular move played.
  - **Classic**: 64 players on 8 boards (to be reworked; ignore it).
  - **1v1** (ranked).
  - **Squads**: teams on three boards (Relay).
  - **Boss raids**: a crowd against a boss with powers. There are about 20 bosses plus the God King.
  - **Auto chess**: a shop-and-fight mode.
- **Around the games:**
  - **The Town**: a walkable square with bots, homes for each boss, the Colosseum and chess tables.
  - **Accounts, profiles and friends.**
  - **Quick chat.**
  - **Ranked**: rank points, seasons, and leave penalties.
  - **Shop**: crates with odds, keys and cosmetics. Coins and Stripe aren't wired yet.
- **Stack:**
  - TypeScript npm workspaces.
  - Preact app (Vite) with its own board and canvas renderers.
  - Cloudflare Workers and Durable Objects (one per lobby or match), with D1 for stored data.
  - Stockfish runs in players' browsers (Web Workers) and on an engine server, and judges move quality.
  - Maia (human-like bots) runs in a separate AGPL worker.
- **Size:** about 250k lines of source (app 194k, chess 24k, server 22k, core 11k), 122 Playwright e2e specs, Vitest units, and 327 decision notes.

## Read in this order (skim; the repo is big)
1. `CLAUDE.md`: how the project is run, Eric's standing rules, test lanes and computing priorities. Read all of it.
2. `buildspec.md`: the original brief.
3. `docs/areas/README.md`, then the area pages in `docs/areas/` (one each: bosses, god-king, crowd, squads, autochess, board, engine, fairplay, accounts, ranked, matchmaking, hub, chat, shop, town-square, colosseum, ops). Each says how the area works today and where its code is.
4. `docs/rules/eric.md` (Eric's rules and their guard tests) and `.claude/LESSONS.md` (what slipped past tests before).
5. `ROADMAP.md`: what's next, including launch items.
6. **Branch `claude/director-notes`:**
   - `notes/RULES.md` (the director's standing rules);
   - `notes/STATUS.md` (the live log; newest at the bottom);
   - `notes/pipeline-audit-2026-11-09.md` (our own latest audit of the CI and dev process, so you don't repeat it).
7. **Code**, by risk:
   - `packages/server/src/` (lobby.ts, lobby-do.ts, duel-room.ts, squads-*, index.ts: routes and auth);
   - `packages/chess/src/runner.ts` and `src/bosses/`;
   - `packages/core/src/settings.ts` (every tunable);
   - `packages/app/src/net.ts` and `solo.ts`;
   - the biggest files: `town/render.ts`, `town/shops/ShopRoom.tsx`, `town/Town.tsx`.
8. `docs/decisions/` and `DECISIONS.md` only to check *why* something is the way it is. Don't read them front to back.

## What we'd most like your eyes on
1. **Game integrity and fairness.**
   - Is the server truly in charge of results, rank points and rewards?
   - Our computing rule sends judging and engine work to players' own devices first, checked against each other. Where could a player cheat, spoof a device's verdict, or farm rank, coins or crates?
   - What do the fair-play signals (docs/areas/fairplay.md) miss?
2. **Launch risk.** What breaks first with real players, at 100 per Crowd match and many matches at once? Look at Durable Object limits, D1 write load, reconnects, a deploy during a match, abuse, and bots.
3. **Security.** Sign-in, sessions, admin pages and abilities, test switches (`?power=`, `__town*` hooks: are they really off for players?), rate limits, and anything a public repo exposes.
4. **Money and law.** Crates with odds, keys, a planned beta discount, and Stripe. Think about loot-box rules (odds disclosure, minors, regions where paid random rewards are restricted), refunds and app-store rules. What must be true before money goes live?
5. **Performance on phones.**
   - We just found that every page load spends about 1.4 s drawing every boss's art up front; a fix is in progress.
   - What else costs load time, memory or battery?
   - Is the bundle sensibly split?
6. **Code health.**
   - Huge files, duplicated logic, dead flags, and test switches tangled into game code.
   - Places where "one more boss" or "one more mode" will keep getting more expensive.
   - Which simplifications would pay back most? Eric's rule is "simple beats flashy: less code, less lag, fewer ways to break".
7. **Scope and product.** Several modes, about 20 bosses, a town, auto chess and a shop, all before launch.
   - Is that a strength or a risk?
   - What would you cut, merge or finish first to launch something solid?
   - What would a new player find confusing?
8. **How we build.** Director plus helpers, decision notes for everything, about 15 to 25 minute CI runs, flaky tests and their gate, and the test lanes. What's wasteful, and what's missing (a review step, a kind of test, monitoring)?
9. **Anything else** you'd flag that isn't on this list: the things we don't know we're missing.

## How to answer
- Put **the top 10 findings first, ranked by impact.** For each finding give:
  - what it is;
  - evidence (`file:line` or doc);
  - why it matters;
  - what you'd do;
  - your confidence (high, medium or low).
- Then a short list per section above, then quick wins (under an hour each).
- Say clearly when you're guessing versus when you've read the code. Don't pad: three real findings beat thirty generic ones.
- Plain American English, no jargon where a plain word works. Eric reads this himself, often on his phone.
- Don't open PRs, issues or comments, and don't push. If you want something checked by running it, say what and how; the director will run it.
