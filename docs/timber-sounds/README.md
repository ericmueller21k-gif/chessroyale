# Timber's sounds (for Eric to listen to)

Timber, the beaver builder, had no sounds of his own: his select sound was Big Boy's toy block (`bigboyClack`) and every cue in
his kit borrowed another boss's. These are his own, all wood (Eric, Nov 2: "a gnawing wood sound… Wood knocking, cutting,
saw, thumping"), synthesized in `packages/app/src/characters/timber-sounds.ts` like the other bosses'. Each file is 16-bit mono,
44.1 kHz, rendered from the game's own code (`npx tsx scripts/timber-sounds-wav.ts`), at the level it plays in the game (about
4 dB under a piece's move on average, like Big Boy's and Sawyer's).

| File | What it is | Where it plays (his cues) |
| --- | --- | --- |
| `select.wav` | The gnaw (the same as `gnaw.wav`) | His select sound on the Boss raid screen |
| `gnaw.wav` | His buck teeth rasping at a log, stroke after stroke, chips flicking off | Select; the first of his town taps |
| `saw.wav` | A hand saw: three strokes through a board (by hand: Sawyer owns the motor saw) | The second of his town taps |
| `knock.wav` | A knuckle's knock-knock on a board | `point` (check: a firm point of the hammer); the third of his town taps |
| `chomp.wav` | One big bite through wood: a crunch, a crack, splinters | `chomp` (the Gnaw's four bites) |
| `clack.wav` | His teeth clacked together: two quick little clicks | `clack` (the Gnaw's warning) |
| `burp.wav` | A little creaky burp and a puff of sawdust | `burp` (the end of the Gnaw) |
| `pat.wav` | A paw's soft pat on his hard hat | `pat` (entrance, hurt, after a build) |
| `tap.wav` | His hammer tapping a peg in: a sharp wooden tok and a little bounce | `tap` (entrance, move, check, a scrap hammered in) |
| `whack.wav` | A big hammer whack into wood, chips flying | `whack` (capture, his strike on a piece) |
| `thump.wav` | A heavy plank set down hard / a beaver landing on the boards | `stomp` (entrance landing), `thump` (defeat: he sits down hard) |
| `clatter.wav` | Planks and tools spilling and settling | `clatter` (defeat: his tools spill) |
| `slap.wav` | His flat tail slapping the boards | `slap` (victory, big cheer) |
| `swoosh.wav` | A plank or his hammer swung through the air | `drop` (entrance fall; a build's plank swung down), `whoosh` (the hammer twirl) |
| `slide.wav` | A plank slid up out of its strap | `pull` (build) |
| `chitter.wav` | His happy beaver chitter | `cheer` (a piece landed, big cheer, victory) |
| `hup.wav` | A proud little "hup!" | `show` (build: the plank shown off overhead) |
| `oof.wav` | A gruff "oof" | `oof` (hurt, defeat) |

Every cue keeps its name and its moment in his animations; only the sound it plays changed. Any one can be swapped or
retuned in `timber-sounds.ts` (or a cue pointed at another of his in `characters/kits.ts`).
