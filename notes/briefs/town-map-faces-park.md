# Town minimap: faces cut off, and the park (Eric, Nov 27 ~06:15 UTC)

Read `notes/briefs/rules-common.md` first, then CLAUDE.md, `.claude/LESSONS.md` and `docs/areas/town-square.md` (or the town's area page).
Branch `claude/town-map-faces-park` from main. Targeted lane (light where it's only numbers). Opus, effort medium. Hub/town lane.

Eric (with a screenshot of the large map, the director has it: tell the director to send it if you need it): "zoom in and have a look at
these things. Chandy and I guess it's mostly Chandy, but he's completely out of the frame, and so is who's ever to the left of him. So
some of these are just a bit off. And where the town is on the minimap, I think we should just put a couple little chessboard
indicators on the minimap to know. Or we should actually just get rid of that tree... we need to know that's the park... if I click on
that tree, nothing even happens. So if I click on it, it should bring me to the park maybe?"
In his shot, in the bottom row of portraits, the third (Chandy's, white ring) shows only a sliver of him; the one to its left is off too;
the door/sign chips (the Walk-up, the Battle Tower, Rolling Dough) and others are slightly off-center.

1. **Every face on the large map whole and centered:** the large map's portraits come from `r.chipFace(h)` with the hand-set crops in
   `BOSS_FACE` (`packages/app/src/town/render.ts` ~:103), the same boxes the town's edge chips use. Find why Chandy's (and his left
   neighbor's) are off (likely the art changed under its numbers: CHANDY_TOWN), fix them, and check every home's face on a picture of
   the large map (phone 390x844 and computer 1440x900). Fix the cause so this can't drift again cheaply: e.g. derive each box from the
   figure's own painted head where a module already exports a head/portrait box, or keep the numbers next to the art they crop. Don't
   add a separate checker for it (Eric's "fix the cause" rule).
2. **The park on the map:** replace the tree icon (`ParkIcon`, `packages/app/src/town/TownMap.tsx` ~:203) with a small chessboard
   icon (a few squares, the park's chess tables: same size and ring style as the Colosseum's icon), and make a tap on it close the map
   and walk you to the park, as a tap on a boss's portrait walks you to its home (`walkHome`/`destFor` in Town.tsx ~:3065: add the park
   as a destination the way a tap on the park in the town would take you). The small corner map keeps its look.
Tests: one focused check in the town's existing e2e (the large map: a tap on the park icon walks you to the park) and, if you derive the
boxes, its unit test. Typecheck, that spec (phone). One still per platform of the open large map on branch `stills/town-map-faces-park`.
`.pr-body.md` (at most 40 lines), a 5-line decision note, the area page updated, then `.done`.
