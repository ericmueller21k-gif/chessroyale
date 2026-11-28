# Town structure: all five phases (Eric, Nov 28: "if this is Fable's recommendation, then we just do the whole thing. We don't even ask
# questions… we're trying to make it could last years"). The plan is `DESIGN.md` on `origin/claude/town-architecture` (Fable's audit).

Order, one job at a time (each a fresh Fable session, its own branch and PR, the director merges before the next starts):
- **Phase 0** (Fable, high, targeted): `town-phase0.md`.
- **Phase 1a** (Fable, xhigh): the picture list out of the renderer; `scripts/bake-town.ts` writing pages (content-named PNG) and a manifest;
  a test that the baked pixels equal today's (the picture hash). No app change yet.
- **Phase 1b** (Fable, xhigh, `full-e2e`): the app loads groups and the manifest (the `adopt` path), frame counts and tops from the manifest;
  the service worker keeps the files; home fetches them when idle.
- **Phase 1c** (Fable, xhigh, `full-e2e`): device painting deleted (`paint-pool.ts`, its worker, `keep-pictures.ts`'s saved copy); budgets
  re-measured (first visit = later visit).
- **Phase 2** (Fable, xhigh): the picture service (ask ahead, make and upload between frames in a budget, draw when ready); no upload
  inside a draw once the card lifts; text at one size (a still to the director first; two sizes if small text looks soft); bubbles made
  ahead of their line; tags never overflow the atlas.
- **Phase 3** (Fable, high): roofs as faces from one texture a building; the darker step in the shader. Stills before and after at the same
  views: the director checks them; only if they match is it kept, else the baked roofs stay. Stills go to Eric as information.
- **Phase 4** (Fable, xhigh): the grid (placing, sorting, sight lines over cells in reach); the ground on the GPU; groups by district with
  a half-size far copy; a doubled-town test plan within 10% of today's frame and load.
Each phase: the brief names `rules-common.md` and `DESIGN.md`; measured before/after (Fable's method); a five-line decision note; area
page; ask Eric for a `/town?report` on his phone and laptop once it's live. The shop (a new building) is built after phase 1.
