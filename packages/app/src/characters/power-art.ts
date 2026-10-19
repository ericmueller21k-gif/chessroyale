/**
 * The art for the bosses' powers: what each boss's character plays when a power fires, and the effect sprites for
 * the board. The power rules (which decide when a power fires and what it does) import these; nothing here decides
 * anything.
 *
 * POWER_MOMENTS, per boss (keyed by its name, as BOSS_KITS is):
 *
 *   "Boingo the Clown"
 *     power        "pieThrow"   He pulls a pie up behind his head and throws it. At `release` the pie leaves his
 *                               glove: fly `pieFly` from him to the square, then play `pieSplat`.
 *     ultimateWarn "check"      His honk-honk, for the one-turn warning.
 *     ultimate     "funhouse"   Played ON THE BOARD (hide him in his usual spot meanwhile): his shadow grows, he
 *                               drops in from above, lands, springs into a spin and lands laughing. At `release`
 *                               (the spin) the board flips. The last frame holds until you take him off.
 *   "Ginger"
 *     power        "freezeCast" He raises the cane (it glows ice-blue, his eyes go icy) and thrusts it; at
 *                               `release` the ice bolt leaves its tip: fly `iceBolt` to the square, then play
 *                               `iceOverlay` freeze, frozen (loop) while it lasts, thaw.
 *     ultimateWarn "check"      His frosty cane thrusts, for the warning.
 *     ultimate     "blizzard"   Cane raised high, a whirl of snow round him that bursts outwards at `release`:
 *                               play `blizzardSweep` across the board from then, and ice every piece (iceOverlay)
 *                               as the sweep passes but the one left free. The pieces due to thaw next turn crack
 *                               (iceOverlay crack, then thinning (loop) while they wait); as each later turn begins,
 *                               those thaw (iceOverlay thaw), and the ones due next crack.
 *   "Jefferson"
 *     power        "ignite"     He winds up the outer sparkler and throws it at the board; at `throw` it leaves his
 *                               hand: fly `sparkFly` to the square, then play `fireTile` ignite (it lands as stage
 *                               1), stage1 (loop). Each turn after, step it up: spread2 then stage2 (loop), spread3
 *                               then stage3 (loop). When it's done: if a piece is on it, `pieceBurn` over the piece
 *                               (its kind, "p" to "q"; take the piece off at `poof`) and the tile's burnOut; if the
 *                               king is on it, the tile's fizzle (he's fireproof); if it's empty, burnOut.
 *     powerHit     "capture"    His laugh, as a piece burns up (lines: `kit.lines.powerHit`).
 *     ultimateWarn "candleWarn" He pulls out the Roman candle, shows it off and taps it; its fuse fizzes.
 *     ultimate     "romanCandle" Played ON THE BOARD, at its middle (hide him in his usual spot meanwhile): his
 *                               shadow grows, he drops in with a roar, heaves the big candle up and slams it down on
 *                               the board (`slam`: a wood smack), then fires 24 shots, one every 130 ms, sweeping it
 *                               left and right: the first at `launch`, each at a `shot` cue. Fly a `candleShot` from
 *                               the candle's top on each, along its tilt (grex.ts: CANDLE_SWEEP, candleMuzzle), so
 *                               they fan out. The last frame holds until you take him off. While the shots are up,
 *                               show `candleShots` by the board's right edge: `left<n>` for the n still up (24 to 0).
 *     ultimateHit  "capture"    His laugh, as fireballs come down (lines: `kit.lines.ultimateHit`): for each, fly
 *                               `fireballFall` fall from above the board onto its square, play its `land` there,
 *                               then the square is a stage-1 `fireTile` (land ends on stage1's first frame), which
 *                               burns up as the passive's does.
 *
 *   "Hollow"
 *     power        "darkCast"   He draws his free arm back as darkness spirals into the void in his chest, then flicks
 *                               it at the board; at `cast` the darkness pours out of his chest: fly `darkPour` from
 *                               the void (HOLLOW_CAST_FROM in hollow.ts) to the square, then play `darkSquare` gather,
 *                               dark (loop) while it lasts, thin (loop) on its last turn, clear when it goes
 *                               (darkItem()). His first cover's line is `kit.lines.darkFirst`; later ones `power`.
 *     ultimateWarn "check"      His loom, if a warning is shown at all (per Eric the rage meter is the only warning).
 *     ultimate     "lightsOut"  Played ON THE BOARD, in his new spot (hide him in his corner meanwhile; see
 *                               LIGHTS_OUT below): his shadow grows, he drops in, lands, holds the strand up and
 *                               crushes it a section at a time: at `smash1`, `smash2`, `smash3` (lightsOutSmashes())
 *                               dim the board a step with nightItems() step "dim1", "dim2", then "dim3" (into
 *                               "night"). His last frames are his dark stance, then hand over to `lightsTest`.
 *                               As he drops in, prewarm("nightSquare", nightWarmList()) draws the night ahead.
 *     more:
 *       claim      "claimDark"  The intro, when the crowd would have been black: he takes the dark side (`cast` is
 *                               the darkness rising round him). Line: `kit.lines.claim`.
 *       test       "lightsTest" (loop) His stance in the test: in the dark, only the void, pulsing. For a round's
 *                               countdown play `test3`, `test4` or `test5` (its seconds: a `tick` each second, twice in
 *                               the last), then `lightsTest` again. The prompt is findLine(pieces) from hollow.ts.
 *       found      "testFound"  A piece found: he recoils. On its square, nightItems() `shown` kind "found" (the
 *                               night bursts open in violet and the piece shows). Lines: `kit.lines.found`.
 *       missed     "testMiss"   A miss: he cackles. Play `darkMiss` on the tapped square (or on every square still
 *                               hidden, out of time). Lines: `kit.lines.missed`. At a round's end show the answers
 *                               with nightItems() `shown` kind "answer" (gold), then `closing`.
 *       lightsBack "lightsBack" Played ON THE BOARD in his new spot: a fresh strand spills out of the void, its bulbs
 *                               lighting (`relight`), the light comes back into him and he leaps off (ends empty:
 *                               show him back in his corner). From `relight`, nightItems() step "dawn" spreads the
 *                               light from his spot out across the board. Lines: `kit.lines.lightsBack`.
 *       bulbs      the countdown to his next cover: `bulbStrand` (a strip: `lit3`…`lit0`, `out3`/`out2`/`out1` as a
 *                               bulb goes out, `relight` after the last). Only the strip counts down: his own strand
 *                               stays lit in full in every pose (Eric, Oct 16).
 *
 *   Not a power, but on the board like one: a boss's attack on a king (the God King in his Last Stand, the crowd's king
 *   at its mate) is its kit's `kingAttack` (kits.ts): Hollow's is HOLLOW_ATTACK's "kingAttack" (hollow.ts), with
 *   `lashHit` on the king's square at each lash (lashItem()).
 *
 *   "Big Boy"
 *     power        "toss"       He pulls out a toy block, winds up over his shoulder and throws it; at `toss` it leaves
 *                               his hand: fly `blockFly` (fly<letter>) from him to the square, then play `toyBlock`
 *                               land<letter>, sit<letter> (loop) while it lasts, poof<letter> when it goes (blockItem()).
 *     ultimateWarn "wail"       His tantrum (a wail as he goes red), for the one-turn warning.
 *     ultimate     "bigBounce"  Played ON THE BOARD (hide him in his corner meanwhile), from BOUNCE.leapAt
 *                               (boss-timing.ts): a leap, then three landings (each a squash with its `boing`) on the
 *                               2x2 spots, a spring up and away (`whoosh`), the giant fall onto the four middle squares
 *                               (`crash`: play `bounceCrash` over the board, and jolt it), dazed, a `giggle` as the
 *                               pieces settle, and a spring off (`boing`). The board moves him (components/BigBoy.tsx);
 *                               `bouncePuff` on each square of a spot as he lands; bounceShape() says which of his
 *                               frames to squash or stretch a little more.
 *     more:
 *       snack      "snack"      Before move 1 (SNACK in boss-timing.ts): he waddles over to the crowd's pawn, grabs it
 *                               at SNACK.grabAt (take it off the board), eats it (`nom`, twice) and waddles off. His look
 *                               `blackPawn` when the crowd plays Black. Lines: `kit.lines.snack`.
 *
 *   "Sawyer"
 *     power        "sawDown"    A saw cut: he drives the saw down at the board's corner; at `cut` the groove opens on its
 *                               edge: play `sawCut` open<S> on each of the edge's two squares (S the edge's side of that
 *                               square on screen), raw<S> (loop) its first turn, tape1<S>/taped1<S> its second,
 *                               tape2<S>/taped2<S> its third, heal<S> when it goes (cutItems() in components/Sawyer.tsx).
 *     ultimateWarn "rev"        He revs the saw, for the warning.
 *     ultimate     "boardSaw"   Played ON THE BOARD (hide him in his corner meanwhile), from BOARD_SAW (boss-timing.ts):
 *                               a `leap` onto the board's bottom edge between the d and e files, a `rev`, then he saws
 *                               his way up the middle (`bigsaw`), `boardGap` run behind him; at the top `part` (the
 *                               board jolts) and `gap` (loop) while it lasts, `close` as the halves rejoin.
 *     more:
 *       split      "sawDown"    Played ON THE BOARD after his first move (SPLIT): a `leap` onto the pawn, the saw driven
 *                               into it (`cut`), `sawCrack` on its square as it cracks, the pawn morphing into two
 *                               small whole pawns that land and grow (SAWYER_LOOKS; "halves": the two halves coming
 *                               apart, the board's pieces clipped to halves), a `leap` back. Lines: `kit.lines.split`.
 *       leap       "leap"       A hop on or off the board: off the ground at LEAP.upAt, down at LEAP.landAt (`hop`).
 *
 *   "Wrangler"
 *     power        "lasso"      His lasso drag, played ON THE BOARD (components/Pig.tsx, DRAG in his rules): a `leap` from
 *                               his corner to beside the piece, the loop thrown so its `catch` lands on it (the art's
 *                               CATCH point on the piece's square), the `tug` dragging it one square (he steps with it,
 *                               the rope taut), a `leap` back. The long pull after his first move is the same on his
 *                               pawn (`more.pull`).
 *     ultimateWarn "taunt"      Never plays now (Eric, Oct 13: no warning); his meter full shows as his ready loop
 *                               instead (both loops swinging, the wind-up's spin looped: boss-beats.ts's `ready`), with
 *                               "I've got you in my sights." as it fills.
 *     ultimate     "windup"     SHOWDOWN!, ON THE BOARD (SHOWDOWN): a `leap` into the middle, both loops spinning (the
 *                               windup to its `throw`), a leap back to his corner, then `haul` while the board's ropes
 *                               yank each pair into the line-up (a `yank` each), and "DRAW!" (the `draw` sting).
 *
 *   "Alfil"
 *     power        "tusksCast"  Tusks' cast: his trunk takes the ankus and swings it down before him; at `cast` it's
 *                               levelled at the board and his two marked pawns start to glow (components/Alfil.tsx), a
 *                               glow they keep until the fusion or the counter.
 *     powerHit     "tusksFuse"  The fusion (his move): at `rise` the two pawns lift off toward the board's center; at
 *                               `flash` they meet in a ball of white light and the elephant (a bishop drawn with its
 *                               own piece art) drops onto its square. Lines: `kit.lines.powerHit` (the fusion's).
 *     ultimateWarn "check"      His trumpet, for the warning.
 *     ultimate     "mammothSlam" He leaps (`leap`, the big trumpet) and crashes down (`slam`: the board shakes); at `fly`
 *                               your three pieces fly up off their squares; at `shadows` each square they'll land on
 *                               shows Jefferson's `fireShadow` (reused as is), a size bigger each turn until they land.
 *     ultimateHit  "idle"       They land (he stays where he is): each drops out of the sky onto its own square, the
 *                               shadow at its biggest until then, a soft thump each (a piece whose square was taken
 *                               slides on to the nearest one allowed). Lines: `kit.lines.ultimateHit`.
 *
 *   "Chub & Chirp"
 *     power        "leapfrog"   Leapfrog: Chirp crouches and hops; at `takeoff` his pawn leaves its square, arcs over
 *                               yours and lands beyond it at `land` (components/Hopper.tsx).
 *     powerHit     "idle"       A carrot pulled (his, or yours): it pops out of the soil and the puller's token goes in
 *                               the square's corner (`carrotPatch`'s pull<W|B>). Lines: `carrotHis`, `carrotYours`.
 *     ultimateWarn "check"      Chirp's chirp, for the warning.
 *     ultimate     "carrotPatch" The cast: Chirp bounds five times while Chub tosses a carrot each bound; at each
 *                               `toss<n>` one leaves his paw (`carrotFly`), at `plant<n>` it lands on its square
 *                               (`carrotPatch`'s plant, then planted); then his ladder.
 *     ultimateHit  "raceWon" / "raceLost"  His spin: the race won (3 or more carrots; 2 when he pulled as many as you)
 *                               or lost, then the reel; the prize pieces drop onto their squares. Lines: `spinBig`,
 *                               `spinSmall`, `spinEmpty`; his fifth carrot (no spin): `carrotsAll`.
 *

 *   "Smudgy"
 *     power        "camouflage" Camouflage's splash (as your turn begins after his second forced move): he dips the brush on
 *                               his palette (`dab`), winds back and flings it; at `splash` the paint leaves the brush: fly
 *                               `paintFly` to his pawn row, land `paintSplash` on every square with one of his pawns (so no
 *                               one can see which swapped), hold it while the rook swaps with a pawn under it, then fade it
 *                               on the board the crowd sees (components/Smudgy.tsx).
 *     powerHit     "strike"     The reveal (his hidden rook moves as no pawn could, gives check, or leaves you no move you
 *                               can see): the tail snaps open and the beret leaps off; at `drip` the paint drips off the
 *                               piece's square (`paintDrip`) as it shows as a rook. Lines: `kit.lines.camoStrike`.
 *     ultimateWarn "check"      His brush pointed ahead, for the warning.
 *     ultimate     "repaint"    Two strokes: at `stroke1` a cream `brushStroke` on his pawn's square (it becomes yours), at
 *                               `stroke2` a charcoal one on your piece's square (it becomes his); the pieces change color
 *                               at each stroke.
 *     ultimateHit  "hurt"       The crowd takes the hidden rook (as your move lands): a drip on its square, his oof. Lines:
 *                               `kit.lines.rookTaken`.

 *   Each moment's animation is in the kit (`BOSS_KITS[name].anims[power | ultimateWarn | ultimate]`), its lines
 *   are `kit.lines.power / ultimateWarn / ultimate` (pick with `pickLine(kit, "power", key)` from boss-beats.ts,
 *   keyed by the moment so every player gets the same line), and its sounds fire from its frames' cues.
 *
 * EFFECTS, each a sprite whose frame is exactly the area it covers (one square, or the whole board), with its
 * animations in the order they play:
 *
 *   iceOverlay     square  freeze, frozen (loop), crack into thinning (loop: thin, dripping ice about to thaw),
 *                           thaw (ends empty). See-through: the piece shows under it.
 *   iceBolt        square  fly (loop). Points right: rotate it toward its target as it flies.
 *   blizzardSweep  board   sweep (one-shot, about 1.3 s, ends empty). Cloud and snow cross left to right.
 *   pieSplat       square  splat, pied (loop), fade (ends empty). On an empty square.
 *   pieFly         square  fly (loop). A pie tumbling; move it from the boss to the square.
 *   fireTile       square  ignite, stage1 (loop), spread2, stage2 (loop), spread3, stage3 (loop), burnOut (ends
 *                          empty); or fizzle (ends empty) when the king stands on it at the end. The stages read
 *                          on their own (a singe at the borders; more burn, flames up the sides; ablaze), with no
 *                          number: a piece stays visible on it at every stage.
 *   pieceBurn      square  p, n, b, r, q: the piece of that kind burning up (flames engulf it, `poof`: take the
 *                          real piece off, its charred shape crumbles to ash and embers, ends empty); burn: the same
 *                          without a shape.
 *   sparkFly       square  fly (loop). G-REX's sparkler tumbling end over end; move it, no need to turn it.
 *   candleShot     square  fly (loop), pop (ends empty). A Roman candle rocket pointing up; move it up.
 *   fireballFall   square  fall (loop), land (ends on fireTile's stage1 look). Move the falling one down onto
 *                          the square, land it there, then carry on with fireTile stage1.
 *   candleShots    strip   left24 ... left0 (loops), 7 x 146: a column of the shots still up (lit rockets from
 *                          the bottom, then spent). Size its box to keep its shape (width = height x 7 / 146).
 *   fireShadow     square  grow1, shadow1 (loop), grow2, shadow2 (loop), grow3, shadow3 (loop): the shadow of a
 *                          fireball coming down on the square, small 3 turns out, bigger, then the biggest (a
 *                          glow round it) the turn before it lands. See-through; draw it under the pieces.
 *   darkSquare     square  gather, dark (loop), thin (loop, its last turn), clear (ends empty). Hollow's dark over a
 *                          square: cloudy smoke, never a flat box, hiding the piece (its body covers 2 to 29 of the
 *                          square's 32 px, so the selection's green shows round it). Over the pieces, no taps.
 *   darkPour       square  fly (loop). The darkness in flight, pointing right: turn it toward its target.
 *   darkMiss       square  miss (ends empty): a red-violet slash, for a wrong tap or a wrong move into the dark.
 *   bulbStrand     strip   lit3 … lit0 (loops), out3, out2, out1 (a bulb going out; each ends on the next lit<n>),
 *                          relight (ends on lit3); 44 x 15. Size its box to keep its shape (height = width x 15 / 44).
 *   nightSquare    square  Lights out, a tile a square: dim1, dim2 (one-shots that hold), dim3<t>, night<t>
 *                          (loop), close<t>, dawn<t> (ends empty), found, shown (loop), answer, answered (loop),
 *                          where <t> is the square's tile (16 by where it is, light or dark). Use nightItems().
 *   nightLabel     square  a … h, 1 … 8: the night's coordinates, over the tiles (nightItems() places them).
 *   carrotPatch    square  plant (`thunk`; then planted), planted (loop), pull<W|B> (`pop`; ends on claimed<W|B>),
 *                          claimed<W|B> (loop: the dug hole and the side's token in the corner). Under the piece.
 *   carrotFly      square  fly (loop): a carrot tumbling, moved from Chub's paw to its square.
 *   carrotHit      square  hit<H|L><L|R> (ends empty, about 200 ms): a carrot bonking a king (Chub's attack on a king).
 *   carrotIcon     14 x 14 icon, slot: the dock's carrot count.
 *   ankusHit       square  hit<H|L><L|R> (ends empty, about 200 ms): a jab of Alfil's ankus landing on a king, high
 *                          or low, from the left or right edge: a gold spike and a burst of gold sparks.
 *   sawHit         square  hit<A|B><L|R> (ends empty, about 200 ms): a bite of Sawyer's saw on a king, high or a little
 *                          lower, from the left or right edge: a spark and a burst of sawdust flying up and away.
 *   lassoHit       square  hit<H|L><L|R> (ends empty, about 200 ms): the crack of Wrangler's lasso's end on a king's
 *                          square, high or low, from the left or right edge: a white snap, gold rays, rope fibers.
 *   pieHit         square  hit<H|L><L|R> (ends empty, about 200 ms): a pie in a king's face, side on, at his head or a
 *                          little lower, from the left or right edge: it splats wide, cream flies on, then slides down.
 *   bonkHit        square  hit<H|L><L|R> (ends empty, about 200 ms): a bonk of Big Boy's lollipop on a king, on its head or
 *                          its chest, from the left or right edge: a white star with rainbow rays, candy-colored stars.
 *   frostHit       square  hit<H|L><L|R> (ends empty, about 200 ms): a jab of Ginger's frosted cane on a king, high or
 *                          low, from the left or right edge: a white puff and ice shards; it never covers the king.
 *   popHit         square  hit<H|L><L|R> (ends empty, about 200 ms): a fireball of Jefferson's Roman candle popping on a
 *                          king, high or low, from the left or right: a white flash and eight sparks bursting out.
 *   lashHit        square  hit<F|B><L|R><c> (ends empty, about 200 ms): a lash of Hollow's strand landing on a king,
 *                          a forehand (high) or backhand (low, rising), from the left or right edge, in bulb color c.
 *   paintSplash    square  land<A|B|C> (a splash of paint lands over a piece: it spreads, `splat`; ends on hold's look),
 *                          hold<A|B|C> (loop, a gleam moving on it), fade<A|B|C> (it thins and dries away, ends empty). Three
 *                          shapes, in turn along a row of pawns. It covers the piece under it (a test measures that).
 *   paintDrip      square  drip (ends empty, 470 ms, `drip` on its first frame): the paint on a piece's square, its drips
 *                          running down; the piece shows through under it.
 *   brushStroke    square  stroke<C|N> (ends empty, 340 ms, `swoosh`): a swoosh of cream (C: white's color) or charcoal (N:
 *                          black's) paint across the square, bristle streaks in it, flecks flying.
 *   paintFly       square  fly (loop): a blob of paint wobbling; move it from his brush to the square.
 *   paintHit       square  hit<H|L><L|R> (ends empty, about 200 ms): a blob of paint splatting on a king's head (high) or a
 *                          little lower, from the left or right edge: it splats, runs and drips (Smudgy's attack on a king).
 *
 * Play them with <BossEffect> (components/BossEffect.tsx), which plays their sounds from the frames' cues, once,
 * through the mute switch; or render frames yourself with `renderFrame`. For many square effects at once (G-REX's
 * burning tiles, a piece burning on one, fireballs landing), use <BoardEffects>: one canvas over the whole board, one
 * shared loop, only the squares that changed redrawn, so a dozen fires cost what one does. Move flying ones
 * (sparkFly, candleShot, fireballFall's fall) with a CSS transform, never by redrawing.
 */
