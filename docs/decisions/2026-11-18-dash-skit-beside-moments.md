# Dash's gags come beside his short turn-start moments (Nov 18, 2026)

**Eric (playtest):** "Dash is still coded wrong, his 20/30 second gag isn't firing, his 10 sec one did then a few turns later I did nothing
for a minute and he just stood there."

**Cause:** `stallPlan` ruled out the clock tap and the stall skit for a whole move if any event of his was on it (`p.events.length`). In a
real battle most moves have one: a slap after each capture of his, a clock fit every 4-5 turns. Those play as the move begins and are over
before its clock starts (`DASH_FX`, held by `POWER_FX`), so they never collide with a beat at 10, 20 or 30 s. The tests used the test switch
(`?power=stall`), whose quick battles never had them. Reproduced with a real Boss-alone battle (no switch): a 60 s wait on a move that began
with a slap or clock fit brought nothing.

**Fix:** `STALL_BESIDE` (slap, flag, clockFit) no longer rule the beats out; a moment still to play on the move (a warning, the Time
Scramble, the Rush's extra) still does. Shared rule code, so solo and the server agree.

**Checks:** `dash.test.ts`: the two "never with another moment" lines (slap, flag, clockFit → null) → those three keep the plan; warn,
scramble, rushWarn, rushExtra still null. New in `boss-clock.test.ts`: a real battle with no test switch, his beats come on a move that began
with a slap or clock fit (fails on the old code).
