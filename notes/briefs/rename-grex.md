# Jefferson's official name is now Grex (Eric, Nov 23). Haiku, high. Light lane (text only)

Eric, Nov 23: "We can actually change his name to Grex everywhere, code can stay whatever it is but that's his new official name."
The fireworks giraffe boss (roster id `grex`) is called "Jefferson" in player text today (`packages/core/src/boss.ts:173` `name:
"Jefferson"`, "Jefferson's Fireworks" in `packages/app/src/town/world.ts`, "Jefferson's Boss Crate" in `crates.ts`, lines, the FAQ...).
Note the spelling: **Grex** (capital G, the rest lowercase), never "G-REX" or "GREX".
Step by step. **Start exactly like this** (a first attempt branched from a weeks-old main by mistake):
`git fetch origin main && git checkout -B claude/rename-grex-2 origin/main && git log --oneline -1` (that commit must be today's main:
a merge of PR #890 or later; stop and say so if it isn't). Work and push only on `claude/rename-grex-2`. Then:
1. `git grep -n "Jefferson"` over `packages/*/src`, `packages/app/public`, `e2e`, `packages/*/test`, `docs/areas`, `docs/rules`,
   `.claude/LESSONS.md`. Change every player-visible "Jefferson" to "Grex" and "Jefferson's" to "Grex's": names, titles, lines
   and bubbles, banners, the FAQ, shop and room names, crate and item names, `themes.json`'s "boss" note, aria labels. Code
   comments too (so the next reader isn't confused), and the old "G-REX" in comments and test titles (e.g. `e2e/perf.spec.ts`'s
   "G-REX's fire", `boss-beats.ts`, `effects/grex.ts`, `grex-sounds.ts`) becomes "Grex".
2. Do NOT change code identifiers or ids: `grex`, `sidekick-jefferson`, `jefferson-giraffe`, file names, CSS classes, test ids,
   storage keys, database values. Do NOT edit `docs/history/` or `DECISIONS.md` (history stays as written) or old files in
   `docs/decisions/`. Add one new file `docs/decisions/2026-11-23-grex-name.md` (about 5 lines: Eric's words, what changed).
3. Lines that only make sense with the old name (a pun on "Jefferson", a rhyme): list them in the PR body for the director instead of
   rewriting them yourself.
4. Tests that check the name: update their expected text to "Grex" (they follow the copy). Don't touch `docs/rules/eric.md` guard
   tests' logic; if one checks the name, update only the text and list it.
5. Check that the name fits where it shows (the boss bar, the picker, the shop sign, the crate card) on phone 390 px: one still of the
   boss picker and one of the boss bar in a battle, both after the change (a shorter name, so it should only get roomier).
6. Prove it with `npm run typecheck`, the unit tests of the packages you touched, and `node e2e/ci-select.mjs files <changed paths>`'s
   specs that mention the name (just the tests whose titles or text you changed), phone, locally.
Write `.pr-body.md` (what changed, what players see, changed checks old → new, the lines from step 3), put the two stills on an orphan
branch `stills/rename-grex-2`, write `.done`, push and stop. Don't open PRs or wait on CI. Commits end with the `Claude-Session:` line only.
