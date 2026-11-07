# Boingo's Funhouse inside: an arcade fun place (Nov 6, 2026)

Eric, Nov 6: "An arcade style … a spiral slide … netting three layers high … one of those half-dome spinny arcade games … roll-ball lanes on the wall … his shop like a prize store … his pogo stick as the centerpiece with a sign next to it saying how much it costs, and a light down on it … a claw machine … the water-squirt race game … it can be larger than the other rooms." No custom intro this round. Then: "the real claw machine in the room … Not a separate 2D overlay screen", and of the kit cabinet: "Claw machine is fine with new design … for now it's fine."

- **No brands:** generic names only ("roll-ball lanes", "the spinning light game", "the squirt race", "the prize counter"); the arcade he loved is a feel reference.
- **24 x 24 squares** (`RoomArt.n`; every other room stays 20), drawn in code in `CLOWN_PALETTE` under an arcade ceiling of bulbs; the animated pieces share one clock and their frames are drawn once as the room loads; every game's glow is a light at each placement.
- **The Shopkeeper** is a clown attendant (the clown kid's rig recolored, `funkeeper`), no name, not a town bot. Boingo's Boss Crate, his Pogo first; the pogo's sign reads the crate's price (`pogoSign()`), so it can't drift.
- **His challenge:** the default intro on his carnival mat, with a new line, "Step right up! Honk honk!".
- **The claw machine** is the kit cabinet at (19, 7): standing at its spot the camera glides in (`SHOP_FEEL.claw`); its coin slot opens the controls docked at the bottom; its claw only acts out the server's answer (`claw/view.ts`).
- **Frame rate (phone emulation, at the door):** 57 fps against Folio's 60 and Smudgy's 58 (a draw 18.5 ms against 13.8 and 13.4); at 4x CPU 8.6 fps against 11.6 and 12.9. The extra cost is the bigger floor (more floor triangles), not the animations; kept, since Eric allowed a bigger room.
