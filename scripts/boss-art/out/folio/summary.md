# Boss art: folio

- Model claude-opus-5-5, effort high, adaptive thinking. 38 turns, 35 renders.
- Spend: **$3.79** of the $20 cap (80 input, 244,934 cache-write, 4,755,190 cache-read, 80,845 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/folio/folio.ts.
- Previews: scripts/boss-art/out/folio/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/folio/looks/.

## Its notes

Folio, the paper crane, is finished. I've looked at all 11 animations at 4x (or 2–3x where several frames share the strip), and the idle at phone size beside the tiger and the gingerbread man. No frame touches the edge. The idle and the entrance came out strongest. The tiny crane in the victory is only 13×9 pixels, so it reads as a small paper bird and not much more. The file is scripts/boss-art/out/folio/folio.ts, exported as FOLIO.

The look: Folio hovers about 7 px above a soft shadow, three-quarter view facing left. Every fold is a flat polygon in its own tone (light, mid, shaded, plus a darker crease line), with a cream highlight on the edges facing the top-left light. Faint sepia handwriting runs across each face at its own angle, so it reads as one written page that's been folded. The head is a small folded beak with a 1-px dark eye. The frame is 97×92 with the feet at (52, 86), and every pose is just numbers: wing tips, neck tip and head angle, tail tip, a crumple amount and an ink-smear switch.

Animations, beat by beat:
- idle (loops, 4.8 s): two slow breaths, the wings rising 3 px and settling as the body lifts 1 px. The head dips once, and a line of sepia writing fades in on the near wing and out, then another.
- entrance (2.7 s): a loose page drifts down, rocking (cue "rustle"), and settles upright over its growing shadow. Then it folds (cue "fold"): creased square, bird base, then the neck and tail tucked into one point under the body with the wings closed up. The neck and tail swing out and up, the head folds down, the wings open, and a gold glint runs up the near wing's edge before the idle pose.
- thinking (loops, 3.2 s): the head cocks up and back. Three lines of ink-blue writing appear on the near wing one at a time, then fade together as the head comes down.
- move: the near wing sweeps up and over and points forward-down toward the board (cue "sweep"), holds, then sweeps back with a little shiver (cue "rustle").
- capture: the beak dips to the board side and comes up holding the taken piece as a tiny folded paper pawn (cue "pick"). The neck curls in, the near wing lifts, and the pawn is slipped underneath (cue "tuck") as the wing settles.
- hurt: the near wing's trailing edge crumples into a zigzag with creases running in, its tip folds over in a darker flap (cue "crumple"), and the bird shudders. Then it smooths back out (cue "smooth").
- check: the neck stretches tall, the near wing points at the board, and an ink-blue underline draws itself along the ground under Folio's front (cues "stretch", "ink").
- smug ("pleased"): a small polite bow of the head, a soft gold streak running up the near wing's edge (cue "glint"), and a sparkle at the tip.
- rattled: the wing edges ripple and flutter (cue "flutter"), the ink runs a little, it shivers, then steadies with the head dipped.
- defeat (4.1 s, slow): the wings close, the head unfolds, the neck and tail droop and then hang (cue "unfold"). Then the bird base, the square, the flat page. The page tips back, drifts down and lies flat on the ground (cue "settle"), held 1.4 s.
- victory: a sparkle at the wing tip (a corner of its page), then a tiny square at the beak folds into a kite and then a tiny crane (cue "fold"). It's sent off (cue "launch") and flaps up and away while Folio watches with its head up. It ends as a gold glint, then Folio gives a small bow.

Choices you might want to change:
- Size: Folio is wider than the tiger (97 px frame against 76), because the wings are broad. It's light on the screen because the shapes are thin, but I can scale the geometry down.
- Ink colours: the writing on the page is sepia, the words that appear while thinking are ink-blue, and the check underline is a lighter blue so it shows on the dark ground.
- Gold: it appears only as glints (wing edge, fold sparkles, the departing tiny crane), never as decoration.
- Tiny crane: in the victory, at this size it reads mainly by its flapping.
- The "hanging point" step: in the entrance and the defeat, the neck and tail briefly hang down as one point under the body. It's the busiest-looking transition frame (160 ms in the entrance) if you'd rather drop it.
- Pointing wing: in move and check the near wing swings in front of the lower neck, which hides part of it while it points.
- Defeat ending: the page lies flat on its shadow, so the shadow barely shows in the last frame.
