/**
 * Every number that shapes how the town square feels, in one place (Eric tests it and sends small changes: each is a
 * one-line edit here). The values are the prototype's (docs/mockups/town-square/prototype.html, its README), which Eric
 * tested on his phone and called "perfect"; distances are in board squares, times in milliseconds.
 */

/** One tuned camera: a pitched pinhole over a small round world (camera.ts). */
export interface CamSet {
  /** Camera height, in squares. */
  h: number;
  /** Pitch down, in degrees. */
  th: number;
  /** How far behind the focus point the camera stands, in squares. */
  back: number;
  /** The world's curve radius, in squares. */
  R: number;
  /** How much of the curve applies sideways (1 = as much as ahead). */
  kx: number;
  /** Focal length, as a fraction of the box's width. */
  fW: number;
  /** The lens center, as a fraction of the box's height. */
  cy: number;
  /** How far the round world reaches from the focus point before it ends at the horizon, in squares. */
  rim: number;
  /** The rim's sideways stretch (1 = a circle). */
  rimX: number;
}

type RGB = readonly [number, number, number];

/** One look of the sky (sky.ts blends them by the hour). */
export interface SkyLook {
  /** The gradient from the top of the box down to the horizon, one color per stop (sky.ts, SKY_STOPS); the last is the
   * horizon's, which the far ground and the haze dissolve into. */
  sky: readonly [RGB, RGB, RGB, RGB, RGB];
  /** The tint laid over the world and everything on it: color and strength (0: none). */
  tint: readonly [number, number, number, number];
  /** The clouds: their lit tops, bodies and bases, and how strongly they show. */
  cloud: readonly [RGB, RGB, RGB];
  cloudAlpha: number;
  /** The sun (or the moon, at night): its disc, its glow and how strong the glow is, and where it stands across the box. */
  sunDisc: string;
  sunGlow: RGB;
  sunGlowAlpha: number;
  sunX: number;
  /**
   * Dawn's morning mist: how much more the far ground fades into the horizon's own color (added to `hazeNear`; 0: none).
   * (Slice 2's first try drew it as light strokes over the ground: Eric saw a white smudge.)
   */
  mist: number;
}

