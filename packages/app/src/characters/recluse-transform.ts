/**
 * The Hidden Boss's transformation (Eric, Nov 14; docs/decisions/2026-11-14-recluse-transformation.md): the figures his phase
 * change draws over the board, from his cutscene's end to his leap home (components/RecluseTransform.tsx draws them; the beats are
 * PHASE_CHANGE in recluse-phase2.ts).
 * - `RECLUSE_CHANGE`: the man in his own drawing (RECLUSE's size, so the board's leap and his place work as ever): kneeling as the
 *   cutscene left him, the book at his feet opening, the light taking him (his eyes white), lifted in it, his arms hanging relaxed
 *   at his sides the whole time, hovering; then, after the white-out, in the suit and helmet (recluse.ts, `suitFrame`), the visor
 *   flipping up for his line (his eyes glowing blue) and back down, the jump, the landing on the drop, the book back in his hands
 *   and the leap home.
 * - `RECLUSE_CHANGE_BOOK`: the open book glowing on the board while he stands, hovers and jumps (his frames leave it out).
 * - `RECLUSE_CHANGE_KID`: the ghost of him as a child, beside him until the white-out (the cutscene's drawing without the man).
 * Where they stand: as the cutscene drew them (its man's size, its ground), shares of the board's width.
 */
import { RECLUSE, recluseLayers, suitFrame, type ReclusePose, type Visor } from "./recluse.ts";
import { RECLUSE_CUTSCENE } from "./recluse-ages.ts";
import { lazyAnim, type Character, type Frame, type Layer } from "./sprite.ts";

// ---- The figures.
/** The cutscene draws the man with the child in one taller drawing: his layers lifted into RECLUSE's. */
const LIFT = RECLUSE_CUTSCENE.h - RECLUSE.h - 4;
const manPart = (l: Layer) => l.part in RECLUSE.parts;
const manOnly = (f: Frame): Frame => ({ ms: f.ms, layers: f.layers.filter(manPart).map((l) => ({ ...l, y: l.y - LIFT })) });
const kidOnly = (f: Frame): Frame => ({ ms: f.ms, layers: f.layers.filter((l) => !manPart(l)), specks: f.specks, pal: f.pal });
const noBook = (f: Frame): Frame => ({ ...f, layers: f.layers.filter((l) => !l.part.startsWith("book:")) });
const bookOnly = (f: Frame): Frame => ({ ...f, layers: f.layers.filter((l) => l.part.startsWith("book:")) });
const A = RECLUSE.anims;
const chantF = () => A.chant!.frames;
/** A frame of a pose; `i`: with the chant's light (its specks and lit palette) as its frame `i`. */
const fr = (ms: number, p: ReclusePose, i = -1): Frame => {
  const c = i >= 0 ? chantF()[i % 8]! : null;
  return { ms, layers: recluseLayers(p), ...(c ? { specks: c.specks, pal: c.pal } : {}) };
};
/** The book's middle on the ground before him (drawing space). */
const OPEN_AT = [46, 123] as const;
const SLUMP_ARMS = { elbowR: [32, 58], wristR: [38, 78], elbowL: [60, 58], wristL: [55, 78] } as const;
/** His arms hanging relaxed at his sides (Eric, Nov 14: "in a more relaxed position to his side the whole time"). */
const SIDE_ARMS = { elbowR: [31, 60], wristR: [33, 80], elbowL: [61, 60], wristL: [60, 80] } as const;
/** The same, drifting a little out from his sides. */
const SIDE_ARMS_OUT = { elbowR: [30, 60], wristR: [31, 80], elbowL: [62, 60], wristL: [62, 80] } as const;
const onGround = (book: "flat" | "half" | "read", at: readonly [number, number] = OPEN_AT, arms: object = SLUMP_ARMS) => ({ book, at: [...at], loose: true, clutched: false, ...arms }) as unknown as ReclusePose["hold"];
const kneelP = (eyes: string, extra: Partial<ReclusePose> = {}): ReclusePose => ({ stance: "kneel", dip: 4, face: { eyes, brows: "up", mouth: "tight" }, ...extra }) as ReclusePose;
const TAKEN = { eyes: "possessed", brows: "up", mouth: "tight" } as const;
const wind3 = (i: number) => ((i % 3) + 1) as 1 | 2 | 3;
/** Phase 2 standing in the suit: his stance, his arms at his sides; `extra` over it. (The helmet hides his hair: no wind.) */
const P2 = (i: number, extra: Partial<ReclusePose> = {}): ReclusePose => ({ phase: 2, stance: "wide", tie: i % 2 ? 1 : 0, face: { eyes: "hard", brows: "stern", mouth: "stern" }, hold: onGround("read", OPEN_AT, SIDE_ARMS), ...extra }) as ReclusePose;
/** A frame in the suit, its visor as given; the book left on the board (drawn apart). */
const S = (f: Frame, visor: Visor = "down") => suitFrame(noBook(f), visor);

