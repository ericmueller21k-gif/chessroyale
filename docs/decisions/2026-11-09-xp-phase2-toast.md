# XP phase 2: the rewards show in a toast, not a dialog (Nov 9, 2026)

The brief: the daily reward's crate "as a line/toast"; level-up rewards "on the level-up pop". The XP box is a fixed 78 px with no room.

- **A toast at the top** (the friends' invite toast's place and look; `components/RewardBox.tsx`), once the XP bar has filled: "Level
  8!" or "Daily reward", the crate and the key with their counts, and the lines. It goes after `XP.rewardToastMs` (6 s).
- **It takes no taps** (`pointer-events: none`) and is fixed over the page, so nothing on the result screen moves and nothing under it
  is blocked. A dialog with OK (the token box's) was built first and dropped: over a Squads or 50 v 50 result it would stop the
  player (and every test) until closed, for news that needs no answer.
- Shown once per game (the Squads card, then its results, don't show it twice).
