# The sprite kit, Smudgy its pilot (Nov 6, 2026)

- Eric, Nov 6: bosses stay 2D pixel sprites; "use Smudgy to test because in the battle intro he's facing the wrong way when the match starts".
- Cause: no figure said which way its art faces. His room's intro turned his town figure by his attack's art and, with no attack in it (the splatter is his), fell back to "faces right": he stood with his back to the table. On the board every left-facing boss stands left of the board, facing away from it.
- Call: facing is data on the kit (`Sprite.facing`); the room, the town and the board ask for a facing and the kit mirrors pixel for pixel. Smudgy's board figure now faces the board (our right) on phone and computer; his art, portraits and select stage are unchanged (pixel-diffed: 0 px).
- Alfil's room intro had the same cause (his attack faces right, his art left): fixed by one line of facing data (`sprites.ts`). The other left-facing bosses face away from the board on the board screen: they move when next touched.
- Ramps: 3 steps for a new sprite; Smudgy keeps his 4- and 5-step ramps, so his look doesn't change.