import type { SoundName } from "../sound.ts";
import { EFFECT_SPRITES, TOY_LETTER_NAMES, type ToyLetter } from "./effects.ts";
import type { Anim, Character } from "./sprite.ts";

/** The power moments' animation names, every boss's. */
export const POWER_ANIMS = [
  "pieThrow",
  "funhouse",
  "freezeCast",
  "blizzard",
  "ignite",
  "candleWarn",
  "romanCandle",
  "darkCast",
  "claimDark",
  "lightsOut",
  "lightsTest",
  "test3",
  "test4",
  "test5",
  "testFound",
  "testMiss",
  "lightsBack",
  "snack",
  "toss",
  "bigBounce",
  "wail",
  "rev",
  "sawDown",
  "leap",
  "boardSaw",
  "lasso",
  "taunt",
  "windup",
  "haul",
  "tusksCast",
  "tusksFuse",
  "mammothSlam",
  "leapfrog",
  "carrotPatch",
  "raceWon",
  "raceLost",
  "camouflage",
  "strike",
  "repaint",
  "hurt",
] as const;
export type PowerAnim = (typeof POWER_ANIMS)[number];

export interface PowerMoment {
  /** The boss's animation (in its kit's character). */
  anim: PowerAnim | "check" | "capture" | "idle";
  /** The frame cue that marks the moment's hit (the pie or bolt leaving, the board flipping, the storm bursting). */
  hit?: string;
  /** Played on the board, not in his usual spot. */
  onBoard?: boolean;
  /** The effects that follow, in order. */
  effects?: readonly EffectName[];
}

