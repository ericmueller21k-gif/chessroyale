# Build brief: XP phase 3 — quests and the daily overlay (design approved; mockup approved by Eric, Nov 9)

Design: notes/briefs/design-xp-quests.md (v2): section 3 (quests) and 5 (the overlay, Eric's reference and tweaks). The overlay UI is
BUILT behind `?quests=` (PR #572: components/QuestsOverlay.tsx, quests-mock.ts, the top bar entry): wire it to real data, don't
redraw it. Eric on the mockup: "absolutely exactly what I'm envisioning"; height maybe 15% less later (leave it).
Lane: FULL (stored data, rewards through the ledger): full-e2e label, an independent review, effort xhigh.

## Rules (numbers in settings.ts, a `QUESTS` block)
- 2 daily quests and 1 weekly quest per account. Dailies reset at the XP day (08:00 UTC); the weekly on Mondays 08:00 UTC.
- Unfinished dailies carry over: at most 3 dailies waiting (Hearthstone's kindness rule); one free reroll a day (a daily only).
- Pool (only modes always playable, bots fill them; NO auto chess; boss quests only bosses live for everyone): e.g. beat any boss;
  fight boss X; play N Squads games; play a 50 v 50 game; win a ranked 1 v 1; finish N games; win N games. Weekly: complete 10 games,
  or similar. Assigned from a seeded pick, server-side, lazily on the first read after a reset (no scheduled job).
- Rewards: a daily 300 XP (some dailies also 1 Winter Crate); the weekly 1,500 XP + 1 Winter Crate + 1 key. Granted on completion
  by the server through the ledger, once (op per quest instance), in the same path as the game's XP (grantXp), so a quest can never
  disagree with the game that completed it. XP from a quest can level you up: level rewards then as phase 2 pays them.
- Progress counts only counted games (the same rules as XP: min moves, not abandoned, not a test game, not a guest).
- PAUSE_REWARDS covers quests (progress and rewards wait).

## Screens
- The overlay (QuestsOverlay) shows on the first home visit of each XP day (signed in), and from the top bar's Quests button any time.
  The button shows for every signed-in player (nothing hidden; greyed for a guest with "Sign in for quests").
- **At 320 px the top bar keeps every button ≥ 40 px** (home-layout.spec.ts's tap-target check; the mockup's 36 px squeeze was gated
  off for this reason): make room another way (e.g. the logo shrinks to its icon under 344 px), and keep the check as is.
- A quest completed by a game: its line in the result's reward toast (phase 2's), "Quest done: Boss Hunter +300 XP".
- The FAQ: quests (the rules above, plainly).

## Tests (full lane)
Unit + server: assignment (seeded, lazy, resets, carry-over cap, reroll once a day), progress from each mode's counted games,
completion paid once (replays, two tabs, two games at once), the weekly, the pause, merge/delete/download. e2e: the overlay on the
day's first visit and from the button, a quest completing after a game (toast + overlay shows Done), the reroll, the 320 px top bar.
Stills: the overlay with real quests (phone light/dark, computer), a done quest, the result toast.
