# Chandy's rules, the fix round: the review's findings and Eric's ult change (Nov 16). Opus, xhigh, alone

Effort xhigh (server, rules, a sim run). `god-king` delegate. Work on the PR's branch `claude/chandy-rules` (PR #739; the director
pushed 814b479 there: the boss select tile count). Include `notes/briefs/rules-common.md`. The review: `git show
origin/review/chandy-rules:review.md`. The spec: `git show origin/stills/boss-chandy:DESIGN.md`. Read `.claude/LESSONS.md`.

## Do
1. **H1 (security, must):** online, Dodge's safe squares and teleports go to every client before Dodge begins (`lobby.ts`
   `bossViewSent` filters only while `r.dodge` is set; Dodge is created as his move applies). Filter whenever Dodge isn't over, as the
   review says, and add the lobby test it names (the message after the move that brings Dodge: `safe: ""`, no teleports, every round).
   Check `r.last` (a reconnect) too.
2. **M1 (director's call: yes, the design's own rule):** after a pass-guard wait, the meter picks another unlocked move instead of the
   queen lock again (`meterPick(c, seed, ["queenlock"])` in the `PASS_WAIT` branch); the queen lock can come back on a later fill.
3. **L1:** a locked pawn that promotes to a queen is unlocked at once (never the queen).
4. **L3:** restore `town-player.test.ts`'s original lines (the `housed` filter weakened a guard for nothing).
5. **Eric's ult change (Nov 16): "He only ults once per game, no matter what"; "It should fire after he gets all 5 upgrades ... it
   should be ulting most games."** Today Dodge came in only 13 of 32 sim battles: after the 5th upgrade the ordinary rage meter fills
   too slowly. Make it:
   - **once a battle** (`maxUltimates.chandy` 1);
   - **soon after the 5th upgrade:** from the 5th upgrade his rage bar fills over a set number of crowd moves (`dodgeAfterMoves`, start
     at 3, in settings), then the usual warning, then Dodge as a crowd turn begins. Nothing else fills or drains it. The bar stays
     dimmed until the 5th upgrade ("Nothing hidden, nothing shifts").
   - Update DESIGN-facing docs (bosses.md his row, the decision note) and the settings comment.
6. **One sim run** at the shipped settings (boss lane: one run, one setting): report the share of battles with Dodge (aim: at least
   85%), the 5-upgrade share, the crowd's score; update `reports/chandy-sim.md`. L2 (bots always find the safe square) stays as is:
   note it for Eric.

## Tests and deliver
His rule tests for 2, 3 and 5 (once a battle, fires N crowd moves after the 5th upgrade, the bar dimmed until then); the lobby test
for 1; the boss kit and parity passing; `e2e/chandy.spec.ts` updated where Dodge's timing changed. Locally only the tests you touch.
Then update `.pr-body.md`'s changed checks and sim numbers (write the new body to `.pr-body.md` again) and write `.done`. No PRs, no
CI waits, no model names in commits (end with the Claude-Session line only). Push work in progress at each real step.
