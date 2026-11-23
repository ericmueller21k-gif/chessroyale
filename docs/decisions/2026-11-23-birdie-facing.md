# Birdie faces the table in his building (Nov 23)

Eric: "He's facing the wrong way in the building." Birdie's town figure is `birdie-town` (birdie-figure.ts BIRDIE_TOWN), and
`artFacing` (sprites.ts) knew only `birdie`, so the room and the town square took his left-facing art for a right-facing one and
never mirrored him. Call: `artFacing` reads a `<id>-town` figure as its character (one place, covers every beat, the town square and
any later town figure, e.g. Chandy's once his facing is known), rather than a second `birdie-town` entry.
