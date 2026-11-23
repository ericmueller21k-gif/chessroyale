# Ginger's Super Freeze: a second meter (Nov 18, 2026)

**Eric, Nov 18:** "another ult meter bar ... around turn like 8 to 15 ... the ice block gets bigger and bigger until it hits all the
squares around it"; "frozen on your turn, and then they unfreeze for his turn"; "up to twice in 60 moves".

**Built:** see docs/areas/bosses.md (Ginger's row). Test switch `?boss=gingerbread&power=superfreeze`.

**Calls:**
1. The meter counts crowd moves (8 to 15 from the seed), not rage: Eric gave turns. It glows on the turn it comes (as that move lands).
2. Equal targets: the 3 x 3 more on the board first (the block sits on it), then the seed.
3. Let go for a legal move: farthest from the middle first.
4. The freeze is unchanged, but skips a piece the Super Freeze holds.
5. The Blizzard first: the Super Freeze waits for it; the admins' trigger on a Super Freeze turn becomes the warning.
6. His charge reuses his intro's `charge`; new art by the runner ($2.95). Lines are placeholders.
7. The raid sim can't price it: main loses 26 of 26 too. Re-tune after the re-baseline.