export const TOWN_FEEL = {
  // ---- The walk (Eric: "perfect"; square to square "makes it feel like chess").
  /** Your step: one square in this many ms. (Prototype: 90.) */
  youStepMs: 90,
  /**
   * Easing into your first step from standing and out of your last (0 = none, 1 = full); the steps between stay even,
   * so a long walk keeps one speed. (Prototype: 0, every step linear: the walk started and stopped at full speed.)
   */
  walkEase: 0.5,
  /** A bot's step. */
  botStepMs: 200,
  /** A boss's step. */
  bossStepMs: 420,
  /** The hobble's hop at the top of a step, in squares (yours). (Prototype: 0.12.) */
  youHop: 0.12,
  /** A bot's hop, in squares. (Prototype: 0.1.) */
  botHop: 0.1,
  /** The hobble's tilt at its widest, in degrees. (Prototype: 3.6, its 6 x 0.6.) */
  hobbleTilt: 3.6,

  // ---- The camera.
  /** The computer's camera (a landscape box, width / height 1.4 or wider). */
  camWide: { h: 7.8, th: 36, back: 6.7, R: 30, kx: 0.4, fW: 0.72, cy: 0.39, rim: 11.5, rimX: 2.3 } as CamSet,
  /** The phone's camera (a portrait box, width / height 0.6 or narrower). Between the two, the box's shape blends them. */
  camTall: { h: 9.3, th: 42, back: 5.7, R: 30, kx: 0.42, fW: 1.31, cy: 0.36, rim: 12.5, rimX: 1.16 } as CamSet,
  /** The box shapes (width / height) where the blend is all phone and all computer. */
  aspectTall: 0.6,
  aspectWide: 1.4,
  /** The page opens zoomed out (Eric, Oct 26: "it feels a little nicer"); − / + work as before. (Slice 1: zoomed in.) */
  startZoomedOut: true,
  /** Zoomed out: the camera's height x (1 + this). */
  zoomOutHeight: 0.75,
  /** Zoomed out: how far back x (1 + this). */
  zoomOutBack: 0.45,
  /** Zoomed out: this many degrees more pitch. */
  zoomOutPitch: 6,
  /** Zoomed out: the rim reaches this much further (0.25 = 25%). */
  zoomOutRim: 0.25,
  /** How fast a zoom glides (per second; higher is quicker). */
  zoomRate: 8,
  /**
   * How the camera follows you: a critically damped spring of this stiffness (per second). It trails a walk by the same
   * 1.6 squares as the prototype's, but eases into motion and settles without a jerk. (Prototype: an exponential
   * follow at rate 7, which jumped to full speed the moment you set off; 14 here gives the same trailing distance.)
   */
  followSpring: 14,
  /** How fast it glides to a home when a chip is tapped (per second). */
  glideRate: 3,
  /** A chip's glide stops this many squares in front of the home (so the home shows ahead of the camera). */
  glideAhead: 3,
  /** A press that moves this many pixels is a drag (to look around), not a tap. */
  dragPx: 8,

  // ---- The far edge and the sky.
  /** From this fraction of the way to the rim, things dissolve into the sky. */
  bandStart: 0.7,
  /** How close to the sky's color the ground gets at the rim (0 to 1). */
  bandMix: 0.93,
  /** How much sprites fade at the rim (0 to 1). */
  bandFade: 0.7,
  /**
   * The far band of ground softened by a blurred copy of itself laid back over it (the prototype's). Off: its low-res copy
   * ghosted the far squares (doubled, smeared), most at dawn (Eric, Oct 26); the haze alone fades them cleanly.
   */
  softenFarBand: false,
  /** How much sprites blur in the far band (a shrink, then a stretch back). */
  bandBlur: 2.6,
  /** A light haze with distance before the band (at the rim, before the band's own). */
  hazeNear: 0.3,
  /** The haze strip under the horizon, as a fraction of the box's height. */
  horizonHaze: 0.05,
  /** Things fade in over this many squares as they come inside the rim. */
  enterSquares: 0.5,
  /** The clouds drift this much as you walk sideways (a fraction of a square's width per square). */
  cloudParallax: 0.12,
  /** And this many pixels per square as you walk ahead. */
  cloudParallaxAhead: 2,

  // ---- The sky by the time of day (sky.ts: the looks' colors; ?sky=day|dawn|dusk|night overrides the clock).
  /** When each look begins, in minutes past local midnight: dawn 5:30, day 7:30, dusk 17:30, night 19:30 (in that order). */
  skyHours: { dawn: 5 * 60 + 30, day: 7 * 60 + 30, dusk: 17 * 60 + 30, night: 19 * 60 + 30 },
  /** Each change blends over this many minutes (centered on its hour), so it's never sudden. */
  skyBlendMinutes: 30,
  /** How often the clock is read, in ms (not every frame). */
  skyCheckMs: 60_000,
  /** The sun or the moon (where it stands across the box is each look's `sunX`): its radius (a fraction of the box's smaller side)... */
  sunSize: 0.085,
  /** ...how far below the horizon its middle sits (a fraction of its radius: it rests low, partly behind the world)... */
  sunLow: 0.1,
  /** ...and how far it swings across the box (a fraction of its width) as you walk once round the world: barely. */
  sunParallax: 0.12,
  /**
   * The four looks (Eric, Oct 26). Day: slice 1's blue, a big soft sun, white clouds. Dawn: soft and cool, light blue
   * through lavender and pink to peach and pale gold, the sun rising on the side opposite dusk's, clouds lit soft pink,
   * a faint mist low over the far ground. Dusk: the deep warm sunset, dark blue, purple, red-orange, gold, the sun big,
   * low and orange, clouds lit pink and orange from below. Night: deep navy, stars, a big pale moon, few faint clouds,
   * a cool dark tint light enough that the checker, the homes and the tags read.
   */
  skyLooks: {
    dawn: {
      sky: [
        [150, 192, 236],
        [184, 172, 222],
        [232, 176, 204],
        [250, 200, 176],
        [255, 226, 176],
      ],
      tint: [255, 214, 220, 0.05],
      cloud: [
        [255, 240, 244],
        [250, 210, 222],
        [236, 178, 196],
      ],
      cloudAlpha: 0.95,
      sunDisc: "#ffe2b0",
      sunGlow: [255, 214, 190],
      sunGlowAlpha: 0.5,
      sunX: 0.3,
      mist: 0.22,
    },
    day: {
      sky: [
        [104, 178, 246],
        [129, 192, 248],
        [154, 205, 251],
        [188, 220, 248],
        [214, 230, 246],
      ],
      tint: [0, 0, 0, 0],
      cloud: [
        [255, 255, 255],
        [238, 243, 250],
        [196, 211, 230],
      ],
      cloudAlpha: 1,
      sunDisc: "#fff4c9",
      sunGlow: [255, 236, 170],
      sunGlowAlpha: 0.55,
      sunX: 0.7,
      mist: 0,
    },
    dusk: {
      sky: [
        [29, 43, 94],
        [74, 58, 126],
        [169, 79, 134],
        [236, 110, 72],
        [255, 187, 102],
      ],
      tint: [255, 120, 50, 0.1],
      cloud: [
        [190, 140, 190],
        [240, 150, 140],
        [255, 185, 110],
      ],
      cloudAlpha: 1,
      sunDisc: "#ffab55",
      sunGlow: [255, 120, 60],
      sunGlowAlpha: 0.55,
      sunX: 0.7,
      mist: 0,
    },
    night: {
      sky: [
        [6, 10, 24],
        [11, 19, 50],
        [19, 32, 74],
        [29, 44, 92],
        [44, 60, 110],
      ],
      tint: [12, 22, 64, 0.34],
      cloud: [
        [84, 98, 140],
        [62, 74, 112],
        [44, 54, 88],
      ],
      cloudAlpha: 0.55,
      sunDisc: "#f2f4ff",
      sunGlow: [210, 220, 255],
      sunGlowAlpha: 0.25,
      sunX: 0.7,
      mist: 0,
    },
  } satisfies Record<string, SkyLook> as Record<"dawn" | "day" | "dusk" | "night", SkyLook>,
  /** The clouds: how many in a strip of sky 1000 pixels wide (some big, some small, a few wisps). */
  cloudsPer1000: 6,
  /** Their pixel size (in CSS pixels): drawn in the game's pixel style, like the homes. */
  cloudPixel: 3,
  /** The band of sky they float in, as fractions of the sky's height above the horizon (never on the horizon). */
  cloudBand: [0.22, 0.88] as const,
  /** How fast they drift on their own, in pixels a second. */
  cloudDrift: 4,
  /** The stars at night: how many, and how many of them twinkle (gently). */
  stars: 70,
  twinkles: 8,

  // ---- The world's edge.
  /** A dark line along the world's rim instead of the haze alone (Eric was curious; off by default)... */
  rimLine: false,
  /** ...its color and width (CSS pixels). */
  rimLineColor: "#1f2530",
  rimLineWidth: 2,

  // ---- The bosses.
  /** A boss stands still this long between walks (a random time between the two). */
  bossPauseMs: [1200, 2800] as const,
  /** And walks this many squares at a time (at most). */
  bossWalkSquares: 2,
  /** How far from its home's plot a boss roams, in squares. */
  bossRoam: 2,
  /** The first line comes after this long. */
  speechFirstMs: 2500,
  /** Then a line every so often (a random time between the two), from a boss on screen, one at a time. */
  speechGapMs: [3500, 6500] as const,
  /** How long a line stays up. */
  speechMs: 3200,

  // ---- The bots.
  /** The first bot walks after this long. */
  botFirstMs: 2500,
  /** Then one bot walks every so often (a random time between the two). */
  botGapMs: [2600, 4200] as const,
  /** To a free square this many steps away (at least, at most). */
  botWalk: [2, 4] as const,
  /**
   * Now and then a bot goes to sit at a chess table (slice 6): this share of its walks head for a free stool up to this
   * many steps away; and a bot sitting stays put, when its turn to walk comes, this share of the time.
   */
  botSitChance: 0.3,
  botSitReach: 7,
  botStaySeated: 0.6,

  // ---- Sizes, in squares.
  /** A boss's picture is this many squares tall. */
  bossSquares: 3.0,
  /** A bot's pawn. */
  botSquares: 1.25,
  /** Your pawn. */
  youSquares: 1.45,
  /**
   * The shadows under a pawn (and a boss): the soft one this strong (as before), and a contact shadow right under the
   * base, this share of the pawn's width across (about its base's), this many squares deep, this strong (Eric's slice 4
   * test: "the shadows below never change and makes it look like I'm floating")...
   */
  shadowAlpha: 0.22,
  contactShadowW: 0.3,
  contactShadowDepth: 0.11,
  contactShadowAlpha: 0.55,
  /** ...both shrinking (1 / (1 + this x the lift in squares)) and fading (1 - this x the lift) as the hop lifts it. */
  shadowLiftShrink: 4,
  shadowLiftFade: 4,
  /**
   * Sitting at a chess table (slice 6): a pawn on a stool shows from this share of its height up (the rest hidden behind
   * the stool, as if sat), resting on the stool's seat this many squares above the ground: lower than standing.
   */
  sitCut: 0.34,
  sitSeat: 0.3,
  /**
   * The Coliseum from afar (slice 6): seen up to this many squares past the rim, standing on the horizon, sunk this many
   * squares behind the world's curve a square past the rim (its top looming over the horizon), and as hazy as this far
   * into the far band (0 to 1).
   */
  farReach: 16,
  farSink: 0.35,
  farHaze: 0.7,
  /** A house's pixels per square (the tent, 144 pixels wide, is about 3.9 squares). */
  housePxPerSquare: 37,
  /** A square drawn less than this many pixels tall (far off) gets no seam: it's barely visible there, and it halves the work. */
  seamMinPx: 7,
  /** Name tags hide past this fraction of the way to the rim. */
  tagFar: 2 / 3,

  // ---- The homes' names (two styles, for Eric to compare: either can be turned off here).
  /** Each home's name floats over it, white with a dark outline, as you come near. */
  floatingNames: true,
  /** It starts to fade in this many squares from the home's plot... */
  nameShowFrom: 4,
  /** ...and is fully there by this many. */
  nameFullAt: 2,
  /** It rises this many pixels as it fades in. */
  nameRise: 6,
  /** The game writes each home's name on its sign board, in its own small pixel capitals (sign-font.ts)... */
  signNames: true,
  /**
   * ...when its letters would be at least this many CSS pixels tall (else the board stays blank). (Slice 1: 6, in the
   * game's Press Start 2P, a font twice as wide: the meadow's sign stayed blank at the zoomed-out view.)
   */
  signMinCap: 4.5,

  // ---- The statues (Eric, Oct 26: "when you walk up to their statue it zooms in close and on the statue their quote
  // renders in on the structure supporting their statue").
  /** The camera's glide in close on a statue, and back out to the zoom you had, this many ms (eased at both ends). */
  closeGlideMs: 900,
  /** Up close, the statue and its pedestal fill the box from this far down it... */
  closeTop: 0.04,
  /** ...to this far down... */
  closeBottom: 0.95,
  /** ...and at most this share of its width, in the middle. */
  closeMaxWidth: 0.92,
  /**
   * Where the statue would reach the − / + and "Back to me" buttons (a phone), it goes round them whichever way lets it be
   * bigger (so its pedestal's quote is bigger): ending this many pixels above them, or moved off the middle to end this
   * many pixels left of them, at least `closeSide` pixels from the box's left edge.
   */
  closeAboveButtons: 10,
  closeBesideButtons: 8,
  closeSide: 6,
  /** The quote keeps this far (Coliseum pixels) inside its panel's rim. */
  quoteInset: 0.4,
  /** The close-up drawing crossfades in from the world's figure over this stretch of the glide in (0 to 1). */
  closeSwap: [0.45, 0.8] as const,
  /** A close-up drawing finished while you're already up close fades in over this many ms (it's made ahead, so rarely). */
  closeReadyFadeMs: 250,
  /**
   * Pawns standing in front of the statue (you, on its square) fade out as the camera comes in, by this much at the end
   * of the glide (1: all the way): they'd stand between the camera and the statue.
   */
  closeNearFade: 1,
  /** The close-up drawings are made this long after the page opens, a slice a frame (at most this many ms of work a frame). */
  closeBuildAfterMs: 1500,
  closeBuildBudgetMs: 4,
  /**
   * The quote renders in line by line once the camera arrives (the panel's squiggles fading as the first line comes): each
   * line fades in over this many ms, this long after the one above...
   */
  quoteFadeMs: 320,
  quoteLineMs: 140,
  /** ...and fades out over this many ms when you leave. */
  quoteOutMs: 200,

  // ---- The edge chips (a boss's face at the box's edge, pointing at its home off screen).
  /**
   * At most this many chips, for the nearest homes off screen. (Slice 3 review: with thirteen homes, more chips covered
   * the pawns' name tags on a phone. The four was fixed in render.ts and Town.tsx before; now it's here.)
   */
  maxChips: 4,
  /** Two chips' middles stay at least this many pixels apart (a chip is 46 across). (Was `CHIP_GAP` in render.ts.) */
  chipGap: 50,
  /**
   * A chip keeps this many pixels clear around its middle of any name tag, home's name, speech bubble or the buttons
   * (new in the slice 3 review; the face's ring is 23 across from its middle, its shadow a few more).
   */
  chipClear: 27,
  /** A chip that would cover one slides along its edge in steps this many pixels long, nearest spot first; none: it's left out. */
  chipSlideStep: 6,

  // ---- The press (slice 4; Eric, Oct 26: "a pulse/light up bold border of the tile… pressing down feels like pressing
  // down, lifting up releases"). It replaces slice 1's tap ripple (a thin gold ring growing from the finger, 700 ms).
  // No sound and no vibration (Eric: "leave those out").
  // Eric's slice 4 test: "it's like yellow, brown, yellow, then the tile… looks cheap". Now one clean thing: the face
  // dims evenly, one bold gold border lies exactly on the square's edge (over its seam), a soft glow outside it only.
  // (Slice 4 also sank the face 0.05 squares and shrank it 0.07, with its far wall in shadow and a fine darker inner
  // line on the border: gone.)
  /** While the finger is down, the pressed square's face dims evenly by this much (0 to 1). (Slice 4: 0.16, and twice that in the hole.) */
  pressDarken: 0.12,
  /** Its border is this bold: this many squares wide (at least `pressBorderMinPx` pixels), centered on the edge... */
  pressBorder: 0.1,
  pressBorderMinPx: 4,
  /** ...glowing this many pixels round, outside the square only (a blur, drawn only while a square is pressed or pulsing). */
  pressGlowPx: 14,
  /** The border's gold (the game's soft gold); and the ring's line and your destination's mark. */
  pressColor: "#ffd76a",
  pressEdge: "#c9962a",
  /** Lifted on the same square: the same border brightens to this gold, widens by this share and fades, over this many ms. (Slice 4: it grew outward by 0.35 of the square.) */
  pulseColor: "#fff1b8",
  pulseWiden: 0.4,
  pulseMs: 300,
  /** A home's card (slice 4) stands this many pixels over the building's top, above its floating name. */
  cardOverName: 30,
  /** Your destination's mark (a small gold ring on its square, until you arrive): this share of a square across. */
  targetSize: 0.5,

  // ---- Your trail (slice 4; Eric: "a little trail your guy leaves behind as he runs… like you're leaving little
  // droplets"). Yours only: other people's pawns leave none.
  /** A droplet on the square you leave, at most one every this many ms (so about three show while you run)... */
  trailEveryMs: 150,
  /** ...each fading and shrinking out over this many ms... */
  trailLifeMs: 520,
  /** ...this share of a square across when it lands, soft white at this opacity. */
  trailSize: 0.3,
  trailAlpha: 0.9,
} as const;
