# Fix round: Don Dough (PR #627, branch claude/boss-zebra). One round. Opus, high

Branch `claude/boss-zebra` (check it out at origin's head; main and the bakery, #626, are merged in; `npm ci`). Read `CLAUDE.md`,
include `notes/briefs/rules-common.md`, Eric's words `notes/zebra-eric.md`, and **the review: `git show origin/review/boss-zebra:review.md`**.

## Do
1. Every finding in the review (1-5 and the nit), each as the review says or better, each with a unit test that fails before it.
   Findings 1 and 2 are what Eric sees (the timer's ding and its roll after his move): show them in a short GIF (phone) on
   `stills/boss-zebra` (add to it).
2. **The bread splash** (Eric: "loaves of bread as the splash screen"): his challenge intro (`town/shops/intros/zebra.ts`) and his
   battle start use the art's bread splash (`zebra-props/splash.png` frames on `origin/claude/boss-art`, the notes `zebra-nov10.md`)
   as the wipe, the way other bosses' own wipes are wired (Ginger's, Folio's: see "Challenging a boss" in docs/areas/town-square.md),
   not the default wipe. And a crew line after his battle-start line (one of the art's battle-start pair: `zebra-openings-nov10.md`).
3. Local tests: the unit tests you touched, `e2e/zebra.spec.ts` and `e2e/zebra-home.spec.ts` (both projects). Node modules: link
   `@chessroyale/*` to THIS worktree's packages (a symlinked main checkout's node_modules resolves them to main's).

## Deliver
Push; append to `.pr-body.md`? No: write `.review-fixes.md` (a table: finding → fix → test) and push `.done` LAST. Wait for green CI.
