# End screens 2c: the director's review of round 2b's sheet (Nov 25). Opus high, targeted. Branch `claude/end-screens-2`

Round 2b (126222b6) is on `claude/end-screens-2`; its sheet is on `stills/end-screens-2` (8c924b79). Read first: CLAUDE.md,
`.claude/LESSONS.md`, `docs/decisions/2026-11-25-end-screens-2.md`, the branch's `.pr-body.md`, `docs/rules/eric.md`, and
on `claude/director-notes` `notes/RULES.md` (search "end page", "spacing token", "UI checklist", "screens are separate").
`git fetch origin claude/end-screens-2 && git checkout -B claude/end-screens-2 origin/claude/end-screens-2`, then `git rm .done` and push before
you start (the director's waiter fires on a stale .done).

Eric's rules for every end screen: the page keeps the game screen's arrangement; ONE gap token between containers (12 px, 6 inside a group);
nothing stretched; a short stack centered as one block; buttons stacked, Play again on top; quests one line when none moved; small chat
where there is chat. Screens are separate: phone 390x844, laptop 1536x730 (Windows 125%), desktop 1920x960; check each one.

## What passed (leave alone)
- The 1 v 1 end pages at every size (placement win/loss, xp win, draw).
- Boss end pages' own stack (title, XP, duo, level card, quests, buttons).

## What failed: fix each
1. **Squads end page: untouched.** Laptop still: "You resigned" pinned to the top, Queue again / Home SIDE BY SIDE, the rest of the page empty.
   Bring it under the same rules as every other end screen (stacked buttons, the one gap, a centered block, its game's arrangement).
   Check phone, laptop, desktop.
2. **50 v 50 (crowd) end page:**
   a. The gap under "You resigned" is about three times every other gap (phone and desktop). One gap.
   b. An EMPTY "Stage | Average loss per move" table (header, rule, "Lower is better…" hint, no rows) when nothing was judged. When there
      are no rows, show one line in its place ("No moves judged this game."), not an empty table.
   c. On desktop that table spans the whole content width, wider than the column above it. It takes the column's width.
3. **Boss end page on laptop and desktop, loss/resign:** the column sits in the left half and the right half is EMPTY (the win shows
   "Your game, move by move" there). Same arrangement for win and loss: show the move by move whenever the game had moves; when there is
   nothing to show, center the column in the page. No half-empty page.
4. **Boss end page on the phone:** the room kept for his words is an empty band (about 70 px) between "No XP…" and the boss when he isn't
   speaking yet. Let the bubble sit over his frame's empty top (positioned over the duo, not a reserved band), so the gap above him is
   the one gap. His words must still never cover your pawn or the headline.
5. **Quest rows kept for the count (your trade-off):** keep the two reserved rows (Eric's "nothing shifts" rule), no change in this round.
   The director takes it to Eric.

## Done when
- Each item fixed, at every size it applies to, by looking at the stills yourself (the director checks them next; Eric only sees them
  after that).
- `endGaps` extended to Squads and the 50 v 50 end page (phone 390x844 and laptop 1536x730), and to a boss loss on desktop (the column
  centered, or the move by move present). One focused check per item in existing specs; no new spec files.
- Re-run `npm run stills:end-screens` on your final build and push the sheet + pictures to `stills/end-screens-2`.
- `.pr-body.md` gets a "Round 2c" section (what changed, checks changed old → new); a short addition to the decision file.
- Push, write `.done`, stop. Don't open PRs or wait on CI.
- Commits end with only `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR` (no Co-Authored-By).
- Budget: about an hour. Run only the specs you touch (boss-result, squads end, crowd end, ranked-1v1's endGaps), on Playwright's own server.