/**
 * A boss's power moments. `powerHit` and `ultimateHit` are for powers whose payoff lands later than the moment they
 * fire (G-REX's tile burning a piece; his fireballs coming down).
 */
export interface BossPowerMoments {
  power: PowerMoment;
  powerHit?: PowerMoment;
  ultimateWarn: PowerMoment;
  ultimate: PowerMoment;
  ultimateHit?: PowerMoment;
  /** A boss's other moments (Hollow's intro, test, found, missed, lights back, bulbs), by name. */
  more?: Readonly<Record<string, PowerMoment>>;
}

export const POWER_MOMENTS: Record<string, BossPowerMoments> = {
  "Boingo the Clown": {
    power: { anim: "pieThrow", hit: "throw", effects: ["pieFly", "pieSplat"] },
    ultimateWarn: { anim: "check" },
    ultimate: { anim: "funhouse", hit: "flip", onBoard: true },
  },
  "Ginger": {
    power: { anim: "freezeCast", hit: "freeze", effects: ["iceBolt", "iceOverlay"] },
    ultimateWarn: { anim: "check" },
    ultimate: { anim: "blizzard", hit: "blizzard", effects: ["blizzardSweep", "iceOverlay"] },
  },
  "Jefferson": {
    power: { anim: "ignite", hit: "throw", effects: ["sparkFly", "fireTile"] },
    powerHit: { anim: "capture", effects: ["pieceBurn", "fireTile"] },
    ultimateWarn: { anim: "candleWarn", hit: "fizz" },
    ultimate: { anim: "romanCandle", hit: "launch", onBoard: true, effects: ["candleShot", "candleShots", "fireShadow"] },
    ultimateHit: { anim: "capture", effects: ["fireShadow", "fireballFall", "fireTile"] },
  },
  "Hollow": {
    power: { anim: "darkCast", hit: "cast", effects: ["darkPour", "darkSquare"] },
    ultimateWarn: { anim: "check" },
    ultimate: { anim: "lightsOut", hit: "smash3", onBoard: true, effects: ["nightSquare", "nightLabel"] },
    more: {
      claim: { anim: "claimDark", hit: "cast" },
      test: { anim: "lightsTest", onBoard: true },
      found: { anim: "testFound", onBoard: true, effects: ["nightSquare"] },
      missed: { anim: "testMiss", onBoard: true, effects: ["darkMiss"] },
      lightsBack: { anim: "lightsBack", hit: "relight", onBoard: true, effects: ["nightSquare"] },
      bulbs: { anim: "idle", effects: ["bulbStrand"] },
    },
  },
  "Big Boy": {
    power: { anim: "toss", hit: "toss", effects: ["blockFly", "toyBlock"] },
    ultimateWarn: { anim: "wail" },
    ultimate: { anim: "bigBounce", hit: "crash", onBoard: true, effects: ["bouncePuff", "bounceCrash"] },
    more: {
      snack: { anim: "snack", hit: "nom", onBoard: true },
    },
  },
  "Sawyer": {
    power: { anim: "sawDown", hit: "cut", effects: ["sawCut"] },
    ultimateWarn: { anim: "rev" },
    ultimate: { anim: "boardSaw", hit: "bigsaw", onBoard: true, effects: ["boardGap"] },
    more: {
      split: { anim: "sawDown", hit: "cut", onBoard: true, effects: ["sawCrack"] },
      leap: { anim: "leap", hit: "hop", onBoard: true },
    },
  },
  "Wrangler": {
    power: { anim: "lasso", hit: "tug", onBoard: true },
    // (Every boss's moments name a warning; his ultimate has none now (Eric, Oct 13): his meter's line and ready loop
    // stand in, so this never plays.)
    ultimateWarn: { anim: "taunt" },
    ultimate: { anim: "windup", hit: "throw", onBoard: true },
    more: {
      pull: { anim: "lasso", hit: "tug", onBoard: true },
      haul: { anim: "haul", hit: "tug", onBoard: true },
      leap: { anim: "leap", hit: "hop", onBoard: true },
    },
  },
  "Chub & Chirp": {
    power: { anim: "leapfrog", hit: "takeoff" },
    // (A carrot pulled: the board pops it; he says his line where he stands.)
    powerHit: { anim: "idle", effects: ["carrotPatch"] },
    ultimateWarn: { anim: "check" },
    ultimate: { anim: "carrotPatch", hit: "toss1", effects: ["carrotFly", "carrotPatch"] },
    // (His spin: the race won or lost, then the reel; the prize pieces drop onto their squares.)
    ultimateHit: { anim: "raceWon" },
    more: { raceLost: { anim: "raceLost" } },
  },
  "Smudgy": {
    power: { anim: "camouflage", hit: "splash", effects: ["paintFly", "paintSplash"] },
    powerHit: { anim: "strike", hit: "drip", effects: ["paintDrip"] },
    ultimateWarn: { anim: "check" },
    ultimate: { anim: "repaint", hit: "stroke1", effects: ["brushStroke"] },
    // (The crowd takes the hidden rook: a drip on its square, his oof where he stands.)
    ultimateHit: { anim: "hurt", effects: ["paintDrip"] },
  },
  "Alfil": {
    power: { anim: "tusksCast", hit: "cast" },
    powerHit: { anim: "tusksFuse", hit: "flash" },
    ultimateWarn: { anim: "check" },
    ultimate: { anim: "mammothSlam", hit: "slam", effects: ["fireShadow"] },
    ultimateHit: { anim: "idle", effects: ["fireShadow"] },
  },
};

