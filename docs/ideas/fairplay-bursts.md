# Fair play: catching selective cheating (design, Nov 11, 2026)

Eric, Nov 11: "They will play normal, but ... all of a sudden for 4 or 5 moves they're playing at 3,000 Elo, and there's a
pattern of that for more than just a game or two, that's a mega must-notify, and drop them in the same cheater queue."
Design only: no game code changes here. It builds on `claude/fairplay-near-best` (near-best counts as the engine's best;
the sustained-strength path) and reuses its `FAIRPLAY.deep.nearBestLoss`.

## 1. What we measure today, and the hole

- **Have, per counted pick:** points lost, the crowd's rate for the best move, an honest player's chance of finding it at a
  given strength (`honestChance`), think time, look-aways, the deep re-check's result. `skipReason` drops the rest.
- **Hole 1: the yardstick moves with the cheater.** A match's evidence is measured against the *higher* of the player's
  history and that same match's strength. A 1500 player who cheats on a third of their moves reads as an honest 1800-1900.
- **Hole 2: nothing adds up across matches.** Levels read the best one or two scores of the last 10 matches (30 days).
  Small, steady excess never accumulates.
- **Hole 3: only long streaks count** (10+ found in a row). A run of 4 or 5 is invisible.
- **The proof** (`reports/fairplay.md`): "engine on 20-40% of moves" is reviewed 1.4-2.4% of the time within 5 matches,
  pooled 0%.

## 2. How others do it (public sources only)

