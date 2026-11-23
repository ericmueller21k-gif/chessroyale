# The four @perf checks red on main (Nov 23, 2026)

**The brief (director, Nov 22):** 11 of 15 `@perf` checks passed on main; find whether each of the 4 red is real, its cause, and fix
the cause where it's real.

**A long boss battle, G-REX's fire (DOM elements): real, fixed.** The phone's move-list panel (Oct 25, #347) drew a row for every
move of the battle, about 14 elements each (Boss alone's "You" rows carry a whole avatar: two SVGs with their clip paths), though
its box shows only the newest few and never scrolls. The panel is drawn anew each turn, so a long battle rebuilt them all every
turn: at 120 plies, 1,750 elements (G-REX: 292 → 1,982, and 121 running animations against 8). Now the small panel draws the
rows its box holds (`clientHeight / 24`, the row's height) and 8 spare, measured as it's drawn and kept for the next turn's copy
(its first frame the same). The sheet and a computer's column still list every move. Slowed phone, 120 plies: the long battle's
boss turn p95 83 → 17 ms (18% → 4% dropped), G-REX 292 → 433 elements, animations 15.

**Changed checks.** "Nothing grows" counted every element against the first move's +40, which a move list can't meet: it fills
its panel once (here 14 rows, about 200 elements), then stays. The two specs now count the list apart: the rest within +40 as
before, and the list's rows within the panel's `cap` (what its box holds + 8). (Not bisected: by the count, 4 moves' rows alone
are past +40, so the old count can't have passed since the list came on Oct 25; no `perf` run on Actions to check.)

**Chess Town, 16 to 18 s to the first frame (limit 8 s): real but not new; left open (`.question`).** Bisected: 17.2 s at
`d077aaeae` (Nov 13, the PR that set the 8 s bound), 16.2 s Nov 16, 16.8 s Nov 18, 16.3 to 18.9 s now; 2,777 pictures each time.
Nov 14's note measured 19.8 s on a slowed phone too ("the rest is the town's painting, unchanged"). The 8 s bound was never met
on a 4x-slowed phone since the loading screen (Nov 11) paints every picture before the first frame. Of about 14 s loading,
13.4 s is that painting (`render.ts` `warm`), 0.5 s the upload, nothing the network. By kind (4x slowed): the bosses' town frames
2.8 s (439), the street houses' sides and fronts 2.7 s and their darker copies 1.0 s, the homes' fronts 0.9 s and darker 0.4 s,
the roofs 2.3 s (the Colosseum's ring alone 0.7 s), the rest under 0.3 s each. Making it fast changes what is painted before the
first frame, so the fix waits for the director's call.
