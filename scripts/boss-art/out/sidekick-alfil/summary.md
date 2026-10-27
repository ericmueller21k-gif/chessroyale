# Boss art: sidekick-alfil

- Model claude-sonnet-5-5, effort xhigh, adaptive thinking. 38 turns, 34 renders.
- Spend: **$3.50** of the $20 cap (78 input, 320,833 cache-write, 6,746,723 cache-read, 135,012 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/sidekick-alfil/sidekick-alfil.ts.
- Previews: scripts/boss-art/out/sidekick-alfil/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/sidekick-alfil/looks/.

## Its notes

Drawing: scripts/boss-art/out/sidekick-alfil/sidekick-alfil.ts, exported as `sidekickAlfil`, id "sidekick-alfil". The frame is 64x54 with the ground at row 51. It stands about 43 px tall, outline included, which is roughly 57-60% of Alfil with his ankus, and it uses the same outline weight and level of detail as Jefferson's sidekick. All 14 animations were rendered at up to 6x and checked. Idle was also checked at phone size beside Alfil, and sit on a light background. The last render of every animation had no edge warnings.

Look:
- Alfil's browns (a to f), his pale ivory toenails and his gold.
- A big head with a high shaggy dome of hair on the back of the skull (the mammoth cue), bangs, a pink-lined round ear, big shiny eyes with blush, a short ringed trunk, and tiny ivory nubs either side of it.
- A round woolly body with a pointed-lock fur skirt over four stubby legs, and a thin tail with a tuft.
- The one prop is a small red and blue cap: red dome, blue band with a gold diamond, gold rim and button, plus a gold tassel that swings.
- It stands on all four legs and has no angry brows.

Animations, beat by beat:
- **idle** (24 frames x 125 ms = 3 s, loops): it breathes with a 1 px bob every 0.75 s, and its head drifts 1 px. The trunk curls and uncurls (hang, curl, tight curl, back). It blinks twice, an ear flaps up once and down once, the tail flicks once, and the tassel nods.
- **walk** (6 x 100 ms = 0.6 s, loops): diagonal-pair plod, with leg shift and lift per pair. The body bobs twice per cycle, the head dips, the trunk swings between two curls, the ear drops on the down-beat, the tassel swings, and there is a "step" cue.
- **sit** (16 x 200 ms, loops): it sits up on its haunches on a wooden stool, body tilted, hind and fore legs dangling over the seat's front edge and swinging 1 px. Slow blinks, a leaning "think" stretch (eyes up, trunk curled to its chin) in the middle, a tail swish, an ear drop. The cap stays on, so its one prop is not set down.
- **wave** (13 frames, 1.22 s, once):
  - It crouches happy, then lifts its trunk with its ears up.
  - It raises the trunk beside its face, tip curling out, and sways it eight times with a grin. The tassel swings, a toot of gold lines pops off the tip, and there is a "toot" cue.
  - It lowers the trunk, then settles into the idle pose (calm, trunk hang1).
- **entrance** (11 frames): a shadow grows, it drops in with its ears up, lands squashed with dust, bounces, toots and waves its trunk left and right, then settles.
- **thinking** (12 x 150 ms, loops): eyes rolled up, head tipped, trunk curled to its chin, a foot tapping, and thought bubbles that grow one at a time.
- **move**: a crouch, a hop forward with its trunk reaching out toward the board, a landing with dust, then a settle.
- **capture**: two excited hops with its trunk high, happy-arc eyes, hearts and twinkles, then a smug settle.
- **hurt**: a white flash, eyes squeezed shut, tufts of fur flying off, the cap knocked askew, then wide eyes, a blink and a brave smile.
- **check**: two sharp trunk-points at the board with toots, then smug.
- **smug** (loops): half-lidded eyes, a smirk, chin up, a slow nod, trunk curled.
- **rattled** (loops): wide eyes, worried brows, trembling, ears flared, sweat drops.
- **defeat**: a flash, X eyes and a wobble, then it plops onto its belly with the cap askew and the trunk limp on the ground. Dizzy stars circle over it, and the last frame holds for 1 s.
- **victory** (loops): hops with its trunk high, happy eyes, hearts and twinkles.

Choices Eric might want to change:
- **Cap:** it sits flat on top of the head, and the tassel hangs from the cap's back-left rim over the ear side so it doesn't cover the eye.
- **Tusks:** they are tiny two-pixel ivory nubs, as briefed. They could be 1-2 px longer if they should read better at phone size.
- **Sit:** the stool is a small wooden park stool with no cushion. It stands about 3 px taller than the standing pose, so its top margin is smaller.
- **Defeat:** it flops forward on its belly rather than rolling over like Jefferson's.
- **Toot specks:** they are gold lines at the trunk tip. They could be recolored if they look odd on a light ground.
