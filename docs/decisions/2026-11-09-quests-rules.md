# Quests: the rules as built (Nov 9, 2026; XP phase 3)

The brief (notes/briefs/brief-xp-phase3.md) and the approved design's section 3. Numbers and the pool in `QUESTS` (settings.ts).

- **2 dailies a day, 1 weekly a week.** Dailies at the XP day (08:00 UTC), the weekly on Mondays at 08:00 UTC (`questWeekStart`).
- **The carry-over cap, read as:** a new day drops the dailies finished before it; unfinished ones wait; the deal tops you up to
  `maxDailies` (3) at most (`dailiesToDeal`: 0 waiting → 2, 1 → 2, 2 → 1, 3 → 0). So the overlay shows 2 or 3 daily rows. The
  weekly doesn't carry: a new week replaces it, finished or not.
- **The reroll:** one a day, an unfinished daily only, swapped for a pool quest you don't hold, its progress gone, in its place.
- **The pool (the call):** only what's always playable and verifiable by the server: Boss Hunter (win a raid, +1 crate), Raid Party
  (2 raids), Squad Up (2 Squads games), Fifty-Fifty (a 50 v 50), Warm Up (finish 3 games), Winner (win 2 online games, +1 crate);
  weekly Regular (10 games: 1,500 XP, a crate, a key). Win quests weigh 1, the rest 2 ("win quests stay rare").
  - **Not "Win a ranked 1 v 1":** ranked needs another person (a bot game is unranked, no XP), so it isn't always playable.
  - **Not "Fight boss X":** a raid's boss is drawn at random, and Boss alone (where you choose) is played on your device, whose word
    never completes a quest. Add it when the server knows a chosen boss's battle (Boss alone online, or a pick in matchmaking).
- **Solo games** (their moves and win are the device's word) count only for "finish games" quests (Warm Up, Regular), and only with
  `soloMinMinutes` (3) of the server's own clock, as the daily reward. A win counts only when its win XP went in (the ledger's
  `xpwin` op), so a friends' lobby's second win against the same player today moves nothing.

- **A solo game counts while it earns XP: its time or its win** (Nov 9, delta review of #575, m-a). Past the day's solo minutes a
  LOST game earns nothing and moves no quest; a WON one still earns its win XP (within the daily solo win cap) and so counts.
