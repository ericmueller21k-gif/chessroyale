# The pass guard's wait on an ultimate is capped: the Carrot Patch and Puddles' watering (Nov 26)

Eric played Chub & Chirp: warned "next turn", then no ultimate for 20 turns, a draw. "I think we need to loosen the restriction
possibly, or just force it at some point." The cause: the pass guard (Oct 18) held the cast every turn passing would lose real
material, with no cap. Now it holds it at most `BOSS_POWERS.ultWaitMax` of his turns after the warning; on the next it comes,
guard or not (in check it still can't: a pass is no legal move). Only the cast; Alfil's fusion (a passive) keeps its guard as it was.
Check: `pass-guard.test.ts`, "the Carrot Patch cast waits at most ultWaitMax…; Puddles' in `gardener.test.ts`" (fails without the change).

Then Eric: "we could do his too then. And I think 2 turns, we could bump it up to like 3 or 4 turns probably." So `ultWaitMax` is 3
(the nearer of his two), and Puddles' watering takes it too (`gardenerBattle.any`: the host places it whatever passing costs once it has
waited that long; online the server sends `waterAny`). His other idea, the watering regrowing the piece he'd lose, is its own job.
