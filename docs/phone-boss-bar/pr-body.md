# Every boss whole inside the phone's boss bar; Puddles' meters stacked

Eric (Nov 4, iPhone, Puddles): his arm and hose were cut off by the boss bar's left edge, and his Seeds meter didn't line up with
his health bar. This makes every boss whole inside the bar at rest and at the end of each beat, on a phone, and stacks the meters.
Decision and calls: `docs/decisions/2026-11-04-phone-bar-fit.md`. Lane: targeted (a phone's bar: CSS, the kits' bar numbers, the
boss bar's guards). No computer change.

## Player-visible changes (phone only)
- Each boss's drawing sits inside the boss bar (was: could hang out of its left edge, and its top: Babur's balloons, Moo's moon).
- Each boss's name, level, meters, words and free room move right where its figure needs room (`barName`). Names no longer share one x.
- Puddles' Seeds meter: "Seeds 5" on its own line above its bar, the bar as wide as the rage meter above it (both at one x).
- Figure sizes: Puddles 14/12 (was 15/12), Moo & Moon 1 (was 14/12), Babur 1 (was 16/12), Jefferson 0.93, Dash 0.97 (were 1).
- No new text. Stills: `docs/phone-boss-bar/` (before and after at 390x844; after at 375x667 and 430x932).

## Changed checks (old → new)
`packages/app/test/boss-bar-same.test.ts`:
- "drawn at full size or more, never less" → "drawn at its own size or smaller, never more": Jefferson and Dash may be smaller.
- "the largest 1/12 step that fits the room" → "the largest size that fits the bar's height at rest" (big animals in 1/12 steps; others a hundredth below 1 where needed).
- Room at rest, left: drawn left edge 2 px inside the screen (L·s − shift ≤ 46) → 2 px inside the bar's left edge (≤ 32).
- Room at rest, right: 2 px short of the name column (≤ 39) → ≤ 39 + the kit's `barName`.
- Room at rest, top: 1 px under the "BOSS · move N" text (U·s ≤ 108) → not above the bar's top (≤ 93).
- Rest frames: idle frames only → every rest frame (each loop's frames, the last frame of each one-shot).
- Moments (mid-motion) check: unchanged.

`e2e/boss-bar-same.spec.ts`:
- "2 px inside the screen's left edge" → "2 px inside the bar's left edge"; added "inside the bar's right edge" and "not above the bar's top".
- "nothing of the figure below the bar" (≤ bar bottom + 1 px) → (≤ bar bottom − 2 px).
- Name x, level x, rage x, prop x and prop width: "the same for every boss" → y only (the name column moves per boss; `status` x stays).
- Status y, prop y and prop height at 320 px: all bosses → bosses whose name column did not move.
- "the status on one line" at 320 px: all bosses → not for a boss whose name column moved.
- Bubble rows at 320 px: rows must equal the wanted rows → for a boss whose name column moved, one more row is allowed (never four).
- New: a seed bar starts at the rage meter's x and is as wide (Puddles).

Unchanged: the Nov 4 sprite rule (`e2e/boss-side.spec.ts`, "whole on screen") and the feet baseline.

## Checks run
- `npx vitest run packages/app/test/boss-bar-same.test.ts`: 61 passed.
- `npm run typecheck`: passed.
- `e2e/boss-bar-same.spec.ts` on the phone project (local, under the shared lock): 15 passed.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01EKH5j59nMnRVnekEcuZbim