export type EffectName = keyof typeof EFFECT_SPRITES;
export const EFFECT_NAMES = Object.keys(EFFECT_SPRITES) as EffectName[];

export interface Effect {
  ch: Character;
  /** What its frame covers: one board square, the whole board, or a strip of its own size (keep its shape). */
  covers: "square" | "board" | "strip";
  /** Its animations: the one that starts it, the loop while it lasts, the one that ends it (ends on an empty frame). */
  start?: string;
  loop?: string;
  end?: string;
  /** An effect that escalates (the fire tile): each stage's loop, in order, and the one-shot that steps up into it. */
  stages?: readonly { loop: string; into?: string }[];
  /** Other endings, by what happened (the fire tile's `fizzle`, when the fireproof king stands on it). Each ends empty. */
  endings?: Readonly<Record<string, string>>;
  /** One animation per kind of piece (a piece burning up): its charred shape. */
  pieces?: Readonly<Record<"p" | "n" | "b" | "r" | "q", string>>;
  /** A count shown as one loop per number (the shots still up): `${prefix}${n}`, n from 0 to max. */
  counter?: { prefix: string; max: number };
  /** After its end, another effect carries on in the same place (a fireball's landing becomes a fire tile); its end's last frame is that one's first. */
  next?: { effect: EffectName; anim: string };
  /** Frame cues to sounds. */
  sounds: Record<string, SoundName>;
}

