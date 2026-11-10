# Quest progress you can see (Eric, Nov 10: "mirror like the Hearthstone thing")

Eric: after a game that moved a quest, "when we complete it and then go back out to like the main page ... it makes the pop-up come
back. And it does like a little like animation to like move it towards ... the goal." And when one completes, "it does more than just
fill up the bar and like give a check mark ... some sort of satisfying animation or sound. I've actually got a sound pack that I'm
working on to incorporate."

Today: a "Quest done" line on the result screen; the quests overlay (`components/QuestsOverlay.tsx`) shows still bars.

Build:
1. Back on home after a game that moved any quest: the quests overlay opens by itself, each moved bar slides from its old count to its
   new one (the count ticks up with it), one after another.
2. A quest that completes: a proper finish (the bar fills and glows, the row pops, "Done!", the reward's art flies or bursts, a short
   sound). Reuse what exists (the crate/XP reveal effects, sound.ts) before writing new (Eric: simple beats flashy, least lag on a phone).
3. Sounds through one named hook (e.g. `questSound("tick" | "done")` in sound.ts) with placeholder synth sounds, so Eric's pack drops
   in later by name. Respect the sound settings and reduced motion.
4. "Got it" closes it; it never pops for a game that moved nothing. Nothing on home moves or resizes (Eric's rule).
**Mockup first:** push 2-3 stills (phone: mid-slide, the completion) to stills/quest-progress early, then build. Lane: targeted
(animation: watch it frame by frame on a phone, `@perf` if the drawing changes). Effort high. Tests: one e2e for the pop-up after a
game that moves a quest and none after one that doesn't. Decision note docs/decisions/2026-11-10-quest-progress.md (≤ 5 lines). Push to
claude/quest-progress at each step; when done write .pr-body.md and push. Don't open the PR. Read CLAUDE.md, .claude/LESSONS.md and
notes/briefs/rules-common.md first.
