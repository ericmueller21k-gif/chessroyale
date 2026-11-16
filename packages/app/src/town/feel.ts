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
  /**
   * The longest the town waits, as it opens, for your pawn's pictures and your ride's frames (Eric, Nov 10: "your rider doesnt appear
   * for a few seconds"; Town.tsx readyYou): past it the town shows with you on foot and the ride appears the moment it's ready.
   */
  youWaitMs: 1000,
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
  /**
   * The street town's chase camera (Nov 5, round 4; brief-town-rows.md "the player's view"): low behind your pawn, looking down the
   * street the way you're heading, the horizon about a third of the way down, your pawn from behind in the lower middle, the rows on
   * both sides filling the screen. Zoomed out (−) it rises and draws back by the zoomOut numbers below. Phone and computer, blended by
   * the box's shape as the town's are.
   */
  camStreetWide: { h: 3.2, th: 18, back: 3.0, R: 30, kx: 0.4, fW: 0.6, cy: 0.4, rim: 16, rimX: 1.6 } as CamSet,
  camStreetTall: { h: 3.2, th: 18, back: 3.0, R: 30, kx: 0.42, fW: 0.95, cy: 0.42, rim: 16, rimX: 1.2 } as CamSet,
  /**
   * The street town's zoom steps, − and + moving one a press (Nov 5, round 4; Eric: "I think this is a pretty good default"; "3 or 4 zoom
   * steps"), phone and computer each: fully in (low and close, about head height, the horizon a little below the middle, the ground the
   * lower 40%: the run-through frames), the default (camStreetTall / Wide: the mockup's), out (a step further back and higher: the
   * mockup's zoomed-out view) and an overview (high, for finding your way: today's town's camera). Between two steps the camera blends
   * their numbers. Every figure stays on screen at each.
   */
  streetZoomSteps: [
    {
      tall: { h: 1.5, th: 3, back: 2.6, R: 30, kx: 0.42, fW: 1.0, cy: 0.55, rim: 16, rimX: 1.2 },
      wide: { h: 1.5, th: 3, back: 3.0, R: 30, kx: 0.4, fW: 0.42, cy: 0.55, rim: 16, rimX: 1.6 },
    },
    {
      tall: { h: 3.2, th: 18, back: 3.0, R: 30, kx: 0.42, fW: 0.95, cy: 0.42, rim: 16, rimX: 1.2 },
      wide: { h: 3.2, th: 18, back: 3.0, R: 30, kx: 0.4, fW: 0.6, cy: 0.4, rim: 16, rimX: 1.6 },
    },
    {
      tall: { h: 5.6, th: 24, back: 4.35, R: 30, kx: 0.42, fW: 0.95, cy: 0.42, rim: 20, rimX: 1.2 },
      wide: { h: 5.6, th: 24, back: 4.35, R: 30, kx: 0.4, fW: 0.6, cy: 0.4, rim: 20, rimX: 1.6 },
    },
    {
      tall: { h: 9.3, th: 42, back: 5.7, R: 30, kx: 0.42, fW: 1.31, cy: 0.36, rim: 12.5, rimX: 1.16 },
      wide: { h: 7.8, th: 36, back: 6.7, R: 30, kx: 0.4, fW: 0.72, cy: 0.39, rim: 11.5, rimX: 2.3 },
    },
    // (Eric, Nov 13: "one more zoom out ... to that old one that we used to have ... That should be the furthest zoom you can go": the
    // old town's zoomed-out camera, the overview with zoomOutHeight, zoomOutBack, zoomOutPitch and zoomOutRim applied in full.)
    {
      tall: { h: 16.275, th: 48, back: 8.265, R: 30, kx: 0.42, fW: 1.31, cy: 0.36, rim: 15.625, rimX: 1.16 },
      wide: { h: 13.65, th: 42, back: 9.715, R: 30, kx: 0.4, fW: 0.72, cy: 0.39, rim: 14.375, rimX: 2.3 },
    },
  ] as readonly { tall: CamSet; wide: CamSet }[],
  /**
   * The step the street town opens at and how long a press of − or + glides (ms). Eric, Nov 5: "If number one is the closest, then we're
   * going with number three for the default": the third step (index 2, "out"), one further back than round 4's default (1, the mockup's
   * camera, still the second step). The park's step out goes from there to the overview (3).
   */
  streetZoomStart: 2,
  streetZoomMs: 350,
  /** The furthest the park's step out goes: the overview (3). The farthest step (4, Nov 13) is only ever chosen with −. */
  streetZoomParkMax: 3,
  /**
   * The park zooms out a step (Nov 5, round 4; Eric, a trial he may revert: "make it zoom out one level when you hit the area that's the
   * … center town square … if it's like a nice transition"): coming into the park (the plus with the chess tables) eases the camera
   * one step out over `parkZoomMs`; leaving eases back to the step you had. A press of − or + in the park wins. Off: false.
   */
  parkZoomOut: true,
  parkZoomMs: 600,
  /** The box shapes (width / height) where the blend is all phone and all computer. */
  aspectTall: 0.6,
  aspectWide: 1.4,
  /** The street town (an admin's, Nov 5) opens zoomed in instead (Eric, Nov 5); − / + work as before. */
  streetStartZoomedOut: false,
  /**
   * The street town's near side (Nov 5, the art's "nothing between the camera and you"): the buildings' fronts (and the sheds)
   * standing more than this many squares nearer the camera than you aren't drawn, and the trees fade out over `streetTreeFade`
   * squares nearer still. The low things there (hedges, beds, bushes) are drawn.
   */
  streetNearCut: 0.9,
  /**
   * Draw only what the rows let you see (Nov 5, round 4; seen.ts): at the in and default zoom steps, the ground, the props and the
   * buildings no straight line from your square (or the camera's) reaches past the lots are left out; the skyline's towers always show.
   */
  streetCull: true,
  /** A skyline tower no ray from you reaches still shows over the rows out to this far (squares); past it, it's in the haze. */
  streetTowerReach: 8,
  streetTreeFade: 1.5,
  /**
   * The street town's camera turn (Nov 5, round 5: the camera faces north, but for a boss home's strip, strips.ts): stepping onto or
   * off a strip eases a quarter turn over this many ms (the brief: "about 0.5 s"). (Round 4's chase camera turned at corners on it.)
   */
  streetTurnMs: 500,
  /**
   * Looking around (Nov 5, round 5, turn.ts LookAround): a drag across the box's width turns the camera this many degrees (Eric's
   * addendum: "a drag across the screen width is about half a turn"), and the first step after eases it back over this many ms.
   */
  streetLookPerWidth: 180,
  streetLookBackMs: 300,
  /**
   * Hold to run (Nov 5, brief-street-controls-map.md; Eric: "if you hold it in the direction … right away … it starts running in that
   * direction"): a press held still (not past `dragPx`) this many ms is a run, not a tap; one that moves past `dragPx` first is a look
   * round. Quick taps are about 80 to 150 ms on a phone; much more than 200 ms and a run feels late.
   */
  streetHoldMs: 180,
  /**
   * The finger's dead zone while running (px): within this of your pawn's middle on screen, a held finger asks for no direction (a run
   * not yet started waits for the finger to leave it; a run going on keeps its way).
   */
  streetRunDeadPx: 14,
  /**
   * Locking a new view (Nov 5; Nov 6, Eric: "about like 45 degrees … everything should be split … 45 degrees … if you hit like negative 50
   * degrees and then run in that new direction, it should snap to the new direction"): letting go of a look round eases the camera to the
   * nearest quarter (north, east, south or west) over `streetSnapMs`: the split is 45 degrees either side of each quarter, so this is 45
   * and every let-go snaps. Any way of setting off (a tap, a run, an arrow) locks it in as the base heading.
   */
  streetSnapDeg: 45,
  streetSnapMs: 160,
  /**
   * The minimap (Nov 5; Eric: "an overlay on the top right, partially see-through, not super big"): its width a share of the town's
   * box on a phone, and on a computer (in the frame) a smaller share, never wider than `mapMaxPx`; its opacity; the large view's share
   * of the box's smaller side (never past `mapBigMaxPx`). The Colosseum's band on its top edge is `mapBandPx` high at the small size.
   */
  mapShare: 0.26,
  mapShareComputer: 0.13,
  mapMaxPx: 168,
  mapOpacity: 0.7,
  mapBigShare: 0.9,
  mapBigMaxPx: 620,
  mapBandPx: 3,
  /**
   * The street town's buildings drawn this much bigger than their pictures' 37 px a square (the homes and the rows' fronts together;
   * hedges, sheds, lamps, trees and figures don't grow). 1: as drawn. (Nov 5, round 4: tried at 1.3 after the run-through frames; Eric:
   * "don't scale the whole town up", so it stays 1 and the low fronts step up instead, rows.ts.) A home too wide for its row's end
   * slides inward along it, whatever the scale; 1.3 is the most the rows hold.
   */
  streetBuildScale: 1,
  /**
   * (Nov 5, round 6, ported in the north edge round; the brief: "Moo's paddock and Ginger's dome sit low in their rows … look sunk or short
   * beside their neighbors") These homes are drawn this much bigger again in the street town, their foot on their row's front line where it
   * was, so their height sits with their neighbors' (a paddock's fence and post, an igloo's dome, beside fronts of three and four floors).
   * A home this makes too wide for its row's end slides inward along it, as any does (rows.ts).
   */
  streetHomeScale: { moo: 1.3, gingerbread: 1.3 } as Readonly<Record<string, number>>,
  /** While it turns, the clouds slide this many box widths a quarter turn (the sun stays put). */
  streetTurnClouds: 1.3,
  /**
   * The buildings' boxes (Nov 5, round 3; box-draw.ts): a roof face whose drawing would be under this many pixels across is left out
   * (a water tank's legs from afar), and a face is drawn in one piece (not two triangles) when its last corner would land within this
   * many pixels of where one piece puts it.
   */
  boxTinyPx: 3,
  boxWholePxFine: 0.75,
  /**
   * A wall (a side, or a front seen at a slant) is drawn in upright strips, so its far end stands shorter than its near one: enough that
   * its top steps at most this many pixels a strip, up to this many strips (fine: a strip costs WebGL a few vertices).
   */
  boxStripFine: 1.5,
  boxStripsFine: 24,
  /** How long a frame may spend getting buildings' roofs ready before they're seen (ms; the nearest first). (Round 4: 2.5 before.) */
  boxBakeMs: 1.5,
  /** The same while you stand still and the view isn't turning (Nov 11: a still frame has room, and what a look round shows gets ready sooner). */
  boxBakeStillMs: 4,
  /**
   * The street town's loading screen (Nov 11, Eric: "loads it all in at once and then it stays there"; Town.tsx `loadTown`): the work done
   * between two of its frames (ms; the bar moves between them), and the bar's share for painting every picture (the rest: uploading them).
   */
  loadSliceMs: 40,
  loadPaintShare: 0.5,
  /** How long it waits for the sidekicks' sheets (ms; they load as the town opens): past it, one not in yet is drawn when it's in, as before. */
  loadSheetWaitMs: 3000,
  /** A home's floating name: how far over its roof it floats (px), and the step it drops by to keep off the buildings behind. */
  nameOverRoof: 6,
  nameDropStep: 3,
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
  /** The chat text is white once night's weight reaches this, dark ink before it (sky.ts `skyTone`; Eric, Oct 28). */
  chatNightAt: 0.5,
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

  // ---- The lights at dusk and night (Oct 27, Eric: lamps in the park "so when it's night and also dusk that they turn
  // on", and the homes glowing "from inside a little bit… so it clearly kind of shows… there's some liveliness in the
  // town"). Where each light is, its color and its strength are data beside the art (houses/*.ts `…_LIGHTS` and
  // `…_POOLS`, the lamp's in houses/park.ts); these shape how they all shine. Drawn after the world's tint, added onto it,
  // so they really glow; nothing at all by day.
  /** How strongly the lights shine in each look of the sky (0: off); as the sky blends between looks, so do they. */
  lightsAt: { dawn: 0, day: 0, dusk: 0.7, night: 1 },
  /**
   * The glow spilling round a lit window or glass, in the picture's pixels: two bands, the inner out to this far at this
   * share of the light's strength, the outer to this far at this share (pixel-art bands, like the lanterns' own glows).
   */
  lightSpill: [
    [1.5, 0.5],
    [3.2, 0.22],
  ] as const,
  /** A halo round a lantern's or a lamp's glass (its radius is the light's own `halo`): three bands, out to this share of it at this share of its strength. */
  lightHalo: [
    [0.42, 0.42],
    [0.72, 0.22],
    [1, 0.09],
  ] as const,
  /** A pool of light on the ground: three bands, out to this share of its size at this share of its strength. */
  lightPool: [
    [0.5, 1],
    [0.78, 0.6],
    [1, 0.28],
  ] as const,
  /** The flicker of the lights marked `flicker` (candles, lanterns, torches): how deep at most (0: none), and how slow (ms a sway). No blinking. */
  lightFlicker: 0.16,
  lightFlickerMs: 700,
  /** The light layer is cleared and laid on the world in tiles this many CSS pixels square: only the tiles a light touches. */
  lightTilePx: 64,

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
  /**
   * Back in the town after a game with a bot (Oct 27): you on your stool, the bot across; it gets up and wanders off
   * after this long (unless you've opened its table's card, which holds it).
   */
  botLeaveAfterGameMs: 4000,
  /**
   * The bots take turns (Oct 28, Eric: "they work on 1 minute timer, 10 out at a time, randomly one each minute starts to
   * head home, is replaced by another"; docs/decisions/2026-10-28-bots-rotation.md). `botsOut` are in the world at once
   * (six before Oct 28's turns; ten measured against main: the decision), the others at home. Every `botTurnMs` one out (free, and at
   * least `botTurnAway` steps from you) walks home and fades into its door over `botFadeMs`; then the bot home longest
   * fades in at its own door and walks to the square. A bot that came out less than `botOutAtLeastMs` ago isn't sent
   * home yet (so the last of one round never turns straight back at the next round's first minute). (Before: six out, a
   * turn every 10 to 20 s, fading out and in where they stood.)
   */
  botsOut: 10,
  botTurnMs: 60000,
  botTurnAway: 5,
  botFadeMs: 500,
  botOutAtLeastMs: 90000,

  // ---- Sizes, in squares.
  /** A boss's picture is this many squares tall. */
  bossSquares: 3.0,
  /**
   * Some bosses smaller than that in the town square, by their home's id (Eric, Oct 26: "Sawyer the raccoon and the pig
   * are massive. And the chameleon … about 65% or three-fourths"; Puddles and Jefferson are the right size).
   */
  // (Don Dough has no town figure: his intro draws his art 1:1 at the room's 37 px a square, 104 / 37 / 3 of bossSquares.)
  bossScale: { sawyer: 0.7, pig: 0.7, smudgy: 0.7, zebra: 0.94 } as Readonly<Record<string, number>>,
  /** A bot's pawn. */
  botSquares: 1.25,
  /**
   * A sidekick (Oct 28) stands this many squares tall from its idle's top to its feet: a bot's pawn's height (its body is
   * 0.69 of its box: botSquares x 0.69). Its shadows are about a pawn's (`sidekickShadow`, the size a boss's are given).
   */
  sidekickSquares: 0.87,
  sidekickShadow: 0.9,
  /** Your pawn. */
  youSquares: 1.45,
  /**
   * Rides (Oct 31): a pawn on its ride is the size it is on foot (its ride drawn at the pawn's scale: the art's 100 units are
   * the pawn's box). Each ride's `foot` is the line on its drawing (in those units) that stands on the square's middle, where
   * a pawn's base stands: the grasshopper's feet, the moon's shadow; `shadow` sizes the shadows under it as a sidekick's
   * (0: none; the moon floats and draws its own). Nov 1 (rides v2), every boss's ride: its feet, wheels, runners or tracks (a
   * unit or two over its lowest drawn row, which `npx tsx scripts/measure-rides.ts` logs), or the shadow it draws itself (the
   * bulb, the brush, the pup, the pogo, the crane, the log: shadow 0). Its back and front views stand on the same line.
   */
  rides: {
    "riding-chirp": { foot: 97, shadow: 1.15 },
    "moon-ride": { foot: 96, shadow: 0 },
    "hollow-bulb": { foot: 96, shadow: 0 },
    "smudgy-brush": { foot: 94, shadow: 0 },
    "alfil-howdah": { foot: 99.5, shadow: 1.3 },
    "balloon-pup": { foot: 97, shadow: 0 },
    "bigboy-buggy": { foot: 98, shadow: 1.2 },
    "boingo-pogo": { foot: 98.5, shadow: 0 },
    "folio-crane": { foot: 98, shadow: 0 },
    "ginger-sled": { foot: 95, shadow: 1.2 },
    "jefferson-giraffe": { foot: 96.5, shadow: 1 },
    "puddles-mower": { foot: 98, shadow: 1.3 },
    "sawyer-dozer": { foot: 100, shadow: 1.4 },
    "rodeo-bull": { foot: 97, shadow: 1.2 },
    "cheetah-shoes": { foot: 95, shadow: 0.9 },
    "log-roller": { foot: 96, shadow: 0 },
    "pen-pony": { foot: 98.5, shadow: 1.3 },
    // (An outfit, Nov 10: drawn with the rides' kit; its shoes' soles.)
    "banana-suit": { foot: 98, shadow: 1.1 },
  } as Readonly<Record<string, { foot: number; shadow: number }>>,
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
  farHaze: 0.7,
  /** A house's pixels per square (the tent, 144 pixels wide, is about 3.9 squares). */
  housePxPerSquare: 37,
  /** A square drawn less than this many pixels tall (far off) gets no seam: it's barely visible there, and it halves the work. */
  seamMinPx: 7,
  /** Name tags hide past this fraction of the way to the rim. */
  tagFar: 2 / 3,
  /**
   * Name tags show only near you by default (Eric, Oct 28: "only people in the radius around you have names shown and as you walk they fade
   * in and out … about an 8x8 area of squares maybe 10x10"): a figure's tag shows while it is within this many squares of you in both
   * directions (about a 10 × 10 area), fading over the last `nameFadeSquares` at the edge (full at radius − fade / 2, gone at radius + fade / 2;
   * tags.ts, `nameAlpha`). The figures themselves are always drawn. "Everyone" in Town settings turns this off.
   */
  nameRadius: 5,
  nameFadeSquares: 1,
  /**
   * A tag's drawn alpha eases toward that target over about this long (ms) rather than following it frame by frame (Nov 6: a slow frame
   * walks you a square at once, and the fade popped), but never more than `nameEaseStep` of the way from 0 to 1 in one frame.
   */
  nameEaseMs: 150,
  nameEaseStep: 0.5,

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
  /** The quote keeps this far (Colosseum pixels) inside its panel's rim. */
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
  // droplets"). Yours only: other people's pawns leave none. On a ride with a trail (Nov 1, rides v2; Eric: "Chirp's…
  // definitely the way to go"), its own mark on every square you leave instead, on its own times (rides.ts, `trail`).
  /** A droplet on the square you leave, at most one every this many ms (so about three show while you run)... */
  trailEveryMs: 150,
  /** ...each fading and shrinking out over this many ms... */
  trailLifeMs: 520,
  /** ...this share of a square across when it lands, soft white at this opacity. */
  trailSize: 0.3,
  trailAlpha: 0.9,

  // ---- The chess tables' games (Oct 27; Eric: "random moves back and forth … pieces disappearing … every 7 or 8 moves, it
  // just resets the boards back"). Look only: no rules, white and black in turn, each piece a step or three forward.
  /** A move every this many ms, sliding over this many ms (a small hop as it goes), a taken piece fading over this many. */
  tableMoveMs: 1100,
  tableSlideMs: 350,
  tableHop: 0.05,
  tableTakeMs: 260,
  /** After this many moves the pieces go back to their start and, this many ms later, play again. */
  tableMoves: 8,
  tableResetMs: 1400,
  /** A waiting table's ring under its free stool: this many squares across its radius, pulsing over this many ms. */
  tableRingR: 0.36,
  tableRingPulseMs: 420,
  /** Its pieces and clock aren't drawn this far into the far band (0 to 1): there they'd be specks. */
  tableFarCut: 0.5,
  /**
   * A table's board is lifted onto its picture in the camera's true perspective, which near the camera (low on the
   * screen) makes it grow without bound against the picture, a cut-out (Oct 28: Eric's warped boards). Where lifting
   * would draw it more than this much bigger than at the table's foot, it's worked out a little farther off, where it
   * still fits, and drawn at the picture's place and scale. Up to this, nothing changes (1.08 to 1.17 over the screen's
   * usual rows).
   */
  tableBoardGrow: 1.2,
} as const;