export const EFFECTS: Record<EffectName, Effect> = {
  iceOverlay: { ch: EFFECT_SPRITES.iceOverlay, covers: "square", start: "freeze", loop: "frozen", stages: [{ loop: "frozen" }, { loop: "thinning", into: "crack" }], end: "thaw", sounds: { crackle: "gingerCrackle" } },
  iceBolt: { ch: EFFECT_SPRITES.iceBolt, covers: "square", loop: "fly", sounds: {} },
  blizzardSweep: { ch: EFFECT_SPRITES.blizzardSweep, covers: "board", start: "sweep", sounds: { wind: "gingerWind" } },
  pieSplat: { ch: EFFECT_SPRITES.pieSplat, covers: "square", start: "splat", loop: "pied", end: "fade", sounds: { splat: "clownSplat" } },
  pieFly: { ch: EFFECT_SPRITES.pieFly, covers: "square", loop: "fly", sounds: {} },
  fireTile: {
    ch: EFFECT_SPRITES.fireTile,
    covers: "square",
    start: "ignite",
    loop: "stage1",
    end: "burnOut",
    stages: [{ loop: "stage1" }, { into: "spread2", loop: "stage2" }, { into: "spread3", loop: "stage3" }],
    endings: { fizzle: "fizzle" },
    sounds: { crackle: "grexCrackle", fizzle: "grexFizz" },
  },
  pieceBurn: { ch: EFFECT_SPRITES.pieceBurn, covers: "square", start: "burn", pieces: { p: "p", n: "n", b: "b", r: "r", q: "q" }, sounds: { poof: "grexPoof" } },
  sparkFly: { ch: EFFECT_SPRITES.sparkFly, covers: "square", loop: "fly", sounds: {} },
  candleShot: { ch: EFFECT_SPRITES.candleShot, covers: "square", loop: "fly", end: "pop", sounds: {} },
  fireballFall: { ch: EFFECT_SPRITES.fireballFall, covers: "square", loop: "fall", end: "land", next: { effect: "fireTile", anim: "stage1" }, sounds: { land: "grexPoof" } },
  candleShots: { ch: EFFECT_SPRITES.candleShots, covers: "strip", loop: "left24", counter: { prefix: "left", max: 24 }, sounds: {} },
  fireShadow: { ch: EFFECT_SPRITES.fireShadow, covers: "square", start: "grow1", loop: "shadow1", stages: [{ into: "grow1", loop: "shadow1" }, { into: "grow2", loop: "shadow2" }, { into: "grow3", loop: "shadow3" }], sounds: {} },
  darkSquare: { ch: EFFECT_SPRITES.darkSquare, covers: "square", start: "gather", loop: "dark", end: "clear", stages: [{ loop: "dark" }, { loop: "thin" }], sounds: { gather: "hollowWhisper", clear: "hollowWhisper" } },
  darkPour: { ch: EFFECT_SPRITES.darkPour, covers: "square", loop: "fly", sounds: {} },
  darkMiss: { ch: EFFECT_SPRITES.darkMiss, covers: "square", start: "miss", sounds: { miss: "hollowMiss" } },
  bulbStrand: { ch: EFFECT_SPRITES.bulbStrand, covers: "strip", loop: "lit3", counter: { prefix: "lit", max: 3 }, sounds: { pop: "hollowPop", relight: "hollowRelight" } },
  nightSquare: { ch: EFFECT_SPRITES.nightSquare, covers: "square", loop: "night0D", end: "dawn0D", sounds: { found: "hollowFound", answer: "hollowWhisper" } },
  nightLabel: { ch: EFFECT_SPRITES.nightLabel, covers: "square", loop: "a", sounds: {} },
  lashHit: { ch: EFFECT_SPRITES.lashHit, covers: "square", start: "hitFL0", sounds: {} },
  toyBlock: { ch: EFFECT_SPRITES.toyBlock, covers: "square", start: "landA", loop: "sitA", end: "poofA", sounds: { clack: "bigboyClack", poof: "bigboyPoof" } },
  blockFly: { ch: EFFECT_SPRITES.blockFly, covers: "square", loop: "flyA", sounds: {} },
  bouncePuff: { ch: EFFECT_SPRITES.bouncePuff, covers: "square", start: "puff", sounds: {} },
  bounceCrash: { ch: EFFECT_SPRITES.bounceCrash, covers: "board", start: "crash", sounds: {} },
  sawCut: { ch: EFFECT_SPRITES.sawCut, covers: "square", start: "openN", loop: "rawN", end: "healN", stages: [{ loop: "rawN" }, { into: "tape1N", loop: "taped1N" }, { into: "tape2N", loop: "taped2N" }], sounds: { tape: "sawyerTape" } },
  sawCrack: { ch: EFFECT_SPRITES.sawCrack, covers: "square", start: "crack", sounds: { crack: "sawyerCrack" } },
  boardGap: { ch: EFFECT_SPRITES.boardGap, covers: "strip", start: "run", loop: "gap", end: "close", sounds: { split: "sawyerCrack", rejoin: "sawyerRejoin" } },
  ankusHit: { ch: EFFECT_SPRITES.ankusHit, covers: "square", start: "hitHL", sounds: {} },
  sawHit: { ch: EFFECT_SPRITES.sawHit, covers: "square", start: "hitAL", sounds: {} },
  lassoHit: { ch: EFFECT_SPRITES.lassoHit, covers: "square", start: "hitHL", sounds: {} },
  pieHit: { ch: EFFECT_SPRITES.pieHit, covers: "square", start: "hitHL", sounds: {} },
  bonkHit: { ch: EFFECT_SPRITES.bonkHit, covers: "square", start: "hitHL", sounds: {} },
  frostHit: { ch: EFFECT_SPRITES.frostHit, covers: "square", start: "hitHL", sounds: {} },
  popHit: { ch: EFFECT_SPRITES.popHit, covers: "square", start: "hitHL", sounds: {} },
  // (In the cast its planting is quiet on the board, `quiet`: the thunk is his `plant<n>` cue's, so one plays, not two.)
  carrotPatch: { ch: EFFECT_SPRITES.carrotPatch, covers: "square", start: "plant", loop: "planted", sounds: { thunk: "hopperThunk", pop: "hopperPop" } },
  carrotFly: { ch: EFFECT_SPRITES.carrotFly, covers: "square", loop: "fly", sounds: {} },
  carrotHit: { ch: EFFECT_SPRITES.carrotHit, covers: "square", start: "hitHL", sounds: {} },
  carrotIcon: { ch: EFFECT_SPRITES.carrotIcon, covers: "strip", loop: "icon", sounds: {} },
  paintSplash: { ch: EFFECT_SPRITES.paintSplash, covers: "square", start: "landA", loop: "holdA", end: "fadeA", sounds: { splat: "smudgySplash" } },
  paintDrip: { ch: EFFECT_SPRITES.paintDrip, covers: "square", start: "drip", sounds: { drip: "smudgyDrip" } },
  brushStroke: { ch: EFFECT_SPRITES.brushStroke, covers: "square", start: "strokeC", sounds: { swoosh: "smudgySwish" } },
  paintFly: { ch: EFFECT_SPRITES.paintFly, covers: "square", loop: "fly", sounds: {} },
  paintHit: { ch: EFFECT_SPRITES.paintHit, covers: "square", start: "hitHL", sounds: {} },
};

