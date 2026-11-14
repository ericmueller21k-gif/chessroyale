# Flaky round 3: fix the causes (Eric, Nov 13: "fix the cause, not add a checker")

Effort high. New branch `claude/flaky-round3` from `origin/main`. Read CLAUDE.md "Fix the cause, not add a checker",
`.claude/LESSONS.md`, `docs/decisions/2026-11-14-flaky-causes.md` (round 1-2: what was learned; `settled()` in e2e/helpers.ts).
For each: **is the game wrong, or the test?** Game first. Guard tests in `docs/rules/eric.md`: game-side fixes only; if the test is
at fault, write the proposed change in .pr-body.md (Eric's OK needed), don't change its checks.

In order (main is red on #1 right now: it failed BOTH tries on main b0fbd8a, run of Nov 14 03:39, shard 12):
1. **town-street.spec.ts:227** [phone, Eric's guard] "Alfil's Pyramid… a tap on the half-hidden tile… the Go in card shows": "the
   half-hidden tile: the card" not visible in 5 s. Round 2's finding: `tapAt` uses `page.touchscreen.tap` (start and end as two round
   trips); on CI's software WebGL one frame between them outlasts `streetHoldMs` (180 ms), so the frame's hold check
   (`press.hold(performance.now())`) turns the tap into a run. Sending start+end together failed 1/3 at step 1 (a zero-length touch
   isn't read as a tap). Find the real fix. Consider the game: should the frame's hold check judge by the touch's own event time
   (a release already queued but not yet handled must not make a hold)? A real slow phone could hit this too. Prove it on phone
   with `--repeat-each 3` several times.
2. **fairplay.spec.ts:65** [phone, Eric's ban guard; 3 retry-passes today]: after clearing cookies+storage, `/` showed the guest home
   ("Player") instead of the landing's "Sign in to play online" within 5 s. Find why (config.onlineNeedsSignIn, the profile, the
   guest flag, a cached /api/config or service worker?).
3. **The font preloads vs the maintenance banner:** with `<link rel="preload" … as="font" crossorigin>` for the three fonts in
   `packages/app/index.html`, `e2e/kill-switches.spec.ts:109` [phone] fails at `/` (no `.maint-banner`); without them it passes
   (proved locally Nov 14). Find why; if the preloads can come back safely (they stop a first-visit reflow), bring them back.
4. **shop.spec.ts:238** [phone] "?fps in a room… going out": read 4 vs > 4 (twice now). Fix the cause, not the bound.
5. **town-chat.spec.ts:1054** [phone] "less left": the cooldown countdown read 6 twice (same second). 
6. **town-street.spec.ts:528** [desktop] "the Hidden Boss's walk-up…" `expect(received).not.toBeNull()`.
7. **town-chat.spec.ts:1367** [phone] "two signed-in players see each other's lines…" `toHaveCount`.
Do 1-3 for sure; 4-7 as time allows (list the rest under "Not done"). Prove each fix (`--repeat-each 3` locally on the project that
failed, before and after where reproducible). Typecheck; unit tests of packages you touch. Push at each real step; `.pr-body.md`
(a table: test, game or test, cause, fix; checks changed old -> new; Eric's OK needed for any guard change); `.done`. No PRs, no CI
waits, no model names in commits (end commits with the Claude-Session line only). About 1.5 hours.
