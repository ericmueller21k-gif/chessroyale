# Mode ranks: 50 v 50 and Squads each get their own rank (Nov 27, 2026)

Eric (Nov 9-25): "one rank per mode is perfect"; "When you play a 50v50 or squads it also counts toward your rank for that mode";
RP from placement and engine score judged against the lobby's average; Squads "entirely on your placement"; a leaver's bot at
their level. The design: [docs/ideas/mode-ranks.md](../ideas/mode-ranks.md). Calls (Eric can reverse any): real players outside
your party only, none means no change; 3 placements a mode; 50 v 50 70% placement, 30% points a move (this stands in for the
rework's tie band, from numbers already in the results); 1 v 1's tiers, Glicko-1 and RP rule reused; no season column yet. Why:
the least new code and stored data, one hidden-rating scale for every mode.