// ---------------- Big Boy's toy block, for the board ----------------

/** A toy block's letter, by its square (A, B or C): the same everywhere, and the next one usually another. */
export const blockLetter = (square: string): ToyLetter => TOY_LETTER_NAMES[(square.charCodeAt(0) - 97 + Number(square[1])) % 3]!;

/** A toy block's look on its square: landing (then sitting), sitting, or going (ends empty). */
export function blockItem(square: string, state: "land" | "sit" | "poof", since: number): SquareItem {
  const l = blockLetter(square);
  if (state === "land") return { square, name: "toyBlock", anim: `land${l}`, then: `sit${l}`, since };
  return { square, name: "toyBlock", anim: `${state}${l}`, since };
}

/** An animation's length in ms. */
export const animLength = (a: Anim) => a.frames.reduce((s, f) => s + f.ms, 0);

/** When a cue fires in an animation, in ms from its start (the start of its first frame with that cue), or null. */
export function cueAt(a: Anim, cue: string): number | null {
  let t = 0;
  for (const f of a.frames) {
    if (f.cue === cue) return t;
    t += f.ms;
  }
  return null;
}

// ---------------- Hollow's dark, for the board ----------------

/** One effect on a square of the board (the shape <BoardEffects> takes). */
export interface SquareItem {
  square: string;
  name: EffectName;
  anim?: string;
  then?: string;
  since: number;
  quiet?: boolean;
}

