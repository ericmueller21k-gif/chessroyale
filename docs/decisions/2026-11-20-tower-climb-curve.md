# The tower's climb: gentler, then a plateau (Nov 20, 2026)

Eric, Nov 20, after the climb sim (+100 a floor ended every bot run by floor 8): "go up like 20 points for the first 5 levels, and then
go up like 30 points, and then like maybe 40 points ... players feel pretty comfortable getting, you know, 10 levels in ... Getting to
20 levels should be doable ... around the 30 mark ... keep it clamped in like the 15 to 1700 range for a bit."

- `BATTLE_TOWER.maiaSteps` replaces `maiaStep`: from 600, +20 a floor (2 to 5), +30 (6 to 10), +40 (11 to 30), +4 (31 to 50):
  two-boss floors 680 at 5, 830 at 10, 1230 at 20, 1630 at 30, 1710 at 50.
- Director's calls: a lone boss +100 (was +200: it made floor 1 stronger than floors 2 to 8, and lone floors in the 30s and 40s 1900);
  Stockfish from floor 51 at 1750 (was 2500, a cliff after a 1710 floor 50), +31 a floor (was +25): its ceiling on 98, its best on 99.
- The sim tries this and a steeper variant (`TOWER_STEPS`), results in `reports/tower-sim.md`. Lives (Eric's "2 lives") aren't a rule
  yet: the sim reports both the first loss and the third.
