# The Hidden Boss's fight: one visual check, start to finish, before Eric plays it again (Eric, Nov 14)

Effort high. READ-ONLY review (no code changes): a fresh pair of eyes after the bubble, same-frame and transformation jobs land.
Branch for your output: `review/recluse-visual-qa` (a `review.md` and the stills; never images under docs/).

Eric: "take screenshots of the board during the first game, then during the transition of the boss, some snapshots during the next
phase, both mobile view and desktop view: where are things sitting? Are things being moved around? Is there anything that just
seems out of place? Just using basic logic."

Play his whole fight from `main` locally (his room's challenge with "Fill with 3 bots", 🏆 to skip a form where playing is slow;
the e2e helpers in `e2e/hidden-boss-room.spec.ts` / `e2e/recluse.spec.ts` show how), on an iPhone-sized phone and on a computer at
1280x800 and 1920x1080. Take a still at each beat: the kid (a line showing), the kid growing (9 -> 13 -> 20), the man (a line), his
fall, the cutscene (two lines), the transformation (3 stills), the split, the four boards (a line, a board ending), the result.
For each still: is every panel, button, pawn, the God King, the chat and the Moves panel where it was in the first still? Does any
speech bubble cover a face or float away from its speaker? Is anything clipped, overlapping, or off-center? Do the four boards have
even gaps? Anything else a player would call wrong.
`review.md`: a table per platform (beat, still, OK / what's wrong, how bad), then the list of problems, worst first, each with the
file it most likely lives in. About 45 minutes. Push; `.done`. No model names in commits (end commits with the Claude-Session line only).
