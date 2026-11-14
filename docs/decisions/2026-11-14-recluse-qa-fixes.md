# The Hidden Boss's fight: fixes from the visual check (Nov 14)

The visual check (branch `review/recluse-visual-qa`, `review.md`) found ten problems in his room's fight. Fixed at their causes:

1. **A phone's bar box at the countdown was a 26 px sliver.** SpeechBox's `balanced` fit was measured while his place was hidden
   (`.rc-away`: `display: none`), got the frame's padding alone, and kept it. Now a box that isn't laid out isn't measured; a
   ResizeObserver measures it as it first shows (before that frame's paint). Every fitted box gets this.
2. **A lone tail in the cutscene.** The tail faded on the scene's own `boxFadeMs` (scaled down with a short hold, as the local server's
   12 s), the box on SPEECH's. The tail now takes its box's own classes (`.cs-say.fresh + .cs-tail`, `.cs-say.leaving + .cs-tail`).
3. **A computer's bar face stayed the 9-year-old.** The face is now his bust's own frame as the phone draws it (the loop his figure
   rests in, his suit), cropped by `RECLUSE_BUST_PORTRAIT` (BossKit `barFace`).
4. **His fall's words 82 px over his head.** The man's kit had no `heads`: it has `RECLUSE_HEADS` now, measured by the unit test as
   the child's are. Call: each animation's tallest frame, as for the child; the fall's lines come after the collapse, over the kneel (99).
5. **The God King's line into the chat and onto a teammate** (party layout, 1280 and 1920). Call: his box sits above the team's heads
   and their checks (bottom 142 px over the board's foot), three rows at a phone's 8 px, and the chat stops 8 px higher (200 px, as
   without a party). Longest God King line, 56 characters: three rows at most.
6. **Phase 2's Moves panel showed phase 1's game.** It lists your own board's moves in phase 2 ("You"), in the same panel.
7. **A phone's small boards had a clock but no name.** The name shows, cut short with "…", the clock whole, inside the board's width.
8. **The white-out's corners on a tall phone.** At its peak the white is the whole screen; as it dies back its disc was sized from the
   screen's diagonal, so a tall phone's bottom corners were in its soft edge on its first frame. Now its solid half reaches the farthest
   corner from his chest as it starts.
9. **His words over his helmet across the bar's edge.** Call: a computer's box is as wide as the cutscene's (320 px: two rows, on the
   board under the bar); a box that would still straddle the bar's bottom edge moves wholly into the bar (empty then, a phone's) or, too
   tall for it, wholly onto the board.
10. **The four boards snapped 3 to 6 px as play started.** The split ended at the slot's size; phase 2 draws each board's squares a whole
    multiple of 8 device pixels and places it in its slot. The split now ends there (`playedBox`).

Not done: #11's nits (the God King's fallen box 14 px higher, the 1280 chat chips, "WON" squeezing names) aren't a line or two each;
#12 goes with the phase 2 standings job.
