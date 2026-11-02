# 50 v 50 on a phone: the scoreboard right under the vote results; chat as a tab (Nov 1, 2026)

**Eric (Nov 1, on his iPhone, live #441):** "It should be right up against the bottom of [the vote results]… all that space
and downward should be the scoreboard… put black, white, and all closer to each other, and then put chat next to that… if
you tap chat, it just replaces the scoreboard window… and then… another option to go back… That line… can all be one
single line of text… There's too many words anyway."

What changed (a phone's 50 v 50 only; a computer and the other modes are unchanged):

- **The middle box is the vote box's height.** Bars 14 px each with their gap, the result line 20 px: 104 px for six bars
  (`--mid-h`, styles.css). It never moves within a match. Six bars at 390 × 750 and 390 × 664 and 375 × 667; four at
  320 × 568, where the board is small and the scoreboard would otherwise keep two rows (`--slots`: 5 below 640 px tall,
  4 below 600). Which bars: yours and the brilliant find's move always, then the most voted (`useBarSlots`, Crowd.tsx).
- **The scoreboard starts 4 px under the result line** and fills to the bottom of the screen.
- **One result line:** the score, "you a3", "best e4" (or "best move"), the allowance as a short number ("4.2 forgiven",
  or "no allowance"), the streak ("🔥3 +0.50"). `allowanceShort` (game.ts) is new; the boss dock keeps `allowanceNote`.
- **The brilliant find is a mark on its bar** ("‼ +1", "+1 each" for several finders), labelled with the finders. Its
  move gets a bar even when it isn't among the most voted.
- **Chat is a tab:** Black · White · All · Chat in the header; Chat replaces the scoreboard in the same box; "‹ Back"
  returns to the pick. The unread count shows on Chat. The chat tab isn't remembered over a reload (the fold is).
  The split and its layout buttons are gone there.

Calls made:

- **A watched turn** has no result line (Eric removed "your team watched" on Nov 1). The box keeps its height, so the
  space stays empty rather than the scoreboard moving.
- **The picking screen** centres the power-up row (or the waiting line) in the box, so the box's height isn't left blank
  at its foot.
- **The fold arrow** stays in the header (the scoreboard's and the chat's), as before.
- **Checks changed** (see the PR body): the brilliant-find text check reads the mark's "‼ +1" (its `.you` class still
  says that it names you); the allowance check reads "8 forgiven"; the split checks in panel.spec and chat.spec now walk
  the tab.
- **Scoreboard rows at 390 × 750:** seven to nine, depending on where the cut line falls. At 664 and 667: four. At
  320 × 568 (four bars): three.
- **Eric's own words are the exception** to "nothing hidden" for this box: Chat replaces the scoreboard behind one tap,
  as he asked.
