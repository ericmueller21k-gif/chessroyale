## First-time walkthrough

- Nine slides over the home screen: the seven spots, the HunChess Handbook, and both Welcome Crates (5 and 25 games).
- "Don't show this tutorial again" is ticked by default. Settings → "Show the walkthrough again" replays it.
- The player-facing FAQ is renamed "HunChess Handbook" (code ids unchanged).
- `data-tour` attributes on the home spots (inert; no visual change).
- Stills for phone and computer: `docs/first-tutorial/`. Decisions: `docs/decisions/2026-11-06-first-tutorial.md`.

## Checks

- `npm run typecheck`: passes.
- Unit tests: `packages/app/test/tutorial.test.ts` (6) and the full app suite.
- e2e, phone and desktop: `walkthrough.spec.ts` (walks all nine slides; Skip; replay), `faq.spec.ts`, `legal.spec.ts`.

## Labels

No `full-e2e` label: the shared-component changes (`FrontMenu.tsx`, `FrontDoor.tsx`, `Home.tsx`) only add `data-tour` attributes,
and the e2e specs above cover the touched screens on both projects.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
