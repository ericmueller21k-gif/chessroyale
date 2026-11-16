# The Hidden Boss's phase 2 on a computer: the phone's layout for the boards (Eric, Nov 16)

Effort high (layout plus the board split's animation and timing on a computer; Opus). You are the `god-king` delegate. Targeted lane
(layout and shared screen code; the specs of the area: `e2e/recluse.spec.ts`, plus whatever `node e2e/ci-select.mjs files <paths>`
names). New branch `claude/recluse-p2-desktop` from main. Never write the Hidden Boss's name in player text, commits or PRs (code
names like `recluse` are fine). Read `.claude/LESSONS.md`, CLAUDE.md ("Simple beats flashy", "Nothing hidden, nothing shifts") and
`docs/areas/bosses.md` (phase 2: "Layouts", "The same frame in every phase", "The phase change"). Eric's screenshot of today's
computer layout: `notes/briefs/assets/recluse-p2-desktop-eric.png` on `claude/director-notes`.

## Eric's words (Nov 16, on a computer in phase 2)
"I think we should make this is the desktop version. ... even though when the board splits, we should just mimic how it splits on
mobile. So we get a bigger board and then the three smaller boards up top still. I think actually that makes more sense for desktop
as well. So it can split like this and it shows all four, but then shrink down the three, or just replicate how it is, I guess, on
mobile ... and then puts the other boards up top. ... but then we keep everything else desktop on it like the same."

## What to do
- On a computer, phase 2's boards take the phone's arrangement: **your board big** (the size of the single board in phase 1, in the
  same place: "nothing shifts" for your board), **the other three small in a row above it**, each with its player's name and clock
  as now; tapping one to watch it and "Back to my board" as on the phone.
- The split: as Eric says, it can split into the four first (as now), then the three shrink up into their row and yours grows back
  to full size. Reuse the phone's animation if it has one; keep it short.
- Everything else on the computer stays as it is: the crowd table on the left with his figure and bubble, the boss bar on top, the
  moves and chat on the right, the God King and pawns at the bottom right, the dock under the board, the "SLOW" strip.
- The three small boards need room above yours: fit them in the space the computer layout has (shrink them as needed, or take room
  from the top margin). Say how it fits at 1280 x 800, 1440 x 900, 1611 x 843 and 1920 x 1080, with your board at its phase-1 size
  if possible; if your board must shrink, by how much at each size.
- Online and solo alike. The Hidden Boss's bubble still sits over every board (`isolation`).

## Deliver
One still per computer size after the split (and one of the phone, unchanged), a short GIF of the split on a computer. Tests: a
focused check in `e2e/recluse.spec.ts` (computer: your board's box the same as phase 1's; the three above it, inside the window, not
overlapping), and the specs the selector names. Frame check with real taps over the split (`frames-recluse-cutscene` or the phase 2
frames script). Update `docs/areas/bosses.md` "Layouts", a 5-line decision note, `.pr-body.md` (what changed, player-visible, checks
old -> new), then `.done`. Push stills to `stills/recluse-p2-desktop`, never images under docs/. No PRs, no CI waits, no model names
in commits (end with the Claude-Session line only). Push work in progress at each real step. Aim for about an hour.
