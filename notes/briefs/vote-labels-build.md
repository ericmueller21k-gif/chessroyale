# Vote labels: build B, the floating tags (Nov 25). Opus medium, targeted lane

Eric picked **B** (Nov 25: "the center one of the three, the best") from the mockup on `claude/vote-labels-mockup` (cd565df0, test switch
`?votetags=a|b|c`; stills and NOTE.md on `stills/vote-labels-mockup`): a small dark tag above each vote zone (the game's `.vote-banner`
style, small), a thin gold rim and a pointer down to its zone; rises in, bobs gently, lifts away; 3 s from the vote opening; gone (0.3 s)
the moment your vote is in; right from either side; nothing on the board moves; long names on two lines.

Start: `git fetch origin main claude/vote-labels-mockup && git checkout -B claude/vote-labels origin/main`, bring in the mockup's code,
keep **only B**: remove A and C and the `?votetags` switch (B is always on for every pawn vote: 50 v 50, Squads; the 1 v 1 time-control
vote too only if it reads well there, your call, recorded). Read CLAUDE.md, `.claude/LESSONS.md`, `docs/rules/eric.md`,
`docs/areas/match.md`. Reduced motion: the tags appear and go without the bob. The durations in settings (`VOTE_TAGS: { showMs: 3000 }`,
Eric's words in its comment).

Prove: typecheck; unit tests touched; the vote e2e specs (`votes.spec.ts`, `opening-vote.spec.ts`, `vote-hint.spec.ts`, whichever cover the
pawn vote) updated, plus one focused check: the tags show over their zones as the vote opens and are gone after your vote (and after 3 s
without a vote). One still per platform (phone and computer) on orphan `stills/vote-labels` (never under docs/). Decision note (about five
lines), area page. PR body in `.pr-body.md` (changed checks old → new). `.done`, push, stop. Commits end with only
`Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR`.