/** A dark square's look: forming (gather, then dark), dark, thinning (its last turn), or clearing (ends empty). */
export function darkItem(square: string, state: "new" | "dark" | "thin" | "clear", since: number): SquareItem {
  if (state === "new") return { square, name: "darkSquare", anim: "gather", then: "dark", since };
  if (state === "clear") return { square, name: "darkSquare", anim: "clear", since };
  return { square, name: "darkSquare", anim: state, since };
}

const FILES = "abcdefgh";
/** A square's column and row on screen (0 at the top left) for a board shown this way up. */
const onScreen = (square: string, orientation: "white" | "black") => {
  const f = square.charCodeAt(0) - 97;
  const r = Number(square[1]) - 1;
  return { col: orientation === "white" ? f : 7 - f, row: orientation === "white" ? 7 - r : r };
};
const squareOn = (col: number, row: number, orientation: "white" | "black") =>
  orientation === "white" ? `${FILES[col]}${8 - row}` : `${FILES[7 - col]}${row + 1}`;
/** A square's night tile: one of 16 by where it is on screen (the smoke drifts across them as one), light or dark. */
const tileOf = (col: number, row: number, square: string) => `${(col % 4) + 4 * (row % 4)}${(square.charCodeAt(0) - 97 + Number(square[1]) - 1) % 2 ? "L" : "D"}`;

export interface NightState {
  orientation: "white" | "black";
  /**
   * Where Lights out is: "dim1", "dim2" (after the first and second smash: darker, the pieces still show), "dim3" (the
   * last smash: into night), "night" (the test), "dawn" (the lights coming back).
   */
  step: "dim1" | "dim2" | "dim3" | "night" | "dawn";
  /** When the step began (Date.now() time, from the shared state). */
  since: number;
  now: number;
  /** Squares showing their piece in the night: found (a violet flash) or an answer at a round's end (gold). */
  shown?: readonly { square: string; at: number; kind: "found" | "answer" }[];
  /** Squares the night closes over again (after showing), from when. */
  closing?: readonly { square: string; at: number }[];
  /** At dawn, the light spreads from this square (his spot) out across the board, `dawnStagger` ms a square. */
  from?: string;
}
export const DAWN_STAGGER = 55;

/**
 * Every square's item for Lights out on the shared board canvas: the dim, the night (each square its tile, so the smoke
 * drifts across the board as one), the coordinates over it (ranks down the left, files along the bottom), squares
 * showing their piece, closing again, and the dawn spreading out. Only one item plays a sound at a time.
 */
