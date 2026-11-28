# The town's structure: a permanent design for loading and drawing. Fable (Eric asked for Fable), xhigh. Design only: no code changes.
# Starts after the town-load-smooth helper finishes (Eric: "we can wait till this one's done").

Eric, Nov 28: "one small addition should not be fucking up the load time this much… it should take 2 seconds to load this… whatever we've
been doing is… getting worse over time… we have to implement a permanent change because there's going to be more changes in the town. I
might even want to make the town bigger. So if that means overhauling the entire structure of the town's code so it can easily add more
to it… how we can make this load make sense and make the frames better… this redrawing shit keeps coming back up constantly for
different things too." Also: "Load the town first so it doesn't lag" (no lag once it shows, ever; `notes/RULES.md`, load first).

Read `notes/briefs/rules-common.md`, `.claude/LESSONS.md`, `docs/areas/` (the town pages), `docs/history/lessons.md` (search "town",
"upload", "redraw", "frame") and the town's code (`packages/app/src/town/`), the frame report (`town/frame-report*.ts`, `/town?report`),
and the git history of the town's perf fixes (`git log --oneline -- packages/app/src/town | grep -iE "frame|lag|upload|redraw|perf"`), to
see what kept coming back and why. The latest load fix (branch `claude/town-load-smooth`) may or may not be merged when you start: measure what's on `main`, and note it.

Measure first (a cold load and a warm load, slowed phone ×4 CPU and the computer project): time from tap to town shown, bytes and requests
at the first and the second visit, texture uploads and canvas redraws per second while walking, draw calls and per-frame cost by part.

**An independent audit (Eric: "what a third party, something that hasn't already looked at this, finds out").** The director's own
ideas are deliberately left out of this brief: don't look for them in `notes/` and don't take earlier helpers' explanations on trust
(their code comments and PR bodies included); judge from the code and your measurements.

Then write `DESIGN.md` (plain words first, for Eric; the technical part after), on branch `claude/town-architecture` from `origin/main`:
1. **Findings first:** what the town actually does on load and per frame that it shouldn't, each with its measured cost and where in the
   code; call out anything surprising or that looks unintended. Then why these problems keep coming back as the town grows.
2. **The structure you'd build** so they can't come back, so adding a building or making the town bigger costs about nothing per frame
   and only its own bytes to load, and the town loads in about 2 s on a mid phone (faster on a second visit; an update re-downloads only
   what changed). What to keep from today's code, what to replace.
3. **The plan in phases**, each shippable alone and measured, with effort (helper-hours) and risk, and the recipe for adding to the town
   after it.
About 2-4 pages. Commit AND push `DESIGN.md` and `.done` (`git add -f`), check `git ls-remote`, stop. No code changes, no PRs, no comments.
