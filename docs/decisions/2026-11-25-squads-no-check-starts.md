# Squads: no opening that starts in check, Nov 25, 2026

Eric, Nov 25, on a Pairs board that began from the Steinitz Gambit (4...Qh4+, White's first move forced): "yes drop it".
Built: `squadsOpenings` (squads/match.ts) filters the library at the draw to lines usable at 4 moves per side whose start
doesn't leave the side to move in check; `drawOpenings` picks from it, still seeded (the same seed draws the same boards,
though not the same ones as before the filter). Dropped at 4 moves: the Steinitz Gambit (classic) and Queen's Pawn Game:
Modern Defense (unusual, never drawn by Squads anyway). Left: 101 lines, 31 classic families (a match needs 2).
Not changed: solo, Crowd and raids (`runner.ts`) draw from the same library and can start in check (see the PR).
