# The town square: two statues by the Coliseum, a close-up and a quote (Oct 26, 2026)

## Eric's words (Oct 26)

- On the bronze statue: "We don't need permission, I verified it. We aren't using his name anywhere. Yes please take
  another pass at his face and hair, remove the arm it looks dangerously close to a certain salute if you know what I
  mean."
- "I wanna do this for both of them, when you walk up to their statue it zooms in close and on the statue their quote
  renders in on the structure supporting their statue, here is [his] … 'Concrete considerations always take precedence
  over general principles'. Zooming in also always a better render of the statue to come into view."
- Then the marble statue's quote: "Nothing is so healing as the human touch".

The real person the bronze statue depicts is never named: not in the game, the code, the tests, the docs, the commits or
the PR. In the code it is `bronze`, "the bronze statue"; the other is `marble`, "the marble statue" (the Hidden Boss in
stone). Neither statue, pedestal nor plaque carries a name, and no name floats over either.

## What's built

- **Two statues on the Coliseum's front**, one each side of the gate, symmetric, each on a pedestal of its own
  (`town/houses/statues.ts`): the marble statue on the gate's left, where the empty plinth stood since slice 5, and the
  bronze statue mirroring it on the right. Each stands before its ground's end column (`STATUE_OFF` in `coliseum.ts`,
  from the ground's size), so the apron square right in front of it (`STATUES` in `world.ts`: (17, 15) and (22, 15)) is
  where you stand to look at it.
  - **The pedestal**: 52 × 44 Coliseum pixels (a chess piece's plinth is 26 × 14): a base, a tall die, a cornice; a
    panel on its face for the quote. The marble statue's is marble with a sunk panel (the quote engraved); the bronze
    statue's is the Coliseum's stone with a bronze plaque, riveted (the quote cast in it). Blank in the world: the quote
    renders in up close.
  - **The pieces shifted** to make room, nothing removed: from the gate outward, the bronze queen, the marble statue, the
    marble bishop and the marble rook on the left; the bronze king, the bronze statue, the marble knight and a marble pawn
    on the right; the other marble pawn stays at the back left corner. The picture grew from 320 to 352 pixels wide (the
    building itself is unchanged). Nothing covers the gate or its tablet.
- **The bronze statue, a second pass on the face and hair, and the new pose.** Tall and lanky, a long face with full
  cheeks (not gaunt) and a rounded chin, strong straight brows over deep-set eyes, a long straight nose, a warm closed
  smile; short curly hair, a round, bushy mass hugging the head, low over the forehead, close at the temples (each curl
  lit on the light's side only); a button-down shirt, its collar open, a pocket. **No raised arm**: both arms hang
  relaxed at his sides, nothing at shoulder height or above. His right hand (our left) holds a small knight at his hip
  (polished bright, as hands polish a statue's lucky charm; its own outlined part so it reads against his arm; at the
  world's scale it's left out, a fist); his left hand hangs easy.
- **The marble statue's fixes**: a cool grey-white marble a step darker than the pieces' (it was low-contrast against the
  cream wall), and his tie cut a full step darker, its right half deepest, so it shows at the world's scale too.
- **Two levels of detail** for each: the world's figure (1 pixel a Coliseum pixel; the head typed by hand) and the
  close-up, the same figure drawn 4 times finer (`CLOSE`) with its carved detail (curls, eyes, buttons, the book's
  letter, the knight). Both cached; the close-ups are made ahead, a slice a frame (at most 4 ms of painting, or one layer
  drawn), starting 1.5 s after the page opens (or at once for a statue the camera is coming in on): the close-up is
  about 180 × 400 pixels, and making it in one go cost 200 ms on a computer. `sculpt` itself got about 4 times faster
  (each shape's box skips it where it can't be; each piece's run along a row is worked out once a row), with the same
  pixels.
- **Walking up zooms in.** When you stop on a statue's square (walked there, or by tapping the statue, which walks you
  there; if someone stands there, a tap on the statue ends you beside it and still brings the close-up), the camera
  glides in close on the statue and its pedestal over 900 ms (eased at both ends): a longer lens (`mag`, `oy` in
  `camera.ts`: the world magnified about the lens's middle, so it keeps its shape and nothing else changes), its power
  rising evenly (M to the power of the glide), the camera's focus on the statue's square. Up close the statue and its
  pedestal fill the box from 4% down to 95% (or 10 pixels above the − / + and "Back to me" buttons where they'd meet),
  at most 92% of its width. The close-up drawing crossfades in over the middle of the glide (the world's figure fades
  only once the close-up covers it, so the wall never shows through).
- **The way back.** A tap anywhere else (it walks you there, or opens what you tapped), a drag, a chip, −, + or "Back to
  me" (or Escape) glides back out over the same 900 ms to the zoom you had: the − / + zoom is never touched by the
  close-up. − and + also set their own zoom, as they always do.
- **The quote renders in** on the pedestal's panel once the camera has arrived, word for word, in the signs' pixel
  capitals (`sign-font.ts`, the lettering the game writes on every sign in the square), wrapped to the panel at the
  biggest whole size that fits (15 CSS pixels tall on a phone and on a computer), engraved in the marble (dark letters,
  their lower edge lit) or cast in the bronze plaque (light letters, shadowed): line by line, each line fading in over
  320 ms, 140 ms after the one above; it fades out over 200 ms when you leave. For screen readers the quote is also in an
  off-screen live region (`.town-sr`, `aria-live="polite"`) while you're there.
- **Nothing hidden, nothing shifts**: the back button, the zoom pair, "Back to me" and the chips stay where they are;
  only the world's camera moves. No chip covers the statue up close.

## Judgment calls

- **The close-up is a lens, not a moved camera**: the pitched camera stays where it is and the view narrows. Pictures in
  the square are upright billboards, so moving the camera down and in would only change the ground under them; a lens
  is two numbers, leaves the world's shape alone and can't upset the rim, the haze or picking.
- **You fade out up close** (and anyone else standing in front of the statue): your pawn stands on the square right in
  front of the pedestal and would cover the quote. It fades as the camera comes in and back as it leaves; taps pass
  through a faded pawn. The bots never stop on a statue's square (it's kept free to look from).
- **The quote is in capitals** (the signs' lettering has only capitals); the words are the quotes' own, word for word,
  with no attribution; the live region has them as given. On a short laptop window (about 1280 × 600) the panel holds
  them only at 10-pixel letters on a 1x screen; on phones and full-size computer windows they're 15 pixels.
- **The Coliseum's background up close** stays the world's picture (big pixels) behind the finer statue: drawing a
  finer wall too would be a second Coliseum for one view.
- **The bronze statue's knight**: the brief allowed a small chess piece at hip height or a hand in a pocket; a knight
  in his fist at the hip, polished.
- **Placement follows the Coliseum**: the statues' places, their squares, the pieces beyond them and the frame's width
  come from the Coliseum's ground size and the pedestal's width; the close-up's framing and the quote's layout come from
  the statue's drawn box and the panel's, so a bigger Coliseum (slice 6) carries them along.
- **The empty plinth's brass plate is gone** (the plinth is now the marble statue's pedestal); `plinth` lost its `plate`.

## Numbers (all in `TOWN_FEEL`, `feel.ts`)

`closeGlideMs` 900, `closeTop` 0.04, `closeBottom` 0.95, `closeAboveButtons` 10, `closeMaxWidth` 0.92, `closeSwap`
[0.45, 0.8], `closeReadyFadeMs` 250, `closeNearFade` 1, `closeBuildAfterMs` 1500, `closeBuildBudgetMs` 4, `quoteFadeMs`
320, `quoteLineMs` 140, `quoteOutMs` 200.
