# Brief: architecture audit and simplification plan (read-only)

**Eric, Nov 6:** "it just seems like it shouldn't be this complicated. It's taken a full day … just to make a … redraw of the Colosseum … there is something that has gotten bloated in here … we got to look at some better ways of optimizing things."
On 3D: "how does an N64 or a Game Boy Advance build these in 3D space and they look totally fine? … the moment I ask you to make something in 3D, it looks so different than everything else … the claw machine looks out of place."
He has approved all of: the item audit trail, one 3D engine for every room ("look into and make a decision"), and making the street town WebGL-only.

**Repo:** /home/user/chessroyale (branch main; `git fetch origin main` first). READ-ONLY: no commits, no pushes, no servers. You may make a scratch worktree under /home/user/cr-audit if you need one; remove it when done.

## Answer with facts from the code (file:line), each one short

1. **Items and economy storage.** How are items, crates, tokens, claw plays and welcome crates granted, spent and stored today (tables, migrations, server routes)? Is there one place every grant or spend goes through? What would an append-only ledger (who, what, delta, reason, source id, time) need?
   - every write path;
   - a minimal schema;
   - backfill;
   - how to make duplicates impossible (idempotency keys);
   - the tests needed.
   Do this at xhigh care: it's money and stored data.
2. **Renderers.**
   - List every place the game draws: today's town 2D, the street town 2D and WebGL, shop rooms (`ShopRoom`, `shops/*-art.ts`), boss intros, the claw machine (claude/boingo-home, claude/claw-machine), boards.
   - For each: the tech, how art is made (code-drawn pixels? sprites? meshes?), and its texel or pixel scale on screen.
   - Why does the 3D claw machine look out of place? Give concrete numbers: pixel size on screen versus the room's, outlines, palette, lighting, smoothing.
3. **The 3D art kit decision.** Propose the kit concretely: low-poly primitives (box, prism, cylinder, wedge, quad) with pixel-art textures at the town's texel density, nearest filtering, the town palette, the town's light model (flat plus 2-tone?), and an outline rule. Then:
   - Where does it live, and how is a building or prop defined (a data file with shapes, textures and positions)?
   - Can rooms render in the same WebGL engine as the street town?
   - Estimate the effort: (a) the kit; (b) rebuilding the claw machine with it; (c) porting one shop room.
   - Recommend yes or no on unifying, with the risks.
4. **What makes changes slow.** Measure, don't guess:
   - the number of lines per town feature duplicated 2D versus WebGL;
   - CI time by spec file (e2e/ci-timings.json), with the top 15 slowest and which are pixel or screenshot checks that could be number checks;
   - docs volume per PR (docs/*/pr-body.md, docs/decisions, docs/areas sizes);
   - stills generation;
   - how many e2e specs are flaky (search recent CI summaries if available locally; otherwise the specs with retries or long waits).
   Then rank what to cut, with the expected time saved per change.
5. **Data versus code.** Bosses, rooms, intros, lines and the street plan: what's data and what's code? Where would moving to data cut work most?
6. **Street town WebGL-only.** What exactly comes out (files and functions) when STREET_TOWN drops its 2D path while today's town keeps 2D? Which tests stop running twice?

## Output
Write `/home/user/cr-notes/notes/audit-2026-11-06.md`: about 2 pages, plain American English. For each area: the findings with file:line, the recommendation, the effort in helper-hours and the risk. End with an ordered plan of PR-sized steps. Do not commit the notes branch; I'll do it. Report a 10-line summary back.

Rules: American English. Don't list processes, read env or auth files, or call session tools. Never name or hint at a real person.