export const RECLUSE_CHANGE: Character = {
  ...RECLUSE,
  id: "recluse-change",
  name: "Hidden Boss (transformation)",
  anims: {
    // As the cutscene left him: on his knees beside the child.
    together: lazyAnim(() => ({ loop: true, frames: RECLUSE_CUTSCENE.anims.together!.frames.map(manOnly) })),
    // The book opens before him: its cover lifts, it falls open, the pages catch light; he looks down at it.
    open: lazyAnim(() => ({
      loop: false,
      frames: [
        fr(260, kneelP("down", { hold: onGround("flat", [46, 125]) })),
        fr(220, kneelP("down", { dip: 3, hold: onGround("half") })),
        fr(220, kneelP("down", { dip: 3, hold: onGround("half") }), 0),
        fr(400, kneelP("down", { dip: 3, hold: onGround("read") }), 1),
      ],
    })),
    glowing: lazyAnim(() => ({ loop: true, frames: Array.from({ length: 8 }, (_, i) => fr(100, kneelP(i === 5 ? "shut" : "down", { dip: 3, hold: onGround("read") }), i)) })),
    // The light takes him: his head goes back, his eyes go totally white; his arms stay down.
    burst: lazyAnim(() => ({ loop: true, frames: Array.from({ length: 8 }, (_, i) => fr(100, kneelP("possessed", { dip: 2, headDy: -1, wind: i < 4 ? 0 : 1, face: { ...TAKEN, mouth: i % 4 < 2 ? "grit" : "tight" }, hold: onGround("read") } as Partial<ReclusePose>), i)) })),
    // Lifted in the beam: off his knees, slowly, his arms at his sides, his hair pushed back.
    rise: lazyAnim(() => ({
      loop: false,
      frames: [
        noBook(fr(320, kneelP("possessed", { dip: 2, wind: 1, headDy: -1, face: TAKEN, hold: onGround("read") } as Partial<ReclusePose>), 0)),
        noBook(fr(380, { stance: "low", dip: 2, wind: 2, headDy: -1, face: TAKEN, hold: onGround("read", OPEN_AT, { elbowR: [32, 59], wristR: [35, 79], elbowL: [60, 59], wristL: [58, 79] }) } as ReclusePose, 2)),
        noBook(fr(380, { stance: "bend", dip: 1, wind: 3, headDy: -1, face: TAKEN, hold: onGround("read", OPEN_AT, SIDE_ARMS) } as ReclusePose, 4)),
        noBook(fr(380, { stance: "rise", wind: 1, headDy: -1, face: TAKEN, hold: onGround("read", OPEN_AT, SIDE_ARMS) } as ReclusePose, 6)),
        noBook(fr(440, { stance: "stand", wind: 2, headDy: -1, face: TAKEN, hold: onGround("read", OPEN_AT, SIDE_ARMS) } as ReclusePose, 0)),
      ],
    })),
    // In the beam: hovering, his head back, his eyes white, his arms drifting a little off his sides, his hair streaming.
    beam: lazyAnim(() => ({ loop: true, frames: Array.from({ length: 6 }, (_, i) => noBook(fr(110, { stance: "stand", air: true, wind: wind3(i), headDy: -1, breath: i % 3 === 1 ? 1 : 0, tie: i % 2 ? 1 : -1, face: { ...TAKEN, mouth: i % 6 < 3 ? "tight" : "grit" }, hold: onGround("read", OPEN_AT, i % 6 < 3 ? SIDE_ARMS : SIDE_ARMS_OUT) } as ReclusePose, i))) })),
    // Revealed: in the suit and helmet, the visor down, standing, his arms at his sides.
    revealed: lazyAnim(() => ({ loop: true, frames: Array.from({ length: 6 }, (_, i) => S(fr(120, P2(i, { breath: i >= 3 ? 1 : 0 })))) })),
    // The visor flips up into the dome (a frame on its way): his face, his eyes glowing blue, for his line; then back down.
    flipUp: lazyAnim(() => ({ loop: false, frames: [S(fr(90, P2(0)), "mid"), S(fr(90, P2(1)), "up")] })),
    faceOpen: lazyAnim(() => ({ loop: true, frames: Array.from({ length: 6 }, (_, i) => S(fr(130, P2(i, { breath: i >= 3 ? 1 : 0, face: { eyes: "glow", brows: "stern", mouth: "stern" } })), "up")) })),
    flipDown: lazyAnim(() => ({ loop: false, frames: [S(fr(90, P2(0, { face: { eyes: "glow", brows: "stern", mouth: "stern" } })), "mid"), S(fr(90, P2(1)), "down")] })),
    // The jump: crouched over the book, then up, and down on the drop; his arms stay at his sides.
    crouch: lazyAnim(() => ({ loop: false, frames: [S(fr(200, P2(1, { stance: "bend", dip: 1, hold: onGround("read", OPEN_AT, SIDE_ARMS_OUT) })))] })),
    air: lazyAnim(() => ({ loop: true, frames: [0, 1, 2].map((w) => S(fr(120, P2(w, { air: true, stance: "bend", tie: 1, headDy: -1 })))) })),
    land: lazyAnim(() => ({
      loop: false,
      frames: [
        { ...S(fr(90, P2(0, { stance: "low", dip: 1, hold: onGround("read", OPEN_AT, SIDE_ARMS_OUT) }), 0)), specks: A.leap!.frames[3]!.specks, shake: [0, 1], cue: "thud" },
        S(fr(110, P2(1, { stance: "bend", hold: onGround("read", OPEN_AT, SIDE_ARMS_OUT) }), 1)),
      ],
    })),
    // Landed, the arcs striking out from his hands at his sides.
    landed: lazyAnim(() => ({ loop: true, frames: Array.from({ length: 6 }, (_, i) => S(fr(110, P2(i, { hold: onGround("read", OPEN_AT, SIDE_ARMS_OUT) }), i))) })),
    // (The rest as before, in the suit: the book snapping shut into his hands, his leap home.)
    pickup: lazyAnim(() => ({ loop: A.pickup!.loop, frames: A.pickup!.frames.map((f) => suitFrame(f)) })),
    leap2: lazyAnim(() => ({ loop: A.leap2!.loop, frames: A.leap2!.frames.map((f) => suitFrame(f)) })),
  },
};
export const RECLUSE_CHANGE_BOOK: Character = { ...RECLUSE, id: "recluse-change-book", name: "Hidden Boss's book (transformation)", anims: { glow: lazyAnim(() => ({ loop: true, frames: chantF().map(bookOnly) })) } };
export const RECLUSE_CHANGE_KID: Character = {
  ...RECLUSE_CUTSCENE,
  id: "recluse-change-kid",
  name: "Hidden Boss as a child (transformation)",
  anims: { together: lazyAnim(() => ({ loop: true, frames: RECLUSE_CUTSCENE.anims.together!.frames.map(kidOnly) })) },
};

