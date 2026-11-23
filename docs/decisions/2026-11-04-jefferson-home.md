# Jefferson's warehouse and his challenge intro in the game (Nov 4, 2026)

Eric approved the whole build Nov 4 and wants it live overnight; Jefferson (kit `grex`) is live, so it goes to everyone. The art:
`claude/boss-art` at 0e4f6482 (`house-shop-grex` with its `warehouse-kit.ts`, `npc-grex` with its `giraffe-rig.ts`,
`sidekick-grex-dealer`, `boss-grex`, `house-intro-grex`; notes `shop-grex-nov4.md`, `intro-grex-nov4.md`), copied in as Wrangler's
and Hollow's were (imports moved, the room still and review sheets left there). The art's calls are kept (16 × 16 floor, the table
at (9.5, 10.5), crate stack 56 px and slab 59, your lift 32 px, the dealer in the north-east corner at 79 px, the crate on the floor
at (15, 3), the forklift facing east on two laps, the dozer's `wake`, all seven ring spots on screen, new sounds as listed).

## The calls

- **The crew are baked into sheets** (`scripts/bake-grex-crew.ts`, one PNG per figure, rows by animation, as the sidekicks are):
  painting their parts and drawing their 224 frames took about 0.75 s on a computer as the room loaded (three or four times that on a
  phone). The art's numbers the room needs (pallet on the forks, step-off, fork heights) are copied into the generated file. A test
  checks every sheet's pixels against the art. The dealer is baked with the sidekicks (`dealer.ts`; the sidekick count is 19).
- **Blocking** (Eric: "If you block it, it stops. If you move out of the way, it starts moving again"): before each square a machine
  looks at the square it's stepping onto and the one after it, and waits while anyone stands there. A step once begun finishes. The
  machines take their foot's square and the one they're stepping onto, and the forklift its forks' square too (east). The pallet on
  the floor takes its square. A tap walks you round them as they are now. If one moves into your way, you stop where you are (the
  Walker's new `peek`/`halt`), so you and a machine never wait on each other forever. The idle crew's squares are blocked.
- **The forklift's backing out of the shelf slot** keeps its forks up (the `set` or `lift` last frame held) until it has backed off,
  then lowers them (`lowerFrom`, `lower`): its drive frames are drawn at carry height, which would have dropped the forks mid-slot.
  After setting the pallet on the floor its forks come up empty (`forksUp`) before it backs home, for the same reason.
- **The machines are silent in the shop**, as every shop's pieces are; their cues are the intro's only. No server state: each client
  runs the loops from its own room's clock.
- **His intro stands you both on the marks** (his red plate, your lift's plate), no stools and no hop back: he stands, you ride the lift.
  He's drawn as the art drew him (not mirrored); his idle and attack as every boss's.
- **His call is one of four at random** (`BossIntro.lines`, `lineOf`), in the big bubble, placeholders until Eric's Gemini lines.
- **The crew's walk is timed to your lift**: they set off 0.4 s after the stop (each after the art's delay; the machine guys once off,
  the dozer once awake) and walk at 3.2 squares a second or as much faster as each must to be at his spot when your lift locks
  (never a third faster: a test). The routes are the mockup's waypoints (`CHALLENGE_FEEL.crew.via`), round the table's north side.
  The crew's steps are one clop at most every 90 ms (seven giraffes at once), a little random in pitch.
- **His brag comes before his attack** (as Wrangler's), so the attack runs on until the wipe has covered the screen, as every boss's.
  About 13 s from the marks to the wipe (Eric: 13 to 15).
- **His brag's laugh and stomp** are his crackle and his poof (he had no laugh or stomp sound); the table's slight wobble creaks
  softly (`grexCreakSoft`), its big one louder. The wipe's front plays his fizz as it starts.
- **The board on its crates is drawn by the intro from the walk in** (the room's stand hidden in his challenge): the same picture in the
  same place, so nothing swaps or pops. Its slab is 59 px up (the game's park table is 26, not the art's 27: your lift's 32 leaves the
  board 27 over your feet, within a pixel).
- **The warehouse is not a cave** though it has a floor's shape (no rock, no snow outside: the night lot's dark asphalt); its tall
  roll-up door goes see-through over you as the cave's rock does, as you'd be hidden behind it just inside.
- **Giraffe Gallop stays in `NO_CRATE_YET`** (crates.test.ts): that list means "in no regular crate" and every boss-crate ride is in it
  (Pen Pony, Hollow's Bulb); taking it out would fail the regular crates' check. It's in Jefferson's Boss Crate (`BOSS_CRATES`).
- **Frame rate** (headless, walking 5 s, median of 3; this shared machine): the warehouse against Wrangler's barn: phone 390 × 844
  28.0 against 26.1 fps (draw 38 against 34 ms), computer 1440 × 900 29.5 against 29.5 fps (27 against 28 ms), phone with the CPU
  slowed 4× 4.9 against 5.4 fps. Within the ~3 fps the brief allows, so no giraffe was trimmed.
