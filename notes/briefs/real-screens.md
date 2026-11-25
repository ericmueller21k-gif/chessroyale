# Computer layouts at real laptop sizes: the 1 v 1 end page fix, then one shared game layout (Nov 25). Opus high (xhigh if it touches shared board sizing logic). Replaces duel-layout-mockup.md's scope

Eric (Nov 25): "I run checks on the laptop ... desktop monitor ... phone ... I get 3 different fucking things every time I look ... how is the
chessboard so small in the 1v1 when I've said many times ... this defeat screen looks horrendous ... 'No quests moved' ... the play again and
home button are huge. The chat is shrunk to shit ... This is never what I had said to build." Then: "I'm running it at 125 because it says
recommended for this laptop ... some people are going to be doing that on their laptop if that's the default."

**Cause (director):** every computer screen was built and checked at 1280×800 / 1440×900 / 1920×1080 only. Windows' recommended 125% on a
1080p laptop gives a viewport about **1536 × 730** (Eric's town report: drawn ratio 1.25), shorter than anything tested, so "height − 170"
boards shrink (≈560 px) and pages laid out for ≥800 px overflow. And game screens each grew their own computer layout.

**Part 1, the cause (ship first, `claude/real-screens`):** add real laptop sizes as e2e projects/viewports and use them in the computer
layout specs: **1536×730** (1080p @125%, Eric's laptop), **1280×600** (1080p @150%), **1366×650** (768p @100%), plus 1920×960 (a desktop).
`deviceScaleFactor` to match (1.25 / 1.5 / 1). A layout check every computer game screen and end page runs at each: no horizontal scroll,
nothing cut off at the top, the chat's message area ≥ 120 px, the board at least (viewport height − 2 name bars − 40). Add the rule to
`docs/rules/eric.md` ONLY as a proposal in the PR body (a guard needs Eric's OK); put the sizes in `docs/areas/board.md`.
**Part 2, the 1 v 1 end page (`DuelEndPage`, `EndScreen`) to Eric's Nov 20 spec** (docs/decisions/2026-11-20-end-screen.md): on a computer the move-by-move stays on the RIGHT
(Eric, Nov 25: "I don't care if the move by move is on the right ... obviously when the screen is vertical like a phone, we're not going to
be able to squeeze a board to the right"), the two columns balanced with even gutters, nothing shifts; the quests row shows the day's quests with their progress (moved ones lit), never "No quests
moved this game"; the placement card "1 of 5 games" (not RP); Play again / Home normal button size; the chat with a real message area;
header never cut. Ship parts 1-2 together on `claude/real-screens` with `.pr-body.md` + `.done` (targeted lane) and stills at the 4 sizes.
**The principle for every computer screen (Eric, Nov 25): "the laptop is just a smaller desktop screen, and we should be seeing pretty much
the same thing, just smaller versions ... where everything is sitting."** Same arrangement on every landscape screen, scaled to the window
(sizes from the viewport, not fixed px that reflow at a breakpoint); only a portrait/phone screen rearranges. A laptop still must look like
the desktop shot, shrunk.
**Part 3, MOCKUP (stills only, `claude/game-layout-mockup`, `stills/game-layout-mockup`):** one shared computer layout for every game screen
(1 v 1, 50 v 50, boss, Squads): the board as tall as the window allows (chess.com: only a name bar above and below; "1 v 1 · Rapid 10+5" in
the top bar by the clock), one right panel width, the chat never collapses; the rank emblem by every name; tap a rank → a "Ranks" pop-up
(Wood → Radiant, 5 divisions of 80 RP, 5 is lowest; Pearlescent top 500, Transcendent top 100; the tapped player highlighted "Illustrious 4 ·
67 of 80 RP"). Show every main screen at 1536×730, 1920×960 and a 390 phone, side by side, before/after, board px. NOTE.md with build cost.
Read CLAUDE.md, `.claude/LESSONS.md`, `docs/rules/eric.md`, `docs/areas/board.md`, `ranked.md`, `hub.md`. Commits end with only
`Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR` (no Co-Authored-By). Never images under docs/. `.done` per branch.
**Eric, Nov 25:** "don't take those notes and assume that it's for every single device ... the whole point is we've tried to make a point to
differentiate what screen we're referring to." Every still and every claim in the PR body names its screen size. Look at your own stills at
each size before reporting.
