# 1 v 1 layout, round 2: Eric's three follow-ups the first round missed (Nov 25). Opus high, targeted. Branch `claude/duel-layout` @ 55b4fce8

Round 1 (read its `.pr-body.md` and `docs/decisions/2026-11-25-menu-labels.md`) built the 1 v 1 frame and a labels rule. Eric sent three
more asks while it ran; do exactly these. `git fetch origin claude/duel-layout && git checkout -B claude/duel-layout origin/claude/duel-layout`,
`git rm .done`, push, merge origin/main, then:

1. **The labels rule, Eric's order (he said it outright; round 1's call 'the column must not narrow' is reversed):** "why would this be the
   case when there's ample room on the right to shrink the chat box in order to make the left menus their necessary size". On every
   computer game screen: (1) the board never shrinks for the menu; (2) the labels show; (3) to make room, the column beside the board
   NARROWS first, down to a working minimum you set per screen (the quick-chat lines and emoji row still fit on at most their current number
   of rows, nothing cut, the 50 v 50's vote rows and status readable; the chat's message area may get shorter: Eric asked for the chat to
   shrink); (4) icons only if that minimum still can't fit. Redo the table (labels/icons, column width, board) at the same 9 sizes. Eric's
   laptop 1536x730: labels on the 1 v 1 AND, if the minimum allows, the 50 v 50 / Boss / Squads. Update the focused check and the
   real-screens chat check's numbers accordingly (old → new in the PR body).
2. **The rank pill, everywhere it shows** (Eric: "remove RP next to names and use Roman ... like Paragon IV - 50"): "<Tier> <division in
   Roman numerals> – <points>", e.g. "Gold V – 45", "Illustrious IV – 67" (en dash with spaces; no "RP"), changed at the one place the
   pill's text is made (1 v 1 strips, profiles, the ladder, lobby/queue rows, wherever). Tiers with no divisions: "<Tier> – <points>".
   Placement pills unchanged. Say what you did with the ranks pop-up's table and the end page's rank card. Update the checks that read the
   old text (old → new). One still of the pill at laptop size.
3. **Eric's standing column rule, on the 1 v 1 (and report it):** every column shares the board's top and bottom line (±1 px), and the
   gaps either side of the board are equal (±1 px). Measure in play and on the end page at 1536x730, 1920x960, 1858x1040; put the numbers in
   the PR body; fix any that are off.
Stills to `stills/duel-layout` (round-2 folder): the 1 v 1 at 1536x730 with labels, the 50 v 50 at 1536x730 under the new rule, the pill;
look at each yourself. Update `.pr-body.md` (a "Round 2" section) and the decision notes. Push, write `.done`, stop. Don't open PRs or
wait on CI. Commits end with only `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR` (no Co-Authored-By).
