# Birdie's lobby round 4, fix round: the bar's arms one smooth counter, not three stepped slabs (Nov 23). Opus high, boss lane

Branch `claude/birdie-lobby-4` (no PR yet; push to it, never force). Start: `git fetch origin claude/birdie-lobby-4 main && git checkout -B
claude/birdie-lobby-4 origin/claude/birdie-lobby-4`. Read its `.pr-body.md`, `docs/decisions/2026-11-23-birdie-lobby-4.md`, the stills
`git show origin/stills/birdie-lobby-4:NOTE.md` (and look at `arm-west-close-phone.png`, `table-close-phone.png`, `room-phone.png` there),
CLAUDE.md, `.claude/LESSONS.md`, `docs/rules/eric.md`. Effort high: rendering.

**The problem (the director, checking the whole room in the game before Eric sees it):** each bar arm was cut into one piece per row, and
every room piece stands up at its own row, so each arm shows as **three stepped slabs**: a notched staircase along its top in the room's
usual view (`room-phone`, `table-close`: the jagged steps at the arms' back ends) and three separate walls side by side up close
(`arm-west-close`). Eric asked for the arms "risen" like the front run: it must read as **one continuous counter** with one straight top
edge and one continuous side face with its red stripe, the same height as the front run, from every camera (usual, close, side).

Fix it at its cause: make each arm **one** room piece spanning its three rows (`ShopPlace` has `d`: a 1 x 3 piece standing at its south
row, as other rooms' long pieces do; check how the room sorts a deep piece against the stools beside it and the run in front, and that
nothing behind it pokes through), or another way the room already supports. Don't redraw the art: cut it differently. Check the stools
along the arms still read in front of / beside the arm and the bartender and vat inside the U still show.

Prove: the room's unit tests (update the "arms stand on rows 1-3" check to the new piece, old → new); `e2e/birdie-home.spec.ts` and
`shop.spec.ts` Birdie's Station, phone and computer; the room bench once. Re-take ALL the stills on `stills/birdie-lobby-4` (same names,
plus `arm-east-close-phone.png`), and update its NOTE.md's lines for Eric's notes. Add a "Fix round" section to `.pr-body.md` (what changed,
changed checks old → new). `.done`, push, stop. Don't open PRs or wait on CI. Commits end with only
`Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR`. Never write the Hidden Boss's name. American English.
