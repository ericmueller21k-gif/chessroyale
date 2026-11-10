# Town: your rider shows up seconds late (Eric, Nov 10: "a big bug happens every town load, your rider doesnt appear for a few seconds,
# gotta fix this too its sloppy")

His screenshot (desktop): the town is up, his pawn in its outfit stands in the middle, but the ride under it isn't drawn yet; it pops
in a few seconds later. Likely causes to check first: rides' code is loaded lazily (docs/decisions/2026-11-01-rides-lazy.md: "Your own
ride's chunk is asked for after the first paint"), and #609 (phone load 3) paints pictures the first time they're drawn
(`town/houses/kit.ts` `paint`, `characters/sprite.ts`).

Fix: the town never shows your pawn without its ride. Least code and least lag: start loading your own ride's chunk as soon as your look
is known (home), and/or when Chess Town is tapped; the town's first frame waits for it (bounded, e.g. 1 s, then draws without it and
adds it the moment it's ready). Other players' rides may pop in as today (say so if they also lag noticeably). Watch it frame by frame
on desktop and phone, cold (no cache) and warm. One e2e check: on the town's first drawn frame your ride is drawn (or within N ms).
Lane: targeted (the town's drawing: `@perf` locally). Effort high. Decision note docs/decisions/2026-11-10-town-rider.md (≤ 5 lines).
Push to claude/town-rider at each real step; as your LAST push write .pr-body.md and .done together. Don't open the PR. Read CLAUDE.md,
.claude/LESSONS.md and notes/briefs/rules-common.md first.
