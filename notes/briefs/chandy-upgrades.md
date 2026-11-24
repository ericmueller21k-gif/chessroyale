# Chandy: more upgrades through the battle; the "queen lock" renamed; the God King's warning (Nov 24). Opus xhigh, boss lane + one sim

Eric (Nov 24, with a screenshot of a deep endgame against Chandy, his rifle showing 2 upgrades): "look at how deep this game is, and he only
has 2 upgrades ... the only 2 we got were the ones that we force him to get. ... we should be able to make it so like he marks one and then
he wants to target it for. Like he's aggressively trying to capture a piece and upgrade, even if it like is a detriment to him, but like not
a super detriment, you know, like if it's like a decent trade, but maybe slightly negative, he still targets it. I think that's the ideal
after the first 2 upgrades, because he ended up just doing the queen shot 3 times, which is one of his strongest ones, and he just keeps
blasting my pieces. ... we need to change it ... if he does a queen shot, we should replace that with ... a generic name since he doesn't
always target your queen ... replace queen in the where it shows that. And then also when he says that the god king should say something
about like, you know, move your queen behind safety or something like that. ... When he does his queen shot, we should already know ... which
piece you're most likely to sacrifice. So have him mark that piece as well. So you're basically ... going to give him another upgrade."

Start: `git fetch origin main && git checkout -B claude/chandy-upgrades origin/main`. Read CLAUDE.md, `.claude/LESSONS.md`,
`docs/rules/eric.md`, `docs/areas/bosses.md` (Chandy's row and section), `docs/decisions/2026-11-16-chandy-rules.md`, the `-first-lock`,
`-queen-lock-first`, `-move-mix`, `-rook-lock`, `-queen-shot` decision notes, `packages/chess/src/bosses/chandy.ts`, settings `chandy`
(~2238-2290), `reports/chandy-sim.md` and its script. Effort xhigh: boss brain and calibration, solo and online.

1. **Find why his locks almost never become upgrades after the first two** (today: `takeMargin` 2, `chaseMargin` 0.75, `huntTurns` 3,
   `liveTurns` 5, `maxLocks` 2). Measure first with the sim (upgrades per battle, when, how many locks expire, how often a locked piece is
   moved away or defended, how often steering found no move in `lockLines`). Fix the cause, not only the numbers.
2. **After his first two (taught) upgrades, he hunts a locked piece aggressively** (Eric's words above): he'll play into a trade that is
   about even or slightly negative for him to take it (a new tunable, e.g. `huntLoss` around 0.5 to 1 pawn, never a big loss: never hang
   his queen or allow mate), keeps chasing it across turns, and re-locks the next most gettable piece when one escapes. Target (the
   director's, tunable, report it): in the sim at Eric's pace, typically **4 to 5 upgrades by the late middlegame**, while his overall
   strength (the crowd's score vs him) stays within the band his calibration set (`reports/chandy-sim.md`); say the before/after numbers.
3. **The shot's victim counts:** when the queen lock fires, the piece it will hit (the queen, or the piece you're most likely to put in the
   way: the first piece between his edge and the target down the file after your best reply) is **locked as well**, so the piece the round
   shatters is an upgrade, like a capture. Decide it once when he aims, the same on every device (the runner's state, not a device's guess).
4. **Rename the move** in every player-facing place (the move's name, the dock and result lines, the weapon screen, the FAQ, his lines):
   "Queen lock" → a generic name, since it may aim at a rook: the director's call is **"Lock-on Shot"** (record it; Eric can change it).
   Its text never says "queen" unless the piece is a queen ("Lock-on Shot: your rook took it.").
5. **The God King warns** when the shot is aimed (the dock/his line on your turn): e.g. "He's aiming down that file. Get your queen out of
   the line!" (or "your rook" when it's a rook), using the God King's existing warning path; quiet if the target can't move (follow the
   existing rule "the God King quiet about threats he can't heed").
6. Prove: typecheck; `packages/chess/test/chandy*.test.ts` and the boss kit; server Chandy lobby tests; `e2e/chandy*.spec.ts` and his boss
   smoke, phone and computer; one sim run (the existing Chandy sim) before and after, its report updated (`reports/chandy-sim.md`). Decision
   note (`docs/decisions/2026-11-24-chandy-upgrades.md`). Area page. PR body in `.pr-body.md` (what changed, player-visible, changed checks
   old → new, the sim's numbers). `.done`, push, stop. Don't open PRs or wait on CI. Helpers reset, never revert. Commits end with only
   `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR` (no Co-Authored-By line, no model names). Never write the Hidden
   Boss's name. American English.
