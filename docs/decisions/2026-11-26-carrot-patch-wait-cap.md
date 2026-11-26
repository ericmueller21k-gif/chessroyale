# The pass guard's wait on an ultimate is capped: the Carrot Patch and Puddles' watering (Nov 26)

Eric played Chub & Chirp: warned "next turn", then no ultimate for 20 turns, a draw. "I think we need to loosen the restriction
possibly, or just force it at some point." The cause: the pass guard (Oct 18) held the cast every turn passing would lose real
material, with no cap. Now it holds it at most `BOSS_POWERS.ultWaitMax` of his turns after the warning; on the next it comes,
guard or not (in check it still can't: a pass is no legal move). Only the cast; Alfil's fusion (a passive) keeps its guard as it was.
Check: `pass-guard.test.ts`, "the Carrot Patch cast waits at most ultWaitMax…; Puddles' in `gardener.test.ts`" (fails without the change).

Then Eric: "we could do his too then. And I think 2 turns, we could bump it up to like 3 or 4 turns probably." So `ultWaitMax` is 3
(the nearer of his two), and Puddles' watering takes it too (`gardenerBattle.any`: the host places it whatever passing costs once it has
waited that long; online the server sends `waterAny`). His other idea, the watering regrowing the piece he'd lose, is its own job.

**The review pass (Nov 26):** the cap counted crowd moves since the warning, so on a Battle Tower floor of several bosses (his turn
every n crowd moves) it forced the cast after one wait, and his turns in check used it up. Now it counts his waits (`passWaits` on
his powers; the garden's `waits`, cleared when a watering comes): the guard holds it at most `ultWaitMax` times, whoever else is on the
floor, and a turn in check (no pass possible) isn't a wait. The admins' trigger on the Carrot Patch is capped the same way.
