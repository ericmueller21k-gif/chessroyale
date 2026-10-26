# Folio, the paper crane (a final boss)

Draw **Folio**: a paper crane, origami, folded from a single page of handwriting. It's one of the game's final bosses, so
it should feel quietly powerful and complete, while staying gentle, graceful and warm, never menacing. It's honest and
kind: it means its compliments, it never gloats, and it tells you the truth. It sits among the other bosses (a circus
tiger, a gingerbread man, a hippo gardener, a chameleon painter, a cow and the moon), so it should be just as charming
and readable at phone size.

## The look
- A classic origami crane, seen from the front and a little to the side (three-quarter view, facing our left, like the
  other bosses face the board), standing or hovering just above the ground with a soft shadow under it. The folds should
  read as folds: crisp straight edges, flat faces in two or three tones each, lit from the top left (light faces, shaded
  faces, a darker crease line where faces meet).
- Paper: warm cream and off-white, never pure white (it must sit on the game's dark ground with its halo). A faint
  warm-grey for the shaded faces.
- **Ink:** faint lines of handwriting across the wings and body, done as tiny squiggles in a soft sepia or ink-blue, not
  readable text (pixel art can't hold real letters at this size). They are what the page was before it was folded.
- A neck that rises in a long angle to a small pointed head with a tiny dark eye (one or two pixels) and a folded beak;
  a tail point opposite; two broad wings that can lift and fold. It should look like it could be folded from one sheet.
- A small touch of the game's gold (#f2c14e) only where it helps: a glint on an edge when it acts, never a crown.
- No logos, no robot or computer look, no glowing circuitry. Paper, ink, light.
- Size it like the other bosses (render shows it beside one at phone size): a big readable silhouette, wings that read
  even at 1x.

## The animations (each a few frames to a dozen or more; whole-pixel, true pixel art)
- **idle** (loops, calm, about 4–6 s): it breathes: the wings rise and settle slowly, the head dips once, a few ink
  squiggles on a wing fade in and out.
- **entrance:** a flat loose page drifts down from above, then folds itself in a few quick steps into the crane (flat
  page → creased square → bird base → crane), ending in its idle pose.
- **thinking** (loops): it tilts its head; ink words appear on a wing and fade, one line at a time.
- **move:** a wing sweeps forward and back (pointing the move), a small rustle.
- **capture:** it dips its beak and tucks a tiny folded paper shape under its wing (the piece it took, now paper).
- **hurt:** a crease bends in, the paper crumples a little at one edge, then smooths back.
- **check:** it stretches its neck tall and points with a wing; a short ink underline appears under it.
- **smug:** for Folio, "pleased", not smug: a small polite bow of the head, a soft gold glint along one wing edge.
- **rattled:** its wing edges curl and flutter, the ink lines smear a little, it steadies itself.
- **defeat:** it slowly unfolds, step by step, back into a flat page that settles gently to the ground (a graceful end,
  not a destruction).
- **victory:** it folds a tiny second crane from a corner of its page and sends it flying up and off (a gift).

## Quality bar
Look at every animation at 4x and the idle at phone size before calling done. The idle and the entrance matter most.
The folds must read as folded paper, not as a blob: clean straight edges, clear faces, the light consistent.
