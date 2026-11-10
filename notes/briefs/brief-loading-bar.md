# A loading bar when the app takes more than about 2 seconds (Eric, Nov 10)

Eric: "Let's put a loading bar. People don't mind if you put a loading bar in and it just says ... loading database, loading chess
engine, something ... we don't need to be like silly ... But we should only do that if it's going to be more than like a 2-second hang.
If it's just 1 second, then it can say hun chess ... somewhere in a nice clean UI. For desktop and mobile."

Today: the static shell (index.html) shows the logo at once, then the app's splash (`App.tsx` ~:1952, `.fd-splash` with `<Logo />`)
waits for `/api/auth/config` and `/api/me` (and an invite's check) with no time limit; after a schema-changing deploy Eric saw it for ~8 s.

## Build
1. The splash (and the shell, so the swap stays invisible) stays exactly as today for the first ~2 s (a setting, e.g. `FRONT_DOOR.loadBarAfterMs`).
2. Past that: under the logo, a thin, clean progress bar and one plain line saying what's loading, in order as each finishes:
   "Loading the game…", "Signing you in…" (or "Loading your account…"), "Loading the chess engine…" (only if home waits on it),
   "Almost there…". The bar moves by real steps done (not a fake timer), easing between them; it never goes backwards.
3. Light and dark mode, phone and desktop, centered under the logo; nothing else on the page moves (Eric's rule).
4. If a step fails (an error or ~20 s), the line says so plainly with a "Try again" button (reload), not an endless bar.
Mockup first: 2 stills (phone and desktop, a step mid-way) pushed to stills/loading-bar early. Tests: one e2e (hold `/api/me` 3 s:
the bar and the "account" line show, then home; hold nothing: no bar ever shows). Lane: targeted (front door). Effort high. Decision note
docs/decisions/2026-11-10-loading-bar.md (≤ 5 lines). Push to claude/loading-bar at each real step; as your LAST push write .pr-body.md
and .done together. Don't open the PR. Read CLAUDE.md, .claude/LESSONS.md and notes/briefs/rules-common.md first.