/**
 * Inside a shop (Nov 2, round 1: Babur's circus tent and Puddles' greenhouse; shops/ShopRoom.tsx,
 * docs/decisions/2026-11-02-shop-interiors-r1.md). The rooms' own numbers (their squares, the door, the shopkeeper's square) are in
 * shops/rooms.ts.
 */
export const SHOP_FEEL = {
  /**
   * "Close" (Eric, Nov 2: "super zoomed resembling normal 3rd person sizing"; + inside): the camera comes down and in behind you and
   * looks more ahead than down. These four replace the town's camTall and camWide numbers of the same names (the box's shape still
   * blends the rest). Zoomed out (−) inside is the town's own zoomed-in camera (camTall / camWide as they are).
   */
  close: { h: 3.2, back: 2.4, th: 24, cy: 0.3 },
  /**
   * The zoom you start at inside a home (0 Close, 1 the town's zoomed-in camera). Eric, Nov 3: "When you walk into the house, the
   * zoom should be the further out of the two by default" (it was Close); `docs/decisions/2026-11-03-home-zoom-out.md`.
   */
  startZoom: 1 as 0 | 1,
  /**
   * You can talk to the Shopkeeper from this many squares away (either direction, from its nearest square). A tap on it walks
   * you to the square this far in front of it (the counter between you), as the mockup's "at the counter" view stands.
   */
  talkRange: 3,
  /**
   * An upright piece nearer the camera than this many squares (its depth: the front wall as you stand at the door, a prop
   * between the camera and you) fades out, gone by `nearGone`: up close it would fill the screen. (Close puts you about 3.5 deep.)
   */
  nearFull: 3,
  nearGone: 2,
  /**
   * In a cave (a room that isn't a box: Hollow's, Nov 3), an upright piece nearer the camera than you that's drawn over you (the
   * passage's walls south of you, the mouth's arch as you come in, with the town's far camera behind you) is drawn this opaque, so the
   * rock never hides you. A box room's walls stand at its edges, so this never comes up there.
   */
  seeThrough: 0.35,
  /**
   * Going in (and out): the town zooms in on the door, this many times bigger over `doorZoomMs`, then fades to black over
   * `fadeMs`, and the room fades in from black over `fadeMs` (going out: the same, backwards).
   */
  doorZoom: 2.4,
  doorZoomMs: 600,
  fadeMs: 260,
  /**
   * (Nov 11, Eric: "when you go into a building, just make it take an extra second... and just load the whole inside.") While the
   * town zooms on the door, the room's pictures are painted at most this many ms a frame (shops/load-slice.ts); the rest behind the
   * black. Inside, the black lifts once the room has drawn `warmFrames` frames (their first-time costs, WebGL's set-up among them,
   * under the black), or after `warmMaxMs` at the most.
   */
  loadSliceMs: 4,
  warmFrames: 3,
  warmMaxMs: 1000,
  /**
   * The floor is drawn flat on its squares in blocks of this many squares a side (each block two triangles of one baked picture of
   * the whole floor): 1 is exactly the mockup's (a tile a draw), 2 a quarter of the draws, the room's gentle curve barely bent.
   */
  floorBlock: 2,
  /** ...a block drawn taller than this many pixels (near the camera, where a block's perspective bends most) is drawn a square at a time. */
  floorSplitPx: 90,
  /** The fire hoops' glow (Babur's): its warm pool under each hoop this strong (0 to 1, over the art's own `strength`). */
  glow: 1,
  /**
   * Your ride comes in with you (Eric, Nov 2: "I want the ride, your rider goes in with you"): drawn under you inside as the town
   * draws it. false: it waits outside and you walk in on foot (round 1's way), and come out on it.
   */
  rideInside: true as boolean,
  /**
   * Jefferson's moving crew (Nov 4; Eric: "If you block it, it stops. If you move out of the way, it starts moving again"; the art's
   * loops, shop-grex-nov4.md; shops/grex-crew.ts): the scissor lift and the forklift drive their loops a square every `stepMs` (a slow
   * walk), the lift holding its platform up `upHoldMs` at each stop and resting `endMs` at its row's west end, the forklift resting
   * `homeMs` at home between its laps. Before each square a machine looks at it and the one after it: anyone standing there and it
   * waits, going on once they're clear. The pallet's last few px onto the shelf slot (or off it) take `palletEaseMs`. Each client
   * runs them from its own room's clock: no server state.
   */
  crew: { stepMs: 620, upHoldMs: 1760, endMs: 1200, homeMs: 1400, palletEaseMs: 150 },
  /**
   * Ginger's elves at work in his igloo (Nov 5; the art's loops, shop-ginger-nov5.md; shops/ginger-elves.ts): the walkers at
   * `walkerSpeed` squares a second, each starting `walkerStart` ms into its loop (so they don't move as one); the dispensing pair at
   * `pairSpeed`, standing `stopBeatMs` after A's four jobs at each stop (tap, boxOut, fill, full: his art's times), elf B `bBehind`
   * squares behind A and taking `bMoveMs` to step over to his place at a stop and back. Before walking on, an elf looks at the points
   * `look` squares ahead of it: anyone there (you, the boss walking in) and it waits where it is. Each elf takes its own square and,
   * walking, the square `takesAhead` ahead: you can't walk there; a tap walks you round them (up
   * the other staircase if one stands on the nearer), and one in your way as you walk has you wait where you are, then go on (or round
   * by the other way once it's open). Each client runs them from its own room's clock.
   */
  elves: {
    walkerSpeed: 1.6,
    walkerStart: { red: 0, green: 2600, blue: 5200 },
    pairSpeed: 1.4,
    stopBeatMs: 300,
    bBehind: 0.5,
    bMoveMs: 300,
    look: [0.35, 0.7, 1.05],
    takesAhead: 0.5,
  },
  /**
   * Boingo's claw machine (Nov 6): standing still at its spot, the camera glides in on the cabinet over `glideMs` (the statue's
   * close-up, TOWN_FEEL.closeGlideMs), through a longer lens: the cabinet (its front's foot to its glass ceiling's back) `tall` of the
   * screen's height (at most `wide` of its width, the lens at most `maxMag`), its middle `atY` down the screen, above the machine's
   * controls docked at the bottom.
   */
  claw: { glideMs: 900, tall: 0.56, wide: 0.8, maxMag: 3, atY: 0.4 },
  /**
   * Rolling Dough's people (Nov 11, shops/zebra-scene.ts). A line stays up `lineMs` plus `perCharMs` a character (the longest, 58
   * characters, about 4.4 s). The guards say one now and then (`guardMs`, at random), sooner while you're beside them or by the back
   * door (`guardNearMs`). The back table's chatter: its first line `firstMs` after you come in, `lineGapMs` between lines, `exchangeGapMs`
   * between exchanges. The talk beat: the crew `staggerMs` apart; Fedora's line `aimLeadMs` after his draw; they lower `lowerAfterMs` into
   * Don's "Relax"; his challenge line `gapMs` after. While they aim, each points his roll at you (zebra-scene.ts aimAt): your rows
   * toward the camera count `aimRowK` of a column on screen, and the roll at his shoulder sits `aimDrop` squares above your middle.
   * `dim`: the back room's dark wash (the art's mockup: 0.36), its lights added over it.
   */
  zebra: {
    lineMs: 1800,
    perCharMs: 45,
    guardMs: [9000, 15000],
    guardNearMs: [3500, 6000],
    firstMs: 900,
    lineGapMs: 500,
    exchangeGapMs: 1400,
    beat: { staggerMs: 120, aimLeadMs: 150, lowerAfterMs: 900, gapMs: 300, aimRowK: 0.8, aimDrop: 0.7 },
    /**
     * The walk-out in the back room after his challenge line (Eric, Nov 11: "watch all of them walk out, like pick up the stuff in the
     * back and walk out"; zebra-scene.ts WalkOut): the crew set off `followMs` apart, the door guard comes in for your chair at once; a
     * square every `stepMs`; `pickMs` picking a thing up (in his hooves halfway); Don gets up `donAfterMs` after the last is picked up,
     * a square every `donStepMs`, and you set off `youAfterMs` after him. Through the door each fades out between rows `fade[0]` and
     * `fade[1]` (in the front room, in between the same distance from its door).
     */
    out: { followMs: 450, stepMs: 200, pickMs: 400, donAfterMs: 800, donStepMs: 240, youAfterMs: 450, fade: [10.1, 10.8] },
    dim: 0.36,
    /**
     * His challenge's set-up in the front room (Eric, Nov 11: "4 of his goons who follow you in carry a chair and a board and a table, 1
     * item per goon"): the first goon `leadMs` after you start walking out, the next each `followMs` after; a square every `stepMs`;
     * `setMs` setting it down (it's in place halfway); a square every `backMs` stepping back to where he watches, `watchBack` rows behind
     * the table, `watchGap` squares apart. His line waits `holdMs` after you're both on your marks, so all is set and everyone watching.
     */
    setup: { leadMs: 500, followMs: 450, stepMs: 220, setMs: 350, backMs: 260, watchBack: 2.2, watchGap: 0.95, holdMs: 2600 },
    /** How high a goon carries his thing (the room's pixels over his feet: at his hooves); the kept board on its table's top. */
    carryUp: 26,
    boardUp: 23,
  },
} as const;

