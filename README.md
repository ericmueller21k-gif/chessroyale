# Battle Tower art: the building, the lobby and its clerk, the floor room (Nov 19)

All art by the API art runner (branch `claude/boss-art`: `scripts/boss-art/out/house-tower`, `sidekick-tower-clerk`,
`house-shop-tower`, `house-shop-tower-floor`). The stills are the real game (a throwaway local wiring, nothing committed to the app):
phone 428 x 746, computer 1440 x 900, town sky "day".

| # | still | what it shows |
| --- | --- | --- |
| 1 | `1-street-phone.png` | The tower on Colosseum Row, in front of its glass door; the game writes "BATTLE TOWER" on its sign |
| 2 | `2-street-from-park-phone.png` | From the park: the tallest thing in town, its top off into the sky |
| 3 | `3-street-computer.png` | The same front on a computer |
| 4 | `4-lobby-phone.png` | The lobby: the clerk at the counter ("Clerk", Talk), the elevator (the way up), the empty "Best floors" board |
| 5 | `5-lobby-computer.png` | The lobby on a computer |
| 6 | `6-floor-4-phone.png` | The floor room, floor 4: the circle, the table and chairs (the game's own, recolored), the elevator the bosses come out of |
| 7 | `7-floor-57-phone.png` | Floor 57: two digits fit |
| 8 | `8-floor-57-computer.png` | Floor 57 on a computer: the big number reads on both side walls |

## The calls (for Eric)
- **The lot:** Colosseum Row's north side, columns 45-48, between Dash's Kicks and Seam Avenue. It was lot ground already, so the
  walks, streets and the Colosseum's plaza don't change; on the back line it rises over the back wall and shows from most of the
  town. The street lamp on its door square goes (your no-lamp-in-front rule).
- **The tower:** Art Deco in slate and gold (the app's colors), a chessboard frieze over the lobby; its top thins out into the sky
  (it melts into whatever sky shows, day or night), so no roof is ever seen.
- **The clerk:** a penguin bellhop (black and white like the pieces, gold cap and bow tie): nobody's kid.
- **The floor number:** big on both side walls as asked. On a phone the side walls are seen almost edge on (stills 6-7), so it's
  also on the back wall either side of the elevator. Say if you'd rather have only one of the two.
- **The board and chairs** in the floor room are the game's park table recolored slate and gold, as the design says.

## API spend: $10.20 of the $20 approved
Tower front $1.52 · clerk $2.28 · lobby $2.35 · floor room $1.35 (a turn ran out of room: nothing written) + $2.18 + a fix pass $0.52
(the game ignores mirrored floor tiles, which broke the circle; the number added to the back wall).

## For PR 11 (wiring), noticed while making these
- Floor tiles must not use `flip` (the game ignores it on floor tiles); the art now uses `rot` only.
- The clerk wants `tall: 57` (his art's size) so his face and bow tie clear the 30 px counter; his tag and card say "Clerk".
- A 1 px see-through seam shows right of the elevator at some widths (a 2-wide piece butted against the next; the art's pixels are
  solid there).
- The tower's box: base x 4-139 up 90 px, shaft x 12-131, setback x 24-119 from 350 px; solid to 458 px over the foot, the dissolve
  above (the art's summary has the rest). The floor room's walls: `towerFloorWallGrid(west, run, floor)`, `towerFloorPieces(floor)`.
