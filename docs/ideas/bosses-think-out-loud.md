<!-- Kept in the repo Oct 31, 2026 (the director's notes since Oct 24). Not built, not queued. -->

# Bosses think out loud (Eric, Oct 24): design notes

## Eric's words
- "each boss should have some more lines… every so often before it plays a move, show like how the engine is thinking, but make
  it… how the boss would sound… they would all kind of sound similar, but have their own personality… like, oh, I want to capture
  his bishop, but then I'm leaving my rook hanging… original lines, based on like what moves the engine is considering. We don't
  want them to just be like the exact same… if you play a move that puts you… in a certain position, sometimes the boss might call
  you out… I see you're trying to go after my… queen."
- "it doesn't need to be… super forced… the tiger, for example… he captures your bishop, or like your horse, then he could say…
  I'm saving him from the circus, or… another animal freed… the hippo could just be like, this piece will look perfect in my
  garden… I think we could probably come up with a lot more for these guys." (He'll send more examples.)
- The bubble: longer lines are fine, about two balanced rows (the bar job).

## The plan (director)
- **Same thought on every phone:** worked out from the board itself (the position before his move, his move, the move you just
  played: captures, what each capture would leave hanging by a simple exchange count, attacks on his queen/rook/king, pins, forks,
  checks), never from each device's engine; picked by a hash of the moment, like today's lines.
- **Kinds:**
  1. **Tempted, but no** (before his move): a capture he could make that would lose material ("That bishop looks tasty… but my
     rook would be left hanging.").
  2. **Free lunch** (as he takes something you left loose): the boss's own capture lines, by the piece taken (Eric's examples).
  3. **Call-outs** (on your move): you attack his queen or rook ("Going after my queen? Bold."), you check him, you pin, you fork.
  4. **His own fork / double attack** (after he plays it, so it's on the board): "Two birds, one knight."
  5. **Trades** he offers; **mood** by material (ahead: smug; behind: "not ideal…").
- **Frequency:** a thought before about 1 in 4 of his moves, never two in a row; call-outs only on the moment itself; one bubble
  at a time; never over his powers' moments; the same rule for every boss.
- **Fair play:** only his own options and the move you already played; never your best next move; nothing that a player can't see
  on the board. The Hidden Boss is left out at first (his line rules: never "Soviet(s)/Russian(s)", nothing implying Korchnoi threw
  games, real quotes verbatim only).
- **Lines:** templates with the piece names filled in, several per kind per boss, each in his personality; a helper drafts them,
  the director edits every one before it ships.

## Capture lines: ideas to build on (director's drafts; Eric's first)
- **Babur** (bored retired circus tiger): a knight: "I'm saving him from the circus." / "Another animal freed." A rook: "No more
  towers to jump off." A bishop: "Shh. Don't tell the ringmaster." The queen: "The star of the show. Retired."
- **Puddles** (patient hippo gardener): "This piece will look perfect in my garden." A pawn: "A little garden gnome." A rook: "That'll
  make a lovely trellis." The queen: "Prize of the county fair."
- **Moo & Moon:** a knight: "Back to the pasture, horsey." "The moon wanted that one."
- **Smudgy** (chameleon painter): "Hold still. I'm painting you out." "You'll make a lovely still life."
- **Sawyer** (raccoon with a saw): "Finders keepers." A rook: "Timber!"
- **Wrangler** (cowboy): a knight: "Fine horse. I'll take it." "Roped one!"
- **Alfil** (mammoth): a bishop: "Only room for one elephant on this board."
- **Chub & Chirp:** a knight: "Leapfrog beats horsey."
- **Big Boy:** "Mine!" "Into the toy box."
- **Boingo the Clown:** "Honk! Gone."
- **Ginger, Jefferson, Hollow:** to draft in their voices.
