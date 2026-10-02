# Battle Royale Chess

## Follow the spec

`buildspec.md` is the brief. Read it before doing anything, and follow it. Where it's ambiguous, make the call and
record it in `DECISIONS.md`.

## How Eric likes to work (carried over from Word Trap)

- Keep Eric's involvement minimal. Make judgement calls yourself and record each one, with the reason, in
  `DECISIONS.md`. Stop and ask Eric only for things only Eric can do: accounts or anything that costs money, testing on
  his real phone or computer, or reversing a rule he set.
- Don't stop for review between milestones (Eric, Oct 2, 2026, overriding the spec's "stop after each milestone"):
  commit, push and keep going. Opening and merging your own PRs into `main` is fine; `main` auto-deploys.
- Free hosting only. Cloudflare (Workers + Durable Objects, deployed from GitHub) is already set up on Eric's account
  for Word Trap; this repo deploys the same way.
- Phone-first and app-like, also good on a computer: big tap targets, no accidental scrolling or zoom, light and dark
  mode.
- Keep every tunable in one settings file (`packages/core/src/settings.ts`).
- Explain rules and scoring in plain language on screen. Real playtests drive changes, so make tweaks easy.

## Progress

- [x] 1. Match engine and scoring (`packages/core`, `packages/chess`)
- [ ] 2. Simulation and playtest report
- [ ] 3. Solo build
- [ ] 4. Multiplayer lobbies
- [ ] 5. Spectating and polish

## Layout and commands

- npm workspaces, TypeScript throughout.
- `packages/core`: pure match logic (stages, grouping, scoring, the draw, retirement, bot picks). No UI, network or
  chess-engine code.
- `packages/chess`: chess rules (chess.js), the Stockfish interface over UCI (`src/uci.ts`; Node transport in
  `src/node.ts`), and the opening library (`data/openings.json`, built by `scripts/build-openings.ts`).

```sh
npm install
npm test                                       # vitest (engine tests run real Stockfish)
npx tsx packages/chess/scripts/build-openings.ts   # rebuild the opening library (~15 min, 4 engines)
```
