# The Stranger: swords and strikes (Eric, Nov 27 ~03:30 and ~05:20 UTC)

Read `notes/briefs/rules-common.md` first. Starts after #1000 merges (his kit in BOSS_KITS, admins first). Branch `claude/stranger-swords`
from main. Lanes: characters (art, animation) + the boss bar/board timing. Effort high (animation and timing). Opus. Boss lane.

Eric's words, in his order:
- "every few moves he draws his swords" (an idle flourish now and then, on his own).
- "when he captures your piece, he draws his swords and does like one of several different slashing animations".
- Clarified (~05:20): when he captures one of your pieces **that isn't a pawn**, "he jumps down and does either like a flame strike...
  or a literal strike with a sword... one of them could be he cuts the piece in half... something that uses maybe some ice or some fire,
  or cuts the piece, or does a combination of that." He picks one at random. "it can be like a 5-second thing where he jumps down,
  strikes it, and then the piece, after it disappears, [his] piece captures it... the piece can't disappear without our piece capturing
  it... drawn in a way where he strikes it, the piece disappears, and then... we move our piece." So: his move is an ordinary capture,
  shown as his leap onto the board, the finisher on the target square, the piece gone, then his piece slides onto the square.
  - The director's call: a pawn capture gets the in-place slash (one of several), no leap.
- "when you capture one of his [pieces, not a pawn], he takes them out and blocks... he kind of took a blow... knocked... trigger it
  right when you capture one of his pieces."
- Sounds: "the God King different sound pack... me recording them... let's give him all of those... have him pick between those. So
  when he does like one of his strikes, he makes one of those different sounds as well." = `gkShout1..4` (`/sounds/god-king/shout-*.mp3`),
  one at random per strike/slash.
- NOT his ultimate: Eric is still deciding it. Leave `strangerult` alone.

Build it simply (Eric's "simple beats flashy"): reuse what exists (the boss's move hold before a move shows, other bosses' over-board
moments, the effect layer, BossCharacter's beats `capture`/`hurt`). Same on solo and online (the move's reveal timing must stay in sync;
the boss clock never runs out). Finishers: at least three (flame, ice, a clean cut), plus a fire+ice combo if cheap. Keep every frame
whole on screen (Eric's guard, boss-side.spec), his reach tables honest (side-size.ts) and the phone frame rate (frames:boss with real taps).
Tests: the boss kit, a unit test for which capture plays which moment, his e2e (a non-pawn capture shows the strike, then the move; a
capture of his knight shows his block). Stills on `stills/stranger-swords` (a GIF of each finisher, the slash, the block; the phone and the
computer). `.pr-body.md` at most 40 lines, then `.done`.
