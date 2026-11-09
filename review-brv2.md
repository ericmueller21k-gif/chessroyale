# Review: boss result v2 (`origin/main...origin/claude/boss-result-v2`)

Boss lane, one read-only pass (effort high). **Verdict: no blocking findings.**

Checks run: `npm run typecheck` passes. `npx vitest run packages/core/test/xp.test.ts packages/app/test/faq.test.ts packages/chess/test/boss-kit.test.ts`: 3 files, 89 tests, all pass.

## What was checked and holds
- **Result in every case:** `ResultDuo` renders whenever `bossResult && match.boss`. The attack plays only when `bossResult === "boss"` and the boss's kit has a `kingAttack`, so it covers a loss, a resign, a timeout, Carrots, a blackout and a simul loss. A win shows the defeat pose and a draw shows both standing. After a Last Stand, the God King is gone and `LastStandCard` still shows.
- **Attack timing:** `at` is fixed once in `useState`. The two timeouts are cleared on unmount, so tapping Home or Play again mid-attack leaks no timer and the attack doesn't carry into the next screen. The attack plays from `landAt` to `leaveAt` (1.91 s) and is unmounted before his leap off. It can't play twice: the stage only moves wait → on → done. The `SpriteAnim` sound tag includes `since` (based on `Date.now()`), so a second loss to the same boss after Play again still plays its sounds, and a re-render never replays them. `lashIn` is fixed state, so redraws (for example when the XP grant arrives) never restart the pawn's jolt. The jolt runs 10 × 170 ms from +340 ms, which ends at about 2.04 s, before the attack ends at about 2.16 s.
- **Removed God King pieces:** `GodKingEpilogue` is now used only by `dev/god-king-preview.tsx`, which is fine. `RESULT_TALK` is still read only by `GodKingEpilogue`. `speech.tsx`'s `hold` parameter is now unused on the result screen, but it is harmless. No CSS or test still expects `.gk-epilogue` on results; the e2e tests assert there are none.
- **`xpShownParts`:** it drops only `/^\d+ min$/` labels, which is exactly what `xpParts` writes for time. "Daily solo limit" shows as words with no number. The total comes from `xp.after - xp.before` and is unchanged. The fill's `starts` are indexed by `of`, so shares stay correct.
- **Compact XP box:** it's always present on boss results, and the separate box is suppressed there only. Its size is fixed at 176 × 96, with rows of 42 + 10 + 30 plus 10 of gaps, which is 92 or less. The longest "No XP" line ("No XP: the game ended before move 10.") wraps to two lines at 12/15 px, inside its 30 px row.
- **FAQ vs. the rules:** "more for a longer game", the cap `maxMinutes*perMinute + win`, "a very quick win pays no win bonus" (server: `ms >= soloWinMinMinutes`), and the daily solo limit as an XP figure "before win bonuses" all match `api.ts` and `xp.ts`. No minute numbers remain.
- **Old app:** the server didn't change. An old app still shows "12 min +120" until it updates; that's expected, not a bug.

## Minor findings (non-blocking, follow-up or same PR at the author's choice)

1. **`packages/app/src/components/XpResult.tsx:82`, low.** The comment says "the hidden time part still takes its share first", but `i === 0 || …` shows the first *shown* part at once. For a win plus time ("Win +50" after 12 min), the "Win +50" label now appears at the fill's first frame, while the count is still in the time XP. Before, it appeared when the count reached its share. Failure scenario: a 12-minute win; at +20 XP, "Win +50" is already shown. Fix: drop `i === 0 ||`, so the part waits for `starts[i]`. Then a part whose `starts` is 0 still shows at once. The alternative is to keep the behavior and correct the comment.

2. **`packages/app/src/components/ResultDuo.tsx:51` and `styles.css` `.results-duo`, low.** For a boss with no character (`bossKit(boss.name)` undefined), `BossCharacter` returns null and `.rd-boss` stays an empty, zero-width box. The row is then `padding-left: 32px` + `gap: 16px` + the 176 px pawn column, so your pawn and XP sit about 24 px right of center, with nothing to face. Failure scenario: any boss missing from `characters/kits.ts`, if one exists (`hasCharacter` is still checked in Results). Fix: when `!hasCharacter(match)`, render only `.rd-you`, or add a class that zeroes the padding and gap. Moot if every boss has a character.

3. **`packages/app/src/components/ResultDuo.tsx:64`, informational.** Under reduced motion the pawn's jolt is turned off but the boss's attack sprite still plays. This matches the board's `KingAttack`, which also ignores reduced motion, so it's consistent and not a regression.

## For the director
The PR body's open question stands and is Eric's to decide, not a bug. During the attack the blow lands on your pawn, which breaks the 16 px gap at rest. The tests guard "never passes your pawn".
