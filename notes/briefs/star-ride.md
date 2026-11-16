# Moon's Ride redrawn as a rounded star, drawn by the API on Fable 5.2 at medium. item-builder lane. Opus, high

Branch: the art on `claude/boss-art` (the runner: `scripts/boss-art/run.ts`, its README), then the ride into the game on
`claude/star-ride` from main. Read CLAUDE.md, `.claude/agents/item-builder.md`, `.claude/LESSONS.md`, and on `claude/director-notes`
`notes/RULES.md` ("Art is drawn by the paid API": you brief, run the runner, render and push; never draw by hand).

**Eric, Nov 16:** "we've got our API credits for the month, our 200 spend ... I think it's time to switch to a Fable at a medium effort
... our first order of business is to redo the Moon star rider. It should resemble more a flat 3D rounded star ... And when it moves, it
should be hovering, and when it moves, it should just have a little kind of like star, like sparkler almost style star thing from the
back ... minus the turbo kind of things. It's just a 3D flat rounded star. And that's where the color comes from that you can unlock as
well ... this one has just a single color to it. There's no dual color. But it should have ... some shading to it ... So not just a
total flat, same exact color for the whole thing."

**The look (his reference, described; the picture is not in the repo):** a thick, puffy five-pointed star with fully rounded points and
soft rounded edges, seen at a slight 3/4 angle, like a pillow or a rounded cookie: a lighter glossy top face, a gentle highlight near the
center, darker rounded sides and underside, a faint soft shadow below it on the ground. One color (the item's color, `colors` stays 1),
shaded light to dark, never flat. **No** thrusters, turbines, fins, handles or face. Your pawn sits on top. **Keep it our own:** a generic
rounded star in the game's pixel style; don't copy any game's star vehicle (no rainbow trail, no other franchise's details).
**Moving:** it hovers (a small bob, the shadow staying on the ground), and from its back a little sparkler trail: a few tiny bright
star sparks that pop and fade behind it (the rides' existing trail mark system: `--rider-trail`). Standing: hovering, no sparks.

**The API run:**
1. Add Fable to the runner: `PRICES["claude-fable-5-2"] = { input: 8, output: 40, cacheWrite: 10, cacheRead: 0.2 }` (the Claude API's
   prices). Fable 5.2 keeps thinking always on (the runner's `thinking: {type: "adaptive"}` is accepted), rejects forced `tool_choice`
   any/tool (check the runner doesn't send one) and enforces preserved thinking's history check: the runner must pass every assistant
   turn back unchanged, thinking blocks included (moving `cache_control` is fine; dropping or editing an earlier block isn't). A
   `stop_reason: "refusal"` already stops the run.
2. Run with `BOSS_ART_MODEL=claude-fable-5-2 BOSS_ART_EFFORT=medium`, the cap at `BOSS_ART_CAP_USD=20` for the side view, then the views
   and the trail runs at their own caps (say each estimate before it runs; the month's budget is $200). Stop and ask (`.question` on your
   branch) before passing $40 in all.
3. The ride replaces `moon-ride`'s drawing (`packages/app/src/components/rides/moon-ride.tsx`; keep the id so owners keep it). Its name
   and line: propose a star-fitting name and description in the PR body (keep "Moon's Ride" until Eric picks).
**Checks:** the item kit's tests for rides, the fitting sheet (`npm run preview:items -- out.png items=moon-ride`), the town ride e2e if
it covers it; one GIF of it moving (hover + sparks) and stills in two colors, on a `stills/star-ride` branch (never under docs/).
Report the API spend in $ per run and the plan usage. `.pr-body.md` (short) and `.done`. Commits end with the `Claude-Session:` line
only, no model names. No PR.
