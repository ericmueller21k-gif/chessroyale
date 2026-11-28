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
see what kept coming back and why. Also read what the town-load-smooth helper changed (branch `claude/town-load-smooth`, its PR body).

Measure first (a cold load and a warm load, slowed phone ×4 CPU and the computer project): time from tap to town shown, bytes and requests
at the first and the second visit, texture uploads and canvas redraws per second while walking, draw calls and per-frame cost by part.

Then write `DESIGN.md` (plain words first, for Eric; the technical part after), on branch `claude/town-architecture` from `origin/main`:
1. **Why it keeps coming back:** each recurring problem (first-use loads, canvases redrawn and re-uploaded, long tasks) traced to the
   structure that lets it happen, with examples from the history.
2. **The structure that makes it impossible by construction**, e.g. (your judgment, not a checklist): art built into atlases at build
   time with a manifest; one preload path the loader runs before the town shows; the device keeps assets across visits (HTTP cache /
   Cache Storage, content-hashed names, so an update re-downloads only what changed); static layers drawn once and kept, only moving
   things redrawn, dynamic text/canvases updated by dirty rects; a world split into chunks so a bigger town costs nothing more per frame
   and loads near chunks first; a per-frame and load budget measured on every PR touching the town. Say what to keep from today's code.
3. **Targets:** load ≤ 2 s on a mid phone first visit, faster after; zero frames over 33 ms after the town shows; adding a building costs
   ~0 per frame and only its own bytes to load.
4. **The plan in phases**, each shippable alone and measured, with effort (helper-hours, model) and risk, and how a new building or a
   bigger town is added after it (the "how to add to the town" recipe).
Keep `DESIGN.md` to what Eric and a builder need (about 2-4 pages). Commit AND push `DESIGN.md` and `.done` (`git add -f`), check
`git ls-remote`, stop. No code changes, no PRs, no comments.
