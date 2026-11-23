# Wrangler on the board faces the way he hops and what he acts on (Nov 17, 2026)

Eric, Nov 17: "have all the bosses facing the right way" (a boss faces the way it walks, or what it acts on). #774/#777 left Wrangler's own
figures on the board (`components/Pig.tsx`) with a hand-set flip that assumed his art faces right; it faces left (sprites.ts `ART_FACING`).

- **Seen frame by frame (`npm run frames:pig`, phone):** hopping back to his corner he was mirrored (snout right, going left: backwards);
  his showdown drop into the middle was unmirrored (snout left, going right: backwards), and he hauled with his back to the board.
- **Changed:** `Figure` takes the way he must face and the way the pose faces as drawn, and mirrors by the shared `mirrorFor`. Hops face
  the way he goes (`hopFacing`, his art's facing from `facingOf`); the wind-up keeps his landing's facing; the haul faces the board, its
  fists mirrored by `drawnX` (the left fist on screen keeps the crowd's ropes, so they don't cross).
- **Call made:** the lasso's facing is its throw's, measured from the art (`CATCH` lies right of his feet: the loop flies to our right, his
  eyes on it), so the loop still lands on the piece. His snout leans the other way in that pose (the throw is drawn across his body):
  turning that would mean redrawing the throw, Eric's call.
- Test: e2e/pig.spec.ts (the long pull: every frame, he faces the way he hops and the pawn he ropes).
