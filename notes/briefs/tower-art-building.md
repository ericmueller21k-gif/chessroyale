# Battle Tower art: the skyscraper in Chess Town, its lobby and clerk, and the floor room (Nov 19). Opus, high. API art run

**Eric, Nov 19 (his calls, settled):** the Battle Tower is entered **only from Chess Town**, never from home or a menu: "go into the
town and then going into the big building in there, and then you talk to the guy at the front, like, at the counter ... then you go
up and then it begins." It's **a new building** (Nov 18: "it's a giant skyscraper ... 99 floors", the same floor room redrawn each
floor, "Easy to program a loop"). He wants to see **the building itself** before anything is built. Art spend: "Just get it done"
(the usual $20 cap a run). Read CLAUDE.md, `notes/briefs/rules-common.md`, the design `docs/decisions/2026-11-18-battle-tower-design.md`
§4 (the room), `docs/areas/town-square.md` (the town's rows, lots, homes and shops), and an existing home + shop for the format
(e.g. `town/houses/folio.ts`, `town/shops/` and the matching `scripts/boss-art/out/house-shop-*`).

Branch `claude/boss-art` (pull with `--no-rebase` before each push; never force-push). **Art by the API runner** (scripts/boss-art,
`BOSS_LINES_API_KEY` in this environment: never print it); ask Eric once for the run as the runner does, with its estimate. Art only:
no app code (PR 11 wires it after Eric approves). Stills on an orphan branch `stills/battle-tower-building` (never on the work branch).
1. **The outside, in the town:** a skyscraper in HunChess's own palette (not a boss's), clearly the tallest thing on its street, its
   top lost toward the sky (99 floors), a sign "BATTLE TOWER" over a glass front door. Pick a free lot that fits (say which, why, and
   that it keeps the town's walks and the Colosseum's plaza as they are); drawn as the town's other homes are (its front on the row,
   the facing, the scale), the whole of its base on screen at the town's zoom.
2. **The lobby** (a room like the boss homes' shops, 37 px squares): a counter with **the clerk** (a new character: a calm
   concierge/bellhop in HunChess colors, never a boss's kid, "Clerk" tag, Talk), an **elevator** door at the back (the way up), the
   floor's chess-tile look, a board of "Best floors" on a wall (empty frame, PR 10 fills it). Nothing else.
3. **The floor room** (design §4): snug, a center circle, a plain board and two chairs in HunChess colors, the floor number big on
   both side walls ("4"), a door at the top the bosses come out of (here: the elevator's doors), you come in from the bottom.
Stills for Eric (phone 428 x 746 and computer 1440 x 900, about 6 in all): the street with the tower, the lobby with the clerk, the
floor room with a "4" (and one with "57" to show two digits fit). Report the API $ spent. Done: an empty `.done` on branch
`claude/tower-art` (from main, nothing else) and push; end. No PRs, no CI waits.
