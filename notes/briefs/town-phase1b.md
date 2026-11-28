# Town structure, phase 1b: the app loads the baked pictures. Fable, xhigh. Full lane (`full-e2e`: how the town loads for everyone).

Read `notes/briefs/rules-common.md`, `DESIGN.md` on `origin/claude/town-architecture` (§2, phase 1), `notes/briefs/town-phases.md`.
Phase 1a is PR #1040 (`claude/town-phase1a`), likely not merged when you start: branch `claude/town-phase1b` **from
`origin/claude/town-phase1a`**, and merge `origin/main` in as it moves. Phase 1a's author left these for you (its `.done`, commit 490fd824):
- `manifest.json` has a fixed name: a service-worker-kept app could read a newer one. Name it by its contents and hand the name to the app
  (a `define`, as `__TOWN_ART__`).
- The dev server doesn't bake (the plugin is build-only) and the service worker's precache leaves `/town-pictures/` out: one line each in
  `vite.config.ts`.
- A file is a group's page, as wide as its pictures reach, padded as the atlas pads: the device places pages on its layers. Names with the
  same pixels share one place. A roof's sheets are pictures `<roof>/<n>`. A glow with no pieces has no picture. The sidekicks' sheets are
  keyed by their name in SIDEKICK_SHEETS. `order.json` is only for the e2e check.
The job:
1. The loading screen fetches the town's groups and the manifest (the later visit's `adopt` path, `paint-gl.ts`), decodes off the main
   thread, uploads; frame counts, roofs, glows and tops from the manifest (no character animation data built just to count frames; no
   tops worked out). Nothing is painted on the device for anything in the list.
2. The service worker keeps the files (content-named: an update fetches only changed groups). Home fetches them quietly when idle, as the
   music. The dev server bakes too.
3. Load first, then show (`rules-common.md`): the card lifts only when every group of the start view is uploaded and the warm-up frames
   settled.
4. Measure (Fable's method): first visit, later visit, after a deploy, slowed phone and computer; bytes on the first visit; no freeze over
   200 ms on the loading screen. Same pixels: the device's picture hash equals today's.
Device painting is still there as a fallback this job (phase 1c deletes it). Decision note, area page. Commit AND push `.pr-body.md` and
`.done` (`git add -f`), check `git ls-remote`, stop. Split off anything over about 4 hours and say so in `.done`.
