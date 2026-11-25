## First-time walkthrough

- Nine slides over the home screen: the seven spots, the HunChess Handbook, and the Welcome Crates (5 and 25 games).
- The last slide: each crate's picture, bar and progress, a "Go to your inventory" button (the shop's Crates tab), and the shop lit up.
- "Don't show this tutorial again" starts unticked. Finishing all nine slides stops it; Skip stops it only when ticked.
- Settings → "Show the walkthrough again" replays it.
- The player-facing FAQ is renamed "HunChess Handbook" (code ids unchanged).
- `data-tour` attributes on the home spots (inert; no visual change).
- Stills: `docs/first-tutorial/`. Decisions: `docs/decisions/2026-11-06-first-tutorial.md`.

## Checks

- `npm run typecheck`: passes.
- Unit tests: `packages/app/test/tutorial.test.ts` (9).
- e2e, phone and desktop: `walkthrough.spec.ts` (all nine slides; the crates; finish vs. Skip; inventory button; replay), `faq.spec.ts`, `legal.spec.ts`.

## Labels

No `full-e2e` label: the shared-component changes (`FrontMenu.tsx`, `FrontDoor.tsx`, `Home.tsx`) only add `data-tour` attributes, and the specs above cover the touched screens on both projects.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
