# The Hidden Boss's fight: everything around the board stays put in every phase (Eric, Nov 14 playtest)

Effort high. Boss lane (+ the touched areas' specs). New branch `claude/recluse-same-frame` from `origin/main` (after
`claude/desktop-side-column` has merged: it moves the Moves panel flush with the board's top and the chat under it; build on that).
Read `docs/areas/bosses.md`, `.claude/LESSONS.md` (watch frame by frame: `npm run frames:boss`), CLAUDE.md "Nothing hidden, nothing
shifts". Never write the Hidden Boss's name in player text, commits or PRs.

Eric (computer, the phase change / four boards, screenshot: the crowd table top left, a line bubble floating far left by itself,
the board alone in the middle; no pawns, no chat): "Everything on the left and right of these boards... the boards should only be
replacing the one board. Everything else should look the same: all the placement of the icons, the crowd moves, your pawns...
your pawns aren't here anymore... the chat's gone here... It should check everything that's on the screen during all phases of the
boss, and everything should be kept in the same positions, except the board splitting. The board split only replaces the single
board." And: "why is the space between the boards on the left and right not the same as in the center? If a chessboard is a square,
the padding is way off."
On a phone: "your board is big and the other three are smaller, like squad mode" (as `screens/Recluse2.tsx`'s header says it is now:
check it holds, with everything else of the phone's boss screen kept).
The God King: "keep the king alive... the king will still be with you, but you can't use him anymore." (Another job removes his
absorption from the transformation; here: he stays drawn in his usual place through every phase, his powers greyed in phase 2.)

1. List everything on screen in each phase of his fight (the child, the man, the cutscene, the phase change, the four boards, the
   result), phone and computer: the header/banner, the tools row, the Moves panel, the chat, the crowd table, the players' pawns with
   their ✓/Kick, the God King and his dock, the boss's figure/bust, the clocks. Stills of each phase BEFORE, as a sheet.
2. Keep each in the same place and size across all phases; only the board's square changes (one board -> the four boards inside the
   same square). Where something is hidden or moved in the phase change or phase 2 today (the pawns, the chat), put it back.
3. The four boards: inside the one board's square, equal gaps (between the boards and to the square's edges, left = right = middle),
   each board square.
4. Line bubbles: keep using whatever placement the "bubble follows his size" job (`claude/recluse-bubble-grows`) gives; if it hasn't
   merged, don't touch bubble placement.
5. AFTER stills of each phase, phone and computer (1280x800, 1920x1080, an iPhone), on branch `stills/recluse-same-frame`, as a sheet
   beside the BEFORE one.
6. One check added to an existing spec: the pawns, chat and Moves panel boxes are the same in phase 1 and phase 2 (within 2 px), and
   the four boards' gaps are equal (within 2 px).
Typecheck; the boss kit; the touched e2e specs. Push at each real step; `.pr-body.md` (short: what moved, player-visible, checks old ->
new); `.done`. No PRs, no CI waits, no model names in commits (end commits with the Claude-Session line only). About 1.5 hours.
