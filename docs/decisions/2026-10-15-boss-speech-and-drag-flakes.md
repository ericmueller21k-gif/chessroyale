# Two flaky boss specs, root-caused: Sawyer's speech test and Wrangler's drag (Oct 15, 2026)

CI's first full runs flagged `e2e/boss-speech.spec.ts` (Sawyer's SPLIT PAWN!) on the phone and the computer, and
`e2e/pig.spec.ts:197` (Wrangler's long pull, then a lasso drag) twice. Each was traced to its cause before anything
changed. No assertion was loosened or skipped.

**Sawyer's speech test.** It failed two ways:
- **The God King's opening line was cut short:** "up whole and in view for 4202 ms of 5035, then none".
  - The spec made room for Sawyer's split by taking one of his pawns whenever it could, from move 1.
  - When that capture was a blunder, the God King's Last Stand fired during his opening line. His leap hides his
    words (`GodKingUnit`: `hidden={… leaping}`), as it should: he's on the board then, not in his place.
  - Reproduced directly on main: the bubble's last frame came 4.7 s in, the frame his leap began.
- **The split never came in 12 moves.**
  - The split waits for room for a ninth pawn of his, then for his next pawn move. Both depend on his brain, so no
    crowd play brings it on time.

The fix: the speech test times **Sawyer's saw cut** instead, his passive on turn 3 of every battle
(`BOSS_POWERS.sawFirst`), and plays the engine's best moves throughout, as it does for the other bosses. Best moves
never blunder, so the Last Stand never cuts into a line being timed. `sawyer.spec.ts` still checks the split and its
line.

**Wrangler's drag.** It also failed two ways:
- **"A drag within 6 turns" came back null.**
  - In the failing run (phone) the eval bar read 100% for White by move 8.
  - Against the engine's best moves, Wrangler on Maia at 600 falls apart. A game more than `DRAG_DECIDED` (4) pawns
    one way has no drag (`dragFrom`: its loss can't be read there), so none came.
  - The test now runs him on the Stockfish brain, an admin's test brain (`?brain=stockfish`, asserted from the debug
    line), at his own strength. Across 3 runs the game stayed within half a pawn and drags came on turns 3, 5 and 6.
  - Its failure message now lists each turn's eval and brain.
- **A sound never heard:** `pigTug` in one run, `pigThrow` in another.
  - A sprite plays a frame's cue sound as that frame is drawn (`SpriteAnim`). A slow frame on a busy machine jumps
    past a short one (the throw is 70 ms, the tug 60 ms), and that sound never played.
  - **This is a real bug** on any slow phone, not only in the test.
  - Now every frame passed over since the last drawn plays its sound, a moment late, never twice (`framesSince` in
    `components/BossEffect.tsx`; `packages/app/test/sprite-cues.test.ts`).