/**
 * The Hidden Boss's child's room (Nov 12: a mockup, shops/recluse-scene.ts; not reachable from the town yet). Times in ms.
 * `play`: one half-move of the child playing himself: he thinks, reaches, carries the piece over, sits back, looks; the start's pause,
 * the pause on the mate and the fade back to the start. `kid`: his drawing's size (room pixels a drawing pixel), the board's (squares
 * across), the piece's lift as it's carried (board squares). `summon`: the summoning's beats, each from its start.
 */
export const HIDDEN_ROOM_FEEL = {
  /**
   * His game's pace (ms; Nov 13, Eric: "it would take him realistically like a while to play out the game. Cause that's the point").
   * Round 3 (Nov 13): every half-move he gets up (`rise`), walks round behind the board to that side (`walk` squares a second), sits
   * back on his heels (`sit`), thinks (each move its own, `think` times 0.6 to 1.6), leans in and reaches, carries, comes back, and
   * looks up. About 10.5 s a half-move: the whole game about 14 minutes.
   */
  play: { first: 1400, think: 2000, reach: 900, carry: 700, back: 800, look: 600, rise: 640, walk: 1.0, sit: 640, end: 3200, fade: 1100 },
  /** His drawing's size in the room, the board's size (squares; small, still real chess), a carried piece's lift, a walk step (ms). */
  kid: { scale: 0.8, board: 1.15, lift: 0.7, stepMs: 240 },
  summon: {
    /** The freeze frame: the players' figures still images (a flash). */
    freeze: 0,
    /** The rays shoot from the board, outward and upward, growing. */
    rays: 350,
    /** The four burst into particles all at once; drawn into the light. */
    burst: 1300,
    /** The light and particles draw back over the board, then fall and splash into it. */
    drawBack: 2350,
    fall: 2850,
    splash: 3150,
    /** The board wobbles up and down, settling; then quiet. */
    wobbleMs: 1100,
    quiet: 4500,
    /** Then the transition: the room closes in on the board (an iris), black, and the match. */
    iris: 5500,
    irisMs: 900,
    end: 6900,
    /** The particles each player bursts into. */
    bits: 90,
  },
} as const;
