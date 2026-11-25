# Residents resign later, by rating (Nov 25, 2026)

- Eric, after the first live run (games of 7 to 19 moves ending in resignations): "can't we just make them not forfeit for a bit longer? What do real players do normally?"
- Changed (`RESIDENTS.duel.resign`, `scripts/residents/play.ts` `shouldResign`): resigning now goes by the resident's rating. Under 1200: only down 15 or more from its 30th move, 4% a move (mostly plays on to the end). 1200-1599: down 10 from move 25, 8%. 1600 and up: down 7 from move 20, 12%. A rage-quitter: down 6 from move 12, 25% (was down 4 from move 4).
- Why: weaker players usually play on hoping for a mistake; stronger ones resign a clearly lost game. The early quick games also came from placements pairing far-apart ratings (everyone new, wide deviations), which settles as ratings firm up.
