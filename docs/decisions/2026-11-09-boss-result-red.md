# Main red: boss-result's defeat never came (Nov 9, 2026)

**Cause.** `e2e/boss-result.spec.ts` "victory and defeat screens" pressed START with no boss picked, so it met a random
playable boss. `?mate=1` can't mate at once against two of the 14: Wrangler (his first move is always the long pull,
which `pigTurn` plays before the switch's mate is looked at) and Sawyer (his first move must be a pawn's, and the mate is
picked among his allowed moves). Both played 2…d5; the battle went on and the result never showed. Found by running the
defeat path once per boss (`?boss=<id>`): 12 passed, those two failed; `?win=1` passed for all 14. Unrelated to #567.

**Fix.** The spec names the boss (`?boss=hollow`, as `king-attack` and `shop` do with `?mate=1`); `bossMateTest`'s comment
in settings.ts says which bosses it can't mate at once. **Call:** the game isn't changed. Letting a test switch break
a boss's first-move rule would touch `applyBossMove`'s last check and Sawyer's split for a test-only path (Eric, Oct 14:
fewest ways to break). The victory test keeps the random pick: `?win=1` works for every boss.
