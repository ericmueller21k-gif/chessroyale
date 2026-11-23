# Birdie's crate on the bar, his token if drawn, and #905's delta nits (Nov 23). Opus high, boss lane

Start: `git fetch origin main && git checkout -B claude/birdie-crate-bar origin/main`. Read CLAUDE.md, `.claude/LESSONS.md`,
`docs/rules/eric.md`, `docs/areas/shop.md`, `docs/areas/town.md` (or the town's area page). Effort high: drawing in code plus small sound
and test fixes, no rules or stored data.

Do:
1. **Birdie's Boss Crate on his bar**, built the way Babur's is (`packages/app/src/town/shops/babur-art.ts` ~617-640:
   `SHOP_BABUR_CRATE`, `SHOP_BABUR_CRATE_AT`, the `at("crate", ...)` line ~1107, and its `crateAt` wiring in `ShopRoom.tsx:195`):
   the houses/kit `crate()` helper, code only, no paid art, no hand-drawn sprite. In Birdie's colors (his room's navy, burgundy and gold,
   from `shops/birdie-art.ts` and his sprite), a small gold emblem on its front (a plain shape, no letters), and a little decoration on the
   lid that fits him (e.g. a tuft of seed or a tiny feather), and the same slow gold glint idle as Babur's. It sits on his bar where
   the player taps to buy, like Babur's on his counter. Reuse Babur's code shape; don't write a new system.
2. **His token, only if it is drawn by the time you get here:** `git fetch origin claude/boss-art` and look for
   `scripts/boss-art/out/token-birdie/token-birdie.ts`. If it's there, copy it as drawn into `packages/app/src/components/tokens/`
   (as `token-blitz.ts` was: a two-line header naming the source commit) and map `birdie` in `components/tokens/index.ts`. If it's not
   there, skip this step and say so in the PR body: the director wires it later.
3. **The delta review's nits** (`git show origin/review/birdie-ride-crate-delta:REVIEW-DELTA.md`, read N1-N5):
   - N1: warm the ride's sound in `dress()` (Town.tsx) once the town has shown, off a moving frame.
   - N2: try/catch around the `new AudioBuffer(...)` in `ride-sound.ts` (~101), returning null as `prepareAudio` does.
   - N3: reword the comment in `e2e/town.spec.ts` (~1697) to what the check proves: "made before your first move, never on it".
   - N4: `packages/core/test/crates.test.ts` (~400): roll with `k = (i + 0.5) / WELCOME_CRATE.items.length` for every `i`, the left-out
     ride as `won`, and expect the set to equal `WELCOME_CRATE.items`.
   - N5: one line in `shop.md`'s Welcome Crate section and the item-builder checklist (`.claude/agents/item-builder.md`): a boss's ride
     goes in with its boss crate, or the Welcome Crate can't tell it's an admins-first boss's.
4. Prove: typecheck; the unit tests of what you touched; e2e: the shop/town spec that covers Babur's crate on the counter, the same for
   Birdie (add one focused check to that existing spec if Babur's has one), and the town ride-sound test; phone and computer.
   One still per platform of Birdie's bar with the crate, on a new orphan branch `stills/birdie-crate-bar` (with `NOTE.md`).
   Decision note of about five lines (`docs/decisions/2026-11-23-birdie-crate-bar.md`). Update the area page(s).
   PR body in `.pr-body.md` (what changed, player-visible changes, changed checks old → new). `.done`, push, stop.
   Don't open PRs or wait on CI. Helpers reset, never revert. Commits end with only
   `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR` (no Co-Authored-By line, no model names).
Never write the Hidden Boss's name anywhere. American English.
