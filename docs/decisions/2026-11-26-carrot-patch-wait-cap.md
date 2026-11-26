# The Carrot Patch's wait is capped (Nov 26)

Eric played Chub & Chirp: warned "next turn", then no ultimate for 20 turns, a draw. "I think we need to loosen the restriction
possibly, or just force it at some point." The cause: the pass guard (Oct 18) held the cast every turn passing would lose real
material, with no cap. Now it holds it at most `BOSS_POWERS.carrotWaitMax` (2) of his turns after the warning; on the next it comes,
guard or not (in check it still can't: a pass is no legal move). Only the cast; Alfil's fusion (a passive) keeps its guard as it was.
Check: `pass-guard.test.ts`, "the Carrot Patch cast waits at most carrotWaitMax…" (fails without the change).
