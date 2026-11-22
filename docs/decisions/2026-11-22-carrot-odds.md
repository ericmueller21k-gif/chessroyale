# Chub & Chirp's carrot spin, toned down (Nov 22)
Eric, Nov 22: "2 carrots ... a pawn with like a 10% chance for a bishop or knight ... 3 ... one knight or bishop ... 2 queens is too
much. It'd just be 1 queen ... 1 carrot, just like half the time a pawn, half the time nothing ... 0 would be nothing."
- `BOSS_POWERS.carrotOdds`: 1 carrot a pawn 50% / nothing 50%; 2 a pawn 90%, knight 5%, bishop 5%; 3 a knight 40%, bishop 40%, rook
  15%, queen 5% (the director's spread for "knight or bishop most of the time"); 4 one queen; 5 still wins.
- The ladder, reel and FAQ read the table, and his race brain weighs each count by its average (now 0, 0.5, 1.2, 3.6, 9 pawns), so
  nothing else changes. Light lane: no sim, an estimate (the race matters less to him now, as intended).
- Seen in `maia-bosses.test.ts`: with 4 carrots now worth one queen, his race brain goes for the 5th (the outright win) where it used to
  sit on 4 for two queens, and wins the race against a crowd that never pulls a carrot. Kept as is (the win is worth more than one queen);
  the Turf build's sim checks how often he wins the race outright against real play. The test's floor of Maia moves now allows his early win.
