# Birdie's home in Chess Town: the station, its lobby, the bartender's shop, the flip board (Nov 23). Opus high, targeted lane

Read first: `notes/designs-birdie.md` on `claude/director-notes` (re-read it before each step: Eric's answers land there), sections
"His home in Chess Town", "The lobby: Eric on the first drawing", "Eric's answers" (the flip board) and "His voice". Then CLAUDE.md,
`.claude/LESSONS.md`, `docs/rules/eric.md`, `docs/areas/town-square.md`, `docs/areas/shop.md`, `docs/areas/bosses.md`. Model it on
Chandy's home and pond (PRs #737 and #740: `git log --oneline origin/main --grep=chandy -i`).
Branch: `git fetch origin main claude/boss-art && git checkout -B claude/town-birdie-home origin/main`. Push work in progress at each step.

The art is done and paid for, on `claude/boss-art` (copy in, never redraw by hand; no new art spend in this job):
- Station exterior: `scripts/boss-art/out/house-birdie/house-birdie.ts` (a little station, a big nest on top).
- Lobby interior: `scripts/boss-art/out/shop-birdie-interior-3/` (round 2, Eric's look: `stills/birdie-10`). It is a **12 x 12** room:
  `makeRoom` defaults to n = 20 and `ShopRoom.tsx` doesn't pass n, so pass 12 (don't change any other room).
- Bartender, the shop clerk: `scripts/boss-art/out/sidekick-birdie-bartender/` (idle: scoops seed from the vat and pours it into a counter
  feeder; his notes say the pour lands 26 px right and 28 px up of his feet; his spot `SHOP_BIRDIE_BARTENDER_SPOT = { col: 6, row: 2 }`).
  Line him up so the pour lands on a counter feeder; say how.

Do:
1. **His lot in the town** (Birdie is admins first, `BOSS_ADMIN_FIRST`: his home shows only where other admin-first homes show; keep the
   rules `town-player.test.ts` states for them). The station on its lot, its card ("Challenge alone" etc., as every boss home), a walk-in.
2. **The lobby** as his shop room (as other bosses' shop rooms): the bartender is the clerk (the shop opens from him, as other clerks).
   The middle table with its two stools is the **challenge spot** (as the other rooms' challenge spot works). His challenge plays
   `hello` (#901 wired the boss-select and town-tap sound; check it plays here).
3. **The split-flap board on the back wall: real text in code** (the art has blank flaps): a few rows of departures and arrivals, times
   and destinations: the town's buildings by their names in the game (the Colosseum, the Battle Tower, the bosses' homes and shops),
   **never the Hidden Boss or anything of his**. Times made up the way a board looks ("10:45", "DELAYED", "ON TIME"). Flaps flip now and
   then like a real board (cheap: a few characters at a time, not every frame). Nothing hidden, nothing shifts: the board keeps its size.
4. **Load first, never while walking** (Eric's rule): his home and lobby paint on the town's loading screen like every other building
   (`town/paint-jobs.ts`, the paint workers); the town's load bound and fps unchanged. Run the `@perf` town specs.
5. The #901 review's nits (`review/birdie-sounds` REVIEW.md): the determinism test that compares a cached array with itself, `trainToot`'s
   seed comment, the stale test-file name in `birdie-sounds.ts` comments, and the `cueSound` doc ("only through BossCharacter").
6. Prove: typecheck; the unit tests you touch; the town, shop and birdie e2e specs you touch (phone, and computer for layout); the boss kit
   if you touch his rules (you shouldn't). One still per platform: the station in the town, the lobby with the bartender, the board up
   close (stills on `stills/town-birdie-home`, never docs/). `e2e/areas.json` covers new files. Area pages and a short decision note.
   `.pr-body.md` (what changed, what players see, changed checks old → new), `.done`, push, stop. Don't open the PR.
Not in this job: his ride (a separate item job), his lines, his leaving admins-first.
Commits end with only `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR`.
