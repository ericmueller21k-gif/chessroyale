# Brief: move replay when you come back to a board, the replay toggle, and a first-time tip (Opus high)

Worktree `/home/user/cr-replay`, branch `claude/move-replay`, from main (set up by the director, node_modules from npm ci). Ports
8987, inspector 9487. Include notes/briefs/rules-common.md. Eric OK'd running this beside the Ginger art helper (Nov 5, this case
only). Clock rule change: the PR gets `full-e2e`; record each call in `docs/decisions/2026-11-05-move-replay.md`; add the rules to
`docs/rules/eric.md` with guards.

Eric (Nov 5), about Squads (Relay: you move on a board, then others play its next moves while you're on other boards, then the
rotation brings you back):
## 1. Move replay (default ON, every mode where you come back to a board)
- Each time you arrive at a board, **the moves played on it since you last played it replay** (animated, one after another, each
  move's from/to shown as it lands), **then** your free seconds start as usual. Check where else this happens (Pairs' boards, any
  mode that switches you between boards); apply it everywhere a player comes back to a board.
- **Free time grows to cover it, replay on or off (simple and fair):** free seconds = today's (`SquadsClock.delaySeconds` or the mode's)
  **+ 0.5 s per move played since you last played** (3 moves: +1.5 s). One number in settings (`replaySecondsPerMove: 0.5`). The replay's
  pace fits inside that extra time (about 0.45 s a move, last move held a beat), so watching it never costs your own time. Server and
  client must agree (the clock is the server's): put the rule where the clock is computed, and show it on the clock.
- A replay is skipped instantly by tapping the board or making a move (premoves too).

## 2. The replay toggle
- A **rewind icon button next to the settings gear** (match screen top bar), on/off, saved per account (the account's prefs if the
  app has them, else this device; say which). Off: no replay animation, the board just shows the position (the extra free time stays).
- **On: a little spinning dot trail runs round the button's edge** (like a game's toggled-on ability: a few dots chasing round a ring,
  slow, subtle). Off: plain icon, no trail. Clean drawn icons, no emoji.

## 3. The first-time tip
- **The first time this account queues for Squads**, a tip: the screen dims, **the settings gear and the replay button stay lit**
  (cut-outs/rings round them), and a small box explains both, e.g.:
  - "Move replay is on: when the rotation brings you back to a board, the moves you missed play back first, and you get a little
    extra time for them. Tap [replay icon] to turn it off."
  - "Tap [gear] to turn off animations for quicker play."
  - a checkbox "Don't show this again" and an **OK** button.
  (Your wording is fine; keep it short. The icons drawn inline, not emoji.) Not shown again once dismissed with the box ticked; if not
  ticked, it shows the next time they queue Squads. Make sure "turn off animations" points to a real setting (find it; if none
  exists, say so and point the line at the right one).

## Done
Unit (the free-time rule: +0.5 s a move since you last played, on and off the same; the replay's moves in order; skip on tap); e2e
(Squads Relay: coming back to a board replays the missed moves then the clock; the toggle off skips the animation; the trail shows only
when on; the first-time tip with the dim and both lit, "Don't show this again" sticks). Stills `docs/move-replay/` (the tip, the
button on/off, a replay mid-way), phone and computer. PR body `docs/move-replay/pr-body.md` (every player-visible change and text,
changed checks old → new, lane full-e2e). Push; no PR. Short report.
