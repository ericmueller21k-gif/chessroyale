# Bosses' ultimates must come when the boss is losing (Eric, Nov 26). Opus xhigh, BOSS lane (rules + brain calibration). Branch `claude/ult-danger`

Eric, Nov 26 (beat Birdie in a test game, his ult never fired; final position: Birdie down only a bishop and two pawns, positionally lost):
"his ult is supposed to fire. It's not about like how many moves have been played. It should have detected like he was basically in
danger, or like it was already heavily in my favor, and it should start triggering very quickly thereafter, like a turn or two at most."
Cause (director): Birdie's Fall (packages/chess/src/bosses/birdie.ts ~483, `BIRDIE_ULT.fallLost` 9 in settings.ts ~2339) comes ONLY at
9 points of material lost; he can be lost on the board with ~5 down, so it never comes. Most bosses use the shared rage meter
(`rageAheadMax`/`rageAheadFull` add rage when the crowd is ahead); Birdie and the hidden boss (recluse.ts, `ultimate: () => false`) use
their own triggers.
Do:
1. **Birdie:** the Fall also comes at the start of his turn once the judge says he's in danger: the crowd's expected score (the judge's,
   the same number the end screen's "your chances" uses) at or above a setting (start at 0.70; Eric: "heavily in my favor") on his
   turn, or for 2 of his turns in a row if one turn alone is too jumpy: pick from evidence (the sim/replays below), say why. Keep the
   material rule as the other way in. Once a battle, as now. Everything in settings.
2. **Every boss (audit, then fix):** for each boss with an ultimate, can a battle the boss is clearly losing (crowd ≥ 0.70 for several
   turns) end without its ultimate? Measure with the boss kit / a scripted strong crowd (e.g. Stockfish-strength moves for the crowd, as
   Eric played) over a few seeds per boss; table: boss, turns from "crowd ≥ 0.70" to the ultimate (or never). Fix every boss where it's
   more than 2 of his turns or never, the least code (the shared meter's ahead gain, or the same danger trigger for own-meter bosses). The
   hidden boss: report only (his fight's design is Eric's); change nothing there without the director.
3. Don't weaken anything else (the meters' normal pace in even games stays: show the even-game timing before/after for 2-3 bosses).
4. Tests: a unit test per changed boss (a lost position → the ultimate on his next turn or the one after); the boss kit passes; the boss
   smoke for Birdie. `.pr-body.md` (the cause, the audit table, what changed, checks changed old → new), a decision note quoting Eric,
   `docs/areas/bosses.md`. COMMIT and push `.pr-body.md` and an empty `.done`, stop. Never write the hidden boss's name in commits, the PR
   body or file names. Commits end with only `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR`.
