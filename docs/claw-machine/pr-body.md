# Boingo's claw machine: spend a boss token for a chance at that boss's crate

Lane: **full e2e** (it spends players' tokens and grants crates: odds, wallets, stored data). Add the `full-e2e` label.

## What changed

- **Server (the fair-play core):** `POST /api/shop/claw {boss, request, seed?}` (`packages/server/src/claw.ts`, `playClaw`). One play
  spends exactly one of that boss's tokens, rolls with the server's own randomness, and on a win puts **that boss's Boss Crate** in the
  inventory, unopened (a `boss_crates` row: it opens like a bought one). Answers `{won, crate?, boss, again?, locker}`.
  - **Atomic:** one D1 batch: the play's row only if the token is there; the token off only if that row went in; the crate in only if
    that row went in and won.
  - **Idempotent:** the app's `request` id per coin; `claw_plays` is `UNIQUE (user_id, request)`, so a retry spends and grants nothing
    and answers the first play (`again: true`). The app asks again with the same id after a network hiccup or a 5xx.
  - **Concurrent plays** can't overspend (each its own transaction; `boss_tokens.n >= 0`).
  - **Logged:** `claw_plays` (account, boss, won, crate, time), in "Download my data" and erased with the account; a log line per play.
  - **`CLAW.winChance` = 0.25** in `packages/core/src/settings.ts` (plus the claw's timings). The shop's kill switch refuses a play.
    Guests can't play. The e2e's `seed` is honored only where `TEST_SWITCHES` is "1" (never production, never for an admin elsewhere).
- **App:** `packages/app/src/claw/` (`index.ts` exports `openClawMachine(): void` for Boingo's Funhouse; its own chunk, loaded on the
  first tap). The machine's screen: "Insert one boss coin", your boss tokens (token art, "× N", greyed at none); a pick drops the coin
  (sound) while the server decides; the claw roams on its own with a big STOP (it drops on its own after 8 s); it grabs, lifts and on a
  win carries the crate to the chute ("You won Folio's Boss Crate!", **Open now** uses the Crates tab's own opening); on a loss it slips
  at the top ("So close! Try again?"). The animation follows the server's answer, which comes first; closing at any point is safe.
  `?claw=1` (a test switch) opens it until the room places it; `?clawSeed=N` is the e2e's seed.
- **Sounds:** a coin, a claw whir, a grab and a prize thud, synthesized (`claw/sounds.ts`), made ahead in the sound worker like the
  bosses' (`MAKE`), each a little under a move's loudness, numbers only.
- **Eric's test tokens:** admins don't have unlimited tokens; the existing admin-only grant gives them (Crates tab, "Admin: test
  grants"). The machine shows admins one button, "Admin: +3 of each token", calling that same grant. Nothing new on the server.
- `Crates.tsx` exports `CrateOpening` and a small `BossCrateArt` (the row's crate picture) for the machine; nothing else changes there.
- Expected cost: 4 tokens a crate at 25%, against a bought crate's 3 tokens (or 1 token and a key): a good use of extras
  (`docs/decisions/2026-11-06-claw-machine.md`).

## Player-visible changes and new text

"Insert one boss coin", "You have no boss tokens yet.", each token's name and "× N", "Tap STOP to drop the claw", "STOP",
"You won Folio's Boss Crate!" (any boss's crate name), "Open now", "Play again", "So close! Try again?", "Try again", "Close"; the
server's refusals on the machine's screen: "You need a Folio token.", "Sign in to play the claw machine.", the shop's resting line.
Admins only: "Admin: +3 of each token". The machine itself appears only once Boingo's Funhouse calls `openClawMachine()`.

## Changed checks (old → new)

- `packages/server/test/account-data.test.ts`, "every table's columns are as pinned": adds `claw_plays: "id user_id request boss won
  crate at"` (old: no such table). Guards no rule in `docs/rules/eric.md`.
- No check changed or removed otherwise. `playwright.config.ts`' ADMINS gains the claw spec's admin address (`ops-admin-claw-*`).
- New: `packages/server/test/claw.test.ts` (spends exactly one; refuses with none; about 25% over 2000 seeded rolls; a win grants that
  boss's crate and it opens; idempotent on retry; the same play twice at once; 5 plays at once with 2 tokens; a failed write undoes the
  play; guests refused; the kill switch; the seed only with TEST_SWITCHES; the admins' grant admin-only),
  `packages/app/test/claw.test.ts` (the flow with a server win and a server loss driving it; never a win the server didn't grant; the
  sounds), `e2e/claw.spec.ts` (phone and computer: an admin's test tokens, a forced win opened with Open now, a forced loss, one token
  each). `e2e/areas.json` maps `packages/app/src/claw/**` and the spec to the shop's area.

## Runs (local, Nov 6)

- `packages/server/test/claw.test.ts`: 14 passed. `packages/server/test/account-data.test.ts`: 20 passed.
- `packages/app/test/claw.test.ts`: 9 passed; `boss-sounds-finite.test.ts` and `sounds-source.test.ts` pass with the new sounds.
- `npm run typecheck`: clean.
- `e2e/claw.spec.ts`: passed on phone (29.4 s) and desktop (29.2 s).

## Visuals (phone, 390 × 844)

`docs/claw-machine/`: `insert-empty.png` (no tokens yet), `insert-picker.png` (the picker after the admin's grant), `roaming.png`
(the claw out, STOP), `win.png` and `win.gif` (the crate carried to the chute, "You won Folio's Boss Crate!", Open now), `loss.png` and
`loss.gif` (it slips at the top, "So close! Try again?").

## Known follow-ups

- Boingo's Funhouse (`claude/boingo-home`) calls `openClawMachine()`; when it merges, main is merged here and the stub resolved (this
  module wins).

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01EKH5j59nMnRVnekEcuZbim
