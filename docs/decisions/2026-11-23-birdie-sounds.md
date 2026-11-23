# Birdie's voice and his train's move sound (Nov 23, 2026)

Eric: "he chirps throughout the game basically, and also when like you go to challenge him"; "the little train sound ... when he goes across the board ... a couple different lengths".
- All eleven built in code (`birdie-sounds.ts`) from the music helper's recipes; they match the files by length, envelope (0.98 to 1.00) and spectrum, so no mp3 ships. His placeholder coo, oof, roll, flutter and toy horn are gone (his `toot` is now the train's whistle).
- The run is picked by how far his piece goes (one square short, two to four medium, five or more long): the piece's slide (220 ms) and his move animation are the same length every move. Toot run on a capture or check.
- His chirp plays 90 ms over the run's start (320 ms for Armored Birdie); both together stay under a move. Armored Birdie gets the same, his armor's clank kept for his return.
- No chirp while he thinks (Eric's Oct 10 rule, boss-kits.test.ts): `ask` is in his idle chatter, which, like his smug teeoo, plays only on your turn (`cueSound`'s `yourTurn`).
- His ride: the long run from his depart to the ride's end, then the medium as he rolls back in. His fall's whoosh played twice (his empty spot's cue and the cutscene's): his is silent now.