export function nightItems(s: NightState): SquareItem[] {
  const out: SquareItem[] = [];
  const shown = new Map((s.shown ?? []).map((x) => [x.square, x]));
  const closing = new Map((s.closing ?? []).map((x) => [x.square, x]));
  const from = s.from ? onScreen(s.from, s.orientation) : { col: 3.5, row: 3.5 };
  let answered = false;
  for (let row = 0; row < 8; row++)
    for (let col = 0; col < 8; col++) {
      const square = squareOn(col, row, s.orientation);
      const t = tileOf(col, row, square);
      const dark = s.step === "dim3" || s.step === "night" || s.step === "dawn";
      const sh = shown.get(square);
      const cl = closing.get(square);
      if (s.step === "dim1" || s.step === "dim2") out.push({ square, name: "nightSquare", anim: s.step, since: s.since });
      else if (s.step === "dawn") {
        const at = s.since + Math.round(Math.hypot(col - from.col, row - from.row) * DAWN_STAGGER);
        out.push(s.now < at ? { square, name: "nightSquare", anim: `night${t}`, since: 0 } : { square, name: "nightSquare", anim: `dawn${t}`, since: at });
        if (s.now >= at + 200) continue;
      } else {
        if (cl && s.now >= cl.at) out.push({ square, name: "nightSquare", anim: `close${t}`, then: `night${t}`, since: cl.at });
        else if (sh && s.now >= sh.at) {
          const found = sh.kind === "found";
          out.push({ square, name: "nightSquare", anim: found ? "found" : "answer", then: found ? "shown" : "answered", since: sh.at, quiet: !found && answered });
          if (!found) answered = true;
        } else if (s.step === "dim3") out.push({ square, name: "nightSquare", anim: `dim3${t}`, then: `night${t}`, since: s.since });
        else out.push({ square, name: "nightSquare", anim: `night${t}`, since: 0 });
      }
      if (!dark) continue;
      // The coordinates, over the night: ranks in the left column, files along the bottom row.
      if (col === 0) out.push({ square, name: "nightLabel", anim: square[1]!, since: 0 });
      if (row === 7) out.push({ square, name: "nightLabel", anim: square[0]!, since: 0 });
    }
  return out;
}

/**
 * The night's frames in the order Lights out needs them, for prewarm() (components/BossEffect.tsx) from the moment he
 * drops in: the dims, every tile's first look (all show at the last smash), then each frame of their loop.
 */
export function nightWarmList(): [string, number][] {
  const anims = Object.keys(EFFECT_SPRITES.nightSquare.anims);
  const tiles = anims.filter((a) => a.startsWith("night"));
  const out: [string, number][] = [];
  for (const a of ["dim1", "dim2"]) EFFECT_SPRITES.nightSquare.anims[a]!.frames.forEach((_, i) => out.push([a, i]));
  for (const a of anims.filter((x) => x.startsWith("dim3"))) out.push([a, 0]);
  for (let f = 1; f < 8; f++) for (const a of tiles) out.push([a, f]);
  return out;
}

/** When Lights out's three smashes land, in ms from the start of `lightsOut` (dim the board a step at each). */
export function lightsOutSmashes(a: Anim): number[] {
  return ["smash1", "smash2", "smash3"].map((c) => cueAt(a, c) ?? 0);
}

/**
 * Where he goes for Lights out (his new spot), as a box on the board in % of its size: centered above it, his feet on
 * its top edge, so he never covers a square during the test. The box keeps his frame's shape (`width` wide).
 */
export function lightsOutSpot(ch: Character, width = 30): { left: number; top: number; width: number; height: number } {
  const height = (width * ch.h) / ch.w;
  return { left: 50 - (width * ch.foot[0]) / ch.w, top: -(height * ch.foot[1]) / ch.h, width, height };
}

// ---------------- A boss's attack on a king, for the board ----------------

/** Hollow's i-th lash landing on the king's square, from his side (`from`: he stands to its left or right). */
export function lashItem(square: string, i: number, from: "L" | "R", since: number): SquareItem {
  return { square, name: "lashHit", anim: `hit${i % 2 ? "B" : "F"}${from}${i % 3}`, since };
}

/** Alfil's i-th jab of his ankus landing on the king's square (high, then low, in turn), from his side. */
export function ankusItem(square: string, i: number, from: "L" | "R", since: number): SquareItem {
  return { square, name: "ankusHit", anim: `hit${i % 2 ? "L" : "H"}${from}`, since };
}

/** Sawyer's i-th bite of his saw on the king's square (high, then a little lower, in turn), from his side. */
export function sawItem(square: string, i: number, from: "L" | "R", since: number): SquareItem {
  return { square, name: "sawHit", anim: `hit${i % 2 ? "B" : "A"}${from}`, since };
}

/** Wrangler's i-th crack of his lasso on the king's square (high, then low, in turn), from his side. */
export function lassoItem(square: string, i: number, from: "L" | "R", since: number): SquareItem {
  return { square, name: "lassoHit", anim: `hit${i % 2 ? "L" : "H"}${from}`, since };
}

/** Boingo's i-th pie in the king's face (at his head, then a little lower, in turn), from his side. */
export function pieItem(square: string, i: number, from: "L" | "R", since: number): SquareItem {
  return { square, name: "pieHit", anim: `hit${i % 2 ? "L" : "H"}${from}`, since };
}

/** Big Boy's i-th bonk of his lollipop on the king's square (overhead on its head, then sideways at its chest, in turn), from his side. */
export function bonkItem(square: string, i: number, from: "L" | "R", since: number): SquareItem {
  return { square, name: "bonkHit", anim: `hit${i % 2 ? "L" : "H"}${from}`, since };
}

/** Ginger's i-th jab of her frosted cane on the king's square (high, then low, in turn), from her side. */
export function frostItem(square: string, i: number, from: "L" | "R", since: number): SquareItem {
  return { square, name: "frostHit", anim: `hit${i % 2 ? "L" : "H"}${from}`, since };
}

/** Jefferson's i-th fireball popping on the king's square (at its head, then its chest, in turn), from his side. */
export function popItem(square: string, i: number, from: "L" | "R", since: number): SquareItem {
  return { square, name: "popHit", anim: `hit${i % 2 ? "L" : "H"}${from}`, since };
}

/** Chub's i-th carrot bonking the king (high, then a little lower, in turn), from his side. */
export function carrotItem(square: string, i: number, from: "L" | "R", since: number): SquareItem {
  return { square, name: "carrotHit", anim: `hit${i % 2 ? "L" : "H"}${from}`, since };
}

/** Smudgy's i-th blob of paint splatting on the king's square (on its head, then a little lower, in turn), from his side. */
export function paintItem(square: string, i: number, from: "L" | "R", since: number): SquareItem {
  return { square, name: "paintHit", anim: `hit${i % 2 ? "L" : "H"}${from}`, since };
}
