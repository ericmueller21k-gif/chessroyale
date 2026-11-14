# Flaky round 5: fix the causes (Eric, Nov 13: "fix the cause, not add a checker")

Effort high. New branch `claude/flaky-round5` from `origin/main` (b6d26aa8 or later, green). Read CLAUDE.md "Fix the cause, not add a
checker", `.claude/LESSONS.md`, `docs/decisions/2026-11-14-flaky-causes.md` and `docs/decisions/2026-11-14-flaky-round4.md` (round 4:
`townTap` holds the town's frames while it reads a point and taps; `tapInTown` uses it). For each: **is the game wrong, or the test?**
Game first. Guard tests in `docs/rules/eric.md`: game-side fixes only; if the test is at fault, write the proposed change in .pr-body.md
(Eric's OK needed), don't change its checks.

1. **The same race, everywhere (round 4's follow-up, LESSONS says so):** specs that still read `__townAt` and click on their own
   (claw, colosseum, global-chat, hidden-boss-room, shop, town-controls, town-fixed, town-street (others), town-tags, zebra-home,
   town.spec (others)). Move them to `townTap` / `tapInTown`: how the tap is made changes, never what is checked. Where one is an Eric
   guard, that's still only the tap's mechanics (say so per test in the PR body).
2. **shop.spec.ts:1144** [desktop, Eric's guard: "up is up the screen in every room"] `toHaveText` failed once (PR #713's run
   43609938357, shard 1, passed on retry).
3. **autochess.spec.ts:238** [phone] "buying: tap an offer's silhouette…" `toBeVisible` (#713's first run 43605689472, shard 8).
4. **town-afk.spec.ts:116** [phone] "in the background for the limit…" `toHaveURL` (#711's run).
5. **shop.spec.ts:238** [phone] "?fps in a room… going out": read 4 vs > 4 (red on both tries once, a8657b75).
6. **town-chat.spec.ts:1367 / 1370** [phone] `.tc-boss` count 2 for 1.
7. **fairplay.spec.ts:65** [phone, Eric's ban guard]: after clearing cookies+storage, `/` showed the guest home instead of the landing.
8. **alfil.spec.ts:247** ("he took your queen": 0), and **town-street.spec.ts:155** (a 500 from the local server; round 4 made its
   errors name the URL: read the next failure's URL if one shows in recent runs).
Get the current list from main's last few full runs first (the `result` job's flaky list; annotations via
https://api.github.com/repos/ericmueller21k-gif/chessroyale/commits/<sha>/check-runs then /check-runs/<id>/annotations) and add new ones.
Do 1-4 for sure; the rest as time allows ("Not done" for the rest). Prove each fix (`--repeat-each 3 --retries 0` on the project that
failed, before and after where reproducible). Typecheck; unit tests of packages you touch. Push at each real step; `.pr-body.md` (a
table: test, game or test, cause, fix; checks changed old -> new; Eric's OK needed for any guard change); `.done`. No PRs, no CI waits,
no model names in commits (end commits with the Claude-Session line only). About 1.5 hours.
