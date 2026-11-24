# Crowd match on a computer: the status line centered and bigger; board, left list and right column flush at the bottom (Nov 25).
# Opus medium, light lane (layout, CSS/markup moves). Eric: "I want this fixed pretty quickly"

Eric (Nov 25, screenshot of a 50 v 50 Crowd match on a computer, 2000 px wide): "on desktop ... we should center the move thing where it
says like move whatever, and that should be centered and probably a bit bigger since that's fairly important information. ... I know it
looks different on phone, but ... on desktop that should be centered in larger text. ... on the left of the rankings and then on the right
for the chat, see how they're like, they dip down ... I want everything flush, like make that container on the left, the cut off at where
the board cuts off, and make the container on the right also do the same. ... I do want to move up the chat box a little bit ... there is
some text that we don't see here. That's why it's that low. But then we should also just bring it up, and then the bottom of it should be
cut off in that same. So ... the board and the two boxes should all be the same lower band, like where they stop."

The screen today (computer): the status line "Move 5 · cut in 10 · P38/50 · −0.8 · CUT +0.2" small at the top left above the board; the
left column (the team's scoreboard, "WHITE TEAM") runs past the board's bottom; the right column has the "Black is voting…" card at its top,
an empty gap, then the chat panel starting low and running past the board's bottom.

Start: `git fetch origin main && git checkout -B claude/crowd-desktop-flush origin/main`. Read CLAUDE.md, `.claude/LESSONS.md`,
`docs/rules/eric.md` (this is Eric's own ask: any guard test of these exact layouts that must change, change it and list it old → new;
nothing else), `docs/areas/match.md` (the Crowd screen), the computer layout of the match screen (find its components and CSS).

1. **Computer only** (the phone layout unchanged; check it): the status line above the board **centered over the board and larger**
   (about 1.4x today's size, still one line; its parts unchanged: move, cut in, your place, your score, the cut).
2. **One bottom line:** the left column and the right column end exactly where the board ends (their bottoms flush with the board's
   bottom edge, the board's own frame included), at every computer size (1280x800, 1440x900, 1920x1080, 2000x1100). Their content scrolls
   inside them if it doesn't fit (the scoreboard already scrolls).
3. **The chat higher:** in the right column, the chat panel starts right under the status card ("Black is voting…") with a normal gap (no
   big empty gap), so it's taller, and ends on the same bottom line. Find what the empty gap is reserving ("some text that we don't see":
   a hidden notice or line that keeps its place): keep the place it needs per "nothing hidden, nothing shifts" (a fixed slot is fine) but
   no more than it needs.
4. Same for the other modes that share this layout on a computer (Boss Battle, Squads' final): flush bottoms there too if they use the same
   columns; say what you checked.
5. Prove: typecheck; one focused e2e check in an existing computer-layout spec (`desktop-board.spec.ts` or `board-layout.spec.ts`): the
   three bottoms within 1 px of each other, the status line centered over the board (within 2 px) at the sizes above; the phone's still as
   before. One still per computer size you checked (orphan `stills/crowd-desktop-flush`, never under docs/), plus one phone still.
   Decision note (about five lines). Area page. PR body in `.pr-body.md` (changed checks old → new). `.done`, push, stop. Commits end with
   only `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR`.

## Added Nov 25 (Eric)
"the scoreboard. I don't think it needs to be so high up. Why don't we just make it literally the same height as the chessboard? ... it
fits the exact same on the left side." So the left scoreboard's **top AND bottom** match the board's top and bottom exactly (same height as
the board, top-aligned with it, not starting higher up the page). Check it in the e2e: the scoreboard's top and bottom within 1 px of the
board's.
