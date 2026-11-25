# 50 v 50 vote box round 2: the phone's standing box, and one check (Nov 25). Opus medium, crowd lane, targeted (UI). Branch `claude/crowd-poll-skeleton`

Round 1 (55800608, `claude/crowd-poll-skeleton`; its `.pr-body.md`, decision `docs/decisions/2026-11-25-crowd-poll-skeleton.md`; stills on
`stills/crowd-poll-skeleton` bb1a2f3a) did the computer: the six skeleton rows stand in the 206 px slot and fill in place. The director passed
the computer. Eric asked for the standing box on the phone too ("do that also on mobile and desktop. They'll sit a little differently"), and
round 1 left the phone's box appearing at the reveal. `git fetch origin claude/crowd-poll-skeleton && git checkout -B claude/crowd-poll-skeleton
origin/claude/crowd-poll-skeleton`, `git rm .done`, push, then start. Read CLAUDE.md and `.claude/LESSONS.md`.

## 1. The phone (the director's call)
Measured (390x844, between reveals): `.play-footer` 438-542 (104 px) = power-up row `.history-nav` 32, gap 6, status `.play-slot` 42, 24 free.
The box needs 6 rows x 14 + its 20 px result line = 104.
- Make the phone's slot taller, permanently, the same height in every phase: power-up row, then the standing box (six skeleton rows that the
  reveal fills in place, as on the computer), then the status line under it (the waiting banner between reveals; the result line at the
  reveal), one gap between them. The scoreboard sits lower by the added height, all game: it never moves during play.
- If the banner can be one line (about 24 px) without losing what it says ("White is voting. Your team moves next. 0/50"), do that so the
  scoreboard drops less; otherwise keep its 42 px.
- Check at 390x844 and 375x667 (the smallest phone we check): nothing overlaps, the page doesn't scroll in a new way, and the board's size
  is unchanged.
- Light and dark.

## 2. Check one thing in the laptop still "4 laptop 1536x730 - with results"
The green (played) row is d3 with 9 votes while Nf3 has 21, and "50 votes" while the rows shown sum to 45. Find out why: is it the stills
staging (a stubbed reveal), or does the real game play a move that isn't the most popular? Say which in `.pr-body.md`. If it's a real bug,
STOP and report it to the director (don't fix it in this PR: it's scoring, a different lane). If it's staging, make the staged reveal
consistent (the played row the top one, the counts summing to the total) so the stills Eric sees aren't wrong.

## 3. The computer, small
With results, a short gray bar floats alone under the box (the watched turn's result line). Keep its fixed spot, but make it read as the
box's own foot line (inside the box's edge, the same width as the rows), not a stray pill.

## Done when
- The focused e2e check in `e2e/crowd.spec.ts` covers the phone too: the box stands with six skeleton rows before results, is filled at the
  reveal, and the box, board and scoreboard keep their places in every phase. Adjust any phone check that measured the old slot height
  (list old → new in the PR body); no eric.md guard edited (if one would be, stop and report).
- Stills: phone 390x844 before/with results, 375x667 before results, laptop 1536x730 before/with results, desktop 1920x960 with results,
  one dark. Push them to `stills/crowd-poll-skeleton` (images only on that branch). Look at each yourself before pushing.
- `.pr-body.md` gets a "Round 2" section; a few lines added to the decision file and `docs/areas/crowd.md`.
- Push, write `.done`, stop. Don't open PRs or wait on CI. Commits end with only
  `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR` (no Co-Authored-By).
- Budget about an hour; run only the crowd specs you touch.
