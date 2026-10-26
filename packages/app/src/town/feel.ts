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

  // ---- Sizes, in squares.
  /** A boss's picture is this many squares tall. */
  bossSquares: 3.0,
  /** A bot's pawn. */
  botSquares: 1.25,
  /** Your pawn. */
  youSquares: 1.45,
  /** A house's pixels per square (the tent, 144 pixels wide, is about 3.9 squares). */
  housePxPerSquare: 37,
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
  /** The game writes each home's name on its sign board, in its pixel font... */
  signNames: true,
  /** ...when its letters would be at least this many pixels (else the board stays blank). */
  signMinPx: 6,
} as const;