// ---- Where things are (shares of the board's width; the board is square): as the cutscene draws them.
/** His figure's width (the cutscene's man, and his figure on the board in phase 2's split). */
export const CHANGE_FIG = 0.24;
/** The cutscene's drawing (the man and the child), its width and left edge. */
export const SCENE_SHARE = (CHANGE_FIG * RECLUSE_CUTSCENE.w) / RECLUSE.w;
export const SCENE_LEFT = 0.5 - SCENE_SHARE / 2;
/** The ground under them, a share of the board's height. */
export const GROUND_Y = 0.66;
/** His feet where he knelt in the cutscene's light: he stands, jumps and lands there. */
export const SPOT = { x: SCENE_LEFT + (RECLUSE_CUTSCENE.foot[0] / RECLUSE_CUTSCENE.w) * SCENE_SHARE, y: GROUND_Y };
/** Where he leaps home to (his feet), by his place: a phone's boss bar above the board's top left; a computer's figure by its bottom left. */
export const CHANGE_PLACE = { phone: { x: 0.1, y: 0.38 }, computer: { x: -0.12, y: 1 } } as const;
/** A point of his drawing (RECLUSE's pixels) with his feet at `feet`, on the board (shares). */
export const onBoard = (feet: { x: number; y: number }, px: number, py: number) => ({ x: feet.x + ((px - RECLUSE.foot[0]) / RECLUSE.w) * CHANGE_FIG, y: feet.y + ((py - RECLUSE.foot[1]) / RECLUSE.w) * CHANGE_FIG });
/** The open book's middle on the board. */
export const BOOK_MID = onBoard(SPOT, RECLUSE.foot[0], RECLUSE.foot[1] - 5);
/** His chest, standing: the middle of the light that engulfs him and dies back into him. */
export const CHEST = onBoard(SPOT, RECLUSE.foot[0], RECLUSE.foot[1] - 70);
/** His hands at his sides once he's landed (the `landed` frames' wrists, drawing space to the frame's), on the board in 0-100: where the arcs strike from. */
export const CHANGE_HANDS = [SIDE_ARMS_OUT.wristR, SIDE_ARMS_OUT.wristL].map(([x, y]) => onBoard(SPOT, x - 14, y + 17)).map((p) => [p.x * 100, p.y * 100] as const);