- **Regan's published method** ([Intrinsic Chess Ratings, AAAI 2011](https://ojs.aaai.org/index.php/AAAI/article/view/7951);
  [his FIDE congress slides](https://cse.buffalo.edu/faculty/regan/Talks/FIDE84CongressTalkNoPauses.pdf)): predict, for a
  player *of that rating*, how often they should match the engine in each position; add up actual minus predicted over many
  moves into a z-score. The slides put a stand-alone finding at z above about 4.5 to 5, and call top-3 matching and
  average error more robust than exact-move matching. A quick screen first, the full test second.
- **Lichess** (open source): [Irwin](https://github.com/clarkerubber/irwin) learns engine-like patterns from analyzed games
  and "assists moderators"; [Kaladin](https://github.com/lichess-org/kaladin) works from a player's own Insights (their
  long-run statistics). No thresholds published.
- **Chess.com** ([its fair play help page](https://support.chess.com/en/articles/8568369-what-do-i-need-to-know-about-fair-play-on-chess-com)):
  automated analysis plus human review, over signals "across your overall playing history". The method is confidential.
- **Other games:** Valve's GDC 2018 talk on deep learning against cheating in CS:GO
  ([GDC Vault](https://www.gdcvault.com/play/1024994)) scores server-side behavior, with no client instrumentation.
- **What we take:** measure each player against their own expected play; add it up over many matches; count near-best, not
  exact best; a cheap screen then an expensive confirmation; a person can always undo it.

## 3. The design

**Baseline (every player).** Their usual strength: the median match strength (`perf`) of their last 50 matches, already
stored one row a match (`fairplay_matches`). A median ignores a few terrible or brilliant games. It needs 5 matches (the
new-account rule and near-best cover newer accounts). An improving player is measured against the higher of that and the
median of their last 10. Capped at `strengthCap` (2700), as today.

**Surprise per pick.** For each counted pick: how much more likely an engine made it than an honest player *at the
baseline* (the existing `moveEvidence`, fed the baseline instead of the match's own strength). A near-best move the crowd
missed scores high; an easy one scores near zero; a miss scores negative. Weight ×1.5 when the position is **critical**: the
second-best move loses 5+ points (the game turns on it) and it wasn't obvious to the crowd.

**A burst** is a run of 3 or more counted picks in a row (skipped picks neither count nor break it), every one near-best,
whose surprise adds up past a bar (start: 100 to 1 against an honest player at the baseline). That is "3,000 for 4 or 5
moves": perfect play, in positions where this player normally isn't. One burst per match is kept: where, how long, how surprising.

**Critical finds** (the cheater who uses the engine in a few key positions, not in a row). Per match: critical positions
met, found, and how many the baseline predicts. Summed over the last 50 matches into one z-score (Regan's test, our numbers).

**The pattern, and what it does** (window: 50 matches, 90 days):

| What we see | What happens |
| --- | --- |
| 1 match with a burst | Nothing visible. Its moves are kept 30 days and the burst's moves go to the deep re-check first. |
| 2 matches with a burst the deep re-check confirms, or z ≥ 3 | Watch: evidence kept, every later match deep-checked. |
| 3 confirmed burst matches in the last 20, or z ≥ 4 over 30+ critical positions in 5+ matches | **Pool, and a Discord alert to Eric**: "Selective-cheating pattern: 3 bursts in 14 matches, baseline 1540" with the case link. |

"Confirmed" means the server's engine (never a device's numbers) agrees every burst move is near-best. Three matches are three
lobbies, so one lobby's judges can't frame anyone. Pool mode stays as is: never a ban, and Release undoes it.

**The review page** (the case page, one new section, "Bursts"): the baseline; one strip per match with a cell per pick (gray
not counted, green near-best, red a miss, the burst outlined, critical positions marked); the burst's moves with the
position, the crowd's share, think time, look-aways and the deep result; and one line: "burst moves 2900+, the rest of those
matches 1510, baseline 1540". Timing and look-aways inside bursts are shown, not scored (kept simple).

**Modes.** *Crowd and raids:* as above; a pick per team turn is a pick, whichever move the crowd played. A Crowd match has
only 8 to 12 counted picks, so a 4-5 move burst often leaves 2 or 3 counted ones: the critical-finds sum matters as much as
the run. *1 v 1:* no judged picks today, so no bursts yet. Later (its own design, with the engine lane): the same math on
the deep re-check's numbers, the baseline from the hidden rating, opening-library positions never counted; a game costs
about 150 searches, so only on a report, an open case or results far above the rating, unless both players' devices judge
the finished game (checked against each other). *Squads:* not recorded yet; then the same rules, and a Stockfish-token pick
neither counts nor breaks a run.

**Cost to run.** The screen is arithmetic on numbers players' devices already judged: no new searches, no new table. Only
a burst's own moves go to the server: about 25 searches a burst match, inside the existing 500 a day. **New stored data**
(so the full lane): three small fields in each match's `summary` JSON (the baseline, the burst, the critical counts), and
a burst match's moves kept 30 days instead of 3.

**False positives, and the guard for each.**
- *A strong player on a hot streak:* the chance model scales with their strength, and one or two bursts never pool.
- *An improving player:* improvement lifts every move (a higher match strength), not bursts beside baseline-level
  mistakes; and the baseline follows their last 10 matches up.
- *Opening theory:* the first 4 moves never count; deeper theory the crowd finds too, so it carries little surprise.
- *Forced, only and obvious moves, decided positions, power turns, power-ups, tokens:* never counted, as today.
- *Mostly bots in the lobby (no crowd rates):* the strength-only chances are less sharp, so the same bar needs a longer
  run; the simulation decides whether those matches count at all.
- *A forged judge:* nothing pools on device numbers.

## 4. How we'd prove it (the cheater simulations, before anything is switched on)

Add to `fairplay-sim.ts`, 20 matches a player: **burst** cheaters (the engine for 4-5 picks in a row once a match; a 1500 and
a 1900 player), **critical** cheaters (the engine in the 3 most critical positions a match), the existing 20-40% types; honest
players at every strength, drawn Maia 1500-2600 (from the near-best work), an **improver** (+40 a match) and a **streaky**
player (±250 of form). Targets to hit or to report as missed:

| Who | Target |
| --- | --- |
| Burst cheater | watch within 3 matches; pooled 70% within 6, 90% within 10 |
| Critical-positions cheater | pooled 60% within 10, 85% within 20 |
| Engine on 20-40% of moves | pooled 50% within 20 (today: 0%) |
| Honest, every strength 1500-2600, improver, streaky | falsely pooled at most 0.2 per 1,000 players over 20 matches; watch at most 5 per 1,000 |

These are targets, not results. "Within a few matches" is realistic for bursts in a row; one or two engine moves a match
in Crowd takes 10 to 20 matches. Simulated players aren't people: refit once real cleared cases exist.

## 5. Build plan (after `claude/fairplay-near-best` merges)

| Step | What | Lane |
| --- | --- | --- |
| 1 | The math in `core/fairplay.ts` (baseline, surprise, burst, critical z), numbers in `FAIRPLAY.bursts` with `on: false`, unit tests; the new sim cheaters and one sim run; the report and the chosen numbers | Full (fair play); nothing changes for players |
| 2 | The server: fields in `summary`, the 50-match read, keeping a burst match's moves, burst moves first in the deep re-check, the pattern → watch or pool, the Discord alert, existing cases worked out again on the next scheduled run (idempotent); switch on | Full (stored data, fair play): one review, one fix round |
| 3 | The review page's "Bursts" section, with a mockup for Eric first | Full by area, small (display only) |
| 4 | 1 v 1 and Squads | Later, their own designs |

About three helper jobs (two at `xhigh`, one at `high`), one at a time. Running cost: no new servers or services.
