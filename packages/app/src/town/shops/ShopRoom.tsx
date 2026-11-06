/**
 * Inside a shop (Nov 2, round 1: Babur's circus tent and Puddles' greenhouse; docs/decisions/2026-11-02-shop-interiors-r1.md).
 * Loaded only when you go in (the town imports it with a dynamic `import()`, and each room's art is its own chunk after that).
 *
 * The room (20 x 20 squares, the art's layout: shops/babur-art.ts, shops/puddles-art.ts) is drawn as the approved mockup drew it
 * (scripts/boss-art/shop-view.ts on claude/boss-art): through the town's own camera (camera.ts), the floor tiles laid flat on
 * their squares (baked once into one picture, drawn as two triangles a block), each upright piece stood at its foot at the town's
 * scale (37 px a square), a deep piece drawn as a plan (Puddles' pond garden) lying flat on its squares with the strip above its
 * north row standing up (unless the room's art says it stands up whole: Big Boy's airplane), the Shopkeeper (the boss's kid, its idle
 * playing, a blue "Shopkeeper" tag) and you, far to near; a tent's canvas, a greenhouse's glass, a pyramid's sandstone or a nursery's
 * sky above the walls. Animated pieces loop (the fire hoops, the pond, the palm, the fountain, the
 * crate). You start at the town's zoomed-in camera (SHOP_FEEL.startZoom, Eric, Nov 3: the further out of the two); the town's − / +
 * switch between it and Close (SHOP_FEEL.close, the third-person camera). Inside is just you: the town's bots and other players don't come in.
 *
 * Your ride comes in with you (Eric, Nov 2: "your rider goes in with you"; SHOP_FEEL.rideInside): the town's own rider, its frames
 * composed as the town drew them (town/rides.ts: the ride at its scale, 0.75 of the pawn), drawn under you at the room's camera,
 * its idle standing and its move walking, its side, back or front the way you go, at its own pace (RIDES.speed); you go out still
 * on it. No ride (or rideInside false: the ride waits outside, as round 1 had it): on foot.
 *
 * You walk by tapping, as in the town (one square at a time, round what's solid: shops/room.ts); a drag looks around and the focus
 * button brings the camera back. Standing within talking range of the Shopkeeper, its card ("Shopkeeper", Talk) shows; Talk opens
 * the crate's card (its picture, its prizes, the price, what you have, and the two ways to buy, through `buyBossCrate`: round 2, the
 * server's purchase, into your inventory since Nov 2; a way you can't pay is greyed, and the answer shows under them). Standing
 * just inside the way out, a card says "Go out".
 *
 * One requestAnimationFrame loop draws everything on one canvas (Canvas 2D); it stops when you go out or the tab is hidden. Every
 * frame of every piece is drawn into a canvas of its own as the room loads (behind the black fade), never in the loop.
 * Test hooks (test switches on): the canvas's `data-room` (its home), `data-you="c,r"`, `data-ready="1"`; `window.__shopAt("keeper"
 * | "door" | "square", [c, r]?)` where to tap; `__shopCam()` the camera (its zoom: 0 Close, 1 the town's); `__shopBench(n)` ms a draw.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { onAccountChange } from "../../account.ts";
import { renderFrame, type Character } from "../../characters/sprite.ts";
import { testSwitchesAllowed } from "../../test-switches.ts";
import { newPt, newView, proj, setView, type CamPair } from "../camera.ts";
import { SHOP_FEEL, TOWN_FEEL, type CamSet } from "../feel.ts";
import type { LightPool, LightSpot } from "../houses/kit.ts";
import { Press } from "../press.ts";
import { anyHeld, keyWalk } from "../arrows.ts";
import { PAWN_HEAD, PAWN_PATH, type YouArt } from "../render.ts";
import { SIDEKICK_SHEETS, type SidekickSheet } from "../sidekick-sheets.ts";
import { TAG_STYLE, type TagKind } from "../tags.ts";
import { Walker, type HomeId } from "../world.ts";
import type { Rider } from "../rides.ts";
import { rideSpeed } from "../../components/rides/scale.ts";
import { STORE_PANELS, driftAt, type PoolDrift, camFocus, ceilingPanel, inTalkRange, lightsAt, litDx, overlaps, upAlpha, walkable, youBox, isFloor, makeRoom, onDoor, tapTarget, findPath, stepFor, type Room, type ShopPlace, type Sq } from "./room.ts";
import { POOL_LINE, bossHoldings, buyBossCrate, canAfford, holdLine, priceLine, prizeRows, shopOf, wayText, type CrateWay, type ShopDef } from "./shops.ts";
import { iceAt, introCam, isIce, type IceNow } from "./challenge.ts";
import type { BlitzNow } from "./challenge.ts";
import { CHALLENGE_FEEL, attackStart, attackTime, bubbleSize, caveLight, chantOf, drainAt, frameAt as animFrame, introAt, introCues, introLength, isDark, isLog, lineOf, marksFeel, marksOf, seatedMarks, type DarkNow, type DrawnMarks, type IntroNow, type LogPlace } from "./challenge.ts";
import { CREW_D_SEAT, CREW_FORK_AT, CREW_SHEETS, CREW_STEP_OFF, type CrewName } from "./grex-crew-sheets.ts";
import { Machine, along, forkLegs, frameOf, liftLegs, routeLength, type MachinePose, type Sq as CrewSq, type Waypoint } from "./grex-crew.ts";
import type { CrewKey } from "./intro.ts";
import { isUp, levelZ, liftAt, makeLevels, squareOf, type LevelsArt } from "./levels.ts";
import { pressKey, squareUnder } from "./tap.ts";
import { ElfLoop, elfB, pairLegs, stopJob, walkerLegs, type DispenseStop, type ElfPose } from "./ginger-elves.ts";
import { HOLLOW, HOLLOW_HEART, hollowBuild } from "../../characters/hollow.ts";
import { play } from "../../sound.ts";
import { paintTable, playCue, slabFrontY, type Emis, type LoadedIntro } from "./intro.ts";
import { folioTimes, isFolio, type FoldNow } from "./challenge.ts";
import { prepareCrumple } from "./crumple-gl.ts";
import { TABLE_BOARD } from "../houses/park.ts";

/** A room's art, as its file exports it. */
interface RoomArt {
  /** Its size in squares, each way (20 unless the art says: Boingo's Funhouse is 24). */
  n?: number;
  layout: readonly ShopPlace[];
  pieces: Readonly<Record<string, Character>>;
  /** Where the crate sits on the counter, in the counter's pixels. */
  crateAt: readonly [number, number];
  lights: readonly (LightSpot & { piece: string })[];
  pools: readonly (LightPool & { piece: string; drift?: PoolDrift })[];
  /**
   * How its pools lie on the floor: added light (the default), or their color laid over the floor (`multiply`: Folio's stained glass on
   * its pale paper, where an added light barely shows; the art's mockup).
   */
  poolBlend?: "multiply";
  /** Deep pieces that stand up at their foot, as any upright piece (Big Boy's airplane, flying round over three squares by three), not laid flat as a plan. */
  upright?: readonly string[];
  /** Its battle circle's drawn start marks, when its art exports them (Big Boy's rug: the boss's west, yours east). */
  marks?: DrawnMarks;
  /** A room that isn't a box (Hollow's cave): its floor's shape, `.` floor and `#` rock (room.ts makeRoom blocks the rock). */
  floor?: readonly string[];
  /** The board on its stand (Wrangler's barn: the `board-stand` piece's square), which his intro ropes and drags to the table's place. */
  stand?: { readonly col: number; readonly row: number };
  /** Its foot this many room pixels south of its row's middle (Jefferson's: on the marks' line), as the art places it. */
  standDy?: number;
  /** Jefferson's crew (his warehouse): the machines' loops, the idle crew's places, the pallet's floor and shelf spots. */
  crew?: CrewPlaces;
  /** A second walking level (Ginger's igloo: the catwalk and its two staircases; levels.ts). */
  levels?: LevelsArt;
  /** A pool of light on the floor of its own, at a square (Ginger's: the battle spot's cool shine), its size in the room's pixels. */
  icePool?: { readonly at: readonly [number, number]; readonly rx: number; readonly ry: number; readonly color: string; readonly strength: number };
  /** Ginger's elves at work (his igloo): the walkers' loops and the dispensing pair's, and their sprites. */
  elves?: ElvesArt;
}
/** Ginger's elves, as his art has them (shops/ginger-art.ts, shops/ginger-elves-art.ts). */
interface ElvesArt {
  walkers: Readonly<Record<"red" | "green" | "blue", readonly { readonly at: readonly [number, number]; readonly pause: number }[]>>;
  path: readonly DispenseStop[];
  chars: Readonly<Record<ElfName, Character>>;
}
type ElfName = "red" | "green" | "blue" | "box" | "pad";
/** An elf's frames, each drawn once into a canvas, by animation, with each frame's time. */
type ElfFrames = Record<string, { frames: HTMLCanvasElement[]; ms: number[]; loop: boolean }>;
/** Jefferson's warehouse's crew, as its art places them (shops/grex-art.ts). */
interface CrewPlaces {
  liftPath: readonly Waypoint[];
  forkPath: readonly Waypoint[];
  /** The idle crew's places (a figure's foot, squares) and facing (1 east), and the machines' homes. */
  places: Readonly<Record<"leaner-a" | "leaner-b" | "crew-c" | "crew-d", { readonly at: readonly [number, number]; readonly face: number }>>;
  palletAt: readonly [number, number];
  shelf: { readonly col: number; readonly row: number; readonly lift: number };
}
const ART: Partial<Record<HomeId, () => Promise<RoomArt>>> = {
  tiger: () => import("./babur-art.ts").then((m) => ({ layout: m.SHOP_BABUR_LAYOUT, pieces: m.SHOP_BABUR_PIECES, crateAt: m.SHOP_BABUR_CRATE_AT, lights: m.SHOP_BABUR_HOOP_LIGHTS, pools: m.SHOP_BABUR_HOOP_POOLS })),
  gardener: () => import("./puddles-art.ts").then((m) => ({ layout: m.SHOP_PUDDLES_LAYOUT, pieces: m.SHOP_PUDDLES_PIECES, crateAt: m.SHOP_PUDDLES_CRATE_AT, lights: [], pools: [] })),
  alfil: () => import("./alfil-art.ts").then((m) => ({ layout: m.SHOP_ALFIL_LAYOUT, pieces: m.SHOP_ALFIL_PIECES, crateAt: m.SHOP_ALFIL_CRATE_AT, lights: m.SHOP_ALFIL_LIGHTS, pools: m.SHOP_ALFIL_POOLS })),
  bigboy: () => import("./bigboy-art.ts").then((m) => ({ layout: m.SHOP_BIGBOY_LAYOUT, pieces: m.SHOP_BIGBOY_PIECES, crateAt: m.SHOP_BIGBOY_CRATE_AT, lights: m.SHOP_BIGBOY_LIGHTS, pools: m.SHOP_BIGBOY_POOLS, upright: ["airplane"], marks: m.SHOP_BIGBOY_MARKS })),
  // (The giant king being carved, 4 x 2 squares, stands up whole at its foot.)
  timber: () => import("./timber-art.ts").then((m) => ({ layout: m.SHOP_TIMBER_LAYOUT, pieces: m.SHOP_TIMBER_PIECES, crateAt: m.SHOP_TIMBER_CRATE_AT, lights: m.SHOP_TIMBER_LIGHTS, pools: m.SHOP_TIMBER_POOLS, upright: ["showpiece"], marks: m.SHOP_TIMBER_MARKS })),
  // (The halfpipe, 4 x 2 squares, its skateboard rolling by itself: deep, so it stands up whole at its foot.)
  dash: () => import("./blitz-art.ts").then((m) => ({ layout: m.SHOP_BLITZ_LAYOUT, pieces: m.SHOP_BLITZ_PIECES, crateAt: m.SHOP_BLITZ_CRATE_AT, lights: m.SHOP_BLITZ_LIGHTS, pools: m.SHOP_BLITZ_POOLS, upright: ["showpiece"], marks: m.SHOP_BLITZ_MARKS })),
  // (A cave, not a box: walkable only on its floor's shape. The tree of presents, 3 x 2 squares, stands up whole at its foot.)
  hollow: () => import("./hollow-art.ts").then((m) => ({ layout: m.SHOP_HOLLOW_LAYOUT, pieces: m.SHOP_HOLLOW_PIECES, crateAt: m.SHOP_HOLLOW_CRATE_AT, lights: m.SHOP_HOLLOW_LIGHTS, pools: m.SHOP_HOLLOW_POOLS, upright: ["showpiece"], marks: m.SHOP_HOLLOW_MARKS, floor: m.SHOP_HOLLOW_FLOOR })),
  // (A box barn. Its two pens of knights, 3 x 2 squares each, stand up whole at their foot; his red mat and your denim one are its marks.)
  pig: () => import("./pig-art.ts").then((m) => ({ layout: m.SHOP_PIG_LAYOUT, pieces: m.SHOP_PIG_PIECES, crateAt: m.SHOP_PIG_CRATE_AT, lights: m.SHOP_PIG_LIGHTS, pools: m.SHOP_PIG_POOLS, upright: ["pen", "pen-b"], marks: m.SHOP_PIG_MARKS, stand: m.SHOP_PIG_BOARD_AT })),
  // (A warehouse with a floor's shape (16 x 16, racking all round), as Hollow's cave; no counter: the crate stands on the floor by the
  // dealer. The board on its crates in the battle spot, its foot on the marks' line; the crew and their machines.)
  grex: () =>
    import("./grex-art.ts").then((m) => ({
      layout: m.SHOP_GREX_LAYOUT,
      pieces: m.SHOP_GREX_PIECES,
      crateAt: [0, 0] as const,
      lights: m.SHOP_GREX_LIGHTS,
      pools: m.SHOP_GREX_POOLS,
      marks: m.SHOP_GREX_MARKS,
      floor: m.SHOP_GREX_FLOOR,
      stand: m.SHOP_GREX_BOARD_AT,
      standDy: m.SHOP_GREX_BOARD_AT.footDy,
      crew: { liftPath: m.SHOP_GREX_LIFT_PATH, forkPath: m.SHOP_GREX_FORK_PATH, places: m.SHOP_GREX_CREW, palletAt: m.SHOP_GREX_PALLET_AT, shelf: m.SHOP_GREX_SHELF_SLOT },
    })),
  // (Folio's sanctuary, Nov 5: a box room, the clean page its battle spot (its `page-` tiles); its windows' colored pools drift with the
  // sun and lie on the paper as color, not light.)
  folio: () =>
    import("./folio-art.ts").then((m) => ({ layout: m.SHOP_FOLIO_LAYOUT, pieces: m.SHOP_FOLIO_PIECES, crateAt: m.SHOP_FOLIO_CRATE_AT, lights: m.SHOP_FOLIO_LIGHTS, pools: m.SHOP_FOLIO_POOLS, marks: m.SHOP_FOLIO_MARKS, poolBlend: "multiply" as const })),
  // (Boingo's Funhouse, Nov 6: an arcade, a box room of 24 x 24; the play structure stands up whole at its foot.)
  clown: () =>
    import("./boingo-art.ts").then((m) => ({ n: m.SHOP_BOINGO_N, layout: m.SHOP_BOINGO_LAYOUT, pieces: m.SHOP_BOINGO_PIECES, crateAt: m.SHOP_BOINGO_CRATE_AT, lights: m.SHOP_BOINGO_LIGHTS, pools: m.SHOP_BOINGO_POOLS, upright: ["play"], marks: m.SHOP_BOINGO_MARKS })),
  // (An igloo with a round floor's shape, as Hollow's cave, but not a cave; its catwalk and staircases, a second walking level; the
  // elves at work.)
  gingerbread: () =>
    Promise.all([import("./ginger-art.ts"), import("./ginger-elves-art.ts")]).then(([m, e]) => ({
      layout: m.SHOP_GINGER_LAYOUT,
      pieces: m.SHOP_GINGER_PIECES,
      crateAt: m.SHOP_GINGER_CRATE_AT,
      lights: m.SHOP_GINGER_LIGHTS,
      pools: m.SHOP_GINGER_POOLS,
      marks: m.SHOP_GINGER_MARKS,
      floor: m.SHOP_GINGER_FLOOR,
      levels: { upper: m.SHOP_GINGER_UPPER, stairs: m.SHOP_GINGER_STAIRS },
      icePool: m.SHOP_GINGER_ICE_POOL,
      elves: {
        walkers: m.SHOP_GINGER_WALKERS,
        path: m.SHOP_GINGER_DISPENSE_PATH,
        chars: { red: e.NPC_GINGER_ELF_RED, green: e.NPC_GINGER_ELF_GREEN, blue: e.NPC_GINGER_ELF_BLUE, box: e.NPC_GINGER_ELF_BOX, pad: e.NPC_GINGER_ELF_PAD },
      },
    })),
};

/** A piece's frames, each drawn once into a canvas, and when each ends in its loop. */
interface Frames {
  ch: Character;
  frames: HTMLCanvasElement[];
  ends: number[];
  loop: number;
}
/** A room ready to draw: its art and every piece's frames (made as it loads, behind the fade). */
export interface LoadedRoom {
  def: ShopDef;
  art: RoomArt;
  frames: Record<string, Frames>;
  /** The kid's sheet (its picture loaded). */
  kid: { sheet: SidekickSheet; img: HTMLImageElement };
  /** Jefferson's crew's baked sheets (their pictures loaded), or null: another room. */
  crew: Readonly<Record<CrewName, HTMLImageElement>> | null;
  /** Ginger's elves' frames (drawn as the room loads, behind the fade: about 40 ms on a computer for their 99), or null: another room. */
  elves: Readonly<Record<ElfName, ElfFrames>> | null;
}

const toCanvas = (ch: Character, i: number, anim = "idle"): HTMLCanvasElement => {
  const { w, h, data } = renderFrame(ch, ch.anims[anim]!.frames[i]!);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  c.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(data), w, h), 0, 0);
  return c;
};
const SHEET_URL: Record<string, string> = Object.fromEntries(
  Object.entries(import.meta.glob<string>("../sidekicks/*.png", { eager: true, query: "?url", import: "default" })).map(([path, url]) => [path.replace(/^.*\/|\.png$/g, ""), url]),
);
const CREW_URL: Record<string, string> = Object.fromEntries(
  Object.entries(import.meta.glob<string>("./grex-crew/*.png", { eager: true, query: "?url", import: "default" })).map(([path, url]) => [path.replace(/^.*\/|\.png$/g, ""), url]),
);
/** A picture, loaded. */
const picture = (url: string, what: string) =>
  new Promise<HTMLImageElement>((ok, no) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => no(new Error(`${what} didn't load`));
    img.src = url;
  });
const loading = new Map<HomeId, Promise<LoadedRoom>>();
/** Loads a home's room (its art's chunk, every piece's frames drawn, the kid's sheet), once. */
export function loadRoom(home: HomeId): Promise<LoadedRoom> {
  let p = loading.get(home);
  if (p) return p;
  const def = shopOf(home)!;
  const sheet = SIDEKICK_SHEETS[def.kid];
  const img = new Image();
  const kid = new Promise<void>((ok, no) => {
    img.onload = () => ok();
    img.onerror = () => no(new Error(`the ${def.kid} sheet didn't load`));
    img.src = SHEET_URL[def.kid]!;
  });
  // (Jefferson's warehouse: his crew's nine sheets too.)
  const crew = home === "grex" ? Promise.all((Object.keys(CREW_SHEETS) as CrewName[]).map((k) => picture(CREW_URL[k]!, `the ${k} sheet`).then((img) => [k, img] as const))).then((l) => Object.fromEntries(l) as Record<CrewName, HTMLImageElement>) : Promise.resolve(null);
  p = Promise.all([ART[home]!(), kid, crew]).then(([art, , crewImgs]) => {
    const frames: Record<string, Frames> = {};
    for (const [name, ch] of Object.entries(art.pieces)) {
      const idle = ch.anims.idle!;
      let t = 0;
      const ends = idle.frames.map((f) => (t += Math.max(16, f.ms)));
      frames[name] = { ch, frames: idle.frames.map((_, i) => toCanvas(ch, i)), ends, loop: t };
    }
    // (Ginger's elves: every frame of every animation of theirs.)
    const elves = art.elves
      ? (Object.fromEntries(
          Object.entries(art.elves.chars).map(([k, ch]) => [
            k,
            Object.fromEntries(Object.entries(ch.anims).map(([a, an]) => [a, { frames: an.frames.map((_, i) => toCanvas(ch, i, a)), ms: an.frames.map((f) => f.ms), loop: an.loop }])),
          ]),
        ) as Record<ElfName, ElfFrames>)
      : null;
    return { def, art, frames, kid: { sheet, img }, crew: crewImgs, elves };
  });
  p.catch(() => loading.delete(home));
  loading.set(home, p);
  return p;
}

/** The card open inside: the Shopkeeper's, the crate's, or the way out's. */
export type ShopCard = "talk" | "crate" | "door";

/** What the town's buttons and back button do while you're inside. */
export interface ShopCtl {
  zoom: (out: boolean) => void;
  recenter: () => void;
}

/**
 * A boss's challenge played in its room (shops/challenge.ts): you and the boss walk in to the battle circle's marks, it says its
 * line, the board comes in between you; then `onDone` (the town starts the boss's transition and the battle).
 */
export interface RoomIntro {
  intro: LoadedIntro;
  /** You both stand on your marks, facing each other: the line and the board's animation begin. */
  onMarks?: () => void;
  onDone: () => void;
}

export function ShopRoom({ room, youArt, youRider, youName, onZoom, onOut, onReady, ctl, intro = null }: { room: LoadedRoom; youArt: () => YouArt | null; /** The town's rider you're on (its frames ready), or null: on foot. */ youRider: () => Rider | null; youName: () => string; onZoom: (out: boolean) => void; onOut: () => void; onReady: () => void; ctl: { current: ShopCtl | null }; /** A boss's challenge to play here (none: the shop as usual). */ intro?: RoomIntro | null }) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const cardEl = useRef<HTMLDivElement>(null);
  const [card, setCard] = useState<ShopCard | null>(null);
  const [msg, setMsg] = useState("");
  const eng = useRef<ReturnType<typeof startRoom> | null>(null);
  const { def } = room;
  useLayoutEffect(() => {
    const r = (eng.current = startRoom(box.current!, canvas.current!, cardEl.current!, room, youArt, youRider, youName, onZoom, (c) => {
      setCard(c);
      setMsg("");
    }, intro));
    ctl.current = r;
    onReady();
    return () => {
      ctl.current = null;
      r.stop();
    };
  }, []);
  // What you hold: your locker's, as the server last said (a buy, a token from a battle, an admin's grant), drawn again with it.
  const [, accountChanged] = useState(0);
  useEffect(() => onAccountChange(() => accountChanged((n) => n + 1)), []);
  const [busy, setBusy] = useState(false);
  const buy = (way: CrateWay) => {
    if (busy) return;
    setBusy(true);
    setMsg("");
    void buyBossCrate(def.home, way).then((res) => {
      setBusy(false);
      setMsg(res.message);
    });
  };
  const held = bossHoldings(def.home);
  const label = card === "talk" ? "Shopkeeper" : card === "crate" ? def.crate : card === "door" ? "Door" : undefined;
  return (
    <div class="town-shop" ref={box}>
      <canvas class="town-shop-canvas" ref={canvas} aria-label={`Inside ${def.boss}'s shop`} />
      <div class={card === "crate" ? "town-card shop-crate" : "town-card"} ref={cardEl} role="dialog" aria-label={label} style={{ display: card ? "" : "none" }}>
        {card === "talk" && (
          <>
            <h2>Shopkeeper</h2>
            <button type="button" class="town-btn primary" onClick={() => eng.current?.show("crate")}>
              Talk
            </button>
          </>
        )}
        {card === "door" && (
          <button type="button" class="town-btn primary" onClick={onOut}>
            Go out
          </button>
        )}
        {card === "crate" && (
          <>
            <h2>{def.crate}</h2>
            <div class="shop-crate-top">
              <CratePic frames={room.frames["crate"]!} />
              <div class="shop-prizes">
                <p class="shop-label">Prizes</p>
                <ul>
                  {prizeRows(def).map((p) => (
                    <li key={p.id}>
                      <span class="shop-prize-name">{p.name}</span>
                      <span class="shop-prize-kind">
                        <i style={{ background: p.color }} />
                        {p.kind}
                      </span>
                    </li>
                  ))}
                  <li class="shop-pool">{POOL_LINE}</li>
                </ul>
              </div>
            </div>
            <p class="shop-price">{priceLine(def)}</p>
            <p class="shop-hold">{holdLine(def, held)}</p>
            {/* (A way you can't pay is greyed, not hidden; the server checks again.) */}
            <button type="button" class="town-btn primary" disabled={busy || !canAfford(held, "tokens")} onClick={() => buy("tokens")}>
              Buy with {wayText(def, "tokens")}
            </button>
            <button type="button" class="town-btn" disabled={busy || !canAfford(held, "key")} onClick={() => buy("key")}>
              Buy with {wayText(def, "key")}
            </button>
            {/* (Its row is always there, its height kept, empty until a buy answers: nothing moves. A crate bought goes into your
                inventory, unopened: "Babur's Boss Crate is in your inventory." (Eric, Nov 2); the Crates tab opens it.) */}
            <div class="town-soon shop-msg" aria-live="polite">
              <span>{msg}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** The crate's picture on its card: its first idle frame, three times its size, crisp. */
function CratePic({ frames }: { frames: Frames }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const c = ref.current!;
    const src = frames.frames[0]!;
    c.width = src.width * 3;
    c.height = src.height * 3;
    const g = c.getContext("2d")!;
    g.imageSmoothingEnabled = false;
    g.drawImage(src, 0, 0, c.width, c.height);
  }, [frames]);
  return <canvas class="shop-crate-pic" ref={ref} aria-hidden="true" />;
}

/** Outside a cave's mouth: snow at night (the art's snow in shade, `W`). */
const CAVE_SNOW = "#aeb7cf";
/** A picture's average color (its drawn pixels), once: a cave's rock past its squares. */
function toneOf(c: HTMLCanvasElement | undefined): string {
  if (!c) return "#1e1c25";
  const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
  let r = 0, gg = 0, b = 0, k = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i + 3]! > 0) ((r += d[i]!), (gg += d[i + 1]!), (b += d[i + 2]!), k++);
  return k ? `rgb(${Math.round(r / k)},${Math.round(gg / k)},${Math.round(b / k)})` : "#1e1c25";
}

/** The most of Jefferson's crew drawn in a frame (seven giraffes, two machines, the pallet). */
const CREW_MAX = 12;

/** The pawn's base's foot down its box (render.ts's PAWN_FOOT: the path's bottom at y 39.5, and half its outline). */
const PAWN_FOOT = (39.5 + 0.75) / 45;
const SHADOW = "rgb(60,35,10)";
const PAWN = new Path2D(PAWN_PATH);
const CAM_KEYS = ["h", "back", "th", "cy"] as const;

/** An upright thing in the room, drawn at its foot, sorted far to near by `z` (its row). */
interface Up {
  name: string;
  /** Its placement's column (its west-most square), and its place in the room's list (set once sorted). */
  col: number;
  i: number;
  /** Its foot: a square (fractions allowed). */
  c: number;
  r: number;
  z: number;
  /** Moved from its foot this many of its pixels (the crate on the counter). */
  ox: number;
  oy: number;
  flip: boolean;
  /** Only this strip of its picture, from its top (a deep piece's part that stands up): its height in pixels; 0 = all. */
  cut: number;
}

/** Runs the room in `box` on `cv`: the loop, the camera, the input and the cards. Returns its controls and its stop. */
function startRoom(
  box: HTMLDivElement,
  cv: HTMLCanvasElement,
  cardEl: HTMLDivElement,
  loaded: LoadedRoom,
  youArt: () => YouArt | null,
  youRider: () => Rider | null,
  youName: () => string,
  onZoom: (out: boolean) => void,
  onCard: (c: ShopCard | null) => void,
  challenge: RoomIntro | null = null,
) {
  const f = TOWN_FEEL;
  const S = SHOP_FEEL;
  const SQ = f.housePxPerSquare;
  const { def, art, frames } = loaded;
  // (Ginger's igloo: its catwalk and staircases, a second walking level: levels.ts.)
  const lv = art.levels ? makeLevels(art.levels, art.n ?? 20) : null;
  const room: Room = makeRoom(art.layout, def.keeper, art.n ?? 20, art.floor, def.talk, lv);
  // (Jefferson's idle crew stand on their squares: nobody walks through them. His machines and the floor pallet block where they are
  // now: crewTakes.)
  if (art.crew) for (const k of ["leaner-a", "leaner-b", "crew-c", "crew-d"] as const) room.blocked[art.crew.places[k].at[1] * room.n + art.crew.places[k].at[0]] = 1;
  const n = room.n;
  const g = cv.getContext("2d")!;
  const you = new Walker(room.start, f.youStepMs, true, f.walkEase);
  // (A room's rows run toward the camera, the town's away: up the screen is a row less. The walker's views and the arrow keys
  // follow it: Walker.rowsUp. Facing the counter, north: up the screen, its back.)
  you.rowsUp = -1;
  you.view = 1;
  /** The rider drawn inside now (your ride's, its frames ready; SHOP_FEEL.rideInside), or null: on foot. */
  const riding = (): Rider | null => {
    if (!S.rideInside) return null;
    const rd = youRider();
    return rd?.ready ? rd : null;
  };
  // ---- A boss's challenge (shops/challenge.ts): the boss comes in beside you and you each walk to your start mark on the battle
  // circle, side by side, at the challenge's pace; each settles onto its mark's middle; facing each other, the intro plays.
  const C = CHALLENGE_FEEL;
  const ci = challenge?.intro ?? null;
  const found = ci ? marksOf(art.layout, ci.def.layout, art.marks, marksFeel(ci.anims, CHALLENGE_FEEL, ci.def.clear)) : null;
  // (Hollow's: you both walk on straight to your seats and stay there.)
  const marks = found && ci?.def.seated ? seatedMarks(found) : found;
  /** Its channel line this time (Hollow's: one of four, at random), or null. */
  const chant = ci ? chantOf(ci.def) : null;
  /** Its line this time (Jefferson's: one of his four calls, at random). */
  const introLine = ci ? lineOf(ci.def) : "";
  /** Hollow's dark (his intro's art and timing), or null: any other room or boss. */
  const dk = ci?.dark ?? null;
  const da = ci?.anims && isDark(ci.anims) ? ci.anims : null;
  /** Wrangler's lasso (his intro's art and timing), or null: any other room or boss. */
  const rp = ci?.rope ?? null;
  /** Folio's folding (its intro's art and timing: the sheets, the stools and table, the plane, the board), or null. */
  const fo = ci?.folio ?? null;
  const foT = fo && ci?.anims && isFolio(ci.anims) ? folioTimes(ci.anims) : null;
  /** Its crumple's DOM layer has been started (as its quiet line goes: crumple-gl.ts prepareCrumple). */
  let crumpleReady = false;
  const across = marks?.layout === "across";
  const boss = ci && marks ? new Walker({ c: room.start.c - 1, r: room.start.r }, C.walkStepMs, false) : null;
  if (boss) boss.rowsUp = -1;
  // The arrow keys walk you about the room (arrows.ts): a square the floor has and nobody's (the challenge's boss, if it's here).
  // Not during a challenge's intro, whose script walks you.
  // (Up the screen is a row less here: keyWalk turns it by `you.rowsUp`. Ginger's levels: along their chain only.)
  const keys = keyWalk(
    you,
    (c, r) => walkable(room, c, r) && !(boss && boss.goalC() === c && boss.goalR() === r) && !elfTakes(c, r),
    undefined,
    (c, r, dc, dr) => stepFor(room, c, r, dc, dr),
  );
  let keysOn = false;
  const bossPose = { x: 0, y: 0, hop: 0, tilt: 0, step: false, t: 0 };
  /** When you and the boss each reached your mark's square (-1: walking), and when you both stood on your marks' middles (the intro's 0). */
  let youAt = -1;
  let bossAt = -1;
  let onMarksAt = -1;
  let introNow: IntroNow | null = null;
  /** Ginger's intro now (his props, the carriers, the board), or null. */
  let iceNow: IceNow | null = null;
  /** Ms into the intro (from you both on your marks), as of the last step. */
  let introT = 0;
  let cueN = 0;
  let said = false;
  let introDone = false;
  const cues = ci ? introCues(ci.beats, ci.anims) : [];
  const introEnd = ci ? introLength(ci.beats) : 0;
  /** Its God King attack (its kit's), from `attackAt` into the intro on: the frame showing (-1: not attacking), its last cue's frame. */
  const attackAt = ci ? attackStart(ci.beats) : Infinity;
  let attackFrame = -1;
  let attackCued = -1;
  /** When you both start walking up to the marks (`insideMs` after the room's first frame: its fade-in, then a beat just inside); -1: not yet. */
  let walkFrom = -1;
  let walking = false;
  if (boss && marks) you.stepMs = C.walkStepMs;
  /** The last half square onto a mark's middle (0 until it's there; then easing to its half). */
  const settle = (at: number, half: number, now: number) => (at < 0 ? 0 : half * Math.min(1, (now - at) / C.settleMs));
  /** The hop back clear of the stools (from the mark to its clear place, as the intro says: `introNow.back`). */
  const back = () => introNow?.back ?? 0;
  const youOx = (now: number) => (marks ? settle(youAt, marks.you.c - marks.youSq.c, now) + back() * (marks.youClear.c - marks.you.c) : 0);
  const youOy = (now: number) => (marks ? settle(youAt, marks.you.r - marks.youSq.r, now) + back() * (marks.youClear.r - marks.you.r) : 0);
  const bossOx = (now: number) => (marks ? settle(bossAt, marks.boss.c - marks.bossSq.c, now) + back() * (marks.bossClear.c - marks.boss.c) : 0);
  const bossOy = (now: number) => (marks ? settle(bossAt, marks.boss.r - marks.bossSq.r, now) + back() * (marks.bossClear.r - marks.boss.r) : 0);
  /** How high the hop back lifts you both now, in squares. */
  const hopLift = () => (introNow?.hop ?? 0) * C.hopUp;
  /**
   * Timber's own intro (his log): where he is while he plays his own moves (`introNow.wood.move`), on his row: his foot `u` of the way
   * between two places, each a column (his mark; the log, `log.at` west of the table's middle; where he works, his art's `reach` west of
   * it, so the log he sets down stands on the table's place; a step back from there, his dusting off's; where he swings). Null: his town
   * figure, where the walk in and the hop back put him.
   */
  const woodAt = (): { c: number; r: number } | null => {
    const w = introNow?.wood;
    if (!w?.move || !marks || !ci?.anims || !isLog(ci.anims)) return null;
    const a = ci.anims;
    const place = (p: LogPlace) =>
      p === "mark" ? marks.boss.c : p === "log" ? marks.table.c - C.log.at : p === "work" ? marks.table.c - a.reach : p === "stepped" ? marks.table.c - a.reach - a.back : marks.bossClear.c;
    const from = place(w.from);
    return { c: from + (place(w.to) - from) * w.u, r: marks.boss.r };
  };
  /** The challenge, a frame on: the walk in, then the intro's beats (its line said once, in the bubble by his head; its cues' sounds). */
  const stepIntro = (now: number) => {
    if (!ci || !boss || !marks || !challenge) return;
    // (Just inside the door a beat, then you both walk up to the marks.)
    if (walkFrom < 0) walkFrom = now + C.insideMs;
    if (!walking) {
      if (now < walkFrom) {
        if (cv.dataset.intro !== "walk") cv.dataset.intro = "walk";
        return;
      }
      walking = true;
      const yp = findPath(room, you.here(), marks.youSq);
      const bp = findPath(room, boss.here(), marks.bossSq);
      if (yp) you.go(yp);
      if (bp) boss.go(bp);
    }
    boss.update(now);
    // (On its mark, each turns to face the other across the table: Walker's side view, `facing` the way.)
    if (youAt < 0 && !you.moving()) {
      youAt = now;
      if (marks.youFace) [you.facing, you.view] = [marks.youFace, 0];
    }
    if (bossAt < 0 && !boss.moving()) {
      bossAt = now;
      if (marks.bossFace) [boss.facing, boss.view] = [marks.bossFace, 0];
    }
    if (onMarksAt < 0 && youAt >= 0 && bossAt >= 0) onMarksAt = Math.max(youAt, bossAt) + C.settleMs;
    if (onMarksAt < 0 || now < onMarksAt) {
      introNow = null;
      darkNow = null;
      if (cv.dataset.intro !== "walk") cv.dataset.intro = "walk";
      return;
    }
    const t = now - onMarksAt;
    introT = t;
    introNow = introAt(ci.beats, ci.anims, t);
    darkNow = introNow.dark;
    // (Folio's: once its quiet line has gone nothing on the page changes until the crumple, so its DOM layer is taken now.)
    if (foT && !crumpleReady && t >= foT.quietEnd) {
      crumpleReady = true;
      prepareCrumple();
    }
    // (Ginger's: his props and his board carriers, from his art's places.)
    iceNow = ci.ice && ci.anims && isIce(ci.anims) ? iceAt(ci.anims, t, ci.ice.at) : null;
    if (!said) {
      said = true;
      challenge.onMarks?.();
      // (His line is said in the bubble by his head only, not in the chat log: Eric, Nov 2.)
    }
    while (cueN < cues.length && t >= cues[cueN]!.at) playCue(ci, cues[cueN++]!.cue);
    // The boss's attack: from `attackAt` on, until the battle takes the screen (its lashes again and again), each frame's sound.
    const a = ci.attack;
    if (a && t >= attackAt) {
      attackFrame = animFrame(a.ms, attackTime(t - attackAt, a.beat, true), false);
      if (attackFrame !== attackCued) {
        attackCued = attackFrame;
        const cue = a.cues[attackFrame];
        const sound = cue ? a.sounds[cue] : undefined;
        if (sound) play(sound);
      }
    }
    if (cv.dataset.intro !== introNow.step) cv.dataset.intro = introNow.step;
    if (!introDone && t >= introEnd) {
      introDone = true;
      challenge.onDone();
    }
  };

  /** The test hook's view of your ride (as the town's `youRide`): its animation and frame drawn last, its side, its view. */
  const seen = { ride: null as string | null, anim: "" as "" | "idle" | "move", frame: -1, facing: 1, view: 0 };

  // ---- The floor, baked once: every tile (turned as the layout says) into one picture of the whole room, n x n squares.
  const floor = document.createElement("canvas");
  floor.width = floor.height = n * SQ;
  {
    const fg = floor.getContext("2d")!;
    fg.imageSmoothingEnabled = false;
    for (const p of art.layout) {
      if (!isFloor(p.name)) continue;
      const img = frames[p.name]!.frames[0]!;
      fg.save();
      fg.translate(p.col * SQ + SQ / 2, p.row * SQ + SQ / 2);
      fg.rotate(((p.rot ?? 0) * Math.PI) / 2);
      fg.drawImage(img, -img.width / 2, -img.height / 2);
      fg.restore();
    }
  }
  /**
   * A cave (a room with a floor's shape): its rock's tone, the average of its flat rock tile (`floor-rock`), filling the ground past
   * its squares; null in a box room.
   */
  // (Jefferson's warehouse has a floor's shape too, its racking all round, but it's a box room: no rock, nothing in front of you.)
  const cave = art.floor && frames["floor-rock"] ? toneOf(frames["floor-rock"].frames[0]) : null;
  // ---- The upright things, far to near; and the deep pieces drawn as plans, which lie flat on their squares.
  const ups: Up[] = [];
  const flats: ShopPlace[] = [];
  const counter = art.layout.find((p) => p.name === "counter");
  for (const p of art.layout) {
    if (isFloor(p.name)) continue;
    const w = p.w ?? 1;
    const d = p.d ?? 1;
    const ch = art.pieces[p.name]!;
    if (d > 1 && !art.upright?.includes(p.name)) {
      // The plan lies flat on its w x d squares; the strip above its north row (its plants' tops) stands up there.
      flats.push(p);
      const rise = ch.h - d * SQ;
      if (rise > 0) ups.push({ name: p.name, col: p.col, i: 0, c: p.col + (w - 1) / 2, r: p.row - d + 0.5, z: p.row - d + 0.5, ox: 0, oy: ch.foot[1] - rise + 1, flip: false, cut: rise });
      continue;
    }
    if (p.name === "crate" && counter) {
      // On the counter, at the art's place for it in the counter's pixels; drawn just after the counter.
      const cp = art.pieces["counter"]!;
      ups.push({ name: p.name, col: p.col, i: 0, c: counter.col + ((counter.w ?? 1) - 1) / 2, r: counter.row, z: counter.row + 0.01, ox: art.crateAt[0] - cp.foot[0], oy: art.crateAt[1] - cp.foot[1], flip: false, cut: 0 });
      continue;
    }
    // (Jefferson's board on its crates stands with its foot `standDy` south of its row's middle, on the marks' line.)
    const dr = p.name === "board-stand" && art.standDy ? art.standDy / SQ : 0;
    ups.push({ name: p.name, col: p.col, i: 0, c: p.col + (w - 1) / 2, r: p.row + dr, z: p.row + dr, ox: 0, oy: 0, flip: !!p.flip, cut: 0 });
  }
  ups.sort((a, b) => a.z - b.z);
  ups.forEach((u, i) => (u.i = i));

  // ---- The glow of a fire (Babur's hoops): one soft round sprite per color, made once, stretched into each pool and halo.
  const glowOf = new Map<string, HTMLCanvasElement>();
  const glow = (color: string) => {
    let c = glowOf.get(color);
    if (c) return c;
    c = document.createElement("canvas");
    c.width = c.height = 64;
    const gg = c.getContext("2d")!;
    const grad = gg.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, color);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    gg.fillStyle = grad;
    gg.fillRect(0, 0, 64, 64);
    glowOf.set(color, c);
    return c;
  };
  for (const l of [...art.pools, ...art.lights]) glow(l.color);
  /**
   * A tint's soft round sprite (Folio's pools, laid over the paper by multiply): its color fading to that color see-through, not to
   * black (a glow's black edge, multiplied, would leave a gray ring).
   */
  const tintOf = new Map<string, HTMLCanvasElement>();
  const tint = (color: string) => {
    let c = tintOf.get(color);
    if (c) return c;
    c = document.createElement("canvas");
    c.width = c.height = 64;
    const gg = c.getContext("2d")!;
    const n = parseInt(color.slice(1), 16);
    const rgb = `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
    const grad = gg.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, `rgba(${rgb},1)`);
    grad.addColorStop(1, `rgba(${rgb},0)`);
    gg.fillStyle = grad;
    gg.fillRect(0, 0, 64, 64);
    tintOf.set(color, c);
    return c;
  };
  // (Ginger's battle spot's own cool shine on its ice: baked into the floor's picture once, not drawn over the room each frame.)
  const ip = art.icePool;
  if (ip) {
    const fg = floor.getContext("2d")!;
    fg.globalCompositeOperation = "lighter";
    fg.globalAlpha = Math.min(1, ip.strength * S.glow);
    fg.drawImage(glow(ip.color), ip.at[0] * SQ + SQ / 2 - ip.rx * 2, ip.at[1] * SQ + SQ / 2 - ip.ry * 2, ip.rx * 4, ip.ry * 4);
    fg.globalAlpha = 1;
    fg.globalCompositeOperation = "source-over";
  }
  // Every light on every place its piece stands (Nov 3: a lantern or a bulb string stands in several places; each lights where it
  // is, mirrored with it): made once as the room loads, so a frame only walks two short lists.
  // (Not a plan's standing strip: its lights are its whole picture's.)
  const whole = ups.filter((u) => !u.cut);
  // (Ginger's igloo: its pools of light along the walls' feet don't change, so they're baked into the floor's picture once, as the
  // battle spot's shine is: two dozen glows a frame were the most of the room's cost over Jefferson's warehouse on a phone. Every other
  // room draws them each frame, as before: Hollow's go dark in his intro.)
  const bakePools = !!art.icePool;
  const poolsAt = bakePools ? [] : lightsAt(art.pools, whole);
  if (bakePools) {
    const fg = floor.getContext("2d")!;
    fg.globalCompositeOperation = "lighter";
    for (const { l, at: u } of lightsAt(art.pools, whole)) {
      const ch = frames[u.name]!.ch;
      const x = u.c * SQ + SQ / 2 + u.ox + litDx(l.x, ch.foot[0], u.flip);
      const y = u.r * SQ + SQ / 2 + u.oy + l.y - ch.foot[1];
      fg.globalAlpha = Math.min(1, l.strength * S.glow);
      fg.drawImage(glow(l.color), x - l.rx * 2, y - l.ry * 2, l.rx * 4, l.ry * 4);
    }
    fg.globalAlpha = 1;
    fg.globalCompositeOperation = "source-over";
  }
  const halosAt = lightsAt(art.lights, whole, (l) => !!l.halo);
  /** A light's middle `lx`, `ly` (its piece's pixels) on screen, its piece standing at `u` (P already at its foot): into `lit`. */
  const lit = { x: 0, y: 0 };
  const litAt = (u: Up, lx: number, ly: number) => {
    const ch = frames[u.name]!.ch;
    const s = pt.k / SQ;
    // (Mirrored as drawUp mirrors the piece: its pixel x lands at w - 1 - x.)
    lit.x = pt.x + (u.ox + litDx(lx, ch.foot[0], u.flip)) * s;
    lit.y = pt.y + (u.oy + ly - ch.foot[1]) * s;
  };

  // ---- Hollow's dark (his challenge intro, Nov 3; shops/challenge.ts darkAt): which cave pieces go out, and how. Made once.
  const DK = C.dark;
  /** Each upright piece's part in it, by its place in `ups`: a lantern (its place in `dark.lanterns`' order), -1 none. */
  const lanternOf = new Int8Array(ups.length).fill(-1);
  /** A bulb piece: its first bulb in the string's run (-1 none) and how many of the run's are its. */
  const runFirst = new Int16Array(ups.length).fill(-1);
  const runCount = new Uint8Array(ups.length);
  if (dk) {
    for (const u of ups) {
      const li = DK.lanterns.findIndex(([c, r]) => u.name.startsWith("lantern") && u.col === c && u.r === r);
      if (li >= 0) lanternOf[u.i] = li;
      dk.art.INTRO_HOLLOW_BULB_RUN.forEach((b, i) => {
        if (b.piece !== u.name || b.col !== u.col || b.row !== u.r) return;
        if (runFirst[u.i]! < 0) runFirst[u.i] = i;
        runCount[u.i]!++;
      });
    }
  }
  /** Hollow's intro now (null: not his, or not yet on the marks). */
  let darkNow: DarkNow | null = null;
  /** A room piece's frame index on the room's clock (`frameAt`'s). */
  const frameIdx = (name: string, t: number): number => {
    const fr = frames[name]!;
    if (fr.frames.length === 1) return 0;
    const u = ((t % fr.loop) + fr.loop) % fr.loop;
    let i = 0;
    while (i < fr.ends.length - 1 && u >= fr.ends[i]!) i++;
    return i;
  };
  /** How many of a bulb piece's own bulbs have gone dark now. */
  const runOut = (u: Up) => (runFirst[u.i]! < 0 || !darkNow ? 0 : Math.min(runCount[u.i]!, Math.max(0, darkNow.run - runFirst[u.i]!)));
  const gutterMs = da ? da.gutter.reduce((a, b) => a + b, 0) : 0;
  /** The lit pixels of the piece `darkPiece` looked at last (for over the dark), or null. */
  let pieceEmis: Emis | null = null;
  /**
   * In Hollow's intro, an upright piece's frame now if it differs from the cave's own (a lantern going out or out, bulbs gone dark,
   * the tree draining or dark), else null (the cave's own); its lit pixels into `pieceEmis` either way.
   */
  const darkPiece = (u: Up, now: number): HTMLCanvasElement | null => {
    pieceEmis = null;
    if (!dk || !da || !darkNow) return null;
    const idx = () => frameIdx(u.name, now);
    const li = lanternOf[u.i]!;
    if (li >= 0) {
      const st = darkNow.lanterns[li]!;
      if (st.since < 0) {
        pieceEmis = dk.lit[u.name]![idx()] ?? null;
        return null;
      }
      const P = dk.pieces[u.name]!;
      // (Its going out starts on its sway frame then, `gutter<k>`, and keeps the room's clock; then its dark idle on it.)
      const lt = st.since < gutterMs ? P[`gutter${frameIdx(u.name, now - st.since)}`]![animFrame(da.gutter, st.since, false)]! : P.idle![idx()]!;
      pieceEmis = lt.emis;
      return lt.img;
    }
    if (runFirst[u.i]! >= 0) {
      const n = runOut(u);
      if (!n) {
        pieceEmis = dk.lit[u.name]![idx()] ?? null;
        return null;
      }
      // (One on the way to the last has its first flicker frame alone: it shows for a bulb's turn.)
      const fr = dk.pieces[u.name]![`${u.flip ? "r" : "l"}${n}`]!;
      const lt = fr[idx()] ?? fr[0]!;
      pieceEmis = lt.emis;
      return lt.img;
    }
    if (u.name === "showpiece") {
      const f = darkNow.tree.frame;
      if (f < 0) {
        pieceEmis = dk.lit.showpiece![idx()] ?? null;
        return null;
      }
      const P = dk.pieces.showpiece!;
      const lt = f < P.drain!.length ? P.drain![f]! : P.idle![0]!;
      pieceEmis = lt.emis;
      return lt.img;
    }
    return null;
  };
  /**
   * A light's strength now in Hollow's intro (1 otherwise): its lantern's, its bulbs' share still lit (the backdrop's all gone with its
   * first, its candle too), the tree's; none from the blackout on.
   */
  const lightMul = (u: Up): number => {
    if (!darkNow) return 1;
    const li = lanternOf[u.i]!;
    return caveLight(darkNow, li >= 0 ? { lantern: li } : runFirst[u.i]! >= 0 ? { out: runOut(u), of: runCount[u.i]!, backdrop: u.name === "backdrop" } : u.name === "showpiece" ? "tree" : null);
  };

  /** The lit pixels drawn this frame, to draw again over the dark (each its picture, place, size, mirrored, alpha). */
  let emN = 0;
  const emImg: HTMLCanvasElement[] = [];
  const emX = new Float64Array(ups.length + 4);
  const emY = new Float64Array(ups.length + 4);
  const emS = new Float64Array(ups.length + 4);
  const emFlip = new Uint8Array(ups.length + 4);
  const emA = new Float64Array(ups.length + 4);
  /** Queues `e` (the lit pixels of a picture `w` pixels wide drawn at (x, y), `s` a pixel, mirrored or not) for over the dark. */
  const addEmis = (e: Emis | null, x: number, y: number, s: number, w: number, flip: boolean, a: number) => {
    if (!e || a <= 0 || emN >= emX.length) return;
    const i = emN++;
    emImg[i] = e.img;
    emX[i] = flip ? x + (w - e.x - e.img.width) * s : x + e.x * s;
    emY[i] = y + e.y * s;
    emS[i] = s;
    emFlip[i] = flip ? 1 : 0;
    emA[i] = a;
  };

  /**
   * The motes of light (CHALLENGE_FEEL.dark.mote), made once: each its kind, when it leaves (ms into the intro), and where from: a
   * piece's pixel at its place (`u`, `lx`, `ly`), one of his own bulbs (`who` 1: his pixels), or your pawn (`who` 2: squares from your
   * feet). Each lands once (`landed`: ms into the intro; -1 not yet).
   */
  interface Mote {
    kind: string;
    at: number;
    who: 0 | 1 | 2;
    u: Up | null;
    lx: number;
    ly: number;
    landed: number;
  }
  const motes: Mote[] = [];
  /** The tree's lights in its pixels, bottom to top (as the art's mockup): from `x0` across `w` (narrowing by `narrow` to the top, drifting `drift` right), from `y0` up `h`. */
  const TREE_LIGHTS = { x0: 15, w: 80, narrow: 0.7, drift: 25, y0: 150, h: 110 } as const;
  /** A lantern's motes leave its glass: round this pixel (its ring's middle, a few pixels down), `spread` pixels across. */
  const LANTERN_GLASS = { x: 18, y: 59, spread: 5 } as const;
  if (dk && da && ci) {
    const M = DK.mote;
    const d = drainAt();
    const drink = ci.beats.find((b) => b.step === "drink")!.at;
    const hash = (n: number) => (((Math.sin(n * 127.1) * 43758.5453) % 1) + 1) % 1;
    const upAt = (name: string, col: number, row: number) => ups.find((u) => u.name === name && u.col === col && u.r === row) ?? null;
    const G = LANTERN_GLASS;
    d.lanterns.forEach((ms, li) => {
      const [c, r] = DK.lanterns[li]!;
      const u = ups.find((x) => x.name.startsWith("lantern") && x.col === c && x.r === r) ?? null;
      for (let j = 0; j < M.perLantern; j++)
        motes.push({ kind: j < 2 ? "warm-l" : j < 5 ? "warm-m" : "warm-s", at: drink + ms + M.lead + j * M.every, who: 0, u, lx: G.x + (hash(li * 9 + j) - 0.5) * G.spread, ly: G.y + (hash(li * 7 + j + 3) - 0.5) * G.spread, landed: -1 });
    });
    const run = dk.art.INTRO_HOLLOW_BULB_RUN;
    run.forEach((b, i) => {
      const kind = dk.runMote[i];
      if (kind) motes.push({ kind: kind + (i % 3 === 1 ? "-s" : ""), at: drink + d.string + (i * d.stringMs) / run.length, who: 0, u: upAt(b.piece, b.col, b.row), lx: b.at[0], ly: b.at[1], landed: -1 });
    });
    const tree = ups.find((u) => u.name === "showpiece") ?? null;
    const cols = ["red", "green", "blue", "gold", "orange", "pink"];
    const T = TREE_LIGHTS;
    for (let i = 0; i < M.tree; i++) {
      const v = i / (M.tree - 1);
      motes.push({ kind: cols[i % 6]! + (i % 2 ? "-s" : ""), at: drink + d.tree + i * M.treeEvery, who: 0, u: tree, lx: T.x0 + hash(i + 50) * T.w * (1 - v * T.narrow) + v * T.drift, ly: T.y0 - v * T.h, landed: -1 });
    }
    const star = dk.art.INTRO_HOLLOW_STAR_AT;
    for (let i = 0; i < M.star; i++) motes.push({ kind: i === 0 ? "star" : "gold", at: drink + d.tree + M.starAt + i * M.starEvery, who: 0, u: tree, lx: star[0], ly: star[1], landed: -1 });
    // His own strand, a third at a time, from where his bulbs hang as he drinks.
    const bulbs = hollowBuild({ crouch: 2, feet: "wide", free: "out", arm: "low", mood: "roar" }).bulbs;
    d.strand.forEach((ms, third) =>
      bulbs.forEach((b, n) => {
        if (n % 3 === 2 - third) motes.push({ kind: ["red", "gold", "blue"][n % 3]!, at: drink + ms + n * M.strandEvery, who: 1, u: null, lx: b[0] + 1.5, ly: b[1] + 3, landed: -1 });
      }),
    );
    for (let i = 0; i < M.pawn; i++) motes.push({ kind: i % 2 ? "pawn-s" : "pawn", at: drink + d.pawn + M.pawnLead + i * M.pawnEvery, who: 2, u: null, lx: (hash(i + 90) - 0.5) * 0.4, ly: -(0.45 + hash(i + 70) * 0.5), landed: -1 });
  }
  /** Where his feet are on screen this frame and a pixel of his, as drawBoss drew him; and your feet's, as drawYou drew you. */
  const hisFoot = { x: 0, y: 0, k: 0, on: false };
  const youFoot = { x: 0, y: 0, k: 0, on: false };
  let lastSip = -Infinity;

  // ---- Tags: each drawn once (its pill and its words), stamped every frame.
  const tagArt = new Map<string, HTMLCanvasElement>();
  const tag = (text: string, kind: TagKind) => {
    const key = `${kind}|${text}|${DPR}`;
    let c = tagArt.get(key);
    if (c) return c;
    c = document.createElement("canvas");
    const tg = c.getContext("2d")!;
    const s = 12;
    const font = `600 ${s}px Archivo, system-ui, sans-serif`;
    tg.font = font;
    const w = tg.measureText(text).width + s * 1.25;
    const h = s + (8 * s) / 11;
    c.width = Math.ceil((w + 8) * DPR);
    c.height = Math.ceil((h + 8) * DPR);
    tg.scale(DPR, DPR);
    const { pill, ink } = TAG_STYLE[kind];
    tg.shadowColor = "rgba(0,0,0,.25)";
    tg.shadowBlur = 4;
    tg.fillStyle = pill;
    tg.beginPath();
    tg.roundRect(4, 4, w, h, h / 2);
    tg.fill();
    tg.shadowColor = "transparent";
    tg.font = font;
    tg.textAlign = "center";
    tg.textBaseline = "middle";
    tg.fillStyle = ink;
    tg.fillText(text, 4 + w / 2, 4 + h / 2);
    tagArt.set(key, c);
    return c;
  };

  // ---- The camera: Close (0) to the town's zoomed-in camera (1), following you as the town's does.
  const v = newView();
  const tall: CamSet = { ...f.camTall };
  const wide: CamSet = { ...f.camWide };
  const sets: CamPair = { tall, wide };
  // (A challenge: its own framing, CHALLENGE_FEEL.cam for its layout, from the start.)
  // (Ginger's own, centred on his table: BossIntro.cam.)
  const cam = marks && ci ? introCam(ci.def, marks.layout) : null;
  let zoomCur: number = cam ? cam.zoom : S.startZoom;
  let zoomTarget = zoomCur;
  let camX = you.c;
  let camY = you.r;
  let vx = 0;
  let vy = 0;
  let follow = true;
  const pt = newPt();
  const pq = [newPt(), newPt(), newPt(), newPt()];
  const P = (c: number, r: number, out = pt) => proj(v, c - camX, camY - r, 0, out);

  let W = 1;
  let H = 1;
  let DPR = 1;
  /** Above the walls: the tent's canvas or the greenhouse's glass, drawn once for the box's size (as the mockup drew it). */
  const roof = document.createElement("canvas");
  const drawRoof = () => {
    roof.width = Math.round(W * DPR);
    roof.height = Math.round(H * DPR);
    const rg = roof.getContext("2d")!;
    rg.scale(DPR, DPR);
    if (def.roof === "glass") {
      const sky = rg.createLinearGradient(0, 0, 0, H * 0.45);
      sky.addColorStop(0, "#9fd0e6");
      sky.addColorStop(1, "#d9eef2");
      rg.fillStyle = sky;
      rg.fillRect(0, 0, W, H);
      rg.strokeStyle = "#f4f2ea";
      rg.lineWidth = 3;
      for (let i = -12; i <= 12; i++) {
        rg.beginPath();
        rg.moveTo(W / 2 + i * W * 0.05, -H * 0.5);
        rg.lineTo(W / 2 + i * W * 0.18, H * 0.45);
        rg.stroke();
      }
      for (const y of [H * 0.06, H * 0.15, H * 0.26]) {
        rg.beginPath();
        rg.moveTo(0, y);
        rg.lineTo(W, y);
        rg.stroke();
      }
      return;
    }
    if (def.roof === "paper") {
      // A sanctuary's ceiling (as the mockup drew it): pale folded paper, its pleats running up to a fold far overhead, fading to blank.
      const sky = rg.createLinearGradient(0, 0, 0, H * 0.5);
      sky.addColorStop(0, "#e9dfc9");
      sky.addColorStop(1, "#f7f0e0");
      rg.fillStyle = sky;
      rg.fillRect(0, 0, W, H);
      rg.strokeStyle = "rgba(165,142,105,0.35)";
      rg.lineWidth = 1.5;
      for (let i = -14; i <= 14; i++) {
        rg.beginPath();
        rg.moveTo(W / 2 + i * W * 0.02, -H * 0.3);
        rg.lineTo(W / 2 + i * W * 0.16, H * 0.5);
        rg.stroke();
      }
      return;
    }
    if (def.roof === "nursery") {
      // A nursery's ceiling (as the mockup drew it): soft sky blue with pale clouds and little stars.
      const sky = rg.createLinearGradient(0, 0, 0, H * 0.45);
      sky.addColorStop(0, "#7fb4e8");
      sky.addColorStop(1, "#cfe6fb");
      rg.fillStyle = sky;
      rg.fillRect(0, 0, W, H);
      const k = W / 390;
      rg.fillStyle = "#ffffff";
      for (const [cx, cy, r] of [[60, 40, 22], [90, 34, 18], [290, 60, 26], [320, 52, 20], [200, 20, 16]] as const) {
        rg.beginPath();
        rg.arc(cx * k, cy * k, r * k, 0, Math.PI * 2);
        rg.fill();
      }
      rg.fillStyle = "#ffe36a";
      for (const [sx, sy] of [[150, 70], [250, 25], [30, 90], [360, 100], [120, 15]] as const) rg.fillRect(sx * k, sy * k, 4, 4);
      return;
    }
    if (def.roof === "store") {
      // A sneaker store's ceiling (as the mockup drew it): white ceiling tiles in a pale grid running up to a point, square light panels.
      const sky = rg.createLinearGradient(0, 0, 0, H * 0.45);
      sky.addColorStop(0, "#c9ced6");
      sky.addColorStop(1, "#f1f2f4");
      rg.fillStyle = sky;
      rg.fillRect(0, 0, W, H);
      rg.strokeStyle = "#b3b9c3";
      rg.lineWidth = 2;
      for (let i = -12; i <= 12; i++) {
        rg.beginPath();
        rg.moveTo(W / 2 + i * W * 0.05, -H * 0.5);
        rg.lineTo(W / 2 + i * W * 0.18, H * 0.45);
        rg.stroke();
      }
      for (const y of [H * 0.05, H * 0.12, H * 0.21, H * 0.33]) {
        rg.beginPath();
        rg.moveTo(0, y);
        rg.lineTo(W, y);
        rg.stroke();
      }
      // (Its light panels are drawn each frame, cut above the walls: `drawPanels`.)
      return;
    }
    if (def.roof === "cave") {
      // A cave's roof (as the mockup drew it): dark stone fading to black overhead, stalactites hanging from it.
      const sky = rg.createLinearGradient(0, 0, 0, H * 0.45);
      sky.addColorStop(0, "#050408");
      sky.addColorStop(1, "#1c1a24");
      rg.fillStyle = sky;
      rg.fillRect(0, 0, W, H);
      rg.fillStyle = "#14121a";
      for (let i = 0; i < 26; i++) {
        const x = (((i * 97) % 41) / 41) * W;
        const y = H * (0.04 + (((i * 53) % 37) / 37) * 0.36);
        const w = 10 + ((i * 31) % 17);
        rg.beginPath();
        rg.moveTo(x - w / 2, y - 30);
        rg.lineTo(x + w / 2, y - 30);
        rg.lineTo(x + 1, y + w * 1.6);
        rg.closePath();
        rg.fill();
      }
      return;
    }
    if (def.roof === "warehouse") {
      // A warehouse's roof (as the mockup drew it): dark steel trusses over the high-bay lamps, a pale corrugated deck between them.
      const sky = rg.createLinearGradient(0, 0, 0, H * 0.45);
      sky.addColorStop(0, "#1b1f2a");
      sky.addColorStop(1, "#4a5262");
      rg.fillStyle = sky;
      rg.fillRect(0, 0, W, H);
      rg.strokeStyle = "#11141b";
      rg.lineWidth = 5;
      for (let i = -12; i <= 12; i++) {
        rg.beginPath();
        rg.moveTo(W / 2 + i * W * 0.05, -H * 0.5);
        rg.lineTo(W / 2 + i * W * 0.18, H * 0.45);
        rg.stroke();
      }
      // The trusses' chords and their zigzag web.
      rg.lineWidth = 4;
      for (const [y0, y1] of [[H * 0.06, H * 0.12], [H * 0.2, H * 0.28]] as const) {
        rg.beginPath();
        rg.moveTo(0, y0);
        rg.lineTo(W, y0);
        rg.moveTo(0, y1);
        rg.lineTo(W, y1);
        rg.stroke();
        rg.lineWidth = 2;
        rg.beginPath();
        for (let x = 0, up = true; x <= W + 30; x += 30, up = !up) (x === 0 ? rg.moveTo : rg.lineTo).call(rg, x, up ? y0 : y1);
        rg.stroke();
        rg.lineWidth = 4;
      }
      return;
    }
    if (def.roof === "igloo") {
      // An igloo's dome (as the mockup's stand-in drew it): courses of packed-snow ice blocks arching overhead, pale and cool, a shade
      // darker toward the top, each course's joints staggered from the one under it.
      const sky = rg.createLinearGradient(0, 0, 0, H * 0.45);
      sky.addColorStop(0, "#6f93b4");
      sky.addColorStop(1, "#d6e8f5");
      rg.fillStyle = sky;
      rg.fillRect(0, 0, W, H);
      rg.strokeStyle = "rgba(70,105,140,0.55)";
      rg.lineWidth = 2;
      const rows = [0.03, 0.09, 0.16, 0.24, 0.33, 0.43];
      const sagOf = (i: number) => H * 0.03 * (1 + i * 0.4);
      for (let i = 0; i < rows.length; i++) {
        // (Each course an arc sagging toward the middle of the screen: the dome curving away overhead.)
        const y = H * rows[i]!;
        rg.beginPath();
        rg.moveTo(-10, y);
        rg.quadraticCurveTo(W / 2, y + sagOf(i) * 2, W + 10, y);
        rg.stroke();
        if (i === 0) continue;
        const y0 = H * rows[i - 1]!;
        const bw = W * (0.07 + i * 0.022);
        for (let x = (i % 2) * bw * 0.5; x < W + bw; x += bw) {
          const u = Math.max(0, Math.min(1, x / W));
          rg.beginPath();
          rg.moveTo(x, y0 + sagOf(i - 1) * 2 * 2 * u * (1 - u));
          rg.lineTo(x, y + sagOf(i) * 2 * 2 * u * (1 - u));
          rg.stroke();
        }
      }
      return;
    }
    if (def.roof === "barn") {
      // A barn's roof (as the mockup drew it): dark rafters running up to the ridge, planks between, two heavy cross beams.
      const sky = rg.createLinearGradient(0, 0, 0, H * 0.45);
      sky.addColorStop(0, "#1e120b");
      sky.addColorStop(1, "#5a3a22");
      rg.fillStyle = sky;
      rg.fillRect(0, 0, W, H);
      rg.strokeStyle = "#140c07";
      rg.lineWidth = 6;
      for (let i = -12; i <= 12; i++) {
        rg.beginPath();
        rg.moveTo(W / 2 + i * W * 0.05, -H * 0.5);
        rg.lineTo(W / 2 + i * W * 0.18, H * 0.45);
        rg.stroke();
      }
      rg.strokeStyle = "#2a190e";
      rg.lineWidth = 10;
      for (const y of [H * 0.08, H * 0.2]) {
        rg.beginPath();
        rg.moveTo(0, y);
        rg.lineTo(W, y);
        rg.stroke();
      }
      return;
    }
    if (def.roof === "lodge") {
      // A lodge's ceiling (as the mockup drew it): dark planks between heavy beams running up to a point.
      const sky = rg.createLinearGradient(0, 0, 0, H * 0.45);
      sky.addColorStop(0, "#2e1d10");
      sky.addColorStop(1, "#6b4526");
      rg.fillStyle = sky;
      rg.fillRect(0, 0, W, H);
      rg.strokeStyle = "#1c120a";
      rg.lineWidth = 7;
      for (let i = -12; i <= 12; i++) {
        rg.beginPath();
        rg.moveTo(W / 2 + i * W * 0.05, -H * 0.5);
        rg.lineTo(W / 2 + i * W * 0.18, H * 0.45);
        rg.stroke();
      }
      return;
    }
    if (def.roof === "stone") {
      // A pyramid's sandstone ceiling (as the mockup drew it): warm stone, darker toward the top, its beams running up to a point.
      const sky = rg.createLinearGradient(0, 0, 0, H * 0.45);
      sky.addColorStop(0, "#5a3f22");
      sky.addColorStop(1, "#b88d56");
      rg.fillStyle = sky;
      rg.fillRect(0, 0, W, H);
      rg.strokeStyle = "#7d5c33";
      rg.lineWidth = 4;
      for (let i = -12; i <= 12; i++) {
        rg.beginPath();
        rg.moveTo(W / 2 + i * W * 0.05, -H * 0.5);
        rg.lineTo(W / 2 + i * W * 0.18, H * 0.45);
        rg.stroke();
      }
      return;
    }
    const sky = rg.createLinearGradient(0, 0, 0, H * 0.5);
    sky.addColorStop(0, "#2a0d10");
    sky.addColorStop(1, "#5a1a1e");
    rg.fillStyle = sky;
    rg.fillRect(0, 0, W, H);
    // The big top's canvas stripes, running up to a peak above the screen.
    for (let i = -24; i <= 24; i++) {
      const x0 = W / 2 + i * W * 0.09;
      rg.beginPath();
      rg.moveTo(W / 2, -H * 0.9);
      rg.lineTo(x0, H * 0.45);
      rg.lineTo(x0 + W * 0.09, H * 0.45);
      rg.closePath();
      const st = rg.createLinearGradient(0, 0, 0, H * 0.45);
      st.addColorStop(0, i & 1 ? "#1c0a0b" : "#2a1512");
      st.addColorStop(1, i & 1 ? "#6e1a20" : "#8a7a68");
      rg.fillStyle = st;
      rg.fill();
    }
  };
  const resize = () => {
    const rc = box.getBoundingClientRect();
    const w = Math.max(1, rc.width);
    const h = Math.max(1, rc.height);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (w === W && h === H && dpr === DPR) return false;
    if (dpr !== DPR) tagArt.clear();
    W = w;
    H = h;
    DPR = dpr;
    cv.width = Math.round(W * DPR);
    cv.height = Math.round(H * DPR);
    cv.style.width = `${W}px`;
    cv.style.height = `${H}px`;
    drawRoof();
    return true;
  };

  /** A source triangle of `img` (u, v pixels) onto a screen triangle, clipped to it (a hair wider, so no seam shows). */
  const tri = (img: CanvasImageSource, sx: number, sy: number, sw: number, sh: number, u0: number, v0: number, u1: number, v1: number, u2: number, v2: number, x0: number, y0: number, x1: number, y1: number, x2: number, y2: number) => {
    const cx = (x0 + x1 + x2) / 3;
    const cy = (y0 + y1 + y2) / 3;
    g.save();
    g.beginPath();
    g.moveTo(x0 + Math.sign(x0 - cx) * 0.6, y0 + Math.sign(y0 - cy) * 0.6);
    g.lineTo(x1 + Math.sign(x1 - cx) * 0.6, y1 + Math.sign(y1 - cy) * 0.6);
    g.lineTo(x2 + Math.sign(x2 - cx) * 0.6, y2 + Math.sign(y2 - cy) * 0.6);
    g.closePath();
    g.clip();
    const den = u0 * (v1 - v2) + u1 * (v2 - v0) + u2 * (v0 - v1);
    const a = (x0 * (v1 - v2) + x1 * (v2 - v0) + x2 * (v0 - v1)) / den;
    const b = (x0 * (u2 - u1) + x1 * (u0 - u2) + x2 * (u1 - u0)) / den;
    const c = (x0 * (u1 * v2 - u2 * v1) + x1 * (u2 * v0 - u0 * v2) + x2 * (u0 * v1 - u1 * v0)) / den;
    const d = (y0 * (v1 - v2) + y1 * (v2 - v0) + y2 * (v0 - v1)) / den;
    const e = (y0 * (u2 - u1) + y1 * (u0 - u2) + y2 * (u1 - u0)) / den;
    const ff = (y0 * (u1 * v2 - u2 * v1) + y1 * (u2 * v0 - u0 * v2) + y2 * (u0 * v1 - u1 * v0)) / den;
    g.transform(a, d, b, e, c, ff);
    // (Only the block's own pixels, a pixel round them: not the whole picture.)
    g.drawImage(img, sx - 1, sy - 1, sw + 2, sh + 2, sx - 1, sy - 1, sw + 2, sh + 2);
    g.restore();
  };
  /**
   * A flat picture laid on squares (c0, r0) to (c0 + nc - 1, r0 + nr - 1), its pixel (sx, sy) at the first square's north-west
   * corner, `SQ` pixels a square: in blocks of `floorBlock` squares, a block drawn large near the camera split into single squares.
   */
  const flat = (img: HTMLCanvasElement, sx: number, sy: number, c0: number, r0: number, nc: number, nr: number, B: number) => {
    for (let br = r0; br < r0 + nr; br += B)
      for (let bc = c0; bc < c0 + nc; bc += B) {
        const bw = Math.min(B, c0 + nc - bc);
        const bh = Math.min(B, r0 + nr - br);
        const [a, b, c, d] = pq as [typeof pt, typeof pt, typeof pt, typeof pt];
        if (!P(bc - 0.5, br - 0.5, a) || !P(bc + bw - 0.5, br - 0.5, b) || !P(bc + bw - 0.5, br + bh - 0.5, c) || !P(bc - 0.5, br + bh - 0.5, d)) {
          if (B > 1) flat(img, sx + (bc - c0) * SQ, sy + (br - r0) * SQ, bc, br, bw, bh, 1);
          continue;
        }
        const x0 = Math.min(a.x, b.x, c.x, d.x);
        const x1 = Math.max(a.x, b.x, c.x, d.x);
        const y0 = Math.min(a.y, b.y, c.y, d.y);
        const y1 = Math.max(a.y, b.y, c.y, d.y);
        if (x1 < 0 || x0 > W || y1 < 0 || y0 > H) continue;
        if (B > 1 && (bw > 1 || bh > 1) && y1 - y0 > S.floorSplitPx) {
          flat(img, sx + (bc - c0) * SQ, sy + (br - r0) * SQ, bc, br, bw, bh, 1);
          continue;
        }
        const u0 = sx + (bc - c0) * SQ;
        const v0 = sy + (br - r0) * SQ;
        const u1 = u0 + bw * SQ;
        const v1 = v0 + bh * SQ;
        tri(img, u0, v0, bw * SQ, bh * SQ, u0, v0, u1, v0, u1, v1, a.x, a.y, b.x, b.y, c.x, c.y);
        tri(img, u0, v0, bw * SQ, bh * SQ, u0, v0, u1, v1, u0, v1, a.x, a.y, c.x, c.y, d.x, d.y);
      }
  };
  /** A piece's frame now (all frames of a room share one clock, as the art's loops are drawn to). */
  const frameAt = (name: string, now: number): HTMLCanvasElement => {
    const fr = frames[name]!;
    if (fr.frames.length === 1) return fr.frames[0]!;
    const t = now % fr.loop;
    let i = 0;
    while (i < fr.ends.length - 1 && t >= fr.ends[i]!) i++;
    return fr.frames[i]!;
  };
  /** Where things were drawn in the last frame (taps, cards, tests): the kid's box and the head points. */
  const kidBox = { x0: 0, y0: 0, x1: 0, y1: 0, on: false, hx: 0, hy: 0 };
  const youHead = { x: 0, y: 0, on: false };
  /** Your figure's box this frame and your row (a cave's see-through pieces: drawUp), drawn before anything nearer than you. */
  const youFig = { x0: 0, y0: 0, x1: 0, y1: 0, z: 0, on: false };
  const dest = { c: 0, r: 0, on: false };
  const pose = { x: 0, y: 0, hop: 0, tilt: 0, step: false, t: 0 };
  const sheet = loaded.kid.sheet;
  // (Drawn at the art's own size when the shop says so: Jefferson's dealer, `tall` room pixels from his feet to his top.)
  const kidSquares = (def.tall ? def.tall / SQ : f.sidekickSquares) / (sheet.foot[1] / sheet.h - sheet.top.idle / sheet.h);
  let kidT = 0;
  const kidEnds = sheet.ms.idle.map((ms) => (kidT += Math.max(16, ms)));

  // ---- Jefferson's crew (his warehouse, Nov 4; shops/grex-crew.ts): the scissor lift and the forklift on their loops (they wait for
  // anyone in their way), the idle crew at their places; in his intro they stop work and come round the table to watch. Drawn from
  // their baked sheets (grex-crew-sheets.ts), 1:1 at the room's scale, each by its row among the pieces.
  const cw = art.crew ?? null;
  const KC = C.crew;
  const lift = cw ? new Machine("lift", liftLegs(cw.liftPath, S.crew)) : null;
  const fork = cw ? new Machine("forklift", forkLegs(cw.forkPath, S.crew)) : null;
  const liftPose: MachinePose = { c: 0, r: 0, anim: "idle", frame: 0, flip: false, waiting: false };
  const forkPose: MachinePose = { c: 0, r: 0, anim: "idle", frame: 0, flip: false, waiting: false };
  /** Someone stands on the square, or is stepping onto it: you, or the boss walking in with you. */
  const figureOn = (c: number, r: number): boolean => {
    if (you.hereC() === c && you.hereR() === r) return true;
    return !!boss && boss.hereC() === c && boss.hereR() === r;
  };
  /** The floor pallet's square (the forklift's loop picks it up there and sets it down again). */
  const palletSq = cw ? { c: Math.round(cw.palletAt[0]), r: Math.round(cw.palletAt[1]) } : { c: -1, r: -1 };
  /** A machine or the pallet on the floor takes the square now: nobody walks onto it. */
  const crewTakes = (c: number, r: number): boolean =>
    !!cw && (lift!.occupies(c, r) || fork!.occupies(c, r) || (fork!.pallet === "floor" && c === palletSq.c && r === palletSq.r));
  /** A way from `from` to `to` round the machines and the pallet where they are now (else the room's own way: you stop if one's in it). */
  const crewRoom: Room | null = cw ? { ...room, blocked: new Uint8Array(room.blocked) } : null;
  const findWay = (from: Sq, to: Sq): Sq[] | null => {
    if (!crewRoom) return findPath(room, from, to);
    const b = crewRoom.blocked as Uint8Array;
    b.set(room.blocked);
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (crewTakes(c, r)) b[r * n + c] = 1;
    return findPath(crewRoom, from, to) ?? findPath(room, from, to);
  };
  // ---- Ginger's elves (his igloo, Nov 5; shops/ginger-elves.ts): the three walkers on their loops round the battle spot, the
  // dispensing pair along the back wall, up the east stairs, along the catwalk and down the west stairs (the height curve yours is:
  // levels.ts). Each waits while you (or the boss walking in) stand on or just ahead of its way; each takes its square (and, walking,
  // the one just ahead): a tap walks you round them, the other staircase if one's on the nearer; one in your way and you wait.
  const EA = art.elves ?? null;
  const EF = S.elves;
  const ef = loaded.elves;
  const WALKERS = ["red", "green", "blue"] as const;
  const walkerLoops = EA ? WALKERS.map((k) => new ElfLoop(walkerLegs(EA.walkers[k], EF.walkerSpeed), EF.walkerStart[k])) : [];
  /** A's four jobs at a stop and their lengths (his art's): tap, hold the box out, fill it, tip it into his sack. */
  const STOP_JOBS = ef ? (["tap", "boxOut", "fill", "full"] as const).map((a) => ({ anim: a, ms: ef.box[a]!.ms.reduce((x, y) => x + y, 0) })) : [];
  const pair = EA ? new ElfLoop(pairLegs(EA.path, EF.pairSpeed, STOP_JOBS.reduce((x, j) => x + j.ms, 0) + EF.stopBeatMs)) : null;
  const stops = EA ? EA.path.filter((p) => p.stop).map((p) => ({ face: p.stop!.face, b: p.b! })) : [];
  const newPose = (): ElfPose => ({ x: 0, y: 0, face: 1, anim: "idle", t: 0, waiting: false });
  /** The elves' poses this frame: the walkers, then A and B. */
  const elfPoses = [newPose(), newPose(), newPose(), newPose(), newPose()];
  /** The squares the elves take this frame (k = r * n + c), and how many. */
  const elfSq = new Int16Array(10);
  let elfN = 0;
  const esq = { c: 0, r: 0 };
  const eahead = { x: 0, y: 0 };
  // (On the stairs and the catwalk nobody blocks anyone: one lane wide, an elf waiting for you while you waited for it stood there
  // for good (main's e2e, Nov 5: you on the east flight's low step, the pair's elf at its foot to go up). Figures pass there.)
  const elfTakes = (c: number, r: number): boolean => {
    if (isUp(lv, c, r)) return false;
    const k = r * n + c;
    for (let i = 0; i < elfN; i++) if (elfSq[i] === k) return true;
    return false;
  };
  /** You (the square you're on, leaving or stepping onto) or the boss walking in are on the square under (x, y). */
  const inElfWay = (x: number, y: number): boolean => {
    squareOf(lv, x, y, esq);
    if (isUp(lv, esq.c, esq.r)) return false;
    return figureOn(esq.c, esq.r) || (you.c === esq.c && you.r === esq.r);
  };
  const takeSq = (x: number, y: number) => {
    squareOf(lv, x, y, esq);
    const k = esq.r * n + esq.c;
    for (let i = 0; i < elfN; i++) if (elfSq[i] === k) return;
    if (elfN < elfSq.length) elfSq[elfN++] = k;
  };
  const legAt = { i: 0, u: 0 };
  const job = { anim: "idle", t: 0 };
  /** The elves a frame on: each walks on unless someone's in its way; then where each stands and the squares they take. */
  const stepElves = (dtMs: number) => {
    if (!EA || !pair) return;
    elfN = 0;
    for (let i = 0; i < walkerLoops.length; i++) {
      walkerLoops[i]!.update(dtMs, inElfWay, EF.look);
      walkerLoops[i]!.pose(elfPoses[i]!);
    }
    pair.update(dtMs, inElfWay, EF.look);
    const a = pair.pose(elfPoses[3]!, (k) => stops[k]!.face);
    const lg = pair.leg(legAt);
    const l = pair.legs[lg.i]!;
    if (l.kind === "stand" && l.stop >= 0) {
      stopJob(STOP_JOBS, lg.u, job);
      a.anim = job.anim;
      a.t = job.t;
    }
    elfB(pair, stops, EF.bBehind, EF.bMoveMs, elfPoses[4]!);
    for (let i = 0; i < 5; i++) {
      const p = elfPoses[i]!;
      takeSq(p.x, p.y);
      if (p.anim === "walk") {
        const loop = i < 3 ? walkerLoops[i]! : pair;
        if (i === 4) loop.pointAt(EF.takesAhead - EF.bBehind, eahead);
        else loop.pointAt(EF.takesAhead, eahead);
        takeSq(eahead.x, eahead.y);
      }
    }
  };
  /** A way from `from` to `to` round the elves where they are now, or null: none now. */
  const elfRoom: Room | null = EA ? { ...room, blocked: new Uint8Array(room.blocked) } : null;
  const wayRoundElves = (from: Sq, to: Sq): Sq[] | null => {
    const b = elfRoom!.blocked as Uint8Array;
    b.set(room.blocked);
    for (let i = 0; i < elfN; i++) if (elfSq[i] !== from.r * n + from.c) b[elfSq[i]!] = 1;
    return findPath(elfRoom!, from, to);
  };
  /** (Tests, Ginger's igloo) Your figure as drawn, frame by frame (hookElves). */
  const youTrail: { x: number; y: number; up: number; sy: number; z: number; t: number }[] = new Array(6000);
  let youTrailN = 0;
  /** Where you're waiting to go while the elves are in your way (a tap's square), or null. */
  let waitFor: Sq | null = null;
  /** Your walk round the elves: re-routed when one steps into your way; waiting where you are while there's no way, and going once there is. */
  const stepYouElves = () => {
    if (!EA || ci) return;
    const nx = you.peek();
    if (nx && elfTakes(nx.c, nx.r)) {
      waitFor = you.goal();
      you.halt();
    }
    if (!waitFor || you.moving()) return;
    const here = you.here();
    if (here.c === waitFor.c && here.r === waitFor.r) return void (waitFor = null);
    const path = wayRoundElves(here, waitFor);
    // (On the stairs or the catwalk the only way round is back the way you came and over by the other staircase: you wait for the
    // way ahead to clear instead (Eric, Nov 5: it turned back halfway down), unless an elf is waiting for you too.)
    if (path && isUp(lv, here.c, here.r) && !(walkerLoops.some((w) => w.waiting) || pair!.waiting) && path.length > (findPath(room, here, waitFor)?.length ?? 0)) return;
    if (path) {
      you.go(path);
      waitFor = null;
    } else if (walkerLoops.some((w) => w.waiting) || pair!.waiting) {
      // (An elf waiting for you while you wait for it: you give way, standing where you are; tap again to go round.)
      waitFor = null;
      dest.on = false;
    }
  };
  /** One of the crew (or an elf) to draw this frame: a frame of a sheet, its foot at (c, r), mirrored or not, raised `up` px; drawn by `z`. */
  interface CrewFig {
    img: CanvasImageSource | null;
    /** An elf: its small shadow on the floor or the planks under its feet (the art's), wherever it stands. */
    elf?: boolean;
    sx: number;
    sy: number;
    w: number;
    h: number;
    fx: number;
    fy: number;
    k: number;
    c: number;
    r: number;
    z: number;
    flip: boolean;
    up: number;
  }
  const crewFigs: CrewFig[] = Array.from({ length: CREW_MAX }, () => ({ img: null, elf: false, sx: 0, sy: 0, w: 0, h: 0, fx: 0, fy: 0, k: 1, c: 0, r: 0, z: 0, flip: false, up: 0 }));
  let crewN = 0;
  const sheetAnim = (name: CrewName, anim: string) => (CREW_SHEETS[name].anims as Record<string, { row: number; loop: boolean; ms: readonly number[]; cues: readonly (string | null)[] }>)[anim]!;
  /** Adds a frame of a crew sheet (its foot at c, r). */
  const addCrew = (name: CrewName, anim: string, frame: number, c: number, r: number, flip: boolean, z = r, up = 0) => {
    if (crewN >= CREW_MAX || !loaded.crew) return;
    const sh = CREW_SHEETS[name];
    const a = sheetAnim(name, anim);
    Object.assign(crewFigs[crewN++]!, { img: loaded.crew[name], elf: false, sx: frame * sh.w, sy: a.row * sh.h, w: sh.w, h: sh.h, fx: sh.foot[0], fy: sh.foot[1], k: 1, c, r, z, flip, up });
  };
  /** Adds a frame of the dealer's sheet (the Shopkeeper's: its idle row 0, walk row 1), at his size. */
  const addDealer = (row: 0 | 1, frame: number, c: number, r: number, flip: boolean) => {
    if (crewN >= CREW_MAX) return;
    Object.assign(crewFigs[crewN++]!, { img: loaded.kid.img, elf: false, sx: frame * sheet.w, sy: row * sheet.h, w: sheet.w, h: sheet.h, fx: sheet.foot[0], fy: sheet.foot[1], k: (kidSquares * SQ) / sheet.h, c, r, z: r, flip, up: 0 });
  };
  const ELF_NAMES: readonly ElfName[] = ["red", "green", "blue", "box", "pad"];
  /** Ginger's elves where they stand this frame (their poses from stepElves), lifted by the height curve, into `crewFigs`; in his intro, the board carriers and the board too. */
  const collectElves = () => {
    if (!EA || !ef) return;
    const I = ci?.ice;
    if (I && iceNow?.carriers) {
      for (const [i, cn] of iceNow.carriers.entries()) {
        if (crewN >= CREW_MAX) break;
        const ca = i === 0 ? I.carriers.a : I.carriers.b;
        const img = ca.frames[cn.anim][cn.frame]!;
        Object.assign(crewFigs[crewN++]!, { img, elf: true, sx: 0, sy: 0, w: img.width, h: img.height, fx: ca.ch.foot[0], fy: ca.ch.foot[1], k: 1, c: cn.c, r: cn.r, z: cn.r, flip: cn.face < 0, up: 0 });
      }
    }
    if (I && iceNow?.board && crewN < CREW_MAX) {
      const bd = iceNow.board;
      const img = bd.anim === "spin" ? I.props.spin.frames[bd.frame]! : I.board.carry;
      // (Just in front of them; over the table's top as it lands.)
      Object.assign(crewFigs[crewN++]!, { img, elf: false, sx: 0, sy: 0, w: img.width, h: img.height, fx: I.board.ch.foot[0], fy: I.board.ch.foot[1], k: 1, c: bd.c, r: bd.r, z: bd.r + 0.02, flip: false, up: bd.lift });
    }
    for (let i = 0; i < 5; i++) {
      if (crewN >= CREW_MAX) return;
      const p = elfPoses[i]!;
      const fr = ef[ELF_NAMES[i]!];
      const an = fr[p.anim] ?? fr.idle!;
      const img = an.frames[frameOf(an.ms, p.t, an.loop)]!;
      const up = liftAt(lv, p.x, p.y);
      Object.assign(crewFigs[crewN++]!, { img, elf: true, sx: 0, sy: 0, w: img.width, h: img.height, fx: EA.chars[ELF_NAMES[i]!].foot[0], fy: EA.chars[ELF_NAMES[i]!].foot[1], k: 1, c: p.x, r: p.y, z: levelZ(p.y, up), flip: p.face < 0, up });
    }
  };
  /** The pallet with the forklift (`at` its pose): on its forks, on the shelf (eased the last few px onto the slot), or on the floor. */
  const addPallet = (at: MachinePose) => {
    const F = CREW_SHEETS.forklift;
    const onForks = (anim: string, frame: number) => {
      const p = CREW_FORK_AT[anim]?.[frame] ?? CREW_FORK_AT.idle![0]!;
      return { c: at.c + (p[0] - F.foot[0]) / SQ, up: F.foot[1] - p[1] };
    };
    const since = fork!.clock - fork!.palletSince;
    const ease = Math.min(1, Math.max(0, since / S.crew.palletEaseMs));
    if (fork!.pallet === "forks") {
      const p = onForks(at.anim, at.frame);
      // (Just lifted off the shelf: eased from the slot's middle onto the forks.)
      const c = fork!.palletSince > -Infinity && ease < 1 && at.anim === "lift" ? cw!.shelf.col + (p.c - cw!.shelf.col) * ease : p.c;
      addCrew("pallet", "idle", 0, c, at.r, false, at.r + 0.001, p.up);
    } else if (fork!.pallet === "shelf") {
      const from = onForks("set", 1).c;
      addCrew("pallet", "idle", 0, from + (cw!.shelf.col - from) * ease, cw!.shelf.row, false, cw!.shelf.row + 0.002, cw!.shelf.lift);
    } else addCrew("pallet", "idle", 0, cw!.palletAt[0], cw!.palletAt[1], false);
  };
  /** Each idle crew member's loop starts at its own place in it (so they don't move as one). */
  const OFFSET: Readonly<Record<string, number>> = { "leaner-a": 0, "leaner-b": 700, "crew-c": 300, "crew-d": 1100 };
  const IDLE = ["leaner-a", "leaner-b", "crew-c", "crew-d"] as const;
  /** The crew walking over in his intro: each one's way (from where he set off, round the table's north side, to his spot), when he goes (ms after the stop), how fast. */
  interface Walk {
    key: CrewKey;
    pts: CrewSq[];
    start: number;
    speed: number;
    spot: readonly [number, number];
    face: number;
    lastFrame: number;
  }
  let walks: Walk[] | null = null;
  const at3 = { c: 0, r: 0, face: 1 as 1 | -1, done: false };
  let lastStep = -Infinity;
  /** The crew stop (his intro): the machines park where they are, each walker's way is set from where he is. */
  const planCrew = () => {
    const cr = ci?.crew;
    if (!cr || !cw || !ci?.anims) return;
    lift!.stop();
    fork!.stop();
    lift!.pose(liftPose);
    fork!.pose(forkPose);
    const rise = ci.anims && "rise" in ci.anims ? ci.anims.rise.reduce((a, b) => a + b, 0) : 0;
    const off = (sheet: CrewName) => sheetAnim(sheet, "stepOff").ms.reduce((a, b) => a + b, 0);
    const wake = sheetAnim("crew-d", "wake").ms.reduce((a, b) => a + b, 0);
    const from: Record<CrewKey, CrewSq> = {
      "lift-guy": { c: liftPose.c + ((liftPose.flip ? -1 : 1) * CREW_STEP_OFF.lift[0]) / SQ, r: liftPose.r + CREW_STEP_OFF.lift[1] / SQ },
      "fork-guy": { c: forkPose.c + CREW_STEP_OFF.forklift[0] / SQ, r: forkPose.r + CREW_STEP_OFF.forklift[1] / SQ },
      "leaner-a": { c: cw.places["leaner-a"].at[0], r: cw.places["leaner-a"].at[1] },
      "leaner-b": { c: cw.places["leaner-b"].at[0], r: cw.places["leaner-b"].at[1] },
      "crew-c": { c: cw.places["crew-c"].at[0], r: cw.places["crew-c"].at[1] },
      "crew-d": { c: cw.places["crew-d"].at[0], r: cw.places["crew-d"].at[1] },
      dealer: { c: def.at[0], r: def.at[1] },
    };
    walks = (Object.keys(cr.spots) as CrewKey[]).map((key) => {
      const own = KC.setOffMs + cr.setoff[key];
      // (The machine guys once they're off; the dozer once he's awake.)
      const start = key === "lift-guy" ? Math.max(own, off("lift")) : key === "fork-guy" ? Math.max(own, off("forklift")) : key === "crew-d" ? own + wake : own;
      const spot = cr.spots[key];
      const pts = [from[key], ...KC.via[key].map(([c, r]) => ({ c, r })), { c: spot.at[0], r: spot.at[1] }];
      // (At least `speed`; faster if he must, to be at his spot by the time your lift locks.)
      const left = Math.max(500, KC.setOffMs + KC.walkMs + rise - start);
      return { key, pts, start, speed: Math.max(KC.speed, routeLength(pts) / (left / 1000)), spot: spot.at, face: spot.face, lastFrame: -1 };
    });
  };
  /** The machines a frame on (until the crew stop in his intro). */
  const stepCrew = (dtMs: number, now: number) => {
    if (!cw) return;
    const cn = introNow?.crew;
    if (cn && cn.stopped >= 0) {
      if (!walks) planCrew();
      stepWalkSounds(cn.stopped, now);
      return;
    }
    lift!.update(dtMs, figureOn);
    fork!.update(dtMs, figureOn);
  };
  /** The crew's steps as they walk over: each walk frame's `step` cue, at most one a `stepGapMs`. */
  const stepWalkSounds = (since: number, now: number) => {
    if (!walks || !ci) return;
    for (const w of walks) {
      const t = since - w.start;
      if (t < 0) continue;
      along(w.pts, w.speed, t, at3);
      if (at3.done) continue;
      const ms = w.key === "dealer" ? sheet.ms.walk : sheetAnim(crewSheet(w.key), "walk").ms;
      const fr = frameOf(ms, t, true);
      if (fr === w.lastFrame) continue;
      w.lastFrame = fr;
      const cue = w.key === "dealer" ? (fr === 0 || fr === 3 ? "step" : null) : sheetAnim(crewSheet(w.key), "walk").cues[fr];
      if (cue && now - lastStep >= KC.stepGapMs) {
        lastStep = now;
        playCue(ci, cue);
      }
    }
  };
  const crewSheet = (k: CrewKey): CrewName => (k === "lift-guy" ? "lift-guy" : k === "fork-guy" ? "fork-guy" : k === "dealer" ? "crew-c" : k);
  /** Who of the crew stands where this frame (each a frame of its sheet), into `crewFigs`. */
  const collectCrew = (now: number) => {
    crewN = 0;
    if (!cw || !loaded.crew) return;
    const cn = introNow?.crew;
    const stopped = cn && cn.stopped >= 0 && walks ? cn.stopped : -1;
    lift!.pose(liftPose);
    fork!.pose(forkPose);
    if (stopped < 0) {
      for (const k of IDLE) {
        const pl = cw.places[k];
        const a = sheetAnim(k, "idle");
        // (The dozer on his pallet: drawn after it.)
        addCrew(k, "idle", frameOf(a.ms, now + OFFSET[k]!, true), pl.at[0], pl.at[1], pl.face < 0, pl.at[1] + (k === "crew-d" ? 0.005 : 0));
      }
      addCrew("lift", liftPose.anim, liftPose.frame, liftPose.c, liftPose.r, liftPose.flip);
      addCrew("forklift", forkPose.anim, forkPose.frame, forkPose.c, forkPose.r, false);
      addPallet(forkPose);
      // (In his challenge, before the stop, the dealer stands in his corner too.)
      if (ci) addDealer(0, frameOf(sheet.ms.idle, now, true), def.at[0], def.at[1], !!def.flip);
      return;
    }
    // His intro, from the stop: the machines park (their guys step off), each of the crew goes when it's his turn.
    for (const [name, pose] of [["lift", liftPose], ["forklift", forkPose]] as const) {
      const so = sheetAnim(name, "stepOff");
      const len = so.ms.reduce((a, b) => a + b, 0);
      const anim = stopped < len ? "stepOff" : "parked";
      const fr = anim === "stepOff" ? frameOf(so.ms, stopped, false) : 0;
      addCrew(name, anim, fr, pose.c, pose.r, name === "lift" && pose.flip);
      if (name === "forklift") addPallet({ ...pose, anim, frame: fr });
    }
    const wakeA = sheetAnim("crew-d", "wake");
    const wakeLen = wakeA.ms.reduce((a, b) => a + b, 0);
    for (const w of walks!) {
      const t = stopped - w.start;
      if (t < 0) {
        // (Not his turn yet: the machine guys are still climbing off (their machines' frames); the dozer waking; the rest as they were.)
        if (w.key === "lift-guy" || w.key === "fork-guy") continue;
        if (w.key === "dealer") addDealer(0, frameOf(sheet.ms.idle, now, true), def.at[0], def.at[1], !!def.flip);
        else if (w.key === "crew-d") addCrew("crew-d", "wake", frameOf(wakeA.ms, stopped, false), w.pts[0]!.c, w.pts[0]!.r, false, w.pts[0]!.r + 0.005);
        else addCrew(w.key, "idle", 0, w.pts[0]!.c, w.pts[0]!.r, cw.places[w.key].face < 0);
        continue;
      }
      along(w.pts, w.speed, t, at3);
      const flip = (at3.done ? w.face : at3.face) < 0;
      if (w.key === "dealer") {
        if (at3.done) addDealer(0, frameOf(sheet.ms.idle, now, true), at3.c, at3.r, flip);
        else addDealer(1, frameOf(sheet.ms.walk, t, true), at3.c, at3.r, flip);
        continue;
      }
      const name = crewSheet(w.key);
      if (at3.done) addCrew(name, "watch", frameOf(sheetAnim(name, "watch").ms, now + (OFFSET[w.key] ?? 400), true), at3.c, at3.r, flip);
      else addCrew(name, "walk", frameOf(sheetAnim(name, "walk").ms, t, true), at3.c, at3.r, flip);
      void wakeLen;
    }
  };
  /** One of the crew (`crewFigs[i]`), its foot on its square, its shadows the town's. */
  const drawCrewFig = (i: number) => {
    const fg = crewFigs[i]!;
    if (!fg.img || !P(fg.c, fg.r)) return;
    const s = (pt.k / SQ) * fg.k;
    const y = pt.y - fg.up * (pt.k / SQ);
    if (fg.w < 100 && fg.up === 0 && fg.h > 60) shadows(pt.x, pt.y, pt.k, fg.w * s * 0.45);
    if (fg.elf) {
      // (The art's: an ellipse 16 x 4 of the room's pixels, #140c04 at 45%, under its feet on the floor, a step or the deck.)
      g.fillStyle = "#140c04";
      g.globalAlpha = 0.45;
      g.beginPath();
      g.ellipse(pt.x, y, 8 * s, 2 * s, 0, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;
    }
    g.imageSmoothingEnabled = false;
    if (fg.flip) {
      g.save();
      g.translate(pt.x, 0);
      g.scale(-1, 1);
      g.drawImage(fg.img, fg.sx, fg.sy, fg.w, fg.h, -fg.fx * s, y - fg.fy * s, fg.w * s, fg.h * s);
      g.restore();
    } else g.drawImage(fg.img, fg.sx, fg.sy, fg.w, fg.h, pt.x - fg.fx * s, y - fg.fy * s, fg.w * s, fg.h * s);
  };

  /** Your figure's middle (its middle third across), for the igloo's see-through walls. */
  const youCore = { x0: 0, y0: 0, x1: 0, y1: 0 };
  const youMid = () => {
    const m = (youFig.x0 + youFig.x1) / 2;
    const half = (youFig.x1 - youFig.x0) / 6;
    return Object.assign(youCore, { x0: m - half, x1: m + half, y0: youFig.y0, y1: youFig.y1 });
  };
  const drawUp = (u: Up, now: number) => {
    // (Wrangler's intro: from the yank, the board on its stand is his bale, drawn as it's dragged: drawRopeCenter.)
    if (introNow?.rope?.bale && u.name === "board-stand") return;
    // (Jefferson's challenge: his intro's crate stack stands in its place from the walk in, the same picture: drawCrewCenter.)
    if (cw && ci?.crew && u.name === "board-stand") return;
    if (!P(u.c, u.r)) return;
    // Near the camera (between it and you, up close: the front wall as you stand at the door) a piece fades out, so it never fills
    // the screen in front of you.
    if (pt.depth <= S.nearGone) return;
    // (Hollow's intro: a lantern going out, bulbs gone dark, the tree draining: its own frame, and its lit pixels for over the dark.)
    // (Ginger's intro: the stockroom door open while the board carriers come out.)
    const img = darkPiece(u, now) ?? frameAt(iceNow?.door && u.name === "bay-door" ? "bay-door-open" : u.name, now);
    const ch = frames[u.name]!.ch;
    const s = pt.k / SQ;
    const fx = u.flip ? ch.w - 1 - ch.foot[0] : ch.foot[0];
    const h = u.cut || img.height;
    const x = pt.x + (u.ox - fx) * s;
    const y = pt.y + (u.oy - ch.foot[1]) * s;
    const w = img.width * s;
    if (x > W || x + w < 0 || y > H || y + h * s < 0) return;
    // (A cave: nearer the camera than you and over you, see-through: SHOP_FEEL.seeThrough.)
    // (Jefferson's warehouse too: its tall roll-up door, nearer the camera than you just inside it.)
    // (Ginger's igloo too: its near walls, the tunnel's and its doorway's arch, nearer the camera than you; there only over your
    // figure's middle, so the candy wall beside a stair's foot, a row nearer, isn't ghosted for covering your edge.)
    const thru = !!cave || !!art.floor;
    const over = lv ? overlaps(youMid(), x, y, x + w, y + h * s) : overlaps(youFig, x, y, x + w, y + h * s);
    g.globalAlpha = upAlpha(pt.depth, thru && youFig.on && u.z > youFig.z && over, thru);
    if (pieceEmis && darkNow && darkNow.level > 0) addEmis(pieceEmis, x, y, s, img.width, u.flip, g.globalAlpha * (1 - darkNow.black));
    if (u.flip) {
      g.save();
      g.translate(x + w, y);
      g.scale(-1, 1);
      g.drawImage(img, 0, 0, img.width, h, 0, 0, w, h * s);
      g.restore();
    } else g.drawImage(img, 0, 0, img.width, h, x, y, w, h * s);
    g.globalAlpha = 1;
  };
  /** Where an upright piece's top is on screen this frame, as drawUp places it; Infinity when it isn't drawn (off screen, faded out). */
  const upTop = (u: Up): number => {
    if (!P(u.c, u.r)) return Infinity;
    if ((pt.depth - S.nearGone) / (S.nearFull - S.nearGone) <= 0) return Infinity;
    const fr = frames[u.name]!;
    const img = fr.frames[0]!;
    const s = pt.k / SQ;
    const x = pt.x + (u.ox - (u.flip ? fr.ch.w - 1 - fr.ch.foot[0] : fr.ch.foot[0])) * s;
    const y = pt.y + (u.oy - fr.ch.foot[1]) * s;
    return x > W || x + img.width * s < 0 || y > H ? Infinity : y;
  };
  /**
   * A store's ceiling light panels (room.ts STORE_PANELS), on the backdrop behind the room, cut at the highest top of any upright piece
   * drawn this frame: the gaps between the side walls' pieces (and a near wall fading out) show the backdrop, and a panel there read as
   * floating over the shelves (the director's review, Nov 3). Nothing allocated.
   */
  const panel = { x: 0, y: 0, w: 0, h: 0 };
  const drawPanels = () => {
    let top = Infinity;
    for (const u of ups) top = Math.min(top, upTop(u));
    g.fillStyle = "#ffffff";
    for (let i = 0; i < STORE_PANELS.length; i++) if (ceilingPanel(i, W, top, panel)) g.fillRect(panel.x, panel.y, panel.w, panel.h);
  };
  const shadows = (x: number, y: number, k: number, pawnW: number) => {
    g.fillStyle = SHADOW;
    g.globalAlpha = f.shadowAlpha;
    g.beginPath();
    g.ellipse(x, y, Math.min(pawnW * 0.42, k * 0.42), k * 0.12, 0, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = f.contactShadowAlpha;
    g.beginPath();
    g.ellipse(x, y, pawnW * f.contactShadowW, k * f.contactShadowDepth, 0, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
  };
  const drawKid = (now: number) => {
    kidBox.on = false;
    // (Jefferson's challenge: his dealer is one of the crew, who come over to watch: drawCrewFig.)
    if (cw && ci) return;
    if (!P(def.at[0], def.at[1])) return;
    const s = (kidSquares * pt.k) / sheet.h;
    // (Raised onto the counter's top, `lift` of the room's pixels: Wrangler's rooster. His shadows there too.)
    const fy = pt.y - ((def.lift ?? 0) * pt.k) / SQ;
    const x0 = pt.x - sheet.foot[0] * s;
    const y0 = fy - sheet.foot[1] * s;
    const t = now % kidEnds[kidEnds.length - 1]!;
    let i = 0;
    while (i < kidEnds.length - 1 && t >= kidEnds[i]!) i++;
    shadows(pt.x, fy, pt.k, sheet.w * s * 0.6);
    g.imageSmoothingEnabled = false;
    if (def.flip) {
      // (Facing west: mirrored about his feet.)
      g.save();
      g.translate(pt.x, 0);
      g.scale(-1, 1);
      g.drawImage(loaded.kid.img, i * sheet.w, 0, sheet.w, sheet.h, -sheet.foot[0] * s, y0, sheet.w * s, sheet.h * s);
      g.restore();
    } else g.drawImage(loaded.kid.img, i * sheet.w, 0, sheet.w, sheet.h, x0, y0, sheet.w * s, sheet.h * s);
    Object.assign(kidBox, { x0, y0, x1: x0 + sheet.w * s, y1: y0 + sheet.h * s, on: true, hx: pt.x, hy: fy - (sheet.foot[1] - sheet.top.idle) * s - 2 });
    // (A cave: the counter is round the bend, out of sight from the mouth, so the tag goes with him behind the rock nearer the camera,
    // drawn now, not over everything.)
    if (cave && !challenge) drawTag("Shopkeeper", "sidekick", kidBox.hx, kidBox.hy);
  };
  /**
   * You on your ride (town/rides.ts' frames, as the town's drawRider draws them): its idle standing, its move a cycle a step,
   * lifted by its hop; its shadows as the town's (smaller and lighter as it lifts); your tag over its top standing.
   */
  const drawRiding = (rd: Rider, now: number) => {
    const view = you.view;
    const rv = rd.views[view];
    const flip = rv.facing === "side" ? you.facing : 1;
    const box = f.youSquares;
    let img: HTMLCanvasElement;
    let lift = 0;
    let i: number;
    if (pose.step) {
      i = rv.moveIndex(pose.t);
      img = rv.frames.move[i]!;
      lift = (rv.lift[i]! * box) / 100;
    } else img = rv.frames.idle[(i = rv.idleIndex(now))]!;
    lift += hopLift();
    Object.assign(seen, { ride: rd.id, anim: pose.step ? "move" : "idle", frame: i, facing: flip, view: rv === rd.views[0] ? 0 : view });
    const h = ((box * rv.h) / 100) * pt.k;
    const w = (h * rv.w) / rv.h;
    const x0 = pt.x - rv.footX * w;
    const y0 = pt.y - rv.footY * h - lift * pt.k;
    // The shadows (the town's drawSprite for a rider: sized by the ride's own `shadow`).
    const up = Math.max(0, lift);
    const grow = 1 / (1 + up * f.shadowLiftShrink);
    const fade = Math.max(0, 1 - up * f.shadowLiftFade);
    const soft = rd.shadow;
    g.fillStyle = SHADOW;
    g.globalAlpha = f.shadowAlpha * (0.5 + 0.5 * fade);
    g.beginPath();
    g.ellipse(pt.x, pt.y, Math.min(w * 0.42, pt.k * 0.42 * soft) * grow, pt.k * 0.12 * soft * grow, 0, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = f.contactShadowAlpha * fade;
    g.beginPath();
    g.ellipse(pt.x, pt.y, pt.k * f.contactShadowW * 1.45 * Math.min(soft, 1.2) * grow, pt.k * f.contactShadowDepth * grow, 0, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
    g.save();
    if (flip < 0) {
      g.translate(pt.x, 0);
      g.scale(-1, 1);
      g.translate(-pt.x, 0);
    }
    // (Crisp drawn bigger than its pixels, smooth smaller: as the town draws it.)
    g.imageSmoothingEnabled = h < img.height * 1.5;
    g.drawImage(img, x0, y0, w, h);
    g.restore();
    g.imageSmoothingEnabled = false;
    // (The tag over its top standing: it doesn't jump with the hop.)
    Object.assign(youHead, { x: pt.x, y: y0 + lift * pt.k + rv.top * h - 2, on: true });
  };
  const drawYou = (now: number) => {
    youHead.on = false;
    youFig.on = false;
    seen.anim = "";
    you.pose(now, pose);
    // (Jefferson's intro: your lift under you, you standing on its plate, lifted with it.)
    if (cw && introNow?.crew) drawLift();
    if (!P(pose.x + youOx(now), pose.y + youOy(now))) return;
    if (cw && introNow?.crew) pt.y -= (plateUp() * pt.k) / SQ;
    // (Ginger's catwalk and stairs: lifted by the height curve where your feet are, levels.ts; your shadows and tag with you.)
    const up = liftAt(lv, pose.x, pose.y);
    if (up) pt.y -= (up * pt.k) / SQ;
    youBox(pt.x, pt.y, pt.k, f.youSquares, youFig);
    youFig.z = levelZ(pose.y + youOy(now), up);
    if (lv && youTrailN < youTrail.length && testSwitchesAllowed()) youTrail[youTrailN++] = { x: Math.round(pose.x * 1000) / 1000, y: Math.round(pose.y * 1000) / 1000, up: Math.round(up * 100) / 100, sy: Math.round(pt.y * 10) / 10, z: Math.round(youFig.z * 1000) / 1000, t: Math.round(now) };
    youFig.on = true;
    Object.assign(youFoot, { x: pt.x, y: pt.y, k: pt.k, on: true });
    const rd = riding();
    if (rd) return drawRiding(rd, now);
    seen.ride = null;
    const a = youArt();
    const pad = a?.pad ?? 0;
    const kk = 1 + 2 * pad;
    const h = f.youSquares * kk * pt.k;
    const fy = (pad + PAWN_FOOT) / kk;
    const head = Math.min(a?.top ?? 1, (pad + PAWN_HEAD) / kk);
    const lift = (pose.hop * f.youHop + hopLift()) * pt.k;
    shadows(pt.x, pt.y, pt.k, h / kk);
    const y0 = pt.y - fy * h - lift;
    g.save();
    g.translate(pt.x, pt.y);
    if (pose.tilt) g.rotate((pose.tilt * f.hobbleTilt * Math.PI) / 180);
    if (you.facing < 0) g.scale(-1, 1);
    if (a) {
      g.imageSmoothingEnabled = h < a.img.height * 1.5;
      g.drawImage(a.img, -h / 2, y0 - pt.y, h, h);
    } else {
      // The plain pawn drawn as its outline at this size (crisp up close, as the mockup's), not its 160 px picture blown up.
      const u = h / 45;
      g.translate(-h / 2, y0 - pt.y);
      g.scale(u, u);
      // (Hollow's intro: its light drawn off, the pawn greys a touch, to a light grey-lilac.)
      const tint = darkNow?.pawn.tint ?? 0;
      g.fillStyle = tint ? `rgb(${Math.round(255 - 38 * tint)},${Math.round(255 - 38 * tint)},${Math.round(255 - 26 * tint)})` : "#ffffff";
      g.fill(PAWN);
      g.lineWidth = 1.5;
      g.lineCap = "round";
      g.strokeStyle = "#000000";
      g.stroke(PAWN);
    }
    g.restore();
    g.imageSmoothingEnabled = false;
    Object.assign(youHead, { x: pt.x, y: y0 + head * h - 2, on: true });
  };
  /** The boss (in a challenge): its town sprite, its idle playing, at the town's size, its shadows as the town draws a boss's. */
  const bossHead = { x: 0, y: 0, on: false, px: 0 };
  /**
   * The boss's God King attack, at the boss's own size in the room: its lashes swung in place (no drop-in, no leap off), its feet
   * where the boss stands (clear of its stool, Nov 2), facing you. Turned to face the way it should (the art faces right, or left
   * for `facesLeft`).
   */
  const drawAttack = (now: number) => {
    const a = ci!.attack!;
    if (!marks) return;
    boss!.pose(now, bossPose);
    if (!P(bossPose.x + bossOx(now), bossPose.y + bossOy(now))) return;
    const face = marks.bossFace ?? boss!.facing;
    const img = a.frames[attackFrame]!;
    const k = (ci!.boss.squares * pt.k) / ci!.boss.ch.h;
    // (Its feet where the boss stands, clear of its stool: Nov 2, "make sure they're not standing where the chair blocks are".)
    const fx = pt.x;
    const flip = (face < 0) !== a.facesLeft;
    const y0 = pt.y - a.ch.foot[1] * k;
    g.save();
    // (Mirrored about its feet: they stay where they are.)
    g.translate(fx, 0);
    if (flip) g.scale(-1, 1);
    g.imageSmoothingEnabled = k < 1.5;
    g.drawImage(img, -a.ch.foot[0] * k, y0, img.width * k, img.height * k);
    g.restore();
    g.imageSmoothingEnabled = false;
  };
  /**
   * Timber's own moves (his log intro): his frame (BOSS_BEAVER_INTRO, drawn facing east; mirrored about his foot to walk west) at his
   * town size, his foot at `at`, the town's shadows under him; his head (for his line's bubble) where his town figure's is.
   */
  const drawWoodMove = (at: { c: number; r: number }) => {
    const wd = ci!.wood!;
    const mv = introNow!.wood!.move!;
    if (!P(at.c, at.r)) return;
    const b = ci!.boss;
    const k = (b.squares * pt.k) / b.ch.h;
    const ch = wd.mover.ch;
    const img = wd.mover.frames[mv.anim][mv.frame]!;
    drawShadows(pt.x, pt.y, b.ch.w * k);
    g.save();
    g.translate(pt.x, 0);
    if (mv.flip) g.scale(-1, 1);
    g.imageSmoothingEnabled = k < 1.5;
    g.drawImage(img, -ch.foot[0] * k, pt.y - ch.foot[1] * k, img.width * k, img.height * k);
    g.restore();
    g.imageSmoothingEnabled = false;
    Object.assign(bossHead, { x: pt.x, y: pt.y - (b.ch.foot[1] - b.ch.h * b.head) * k, on: true, px: b.squares * pt.k });
  };
  /**
   * Hollow in his intro (the dark): his own move's frame (BOSS_HOLLOW_INTRO, his strand's bulbs as lit as the drain has left them), or
   * once he has settled his idle with his strand dark; at his town size, his feet where he stands, as his town figure is drawn. His lit
   * pixels queued for over the dark, and his eyes alone in the black.
   */
  const drawDarkBoss = (now: number, dn: DarkNow) => {
    boss!.pose(now, bossPose);
    if (!P(bossPose.x + bossOx(now), bossPose.y + bossOy(now))) return;
    const b = ci!.boss;
    const k = (b.squares * pt.k) / b.ch.h;
    let img: HTMLCanvasElement;
    let emis: Emis | null = null;
    let eyes: Emis | null = null;
    if (dn.move) {
      const by = dk!.him[dn.move.anim];
      // (At the strand's count now; a frame not drawn at it (never shown there) from the nearest count that has it.)
      const f = dn.move.frame;
      let lt = by[dn.bulbs]?.[f];
      for (let n = 0; !lt && n <= 3; n++) lt = by[dn.bulbs - n]?.[f] ?? by[dn.bulbs + n]?.[f];
      img = lt!.img;
      emis = lt!.emis;
      if (dn.move.anim === "full" || dn.move.anim === "settle") eyes = dk!.eyes[dn.move.anim][dn.move.frame] ?? null;
    } else {
      const u = now % b.loop;
      let i = 0;
      while (i < b.ends.length - 1 && u >= b.ends[i]!) i++;
      img = dk!.idle0[i]!;
    }
    const x0 = pt.x - b.ch.foot[0] * k;
    const y0 = pt.y - b.ch.foot[1] * k;
    drawShadows(pt.x, pt.y, b.ch.w * k);
    g.imageSmoothingEnabled = k < 1.5;
    g.drawImage(img, x0, y0, img.width * k, img.height * k);
    g.imageSmoothingEnabled = false;
    if (dn.level > 0) addEmis(emis, x0, y0, k, img.width, false, 1 - dn.black);
    if (dn.eyes > 0) addEmis(eyes, x0, y0, k, img.width, false, dn.eyes);
    Object.assign(hisFoot, { x: pt.x, y: pt.y, k, on: true });
    Object.assign(bossHead, { x: pt.x, y: y0 + b.ch.h * b.head * k, on: true, px: b.squares * pt.k });
  };
  // ---- Wrangler's lasso (his intro, Nov 4; challenge.ts ropeAt): he stands where he walked on to all along, his moves as drawn.
  /** Where each of his fists holds a rope this frame (screen px; `on` false: no rope in it), and his frame's last grips (his pixels). */
  const fist1 = { x: 0, y: 0, on: false };
  const fist2 = { x: 0, y: 0, on: false };
  let grip1: readonly [number, number] = [15, 47];
  let grip2: readonly [number, number] = [61, 50];
  /** Where the loop's line meets it on the bale this frame (screen px), and each bucket's handle grip. */
  const knot = { x: 0, y: 0, on: false };
  const grips = { b: { x: 0, y: 0, on: false }, w: { x: 0, y: 0, on: false } };
  /**
   * Him in his intro: his own move's frame (BOSS_PIG_INTRO), or his idle, as drawn (not mirrored: his moves throw and haul to our left
   * and right as drawn; his attack, after, faces you as every boss's), at his town size, his feet where he stands; his fists' grips.
   */
  const drawRopeBoss = (now: number) => {
    boss!.pose(now, bossPose);
    if (!P(bossPose.x + bossOx(now), bossPose.y + bossOy(now))) return;
    const b = ci!.boss;
    const mv = introNow!.rope!.move;
    let img: HTMLCanvasElement;
    if (mv) img = rp!.mover.frames[mv.anim][mv.frame]!;
    else {
      const u = now % b.loop;
      let i = 0;
      while (i < b.ends.length - 1 && u >= b.ends[i]!) i++;
      img = b.frames[i]!;
    }
    const ch = rp!.mover.ch;
    const k = (b.squares * pt.k) / ch.h;
    const x0 = pt.x - ch.foot[0] * k;
    const y0 = pt.y - ch.foot[1] * k;
    drawShadows(pt.x, pt.y, ch.w * k);
    g.imageSmoothingEnabled = k < 1.5;
    g.drawImage(img, x0, y0, img.width * k, img.height * k);
    g.imageSmoothingEnabled = false;
    // (A fist without a rope's grip this frame keeps its last: the line still runs to it as he stands, or reels in to it.)
    const h1 = mv ? rp!.hands[mv.anim]?.[mv.frame] : null;
    const h2 = mv ? rp!.hands2[mv.anim]?.[mv.frame] : null;
    if (h1) grip1 = h1;
    if (h2) grip2 = h2;
    Object.assign(fist1, { x: x0 + grip1[0] * k, y: y0 + grip1[1] * k, on: true });
    Object.assign(fist2, { x: x0 + grip2[0] * k, y: y0 + grip2[1] * k, on: true });
    Object.assign(bossHead, { x: pt.x, y: y0 + b.ch.h * b.head * k, on: true, px: b.squares * pt.k });
    Object.assign(hisFoot, { x: pt.x, y: pt.y, k, on: true });
  };
  /**
   * Jefferson in his intro: his own move's frame (BOSS_GREX_INTRO: his call, his wave over, his brag), as drawn (not mirrored: he faces
   * you, east), at his town size, his feet where he stands.
   */
  const drawCrewBoss = (now: number, mv: { anim: "call" | "waveOver" | "brag"; frame: number }) => {
    boss!.pose(now, bossPose);
    if (!P(bossPose.x + bossOx(now), bossPose.y + bossOy(now))) return;
    const b = ci!.boss;
    const M = ci!.crew!.mover;
    const img = M.frames[mv.anim][mv.frame]!;
    const k = (b.squares * pt.k) / M.ch.h;
    const x0 = pt.x - M.ch.foot[0] * k;
    const y0 = pt.y - M.ch.foot[1] * k;
    drawShadows(pt.x, pt.y, M.ch.w * k);
    g.imageSmoothingEnabled = k < 1.5;
    g.drawImage(img, x0, y0, img.width * k, img.height * k);
    g.imageSmoothingEnabled = false;
    Object.assign(bossHead, { x: pt.x, y: y0 + b.ch.h * b.head * k, on: true, px: b.squares * pt.k });
    Object.assign(hisFoot, { x: pt.x, y: pt.y, k, on: true });
  };
  /** Ginger in his intro: his own move's frame (BOSS_GINGER_INTRO: his charge, blast, cast, brag), as drawn, at his town size. */
  const drawIceBoss = (now: number, mv: { anim: "charge" | "blast" | "cast" | "brag"; frame: number }) => {
    boss!.pose(now, bossPose);
    if (!P(bossPose.x + bossOx(now), bossPose.y + bossOy(now))) return;
    const b = ci!.boss;
    const M = ci!.ice!.mover;
    const img = M.frames[mv.anim][mv.frame]!;
    const k = (b.squares * pt.k) / M.ch.h;
    const x0 = pt.x - M.ch.foot[0] * k;
    const y0 = pt.y - M.ch.foot[1] * k;
    drawShadows(pt.x, pt.y, M.ch.w * k);
    g.imageSmoothingEnabled = k < 1.5;
    g.drawImage(img, x0, y0, img.width * k, img.height * k);
    g.imageSmoothingEnabled = false;
    Object.assign(bossHead, { x: pt.x, y: y0 + b.ch.h * b.head * k, on: true, px: b.squares * pt.k });
    Object.assign(hisFoot, { x: pt.x, y: pt.y, k, on: true });
    // (Where his hook is on screen: the blast leaves it.)
    Object.assign(hisHook, { x: x0 + M.blastFrom[0] * k, y: y0 + M.blastFrom[1] * k, on: true });
  };
  const hisHook = { x: 0, y: 0, on: false };
  /**
   * Dash's dust trail in his intro (INTRO_BLITZ_DUST, its foot at his spot, at his pixels: it runs off to our left behind him), drawn
   * just before him.
   */
  const drawBlitzDust = (now: number, n: BlitzNow) => {
    if (n.dust < 0) return;
    boss!.pose(now, bossPose);
    if (!P(bossPose.x + bossOx(now), bossPose.y + bossOy(now))) return;
    const b = ci!.boss;
    const D = ci!.dash!.dust;
    const k = (b.squares * pt.k) / b.ch.h;
    const img = D.frames[n.dust]!;
    g.imageSmoothingEnabled = k < 1.5;
    g.drawImage(img, pt.x - D.ch.foot[0] * k, pt.y - D.ch.foot[1] * k, img.width * k, img.height * k);
    g.imageSmoothingEnabled = false;
  };
  /**
   * Dash in his intro (his dashes): his own move's frame (BOSS_BLITZ_INTRO, facing you as drawn: his bolt running off and his arrive
   * racing back are in its frames), at his town figure's pixels, his foot on his spot; or none of him while he's off. The town's
   * shadows only while he's on his spot (his frames mid-run carry their own).
   */
  const drawBlitzBoss = (now: number, n: BlitzNow) => {
    if (n.gone || !n.move) return;
    boss!.pose(now, bossPose);
    if (!P(bossPose.x + bossOx(now), bossPose.y + bossOy(now))) return;
    const b = ci!.boss;
    const k = (b.squares * pt.k) / b.ch.h;
    const M = ci!.dash!.mover;
    const img = M.frames[n.move.anim][n.move.frame]!;
    const x0 = pt.x - M.ch.foot[0] * k;
    const y0 = pt.y - M.ch.foot[1] * k;
    if (n.here) drawShadows(pt.x, pt.y, b.ch.w * k);
    g.imageSmoothingEnabled = k < 1.5;
    g.drawImage(img, x0, y0, img.width * k, img.height * k);
    g.imageSmoothingEnabled = false;
    if (n.here) {
      Object.assign(bossHead, { x: pt.x, y: pt.y - (b.ch.foot[1] - b.ch.h * b.head) * k, on: true, px: b.squares * pt.k });
      Object.assign(hisFoot, { x: pt.x, y: pt.y, k, on: true });
    }
  };
  /** A prop's frame at its foot on screen (x, y), `s` screen px a room px, mirrored or not. */
  const putProp = (img: CanvasImageSource & { width: number; height: number }, foot: readonly number[], x: number, y: number, s: number) =>
    g.drawImage(img, x - foot[0]! * s, y - foot[1]! * s, img.width * s, img.height * s);
  /**
   * Ginger's table (his intro): the icicle forming over the table's spot, falling and stabbing in, then the table (its round flat top
   * 27 px up) with the board on it once it lands (`paintTable`, its pieces coming in as the light fades), the white light on it, and
   * the puff of snow at its foot.
   */
  const drawIceCenter = (now: number) => {
    const n = iceNow;
    const I = ci?.ice;
    if (!n || !I || !marks || !P(I.at.table[0], I.at.table[1])) return;
    const s = pt.k / SQ;
    const x = pt.x;
    const y = pt.y;
    g.imageSmoothingEnabled = false;
    if (n.shard) {
      const pr = I.props[n.shard.anim];
      putProp(pr.frames[n.shard.frame]!, pr.ch.foot, x, y - n.shard.lift * s, s);
    }
    if (n.table >= 0) {
      const pr = I.props.tableIdle;
      putProp(pr.frames[n.table]!, pr.ch.foot, x, y, s);
      if (n.onTable) {
        // (On its round top, 27 px up: the park table's 26 and a pixel.)
        g.save();
        g.translate(0, -(I.at.top - TABLE_BOARD.top) * s);
        paintTable(g, v, I.at.table[0] - camX, camY - I.at.table[1], ci!.table.palette, marks.layout, 1, n.pieces);
        g.restore();
      }
    }
    if (n.light) {
      const pr = I.props[n.light.anim];
      putProp(pr.frames[n.light.frame]!, pr.ch.foot, x, y - (I.at.top + 4) * s, s);
    }
    if (n.puff >= 0) putProp(I.props.puff.frames[n.puff]!, I.props.puff.ch.foot, x, y + 2 * s, s);
  };
  /** Ginger's blast (his intro): flying from his hook to over the table's spot on a little arc, then bursting there. Over everything. */
  const drawIceBlast = () => {
    const n = iceNow;
    const I = ci?.ice;
    if (!n?.blast || !I || !P(I.blastTo.at[0], I.blastTo.at[1])) return;
    const s = pt.k / SQ;
    const tx = pt.x;
    const ty = pt.y - I.blastTo.lift * s;
    const pr = I.props[n.blast.anim];
    const u = n.blast.u;
    const fx = hisHook.on ? hisHook.x : tx;
    const fy = hisHook.on ? hisHook.y : ty;
    const x = fx + (tx - fx) * u;
    const y = fy + (ty - fy) * u - Math.sin(Math.PI * u) * C.ice.flyArc * s;
    g.imageSmoothingEnabled = false;
    putProp(pr.frames[n.blast.frame]!, pr.ch.foot, x, y, s);
  };
  /** The bale's place now (squares): on its stand until it slides, along its curve (control point CHALLENGE_FEEL.rope.bend), then the table's. */
  const baleSq = { c: 0, r: 0 };
  const ropeBale = () => {
    const st = art.stand ?? { col: marks!.table.c, row: marks!.table.r };
    const u = introNow?.rope?.bale?.u ?? 0;
    const [qc, qr] = C.rope.bend;
    const T = marks!.table;
    baleSq.c = (1 - u) ** 2 * st.col + 2 * (1 - u) * u * qc + u * u * T.c;
    baleSq.r = (1 - u) ** 2 * st.row + 2 * (1 - u) * u * qr + u * u * T.r;
    return baleSq;
  };
  /**
   * The bale with the board (his table; INTRO_PIG_TABLE) where it's dragged, its slab and board on it (`paintTable`, raised by its
   * slide's lift), and the loop round it (dropping over it, cinched, flicked free: from the stand, before the bale takes its place).
   */
  const drawRopeCenter = () => {
    const n = introNow!.rope!;
    knot.on = false;
    const at = ropeBale();
    if (!P(at.c, at.r)) return;
    const s = pt.k / SQ;
    const x = pt.x;
    const y = pt.y;
    g.imageSmoothingEnabled = false;
    let lift = 0;
    if (n.bale) {
      const B = rp!.bale;
      lift = B.lift[n.bale.anim]?.[n.bale.frame] ?? 0;
      const img = B.frames[n.bale.anim][n.bale.frame]!;
      g.drawImage(img, x - B.ch.foot[0] * s, y - B.ch.foot[1] * s, img.width * s, img.height * s);
      g.save();
      g.translate(0, -lift * s);
      paintTable(g, v, at.c - camX, camY - at.r, ci!.table.palette, marks!.layout);
      g.restore();
      P(at.c, at.r);
    }
    const ls = n.lasso;
    if (ls && ls.anim !== "fly") {
      const L = rp!.loop;
      const img = L.frames[ls.anim][ls.frame]!;
      const ly = y - lift * s;
      g.drawImage(img, x - L.ch.foot[0] * s, ly - L.ch.foot[1] * s, img.width * s, img.height * s);
      const kn = L.knot[ls.anim]?.[ls.frame];
      if (kn) Object.assign(knot, { x: x + (kn[0] - L.ch.foot[0]) * s, y: ly + (kn[1] - L.ch.foot[1]) * s, on: true });
    }
  };
  /** A bucket's place (squares): from just off the screen's edge on its side (`offCol`), along the floor, to its stool's place. */
  const bucketSq = { b: { c: 0, r: 0 }, w: { c: 0, r: 0 } };
  const offAt = { b: { c: 0, r: 0 }, w: { c: 0, r: 0 } };
  /**
   * Where a bucket starts (and its rope's thrown to): the nearest column out from the table on its side (our left for the black, right
   * for the white) where the whole bucket is off the screen, `tumbleSouth` in front of the table's row; kept inside the barn's walls.
   */
  const offSq = (side: "b" | "w") => {
    const T = marks!.table;
    const dir = side === "b" ? -1 : 1;
    const r = T.r + C.rope.tumbleSouth;
    const ch = rp!.buckets[side].ch;
    let c = T.c + dir;
    for (let i = 0; i < 60; i++, c += dir * 0.25) {
      if (!P(c, r)) break;
      const s = pt.k / SQ;
      if (dir < 0 ? pt.x + (ch.w - ch.foot[0]) * s < 0 : pt.x - ch.foot[0] * s > W) break;
    }
    const o = offAt[side];
    o.c = Math.max(0.6, Math.min(n - 1.6, c));
    o.r = r;
    return o;
  };
  const bucketAt = (side: "b" | "w") => {
    const o = offSq(side);
    const u = introNow?.rope?.buckets?.u ?? 0;
    const to = side === "b" ? marks!.bossStool : marks!.youStool;
    const q = bucketSq[side];
    q.c = o.c + (to.c - o.c) * u;
    q.r = o.r + (to.r - o.r) * u;
    return q;
  };
  /** A bucket (INTRO_PIG_BUCKET_B, his, or _W, yours) tumbling in, landing upside down, standing as its stool; its handle's grip. */
  const drawBucket = (side: "b" | "w") => {
    const bk = introNow?.rope?.buckets;
    grips[side].on = false;
    if (!bk) return;
    const at = bucketAt(side);
    if (!P(at.c, at.r)) return;
    const B = rp!.buckets[side];
    const s = pt.k / SQ;
    const img = B.frames[bk.anim][bk.frame]!;
    g.imageSmoothingEnabled = false;
    g.drawImage(img, pt.x - B.ch.foot[0] * s, pt.y - B.ch.foot[1] * s, img.width * s, img.height * s);
    const gp = rp!.handle[`${side}:${bk.anim === "drop" ? "land" : "tumble"}`]?.[bk.frame];
    if (gp && bk.anim !== "stool") Object.assign(grips[side], { x: pt.x + (gp[0] - B.ch.foot[0]) * s, y: pt.y + (gp[1] - B.ch.foot[1]) * s, on: true });
  };
  /** A rope's line from (ax, ay) to (bx, by), bowing down `sag` px at its middle (INTRO_PIG_ROPE_INK: an outline, the cord, a twist tick every `twist` art px). */
  const ropeLine = (ax: number, ay: number, bx: number, by: number, sag: number, s: number) => {
    const I = rp!.ink;
    g.beginPath();
    g.moveTo(ax, ay);
    g.quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 + 2 * sag, bx, by);
    g.lineCap = "round";
    g.strokeStyle = I.outline;
    g.lineWidth = (I.width + 1.6) * s;
    g.stroke();
    g.strokeStyle = I.mid;
    g.lineWidth = I.width * s;
    g.stroke();
    g.setLineDash([s, I.twist * s - s]);
    g.strokeStyle = I.dark;
    g.stroke();
    g.setLineDash([]);
  };
  /** A loop in flight (its `fly` frame `f`), its middle at (x, y), `s` a room pixel: and where its knot is, into `fly`. */
  const fly = { x: 0, y: 0 };
  const drawFly = (f: number, x: number, y: number, s: number) => {
    const L = rp!.loop;
    const img = L.frames.fly[f % L.frames.fly.length]!;
    g.drawImage(img, x - L.ch.foot[0] * s, y - L.ch.foot[1] * s, img.width * s, img.height * s);
    const kn = L.knot.fly?.[f % L.frames.fly.length] ?? L.ch.foot;
    fly.x = x + (kn[0] - L.ch.foot[0]) * s;
    fly.y = y + (kn[1] - L.ch.foot[1]) * s;
  };
  /**
   * His ropes' lines, over the room (as the art's mockup draws them): the lasso flying to the bale on the stand (its loop with it,
   * arcing up), then taut to its knot through the catch and the drag, reeled in once it's free; the two ropes thrown out each way
   * (the black bucket's from his other fist, to our left, the white's from his lasso fist, to our right: crossed), taut to just off the
   * screen, then to the buckets' handles as they tumble in, reeled in once untied.
   */
  const drawRopeLines = () => {
    const n = introNow!.rope!;
    if (!fist1.on || !hisFoot.on || !marks) return;
    const s = hisFoot.k * (ci!.boss.ch.h / (ci!.boss.squares * SQ));
    const R = C.rope;
    const I = rp!.ink;
    g.imageSmoothingEnabled = false;
    const ls = n.lasso;
    if (ls?.anim === "fly") {
      const st = art.stand ?? { col: marks.table.c, row: marks.table.r };
      if (P(st.col, st.row)) {
        const ss = pt.k / SQ;
        const u = Math.min(1, ls.u);
        const tx = pt.x;
        const ty = pt.y - 4 * ss;
        const x = fist1.x + (tx - fist1.x) * u;
        const y = fist1.y + (ty - fist1.y) * u - Math.sin(Math.PI * u) * R.flyArc * pt.k;
        drawFly(ls.frame, x, y, ss);
        ropeLine(fist1.x, fist1.y, fly.x, fly.y, I.sag * Math.hypot(fly.x - fist1.x, fly.y - fist1.y), s);
      }
    } else if (ls && knot.on) {
      ropeLine(fist1.x, fist1.y, knot.x, knot.y, ls.anim === "catch" ? 3 * s : 0, s);
      Object.assign(reelFrom, { x: knot.x, y: knot.y });
    } else if (n.reel >= 0) {
      ropeLine(fist1.x, fist1.y, reelFrom.x + (fist1.x - reelFrom.x) * n.reel, reelFrom.y + (fist1.y - reelFrom.y) * n.reel, 2 * s * (1 - n.reel), s);
    }
    for (const side of ["b", "w"] as const) {
      const fist = side === "b" ? fist2 : fist1;
      const gp = grips[side];
      if (n.tied && n.buckets && gp.on) {
        ropeLine(fist.x, fist.y, gp.x, gp.y, 1.5 * s, s);
        Object.assign(reelTo[side], { x: gp.x, y: gp.y });
      } else if (n.reel2 >= 0) {
        const e = reelTo[side];
        ropeLine(fist.x, fist.y, e.x + (fist.x - e.x) * n.reel2, e.y + (fist.y - e.y) * n.reel2, 2 * s * (1 - n.reel2), s);
      } else if (n.out >= 0 && !n.buckets) {
        const o = offSq(side);
        if (!P(o.c, o.r)) continue;
        const ss = pt.k / SQ;
        const ex = pt.x;
        const ey = pt.y - 14 * ss;
        const u = n.out;
        const x = fist.x + (ex - fist.x) * u;
        const y = fist.y + (ey - fist.y) * u - Math.sin(Math.PI * u) * R.offArc * pt.k;
        if (u < 1) {
          drawFly(Math.floor(introT / 60), x, y, ss);
          ropeLine(fist.x, fist.y, fly.x, fly.y, I.sag * Math.hypot(fly.x - fist.x, fly.y - fist.y) * (1 - u), s);
        } else ropeLine(fist.x, fist.y, x, y, 0, s);
        Object.assign(reelTo[side], { x, y });
      }
    }
  };
  /** Where a reeling line starts from: the loop's knot as it was freed, each bucket's grip as it came untied. */
  const reelFrom = { x: 0, y: 0 };
  const reelTo = { b: { x: 0, y: 0 }, w: { x: 0, y: 0 } };
  /** The town's two shadows under a boss (a soft one, `w` wide at most, and the contact one at its feet). */
  const drawShadows = (x: number, y: number, w: number) => {
    const soft = 1.6;
    g.fillStyle = SHADOW;
    g.globalAlpha = f.shadowAlpha;
    g.beginPath();
    g.ellipse(x, y, Math.min(w * 0.42, pt.k * 0.42 * soft), pt.k * 0.12 * soft, 0, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = f.contactShadowAlpha;
    g.beginPath();
    g.ellipse(x, y, pt.k * f.contactShadowW * 1.45 * 1.2, pt.k * f.contactShadowDepth, 0, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
  };
  const drawBoss = (now: number) => {
    bossHead.on = false;
    hisHook.on = false;
    hisFoot.on = false;
    fist1.on = fist2.on = false;
    if (!ci || !boss) return;
    if (fo) return drawFolioBoss(now);
    const wat = woodAt();
    if (wat) return drawWoodMove(wat);
    if (dk && darkNow && (darkNow.move || darkNow.bulbs < 3)) return drawDarkBoss(now, darkNow);
    if (rp && introNow?.rope && attackFrame < 0) return drawRopeBoss(now);
    if (ci.crew && introNow?.crew?.move && attackFrame < 0) return drawCrewBoss(now, introNow.crew.move);
    if (ci.ice && iceNow?.move && attackFrame < 0) return drawIceBoss(now, iceNow.move);
    // (Dash's: his dust trail at his spot, under him; his own moves, or none of him while he's off.)
    const bz = introNow?.blitz;
    if (ci.dash && bz && attackFrame < 0) {
      drawBlitzDust(now, bz);
      if (bz.move || bz.gone) return drawBlitzBoss(now, bz);
    }
    if (attackFrame >= 0 && ci.attack) return drawAttack(now);
    boss.pose(now, bossPose);
    if (!P(bossPose.x + bossOx(now), bossPose.y + bossOy(now))) return;
    const b = ci.boss;
    const u = now % b.loop;
    let i = 0;
    while (i < b.ends.length - 1 && u >= b.ends[i]!) i++;
    const img = b.frames[i]!;
    const h = b.squares * pt.k;
    const w = (h * b.ch.w) / b.ch.h;
    const x0 = pt.x - (b.ch.foot[0] / b.ch.w) * w;
    const y0 = pt.y - (b.ch.foot[1] / b.ch.h) * h - hopLift() * pt.k;
    drawShadows(pt.x, pt.y, w);
    g.save();
    // (Its town figure faces the way its attack's art does, as its kit says: Babur's and Puddles' left; a boss without one as its
    // intro says, Dash's left. Turned to face `facing`.)
    if ((boss.facing < 0) !== !!(ci.attack ? ci.attack.facesLeft : ci.def.facesLeft)) {
      g.translate(pt.x, 0);
      g.scale(-1, 1);
      g.translate(-pt.x, 0);
    }
    g.imageSmoothingEnabled = h < img.height * 1.5;
    g.drawImage(img, x0, y0, w, h);
    g.restore();
    g.imageSmoothingEnabled = false;
    Object.assign(bossHead, { x: pt.x, y: y0 + h * b.head, on: true, px: h });
    Object.assign(hisFoot, { x: pt.x, y: pt.y, k: h / b.ch.h, on: true });
  };
  /**
   * Between you (in a challenge): the pyramid's frame, or the table with its board (the crumble's last frames over it). The table's
   * picture is three squares across, a stool in each outer one: across, the stools are where you and the boss stand, so it's drawn
   * whole; facing, its middle (the leg) alone, the stools drawn on their own (`drawStool`). The default intro's table pops in (grows
   * from its foot, a touch past its size and back) in a puff of dust. Toy blocks (Big Boy's) are the table and its stools: their frame,
   * and the board on the top block once it drops (falling from above it, `drop` squares up, then on it).
   */
  const drawCenter = () => {
    const n = introNow;
    if (!ci || !marks || !(n || ci.wood) || !P(marks.table.c, marks.table.r)) return;
    const s = pt.k / SQ;
    const x = pt.x;
    const y = pt.y;
    const put = (img: HTMLCanvasElement, ch: Character, fx = ch.foot[0]) => g.drawImage(img, x - fx * s, y - ch.foot[1] * s, img.width * s, img.height * s);
    g.imageSmoothingEnabled = false;
    if (ci.wood) return drawWood(x, y, s);
    if (!n) return;
    if (ci.dash) return drawBlitzCenter(n, x, y, s);
    if (fo) return drawFolioCenter(x, y, s);
    const bl = ci.blocks;
    if (bl) {
      if (n.blocks) put(bl.frames[n.blocks.anim][n.blocks.frame]!, bl.ch);
      if (n.table) {
        // (Lifted until the slab's front rests on the top block, its foot TABLE_BOARD.top over the table's: else the slab, reaching
        // toward you, would hide the pyramid's upper blocks. Then `drop` squares higher while it falls.)
        const dx = marks.table.c - camX;
        const dz = camY - marks.table.r;
        const front = slabFrontY(v, dx, dz);
        const rest = front === null ? 0 : Math.max(0, front - (y - TABLE_BOARD.top * s));
        g.save();
        g.translate(0, -rest - n.drop * pt.k);
        paintTable(g, v, dx, dz, ci.table.palette, marks.layout);
        g.restore();
      }
      return;
    }
    if (n.table) {
      const T = ci.table;
      const popping = n.pop < 1;
      if (popping) {
        g.save();
        g.translate(x, y);
        g.scale(n.pop, n.pop);
        g.translate(-x, -y);
      }
      if (across) put(T.img, T.ch);
      else put(T.leg, T.ch, T.ch.foot[0] - T.leg.width);
      if (n.pop > 0) paintTable(g, v, marks.table.c - camX, camY - marks.table.r, T.palette, marks.layout);
      if (popping) g.restore();
    }
    if (n.puff >= 0) drawPuff(x, y, n.puff);
    const py = ci.pyramid;
    if (!py) return;
    if (n.pyramid) put(py.frames[n.pyramid.anim][n.pyramid.frame]!, py.ch);
    else if (n.drift) put(py.frames.crumble[py.frames.crumble.length - 1]!, py.ch);
  };
  /**
   * Dash's table (his intro), the table's foot at (x, y), `s` a room pixel: the shoe-box stack as it lands (its `land`, then its `idle`:
   * its top box's own teal lid until the board comes), both stools at their places as they land, the slab and board on it
   * (`paintTable`, falling on from `board` squares up; its pieces from the pop's own frame), and the pop over it.
   */
  const drawBlitzCenter = (n: IntroNow, x: number, y: number, s: number) => {
    const z = n.blitz;
    const D = ci?.dash;
    if (!z || !D || !marks) return;
    const put = (img: HTMLCanvasElement, ch: Character, px: number, py: number, k: number) => g.drawImage(img, px - ch.foot[0] * k, py - ch.foot[1] * k, img.width * k, img.height * k);
    g.imageSmoothingEnabled = false;
    if (z.table) put(D.table.frames[z.table.anim][z.table.frame]!, D.table.ch, x, y, s);
    if (z.stools) {
      const img = D.stool.frames[z.stools.anim][z.stools.frame]!;
      for (const at of [marks.bossStool, marks.youStool]) if (P(at.c, at.r, pq[0])) put(img, D.stool.ch, pq[0]!.x, pq[0]!.y, pq[0]!.k / SQ);
    }
    if (z.board !== null) {
      g.save();
      g.translate(0, -z.board * s * SQ);
      paintTable(g, v, marks.table.c - camX, camY - marks.table.r, ci!.table.palette, marks.layout, 1, z.pieces ? 1 : 0);
      g.restore();
    }
    if (z.pop >= 0) put(D.pop.frames[z.pop]!, D.pop.ch, x, y, s);
  };
  /**
   * Jefferson's table (his intro, from the walk in): the crate stack where the room's board stand stood (the same picture, its foot on
   * the marks' line), its slight wobble or its bigger one, and on it the slab and board (`paintTable`), `top` px over its foot (32 higher
   * than a park table's), riding on the top crate (its sway).
   */
  const crewCenter = { c: 0, r: 0 };
  const crewTableAt = () => {
    const st = art.stand ?? { col: marks!.table.c - 0.5, row: marks!.table.r };
    crewCenter.c = st.col + 0.5;
    crewCenter.r = st.row + (art.standDy ?? 0) / SQ;
    return crewCenter;
  };
  const drawCrewCenter = (now: number) => {
    const cr = ci?.crew;
    if (!cr || !marks) return;
    const at = crewTableAt();
    if (!P(at.c, at.r)) return;
    const T = cr.table;
    const n = introNow?.crew;
    const anim = n?.table.anim ?? "idle";
    const fr = n ? n.table.frame : animFrame(T.ch.anims.idle!.frames.map((x) => x.ms), now, true);
    const img = T.frames[anim][fr]!;
    const s = pt.k / SQ;
    g.imageSmoothingEnabled = false;
    g.drawImage(img, pt.x - T.ch.foot[0] * s, pt.y - T.ch.foot[1] * s, img.width * s, img.height * s);
    const [dx, dy] = T.sway[anim]?.[fr] ?? [0, 0];
    g.save();
    g.translate(dx * s, (dy - (T.top - TABLE_BOARD.top)) * s);
    paintTable(g, v, at.c - camX, camY - at.r, ci!.table.palette, marks.layout);
    g.restore();
  };
  /** Your lift's plate now (px over the floor, Jefferson's intro: INTRO_GREX_LIFT_H), 0 otherwise. */
  const plateUp = (): number => {
    const n = introNow?.crew;
    if (!n || !ci?.crew) return 0;
    return ci.crew.lift.h[n.lift.anim]?.[n.lift.frame] ?? 0;
  };
  /** Your lift at your mark (its plate the mark's; Jefferson's intro), drawn just before you on it. */
  const drawLift = () => {
    const n = introNow?.crew;
    const L = ci?.crew?.lift;
    if (!n || !L || !marks || !P(marks.you.c, marks.you.r, pq[3])) return;
    const q = pq[3]!;
    const img = L.frames[n.lift.anim][n.lift.frame]!;
    const s = q.k / SQ;
    g.imageSmoothingEnabled = false;
    g.drawImage(img, q.x - L.ch.foot[0] * s, q.y - L.ch.foot[1] * s, img.width * s, img.height * s);
  };
  /**
   * Timber's props between you (his log intro; from the walk in), the table's foot at (x, y), `s` a room pixel: the log lying where it waits (at his
   * size: it's the log he lifts, its foot where his art's `liftAt` puts it from his foot as he lifts it); the ring of shavings left on
   * the floor; the stumps at the stools' places (popping up, then standing); his table (a gnawed pedestal, its middle alone: no stools
   * in its picture) and its slab and board (`paintTable`, in his table's woods); the log standing and gnawed in front of him (his art's
   * `reach` from his foot, behind him). The fog itself is drawn over you both (`drawFog`).
   */
  const drawWood = (x: number, y: number, s: number) => {
    const wd = ci!.wood!;
    // (Walking in, before the intro: the log lies there already.)
    const w = introNow?.wood ?? { log: { anim: "lying", frame: 0 }, ring: false, stumps: null };
    const b = ci!.boss;
    const kb = (b.squares * pt.k) / b.ch.h;
    const L = wd.log;
    const putAt = (img: HTMLCanvasElement, ch: Character, fx: number, fy: number, k: number) => g.drawImage(img, fx - ch.foot[0] * k, fy - ch.foot[1] * k, img.width * k, img.height * k);
    if (w.log?.anim === "lying" && P(marks!.table.c - C.log.at, marks!.boss.r)) putAt(L.frames.lying[0]!, L.ch, pt.x + wd.liftAt[0] * kb, pt.y + wd.liftAt[1] * kb, kb);
    if (w.ring) {
      const fr = wd.fog.frames.settle;
      putAt(fr[fr.length - 1]!, wd.fog.ch, x, y, s);
    }
    const st = wd.stump;
    if (w.stumps)
      for (const at of [marks!.bossStool, marks!.youStool]) if (P(at.c, at.r)) putAt(st.frames[w.stumps.anim][w.stumps.frame]!, st.ch, pt.x, pt.y, s);
    if (introNow?.table && P(marks!.table.c, marks!.table.r)) {
      const T = ci!.table;
      putAt(T.img, T.ch, pt.x, pt.y, s);
      paintTable(g, v, marks!.table.c - camX, camY - marks!.table.r, T.palette, marks!.layout);
    }
    const me = woodAt();
    if ((w.log?.anim === "standing" || w.log?.anim === "gnawed") && me && P(me.c, me.r)) putAt(L.frames[w.log.anim][w.log.frame]!, L.ch, pt.x + wd.reach[0] * kb, pt.y + wd.reach[1] * kb, kb);
  };
  /** Timber's shavings' fog (rising, holding, settling), over the table's place and over you both: its foot is the table's. */
  const drawFog = () => {
    const fog = introNow?.wood?.fog;
    if (!ci?.wood || !fog || !marks || !P(marks.table.c, marks.table.r)) return;
    const F = ci.wood.fog;
    const s = pt.k / SQ;
    const img = F.frames[fog.anim][fog.frame]!;
    g.imageSmoothingEnabled = false;
    g.drawImage(img, pt.x - F.ch.foot[0] * s, pt.y - F.ch.foot[1] * s, img.width * s, img.height * s);
  };
  // ---- Folio's intro (Nov 5): its own moves, the sheets folding up into its stools and table, the plane, the board.
  /** A flat picture laid on the room, its middle at (c, r), `w` x `d` squares, `h` squares up: its whole picture on that rectangle. */
  const flatAt = (img: HTMLCanvasElement, c: number, r: number, w: number, d: number, h: number) => {
    const [a, b, cc, dd] = pq as [typeof pt, typeof pt, typeof pt, typeof pt];
    const L = (x: number, y: number, o: typeof pt) => proj(v, x - camX, camY - y, h, o);
    if (!L(c - w / 2, r - d / 2, a) || !L(c + w / 2, r - d / 2, b) || !L(c + w / 2, r + d / 2, cc) || !L(c - w / 2, r + d / 2, dd)) return;
    const iw = img.width;
    const ih = img.height;
    tri(img, 0, 0, iw, ih, 0, 0, iw, 0, iw, ih, a.x, a.y, b.x, b.y, cc.x, cc.y);
    tri(img, 0, 0, iw, ih, 0, 0, iw, ih, 0, ih, a.x, a.y, cc.x, cc.y, dd.x, dd.y);
  };
  /** The three sheets lying flat on the clean page (the art's top views, at their size in squares), each until its fold starts. */
  const drawFolioSheets = () => {
    const z = introNow?.folio;
    const F = fo!;
    const lying = (k: FoldNow | undefined) => !k || k.anim === "sheet";
    g.imageSmoothingEnabled = false;
    const [sw, sd] = F.sheets.squares.stool;
    if (lying(z?.stools[0])) flatAt(F.sheets.stool, marks!.bossStool.c, marks!.bossStool.r, sw, sd, 0);
    if (lying(z?.stools[1])) flatAt(F.sheets.stool, marks!.youStool.c, marks!.youStool.r, sw, sd, 0);
    const [tw, td] = F.sheets.squares.table;
    if (lying(z?.table)) flatAt(F.sheets.table, marks!.table.c, marks!.table.r, tw, td, 0);
  };
  /**
   * Folio itself through its challenge (BOSS_FOLIO_INTRO, at its town figure's size, drawn facing our left: mirrored to face east): its
   * glide walking on and stepping back, its bow, its idle. Its own warm see-through shadow is in its frames (the art's note 14: FOLIO's
   * near-black one cut a hard bar on the pale paper), so the town's dark shadows aren't drawn under it.
   */
  const drawFolioBoss = (now: number) => {
    boss!.pose(now, bossPose);
    if (!P(bossPose.x + bossOx(now), bossPose.y + bossOy(now))) return;
    const b = ci!.boss;
    const M = fo!.mover;
    const k = (b.squares * pt.k) / b.ch.h;
    const z = introNow?.folio;
    const fa = ci!.anims && isFolio(ci!.anims) ? ci!.anims : null;
    const walking = boss!.moving();
    const anim = z ? z.move.anim : walking ? "glide" : "idle";
    const frame = z ? z.move.frame : fa ? animFrame(fa.moves[anim], now, true) : 0;
    const img = M.frames[anim][frame]!;
    g.save();
    if (boss!.facing > 0) {
      g.translate(pt.x, 0);
      g.scale(-1, 1);
      g.translate(-pt.x, 0);
    }
    g.imageSmoothingEnabled = k < 1.5;
    g.drawImage(img, pt.x - M.ch.foot[0] * k, pt.y - M.ch.foot[1] * k, img.width * k, img.height * k);
    g.restore();
    g.imageSmoothingEnabled = false;
    Object.assign(bossHead, { x: pt.x, y: pt.y - (b.ch.foot[1] - b.ch.h * b.head) * k, on: true, px: b.squares * pt.k });
    Object.assign(hisFoot, { x: pt.x, y: pt.y, k, on: true });
  };
  /**
   * Folio's table and stools (its intro), the table's foot at (x, y), `s` a room pixel: each stool folding up and standing at its place,
   * the table folding up and standing; on its top (`top` px up) the board's top view as the packet falls flat onto it, lies and unfolds
   * (`INTRO_FOLIO_BOARD_SQUARES` across), then the game's own board (`paintTable`, its squares as wide as the unfolded sheet's).
   */
  const foC = newPt();
  const drawFolioCenter = (x: number, y: number, s: number) => {
    const z = introNow?.folio;
    const F = fo;
    if (!z || !F || !marks) return;
    const put = (img: HTMLCanvasElement, ch: Character, px: number, py: number, k: number) => g.drawImage(img, px - ch.foot[0] * k, py - ch.foot[1] * k, img.width * k, img.height * k);
    g.imageSmoothingEnabled = false;
    z.stools.forEach((st, i) => {
      if (st.anim === "sheet") return;
      const at = i ? marks.youStool : marks.bossStool;
      if (P(at.c, at.r, foC)) put(F.stool.frames[st.anim][st.frame]!, F.stool.ch, foC.x, foC.y, foC.k / SQ);
    });
    if (z.table.anim !== "sheet") put(F.table.frames[z.table.anim][z.table.frame]!, F.table.ch, x, y, s);
    const sq = F.board.squares;
    const top = F.table.top / SQ;
    const T = marks.table;
    // (Falling flat from the plane's height to the top, faster and faster, swaying a hair: the art's 280 ms.)
    if (z.packet) flatAt(F.board.frames.packet[0]!, T.c + Math.sin(z.packet.u * 6) * 0.05, T.r, sq, sq, top + (z.packet.from - top) * (1 - z.packet.u * z.packet.u));
    if (z.board) {
      g.globalAlpha = 1 - z.swap;
      flatAt(F.board.frames[z.board.anim][z.board.frame]!, T.c, T.r, sq, sq, top);
      g.globalAlpha = 1;
    }
    if (z.real) {
      // (The game's own board, as on every boss's table, lifted to this table's top: it comes in over the unfolded sheet.)
      g.save();
      g.translate(0, -(F.table.top - TABLE_BOARD.top) * s);
      paintTable(g, v, T.c - camX, camY - T.r, ci!.table.palette, marks.layout, z.swap);
      g.restore();
    }
  };
  /** The paper plane (its intro), `lift` squares up over its place on the room, at the room's scale, flying west as drawn. */
  const drawFolioPlane = (pl: { anim: string; frame: number; c: number; r: number; lift: number }) => {
    const F = fo!;
    if (!proj(v, pl.c - camX, camY - pl.r, pl.lift, foC)) return;
    const img = F.plane.frames[pl.anim as "fly"][pl.frame]!;
    const k = foC.k / SQ;
    g.imageSmoothingEnabled = false;
    g.drawImage(img, foC.x - F.plane.ch.foot[0] * k, foC.y - F.plane.ch.foot[1] * k, img.width * k, img.height * k);
  };
  /** A stool on its own (facing: the table's north one, or its south one), as the table's picture has it. */
  const drawStool = (at: { c: number; r: number }) => {
    const n = introNow;
    if (!ci || !n?.table || !P(at.c, at.r)) return;
    const T = ci.table;
    const s = pt.k / SQ * n.pop;
    // (The stool's square is the picture's left third: its middle over the stool's foot.)
    g.drawImage(T.stool, pt.x - (T.stool.width / 2) * s, pt.y - T.ch.foot[1] * s, T.stool.width * s, T.stool.height * s);
  };
  /** The default's dust puff as the table pops in: a ring of soft dust round its foot, spreading and fading (`u` 0 to 1). */
  const drawPuff = (x: number, y: number, u: number) => {
    const k = pt.k;
    const e = 1 - (1 - u) ** 2;
    g.fillStyle = "#e9dfcc";
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.4;
      const r = k * (0.35 + 0.55 * e);
      g.globalAlpha = 0.75 * (1 - u);
      g.beginPath();
      g.ellipse(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.38 - k * 0.12 * e, k * (0.16 + 0.12 * e), k * (0.11 + 0.08 * e), 0, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
  };
  /**
   * What stands among the pieces this frame (the Shopkeeper 0, you 1, the boss 2, the board 3, facing the boss's stool 4 and yours 5,
   * and Timber's shavings' fog 6), by row: drawn far to near.
   */
  const figZ = new Float64Array(8 + CREW_MAX);
  const figK = new Uint8Array(8 + CREW_MAX);
  let figN = 0;
  const addFig = (z: number, k: number) => {
    let i = figN++;
    while (i > 0 && figZ[i - 1]! > z) {
      figZ[i] = figZ[i - 1]!;
      figK[i] = figK[i - 1]!;
      i--;
    }
    figZ[i] = z;
    figK[i] = k;
  };
  const drawFigure = (k: number, now: number) =>
    k >= 8 ? drawCrewFig(k - 8) : k === 0 ? drawKid(now) : k === 1 ? drawYou(now) : k === 2 ? drawBoss(now) : k === 3 ? (ci?.ice ? drawIceCenter(now) : cw && ci?.crew ? drawCrewCenter(now) : rp ? drawRopeCenter() : drawCenter()) : k === 6 ? drawFog() : rp ? drawBucket(k === 4 ? "b" : "w") : drawStool(k === 4 ? marks!.bossStool : marks!.youStool);
  /** A speech bubble's lines (wrapped once for its words, at its size). */
  const bubbles = new Map<string, { lines: string[]; w: number }>();
  /**
   * The boss's line in a speech bubble (the town's: white, rounded, its tail pointing down at the speaker's head `ax`, `ay`), sized for
   * the boss drawn `px` tall (challenge.ts bubbleSize: Eric, Nov 4, a speech bubble for his size, just over his head), inside the view.
   */
  const drawBubble = (text: string, ax: number, ay: number, px: number) => {
    const z = bubbleSize(px);
    const s = z.s;
    g.font = `500 ${z.font}px Archivo, system-ui, sans-serif`;
    const key = `${z.font}|${text}`;
    let b = bubbles.get(key);
    if (!b) {
      const lines: string[] = [];
      let line = "";
      for (const w of text.split(" ")) {
        const tt = line ? `${line} ${w}` : w;
        if (g.measureText(tt).width > z.wrap && line) {
          lines.push(line);
          line = w;
        } else line = tt;
      }
      if (line) lines.push(line);
      b = { lines, w: Math.max(...lines.map((l) => g.measureText(l).width)) + 16 * s };
      if (bubbles.size > 40) bubbles.clear();
      bubbles.set(key, b);
    }
    const lh = 14 * s;
    const h = b.lines.length * lh + 8 * s;
    const bx = Math.max(6, Math.min(W - b.w - 6, ax - b.w / 2));
    const by = Math.max(6, ay - z.gap - h - 7 * s);
    g.save();
    g.shadowColor = "rgba(0,0,0,.25)";
    g.shadowBlur = 8 * s;
    g.shadowOffsetY = 2 * s;
    g.fillStyle = "#fff";
    g.beginPath();
    g.roundRect(bx, by, b.w, h, 12 * s);
    g.fill();
    const tx = Math.max(bx + 14 * s, Math.min(bx + b.w - 14 * s, ax));
    g.beginPath();
    g.moveTo(tx - 6 * s, by + h - 1);
    g.lineTo(tx + 6 * s, by + h - 1);
    g.lineTo(tx, by + h + 7 * s);
    g.closePath();
    g.fill();
    g.restore();
    g.fillStyle = "#1d1b19";
    g.textAlign = "center";
    g.textBaseline = "middle";
    for (let i = 0; i < b.lines.length; i++) g.fillText(b.lines[i]!, bx + b.w / 2, by + 5 * s + lh / 2 + i * lh);
  };
  const drawTag = (text: string, kind: TagKind, x: number, y: number) => {
    const c = tag(text, kind);
    const w = c.width / DPR;
    const h = c.height / DPR;
    g.drawImage(c, x - w / 2, y - h + 4, w, h);
  };
  /** A piece's light fades with it near the camera (drawUp's `near`): 0 gone, 1 whole. P must be at its foot. */
  const nearOf = () => Math.min(1, (pt.depth - S.nearGone) / (S.nearFull - S.nearGone));
  const drift = { x: 0, y: 0 };
  const drawGlows = (now: number) => {
    if (!poolsAt.length && !halosAt.length) return;
    // (Folio's: its pools' color laid over the paper, then its halos' light added.)
    g.globalCompositeOperation = art.poolBlend ?? "lighter";
    for (const { l, at: u } of poolsAt) {
      if (!P(u.c, u.r)) continue;
      const near = nearOf();
      if (near <= 0) continue;
      const s = pt.k / SQ;
      // (A drifting pool (Folio's windows'): its middle on its sine now, one sun for them all.)
      const d = driftAt(l.drift, now, u.flip, drift);
      litAt(u, l.x + (u.flip ? -d.x : d.x), l.y + d.y);
      g.globalAlpha = Math.min(1, l.strength * S.glow * near * lightMul(u));
      if (g.globalAlpha <= 0.003) continue;
      g.drawImage(art.poolBlend ? tint(l.color) : glow(l.color), lit.x - l.rx * 2 * s, lit.y - l.ry * 2 * s, l.rx * 4 * s, l.ry * 4 * s);
    }
    g.globalCompositeOperation = "lighter";
    for (const { l, at: u } of halosAt) {
      if (!P(u.c, u.r)) continue;
      const near = nearOf();
      if (near <= 0) continue;
      const s = pt.k / SQ;
      // A torch's slow, gentle flicker (as the town's lights flicker: two slow waves, never dark), each place out of step.
      const fl = l.flicker ? 0.85 + 0.1 * Math.sin(now / 170 + u.c) + 0.05 * Math.sin(now / 53 + u.r) : 1;
      g.globalAlpha = Math.min(1, 0.35 * l.strength * S.glow * fl * near * lightMul(u));
      if (g.globalAlpha <= 0.003) continue;
      const r = l.halo! * s;
      litAt(u, l.x + l.w / 2, l.y + l.h / 2);
      g.drawImage(glow(l.color), lit.x - r, lit.y - r, 2 * r, 2 * r);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  };

  /** His void's radius, his pixels (the ball's when it isn't out: the art's notes). */
  const VOID_R = 5.5;
  /** Your pawn's light gathering, as the art's mockup draws it: a pale glow `r` squares round a point `up` squares over your feet, at `a` at its strongest. */
  const PAWN_GLOW = { color: "#e4e0ff", r: 0.9, up: 0.75, a: 0.55 } as const;
  /** The ball's middle on screen now and its radius (screen pixels), as drawn this frame. */
  const heart = { x: 0, y: 0, r: 0 };
  const heartNow = (dn: DarkNow) => {
    const m = dn.move;
    const hp = m ? dk!.art.HOLLOW_INTRO_HEART[m.anim]![m.frame]! : HOLLOW_HEART;
    heart.x = hisFoot.x + (hp[0] - HOLLOW.foot[0]) * hisFoot.k;
    heart.y = hisFoot.y + (hp[1] - HOLLOW.foot[1]) * hisFoot.k;
    heart.r = ((m ? dk!.art.HOLLOW_INTRO_BALL_R[m.anim]![m.frame]! : 0) || VOID_R) * hisFoot.k;
  };
  const moteMs = dk ? dk.art.INTRO_HOLLOW_MOTE.anims.red!.frames.map((x) => x.ms) : [];
  const sipMs = dk ? dk.art.INTRO_HOLLOW_MOTE.anims.sip!.frames.map((x) => x.ms) : [];
  const moteHash = (n: number) => (((Math.sin(n * 127.1) * 43758.5453) % 1) + 1) % 1;
  /** A mote's flight from (sx, sy) to the ball, `el` ms after it left: into `mp`; true once it's in (at its end, or at the ball's rim). */
  const mp = { x: 0, y: 0 };
  const flight = (sx: number, sy: number, el: number): boolean => {
    const M = DK.mote;
    const dx = heart.x - sx;
    const dy = heart.y - sy;
    const dist = Math.hypot(dx, dy) || 1;
    const dur = Math.max(M.minMs, Math.min(M.maxMs, M.ms + dist * M.msPerPx));
    const u = Math.max(0, Math.min(1, el / dur));
    const e = u ** M.ease;
    // (A curve bowing upward by `bow` of its length.)
    const nx = -dy / dist;
    const ny = dx / dist;
    const side = ny < 0 ? 1 : -1;
    const cx = (sx + heart.x) / 2 + nx * side * dist * M.bow;
    const cy = (sy + heart.y) / 2 + ny * side * dist * M.bow;
    mp.x = (1 - e) ** 2 * sx + 2 * (1 - e) * e * cx + e * e * heart.x;
    mp.y = (1 - e) ** 2 * sy + 2 * (1 - e) * e * cy + e * e * heart.y;
    return u >= 1 || Math.hypot(mp.x - heart.x, mp.y - heart.y) < heart.r * 0.9;
  };
  /** The motes in flight now (and each one's sip as it lands, every other one; its sound at most one a `sipGapMs`). */
  const drawMotes = (t: number) => {
    if (!dk || !hisFoot.on) return;
    const M = DK.mote;
    const art = dk.motes;
    for (let n = 0; n < motes.length; n++) {
      const m = motes[n]!;
      if (t < m.at) continue;
      if (m.landed >= 0) {
        const since = t - m.landed;
        if (n % 2 || since >= M.sipMs) continue;
        const img = art.sip![animFrame(sipMs, since, false)]!;
        const s = Math.max(hisFoot.k, M.minScale);
        g.drawImage(img, heart.x + (moteHash(n) - 0.5) * heart.r - 6 * s, heart.y + (moteHash(n + 1) - 0.5) * heart.r - 6 * s, img.width * s, img.height * s);
        continue;
      }
      let sx: number;
      let sy: number;
      let s: number;
      if (m.who === 0) {
        if (!m.u || !P(m.u.c, m.u.r)) continue;
        litAt(m.u, m.lx, m.ly);
        [sx, sy, s] = [lit.x, lit.y, pt.k / SQ];
      } else if (m.who === 1) [sx, sy, s] = [hisFoot.x + (m.lx - HOLLOW.foot[0]) * hisFoot.k, hisFoot.y + (m.ly - HOLLOW.foot[1]) * hisFoot.k, hisFoot.k];
      else {
        if (!youFoot.on) continue;
        [sx, sy, s] = [youFoot.x + m.lx * youFoot.k, youFoot.y + m.ly * youFoot.k, youFoot.k / SQ];
      }
      if (flight(sx, sy, t - m.at)) {
        m.landed = t;
        if (t - lastSip >= DK.sipGapMs) {
          lastSip = t;
          playCue(ci!, "sip");
        }
        continue;
      }
      const x = mp.x;
      const y = mp.y;
      const color = dk.art.INTRO_HOLLOW_MOTE_GLOW[m.kind] ?? "#ffffff";
      const ms = Math.max(s, M.minScale);
      g.globalCompositeOperation = "lighter";
      g.globalAlpha = M.glowA;
      const r = M.glowPx * ms;
      g.drawImage(glow(color), x - r, y - r, 2 * r, 2 * r);
      for (let i = 0; i < M.trail.length; i++) {
        flight(sx, sy, Math.max(0, t - m.at - M.trail[i]!));
        g.globalAlpha = M.trailA[i]!;
        const rr = (2.2 - i * 0.4) * ms;
        g.drawImage(glow(color), mp.x - rr, mp.y - rr, 2 * rr, 2 * rr);
      }
      g.globalCompositeOperation = "source-over";
      g.globalAlpha = 1;
      const img = art[m.kind]![animFrame(moteMs, t - m.at + n * 23, true)]!;
      g.drawImage(img, x - 6 * ms, y - 6 * ms, img.width * ms, img.height * ms);
    }
  };
  /**
   * Hollow's dark over the room (his intro; the art's mockup's order): the dark laid over everything at its level, the dim light's pool
   * cut out of it and tinted (closing in on the board as the iris), then the lights still lit (their glows, the ball's violet glow, your
   * pawn's), their lit pixels over that, his eyes in the black, and the motes. Before he's on his mark: the glows only (drawn over the
   * room in his challenge throughout, as the mockup draws them).
   */
  const drawDarkPass = (now: number) => {
    const dn = darkNow;
    if (dn && dn.level > 0 && !(marks && P(marks.table.c - dk!.art.INTRO_HOLLOW_DIMPOOL.west, marks.table.r))) {
      // (The table's place out of the view: the dark alone.)
      g.globalAlpha = dn.level;
      g.fillStyle = dk!.art.INTRO_HOLLOW_DARK.tone;
      g.fillRect(0, 0, W, H);
      g.globalAlpha = 1;
    } else if (dn && dn.level > 0 && marks) {
      const D = dk!.art.INTRO_HOLLOW_DARK;
      const Q = dk!.art.INTRO_HOLLOW_DIMPOOL;
      const tone = D.tone;
      let cx = pt.x;
      let cy = pt.y - Q.lift * pt.k;
      let rx = Q.rx * pt.k;
      let ry = Q.ry * pt.k;
      if (dn.iris > 0 && P(marks.table.c, marks.table.r)) {
        // (The iris: the pool closing in on the board, the table's top.)
        const bx = pt.x;
        const by = pt.y - (TABLE_BOARD.top * pt.k) / SQ;
        cx += (bx - cx) * dn.iris;
        cy += (by - cy) * dn.iris;
        rx *= 1 - dn.iris;
        ry *= 1 - dn.iris;
      }
      const [tr, tg, tb] = [1, 3, 5].map((j) => parseInt(tone.slice(j, j + 2), 16));
      if (dn.pool > 0 && rx > 0.5 && ry > 0.5) {
        // The dark, the pool cut out of it: the room at `level` in its middle out to `inner`, then smoothly to the black at its edge.
        g.save();
        g.translate(cx, cy);
        g.scale(rx, ry);
        const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1);
        for (let i = 0; i <= 10; i++) {
          const u = i / 10;
          const v = u <= Q.inner ? 1 : 1 - ((u - Q.inner) / (1 - Q.inner)) ** 2 * (3 - 2 * ((u - Q.inner) / (1 - Q.inner)));
          gr.addColorStop(u, `rgba(${tr},${tg},${tb},${(dn.level * (1 - Q.level * dn.pool * v)).toFixed(3)})`);
        }
        g.fillStyle = gr;
        g.fillRect(-cx / rx, -cy / ry, W / rx, H / ry);
        // Its cool tint.
        g.globalCompositeOperation = "multiply";
        const tint = g.createRadialGradient(0, 0, 0, 0, 0, 1);
        tint.addColorStop(0, Q.tint);
        tint.addColorStop(1, "#ffffff");
        g.globalAlpha = dn.pool;
        g.fillStyle = tint;
        g.beginPath();
        g.arc(0, 0, 1, 0, Math.PI * 2);
        g.fill();
        g.restore();
      } else {
        g.globalAlpha = dn.level;
        g.fillStyle = tone;
        g.fillRect(0, 0, W, H);
        g.globalAlpha = 1;
      }
    }
    drawGlows(now);
    if (!dn) return;
    g.globalCompositeOperation = "lighter";
    if (hisFoot.on) {
      heartNow(dn);
      const BG = dk!.art.INTRO_HOLLOW_BALL_GLOW as Readonly<Record<string, { r: number; a: number } | string>>;
      const bg = dn.move ? BG[dn.move.anim] : undefined;
      if (bg && typeof bg !== "string" && dn.black < 1) {
        const r = bg.r * hisFoot.k + heart.r;
        g.globalAlpha = Math.min(1, bg.a * (0.85 + 0.15 * Math.sin(now / DK.pulseMs)) * (1 - dn.black));
        g.drawImage(glow(dk!.art.INTRO_HOLLOW_BALL_GLOW.color), heart.x - r, heart.y - r * 0.9, 2 * r, 2 * r * 0.9);
      }
    }
    if (dn.pawn.glow > 0 && youFoot.on) {
      g.globalAlpha = PAWN_GLOW.a * dn.pawn.glow;
      const r = youFoot.k * PAWN_GLOW.r;
      g.drawImage(glow(PAWN_GLOW.color), youFoot.x - r, youFoot.y - youFoot.k * PAWN_GLOW.up - r, 2 * r, 2 * r);
    }
    g.globalCompositeOperation = "source-over";
    // The lights' own lit pixels over the dark (and his eyes in the black).
    for (let i = 0; i < emN; i++) {
      const img = emImg[i]!;
      const s = emS[i]!;
      g.globalAlpha = Math.min(1, emA[i]!);
      if (emFlip[i]) {
        g.save();
        g.translate(emX[i]! + img.width * s, emY[i]!);
        g.scale(-1, 1);
        g.drawImage(img, 0, 0, img.width * s, img.height * s);
        g.restore();
      } else g.drawImage(img, emX[i]!, emY[i]!, img.width * s, img.height * s);
    }
    g.globalAlpha = 1;
    drawMotes(introT);
  };

  const draw = (now: number) => {
    emN = 0;
    for (const k of CAM_KEYS) {
      tall[k] = S.close[k] + (f.camTall[k] - S.close[k]) * zoomCur;
      wide[k] = S.close[k] + (f.camWide[k] - S.close[k]) * zoomCur;
    }
    setView(v, W, H, 0, 1, 0, 0, sets);
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    g.imageSmoothingEnabled = false;
    g.drawImage(roof, 0, 0, W, H);
    if (def.roof === "store") drawPanels();
    if (cave) {
      // A cave: past its 20 x 20 squares the rock goes on (its rock's own tone, to the horizon), so no view ends in nothing (Nov 3).
      g.fillStyle = cave;
      g.beginPath();
      g.moveTo(v.rimPx[0]!, H);
      for (let i = 0; i < v.rimN; i++) g.lineTo(v.rimPx[i]!, v.rimPy[i]!);
      g.lineTo(v.rimPx[v.rimN - 1]!, H);
      g.closePath();
      g.fill();
    }
    // Outside, past the low front wall: the bright day the door opens onto (a flat pale ground); a cave's mouth opens onto the snowy
    // night.
    const q = pq as [typeof pt, typeof pt, typeof pt, typeof pt];
    const near = Math.min(n + 6, camY + v.back - 0.6); // (up to just in front of the camera)
    if (near > n - 0.5 && P(-6, n - 0.5, q[0]) && P(n + 5, n - 0.5, q[1]) && P(n + 5, near, q[2]) && P(-6, near, q[3])) {
      // (A warehouse's roll-up door opens onto the night lot: dark asphalt.)
      // (An igloo's doorway onto the snowy night, as a cave's.)
      g.fillStyle = cave || def.roof === "igloo" ? CAVE_SNOW : def.roof === "warehouse" ? "#3a3d4a" : "#e6dfcf";
      g.beginPath();
      g.moveTo(q[0].x, q[0].y);
      for (let i = 1; i < 4; i++) g.lineTo(q[i]!.x, q[i]!.y);
      g.fill();
    }
    flat(floor, 0, 0, 0, 0, n, n, S.floorBlock);
    for (const p of flats) {
      const img = frameAt(p.name, now);
      const d = p.d ?? 1;
      flat(img, 0, img.height - d * SQ, p.col, p.row - d + 1, p.w ?? 1, d, S.floorBlock);
    }
    // (Folio's intro: the three flat sheets on the clean page, each until it starts folding up; from the walk in.)
    if (fo && marks) drawFolioSheets();
    // (Ginger's intro: the crack round the icicle's foot, flat on the ice, 3 squares by 2, centred on the table's spot.)
    if (iceNow?.crack && ci?.ice) {
      const fr = ci.ice.props.crack.frames;
      const img = iceNow.crack.anim === "crack" ? fr[iceNow.crack.frame]! : fr[fr.length - 1]!;
      flat(img, 0, 0, ci.ice.at.table[0] - 1, ci.ice.at.table[1] - 0.5, 3, 2, 1);
    }
    // Your destination: a small gold ring on its square until you're there.
    if (dest.on && (you.moving() || waitFor) && P(dest.c, dest.r)) {
      // (On Ginger's catwalk or stairs: on the deck or the step there.)
      const lift = liftAt(lv, dest.c, dest.r);
      if (lift) pt.y -= (lift * pt.k) / SQ;
      g.strokeStyle = "rgba(255,206,84,0.95)";
      g.lineWidth = Math.max(1.5, pt.k * 0.05);
      g.beginPath();
      g.ellipse(pt.x, pt.y, pt.k * 0.3, pt.k * 0.11, 0, 0, Math.PI * 2);
      g.stroke();
    } else dest.on = false;
    // (Hollow's challenge: the glows over the room, with his dark: drawDarkPass.)
    if (!dk) drawGlows(now);
    // Far to near: the pieces by their rows, the Shopkeeper and you (and in a challenge the boss and the board between you) each
    // drawn before the first piece nearer than them.
    you.pose(now, pose);
    figN = 0;
    // (A Shopkeeper on the counter's top stands on its row: drawn just after the counter.)
    addFig(def.at[1] + (def.lift ? 0.005 : 0), 0);
    // (In a challenge you're drawn a hair nearer than your row: in front of Timber's fog on the table's row, as of the boss.)
    addFig(levelZ(pose.y + youOy(now), liftAt(lv, pose.x, pose.y)) + (ci ? 0.002 : 0), 1);
    if (boss && marks) {
      boss.pose(now, bossPose);
      addFig(woodAt()?.r ?? bossPose.y + bossOy(now), 2);
      if (rp && introNow) {
        // (Wrangler's: the bale where it's dragged (the loop on the stand before), the buckets where they tumble: each by its row.)
        addFig(ropeBale().r - 0.01, 3);
        if (introNow.rope?.buckets) {
          addFig(bucketAt("b").r, 4);
          addFig(bucketAt("w").r, 5);
        }
      } else if (introNow || ci?.wood || (cw && ci?.crew)) {
        // (Across, you and the boss stand on the table's row, at its stools: the table first, you in front of yours. Timber's log
        // lies there from the walk in; his fog over him, as it boils up round where he works.)
        addFig(across ? marks.table.r - 0.01 : marks.table.r, 3);
        if (introNow?.wood?.fog) addFig(marks.table.r + 0.001, 6);
        if (!across) {
          addFig(marks.bossStool.r, 4);
          addFig(marks.youStool.r, 5);
        }
      }
    }
    // (Jefferson's crew, each by his row.)
    collectCrew(now);
    collectElves();
    for (let i = 0; i < crewN; i++) addFig(crewFigs[i]!.z, 8 + i);
    let k = 0;
    for (const u of ups) {
      while (k < figN && figZ[k]! < u.z) drawFigure(figK[k++]!, now);
      drawUp(u, now);
    }
    while (k < figN) drawFigure(figK[k++]!, now);
    if (iceNow) drawIceBlast();
    if (fo && introNow?.folio?.plane) drawFolioPlane(introNow.folio.plane);
    if (rp && introNow?.rope) drawRopeLines();
    if (dk) drawDarkPass(now);
    if (kidBox.on && !ci && !cave) drawTag("Shopkeeper", "sidekick", kidBox.hx, kidBox.hy);
    // (Hollow's intro: your tag fades as the drain starts, so the dark isn't broken by a bright label.)
    const tagA = darkNow?.tag ?? 1;
    if (youHead.on && tagA > 0) {
      g.globalAlpha = tagA;
      drawTag(youName(), "you", youHead.x, youHead.y);
      g.globalAlpha = 1;
    }
    if (ci && introNow?.line && bossHead.on) drawBubble(introLine, bossHead.x, bossHead.y, bossHead.px);
    if (chant && introNow?.chant && bossHead.on) drawBubble(chant, bossHead.x, bossHead.y, bossHead.px);
    // (Ginger's board carriers call out as they come: over them, their size.)
    const cl = ci?.def.crewLine;
    if (cl && iceNow?.line && iceNow.carriers) {
      const [a, b] = iceNow.carriers;
      if (P((a.c + b.c) / 2, (a.r + b.r) / 2)) drawBubble(cl, pt.x, pt.y - 28 * (pt.k / SQ), 25 * (pt.k / SQ));
    }
    placeCard();
    const h = you.here();
    const key = `${h.c},${h.r}`;
    if (cv.dataset.you !== key) cv.dataset.you = key;
    if (cv.dataset.ready !== "1") cv.dataset.ready = "1";
  };

  // ---- The cards: the Shopkeeper's and the way out's show when you stop near them; the crate's from Talk.
  let card: ShopCard | null = null;
  /** The square where you closed a card: it doesn't open again until you've moved on. */
  let shut = "";
  let cardW = NaN;
  let cardH = NaN;
  let cardX = NaN;
  let cardY = NaN;
  let cardA = NaN;
  const setCard = (c: ShopCard | null) => {
    if (c === card) return;
    card = c;
    cardW = cardH = cardX = cardY = cardA = NaN;
    onCard(c);
  };
  const close = () => {
    if (!card) return;
    const h = you.here();
    shut = `${h.c},${h.r}`;
    setCard(null);
  };
  const stepCards = () => {
    if (ci) return; // (A challenge: no cards; you're here to fight.)
    const h = you.here();
    const key = `${h.c},${h.r}`;
    if (shut && shut !== key) shut = "";
    if (you.moving()) {
      if (card === "talk" || card === "door") setCard(null);
      return;
    }
    if (card || shut === key) return;
    if (onDoor(room, h.c, h.r)) setCard("door");
    else if (inTalkRange(room, h.c, h.r)) setCard("talk");
  };
  function placeCard() {
    if (!card) return;
    if (Number.isNaN(cardW)) {
      if (cardEl.style.display === "none") return; // (drawn next time round)
      cardW = cardEl.offsetWidth;
      cardH = cardEl.offsetHeight;
    }
    // The crate's card stands in the middle of the box; the others over the Shopkeeper's head or yours, their tails pointing there.
    let ax = W / 2;
    let ay = H / 2 + cardH / 2 + 14;
    if (card === "talk" && kidBox.on) ((ax = kidBox.hx), (ay = kidBox.hy - 16));
    else if (card !== "crate" && youHead.on) ((ax = youHead.x), (ay = youHead.y - 16));
    const left = Math.max(8, Math.min(W - cardW - 8, ax - cardW / 2));
    const top = Math.max(8, Math.min(H - cardH - 8, ay - cardH - 14));
    if (!(Math.abs(left - cardX) < 0.05 && Math.abs(top - cardY) < 0.05)) {
      cardEl.style.transform = `translate3d(${left.toFixed(1)}px, ${top.toFixed(1)}px, 0)`;
      cardX = left;
      cardY = top;
    }
    const tail = Math.max(20, Math.min(cardW - 20, ax - left));
    if (!(Math.abs(tail - cardA) < 0.05)) {
      cardEl.style.setProperty("--ax", `${tail.toFixed(1)}px`);
      cardA = tail;
    }
  }

  // ---- The loop.
  let raf = 0;
  let last = performance.now();
  let alive = true;
  /** Held arrow keys walk you (the town's rule: a key set off closes the room's card and clears a tap's walk; the walk runs on). */
  const keysWalk = () => {
    if (ci) return;
    if (!anyHeld()) {
      keysOn = false;
      return;
    }
    if (!keysOn) {
      keysOn = true;
      dest.on = false;
      waitFor = null;
      follow = true;
      if (you.moving()) you.go([]);
    }
    keys.start();
  };
  const frame = (now: number) => {
    raf = 0;
    if (!alive) return;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    zoomCur += (zoomTarget - zoomCur) * (1 - Math.exp(-dt * f.zoomRate));
    if (Math.abs(zoomTarget - zoomCur) < 0.001) zoomCur = zoomTarget;
    // (On your ride inside, at its pace: RIDES.speed, as in the town.)
    if (!ci) you.stepMs = f.youStepMs / rideSpeed(riding()?.id);
    keysWalk();
    // (Jefferson's crew: one in your way (a machine, the pallet on the floor) and you stop where you are; tap again to go round.)
    if (cw && !ci) {
      const nx = you.peek();
      if (nx && crewTakes(nx.c, nx.r)) you.halt();
    }
    // (Ginger's elves: one in your way and you wait, then go on or round.)
    stepYouElves();
    you.update(now);
    stepIntro(now);
    stepCrew(dt * 1000, now);
    stepElves(dt * 1000);
    stepCards();
    if (follow) {
      // A critically damped spring toward you (the town's), solved exactly for the frame; in a challenge, toward its framing.
      you.pose(now, pose);
      const gx = marks ? marks.table.c - cam!.west : pose.x;
      const gy = marks ? marks.table.r + cam!.south : pose.y;
      const w = f.followSpring;
      const e = Math.exp(-w * dt);
      const x = camX - gx;
      const y = camY - gy;
      const jx = vx + w * x;
      const jy = vy + w * y;
      camX = gx + (x + jx * dt) * e;
      camY = gy + (y + jy * dt) * e;
      vx = (vx - w * jx * dt) * e;
      vy = (vy - w * jy * dt) * e;
    } else vx = vy = 0;
    draw(now);
    // (Folio's: once its intro hands over to the crumple, the room is under the crumple's cover, its last frame what the crumple
    // took: it stops drawing, so the crumple has the page's thread to itself.)
    if (fo && introDone) {
      raf = 0;
      return;
    }
    raf = requestAnimationFrame(frame);
  };
  const run = () => {
    if (raf || !alive || document.hidden) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  };
  const halt = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };
  const onVisibility = () => (document.hidden ? halt() : run());
  document.addEventListener("visibilitychange", onVisibility);
  const ro = new ResizeObserver(() => {
    if (resize()) draw(performance.now());
  });
  ro.observe(box);
  resize();

  // ---- Input: a tap walks you (to a square, into talking range, to the way out); a drag looks around.
  const press = new Press(f.dragPx);
  const focus = { x: 0, y: 0 };
  let drag: { id: number; x: number; y: number; cx: number; cy: number; k: number } | null = null;
  let closing = false;
  /** The square under (x, y) in the box, or null: the nearest drawn square whose shape holds the point (tap.ts). */
  const squareAt = (x: number, y: number): Sq | null => squareUnder(room, v, camX, camY, SQ, x, y, pq);
  /** (x, y) is on the Shopkeeper's picture. */
  const onKid = (x: number, y: number): boolean => kidBox.on && x >= kidBox.x0 && x <= kidBox.x1 && y >= kidBox.y0 && y <= kidBox.y1;
  /** What a press or its release at (x, y) is on (tap.ts `pressKey`): the same at both walks you, as in the town. */
  const keyAt = (x: number, y: number): string => (onKid(x, y) ? pressKey(room, true, null) : pressKey(room, false, squareAt(x, y)));
  /** What a tap at (x, y) means: the Shopkeeper (its picture), the way out (its picture), or the square under it. */
  const plan = (x: number, y: number) => {
    const here = you.here();
    if (onKid(x, y)) return tapTarget(room, here, def.keeper[0]!.c, def.keeper[0]!.r);
    const sq = squareAt(x, y);
    if (!sq) return null;
    return tapTarget(room, here, sq.c, sq.r);
  };
  const local = (e: PointerEvent) => {
    const rc = box.getBoundingClientRect();
    return { x: e.clientX - rc.left, y: e.clientY - rc.top };
  };
  const onDown = (e: PointerEvent) => {
    if (ci) return; // (A challenge plays out on its own: no walking, no looking around.)
    cv.setPointerCapture?.(e.pointerId);
    P(camX, camY - 0.5, pq[0]);
    P(camX, camY + 0.5, pq[1]);
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, cx: camX, cy: camY, k: Math.max(8, pq[1]!.y - pq[0]!.y) };
    closing = !!card;
    if (closing) return press.down(e.clientX, e.clientY, "");
    // (What's under the finger now, as you see it: the camera may glide on before the release (it trails your walk), and a release
    // on anything else lets go without walking, as in the town.)
    const xy = local(e);
    press.down(e.clientX, e.clientY, keyAt(xy.x, xy.y));
  };
  const onMove = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (!press.move(e.clientX, e.clientY)) return;
    follow = false;
    // As the town's drag (Eric, Nov 2: "when I drag from down to up, it should be the same as the town movement"): the floor
    // follows the finger, both ways. A room's rows run toward the camera (P's `camY - r`; the town's run away from it), so a
    // finger going down the screen takes this camY down, where the town's drag adds to its own.
    // (Kept over the room: a cave's over its floor's shape, never into the rock or past its edge: room.ts camFocus.)
    camFocus(room, drag.cx - (e.clientX - drag.x) / v.kf, drag.cy - (e.clientY - drag.y) / drag.k, focus);
    camX = focus.x;
    camY = focus.y;
  };
  const onUp = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    drag = null;
    if (closing) {
      if (press.up("") !== "drag") close();
      return;
    }
    const xy = local(e);
    if (press.up(keyAt(xy.x, xy.y)) !== "walk") return;
    const p = plan(xy.x, xy.y);
    if (!p?.dest) return;
    // (Round Jefferson's machines where they are now; round Ginger's elves, or wait where you are while they're in the way.)
    const path = EA ? wayRoundElves(you.here(), p.dest) : findWay(you.here(), p.dest);
    waitFor = null;
    if (!path) {
      if (!EA || !findPath(room, you.here(), p.dest)) return;
      if (you.moving()) you.halt();
      waitFor = { c: p.dest.c, r: p.dest.r };
      Object.assign(dest, { c: p.dest.c, r: p.dest.r, on: true });
      shut = "";
      follow = true;
      return;
    }
    you.go(path);
    Object.assign(dest, { c: p.dest.c, r: p.dest.r, on: path.length > 0 });
    shut = "";
    follow = true;
  };
  const onCancel = () => {
    drag = null;
    press.cancel();
  };
  const setZoom = (out: boolean) => {
    zoomTarget = out ? 1 : 0;
    onZoom(out);
  };
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    setZoom(e.deltaY > 0);
  };
  const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
  cv.addEventListener("pointerdown", onDown);
  cv.addEventListener("pointermove", onMove);
  cv.addEventListener("pointerup", onUp);
  cv.addEventListener("pointercancel", onCancel);
  cv.addEventListener("wheel", onWheel, { passive: false });
  addEventListener("keydown", onKey);

  // ---- Test hooks (e2e, with the test switches on).
  cv.dataset.room = def.home;
  const hookAt = (kind: "keeper" | "door" | "square", sq?: readonly [number, number]) => {
    if (!testSwitchesAllowed()) return null;
    if (kind === "keeper") {
      const x = (kidBox.x0 + kidBox.x1) / 2;
      const y = kidBox.y0 + (kidBox.y1 - kidBox.y0) * 0.7;
      return kidBox.on && x > 0 && x < W && y > 0 && y < H ? { x, y } : null;
    }
    const s = kind === "door" ? room.doors[0]! : { c: sq![0], r: sq![1] };
    if (!P(s.c, s.r)) return null;
    // (Ginger's catwalk and stairs: up where its deck or its step is drawn.)
    if (isUp(lv, s.c, s.r)) pt.y -= (liftAt(lv, s.c, s.r) * pt.k) / SQ;
    return pt.x >= 0 && pt.x <= W && pt.y >= 0 && pt.y <= H ? { x: pt.x, y: pt.y } : null;
  };
  const hookCam = () => (testSwitchesAllowed() ? { zoom: zoomCur, zoomTarget, room: def.home, follow, focus: [camX, camY] } : null);
  const hookRide = () => (testSwitchesAllowed() ? { ...seen, stepMs: you.stepMs, foot: youFoot.on ? [youFoot.x, youFoot.y] : null } : null);
  /** (Tests) A challenge's state: its step ("walk" until you're both on your marks), where you and the boss stand, the line and the board showing. */
  const hookIntro = () => {
    if (!testSwitchesAllowed() || !ci || !boss) return null;
    const now = performance.now();
    you.pose(now, pose);
    boss.pose(now, bossPose);
    const wat = woodAt();
    const w = introNow?.wood ?? null;
    return {
      step: introNow?.step ?? "walk",
      layout: marks!.layout,
      attack: attackFrame >= 0,
      you: [pose.x + youOx(now), pose.y + youOy(now)],
      boss: wat ? [wat.c, wat.r] : [bossPose.x + bossOx(now), bossPose.y + bossOy(now)],
      facing: { you: you.facing, boss: w?.move ? (w.move.flip ? -1 : 1) : boss.facing },
      // (Timber's own: his move, the log, the fog, the shavings' ring, the stumps.)
      wood: w ? { move: w.move?.anim ?? null, log: w.log?.anim ?? null, fog: w.fog?.anim ?? null, ring: w.ring, stumps: w.stumps?.anim ?? null } : null,
      line: !!introNow?.line && bossHead.on,
      // (Ginger's own: his move, the blast, the icicle, the table, the crack, the door, the carriers, the board, the light, the pieces.)
      ice: iceNow
        ? {
            move: iceNow.move?.anim ?? null,
            blast: iceNow.blast?.anim ?? null,
            shard: iceNow.shard ? { anim: iceNow.shard.anim, lift: Math.round(iceNow.shard.lift) } : null,
            table: iceNow.table >= 0,
            crack: iceNow.crack?.anim ?? null,
            door: iceNow.door,
            carriers: iceNow.carriers?.map((c) => ({ at: [Math.round(c.c * 100) / 100, Math.round(c.r * 100) / 100], anim: c.anim })) ?? null,
            board: iceNow.board ? { at: [Math.round(iceNow.board.c * 100) / 100, Math.round(iceNow.board.r * 100) / 100], lift: Math.round(iceNow.board.lift) } : null,
            onTable: iceNow.onTable,
            light: iceNow.light?.anim ?? null,
            pieces: Math.round(iceNow.pieces * 100) / 100,
            crewLine: !!iceNow.line,
          }
        : null,
      // (Folio's own: its move, the stools' and table's folding (sheet, fold, idle), the plane, the packet, the board on the table, the
      // game's own board.)
      folio: introNow?.folio
        ? {
            move: introNow.folio.move.anim,
            stools: introNow.folio.stools.map((x) => x.anim),
            table: introNow.folio.table.anim,
            plane: introNow.folio.plane ? { anim: introNow.folio.plane.anim, at: [Math.round(introNow.folio.plane.c * 100) / 100, Math.round(introNow.folio.plane.r * 100) / 100], lift: Math.round(introNow.folio.plane.lift * 100) / 100 } : null,
            packet: !!introNow.folio.packet,
            board: introNow.folio.board?.anim ?? null,
            real: introNow.folio.real,
          }
        : null,
      // (Hollow's own: his channel line this time, while it shows; and the dark: his move, his strand, the lanterns out, the string's
      // bulbs dark, the tree, the dark's level, the blackout, the dim light, the iris.)
      chant: introNow?.chant && bossHead.on ? chant : null,
      dark: darkNow
        ? {
            move: darkNow.move?.anim ?? null,
            bulbs: darkNow.bulbs,
            lanterns: darkNow.lanterns.filter((l) => l.since >= 0).length,
            run: darkNow.run,
            tree: darkNow.tree.out,
            tag: darkNow.tag,
            level: darkNow.level,
            black: darkNow.black,
            pool: darkNow.pool,
            iris: darkNow.iris,
          }
        : null,
      // (Wrangler's own: his move, the lasso's loop, the bale (how far along its drag; the stand hidden from the yank), the ropes out,
      // the buckets.)
      rope: introNow?.rope
        ? {
            move: introNow.rope.move?.anim ?? null,
            lasso: introNow.rope.lasso?.anim ?? null,
            bale: introNow.rope.bale ? Math.round(introNow.rope.bale.u * 100) / 100 : null,
            baleAt: introNow.rope.bale ? [Math.round(ropeBale().c * 100) / 100, Math.round(ropeBale().r * 100) / 100] : null,
            standHidden: !!introNow.rope.bale,
            out: introNow.rope.out,
            buckets: introNow.rope.buckets?.anim ?? null,
          }
        : null,
      // (Jefferson's own: his move, the line he called this time, the crew (stopped, walking, each one where and doing what), your
      // lift and its plate's height, the table's wobble, where it stands.)
      lineText: introNow?.line && bossHead.on ? introLine : null,
      crew: introNow?.crew
        ? {
            move: introNow.crew.move?.anim ?? null,
            stopped: introNow.crew.stopped,
            walk: introNow.crew.walk,
            lift: introNow.crew.lift.anim,
            plate: plateUp(),
            table: introNow.crew.table.anim,
            tableAt: [Math.round(crewTableAt().c * 1000) / 1000, Math.round(crewTableAt().r * 1000) / 1000],
            figs: crewHook(),
          }
        : null,
      // (Dash's own: his move, whether he's off or on his spot, his dust trail, the shoe-box table, the board (how far over the
      // table: 0 on it), the pieces, the pop, the stools.)
      blitz: introNow?.blitz
        ? {
            move: introNow.blitz.move?.anim ?? null,
            frame: introNow.blitz.move?.frame ?? -1,
            gone: introNow.blitz.gone,
            here: introNow.blitz.here,
            dust: introNow.blitz.dust >= 0,
            table: introNow.blitz.table?.anim ?? null,
            board: introNow.blitz.board === null ? null : Math.round(introNow.blitz.board * 100) / 100,
            pieces: introNow.blitz.pieces,
            pop: introNow.blitz.pop >= 0,
            stools: introNow.blitz.stools?.anim ?? null,
          }
        : null,
      table: !!introNow?.table,
      stools: introNow?.stools ? [[marks!.bossStool.c, marks!.bossStool.r], [marks!.youStool.c, marks!.youStool.r]] : [],
      pyramid: introNow?.pyramid ?? null,
      blocks: introNow?.blocks ?? null,
      drop: introNow?.drop ?? 0,
    };
  };
  /** (Tests) The crew drawn last frame: each one's sheet's row's animation, where (squares), mirrored, raised. */
  const crewHook = () =>
    crewFigs.slice(0, crewN).map((fg) => {
      const name = fg.img === loaded.kid.img ? "dealer" : (Object.keys(CREW_SHEETS) as CrewName[]).find((k) => loaded.crew?.[k] === fg.img) ?? "?";
      const anims = name === "dealer" ? { idle: { row: 0 }, walk: { row: 1 } } : (CREW_SHEETS[name as CrewName].anims as Record<string, { row: number }>);
      const anim = Object.entries(anims).find(([, a]) => a.row * fg.h === fg.sy)?.[0] ?? "?";
      return { name, anim, frame: Math.round(fg.sx / fg.w), at: [Math.round(fg.c * 100) / 100, Math.round(fg.r * 100) / 100], flip: fg.flip, up: fg.up };
    });
  /**
   * (Tests) Jefferson's machines and crew in his shop: each machine's foot, animation, whether it's waiting for someone in its way, the
   * squares it takes; the pallet; every figure drawn.
   */
  const hookCrew = () => {
    if (!testSwitchesAllowed() || !cw) return null;
    lift!.pose(liftPose);
    fork!.pose(forkPose);
    const m = (p: MachinePose, mc: Machine) => ({ at: [Math.round(p.c * 100) / 100, Math.round(p.r * 100) / 100], anim: p.anim, waiting: p.waiting, leg: mc.i });
    return { lift: m(liftPose, lift!), forklift: m(forkPose, fork!), pallet: fork!.pallet, figs: crewHook(), you: [you.hereC(), you.hereR()] };
  };
  /**
   * (Tests) Ginger's igloo: the elves (each one's foot, lift, animation, whether it's waiting for you), the squares they take, and your
   * figure as drawn in each of the last frames (`trail`: your foot in squares, your lift, your feet on screen and your draw order),
   * cleared by `clear`.
   */
  const hookElves = (clear = false) => {
    if (!testSwitchesAllowed() || !EA) return null;
    const names = ["red", "green", "blue", "box", "pad"];
    const out = {
      elves: elfPoses.map((p, i) => ({ name: names[i]!, at: [Math.round(p.x * 100) / 100, Math.round(p.y * 100) / 100], up: Math.round(liftAt(lv, p.x, p.y) * 10) / 10, anim: p.anim, waiting: p.waiting })),
      taken: Array.from(elfSq.slice(0, elfN), (k) => [k % n, Math.floor(k / n)]),
      you: [you.hereC(), you.hereR()],
      waiting: waitFor ? [waitFor.c, waitFor.r] : null,
      pairT: Math.round(pair!.t),
      trail: youTrail.slice(0, youTrailN),
    };
    if (clear) youTrailN = 0;
    return out;
  };
  const hookBench = (k: number) => {
    if (!testSwitchesAllowed()) return null;
    const now = performance.now();
    draw(now);
    const t0 = performance.now();
    for (let i = 0; i < k; i++) draw(now);
    return (performance.now() - t0) / k;
  };
  const hooks = window as unknown as { __shopAt?: typeof hookAt; __shopCam?: typeof hookCam; __shopBench?: typeof hookBench; __shopRide?: typeof hookRide; __shopIntro?: typeof hookIntro; __shopCrew?: typeof hookCrew; __shopElves?: typeof hookElves };
  hooks.__shopElves = hookElves;
  hooks.__shopAt = hookAt;
  hooks.__shopCrew = hookCrew;
  hooks.__shopIntro = hookIntro;
  hooks.__shopRide = hookRide;
  hooks.__shopCam = hookCam;
  hooks.__shopBench = hookBench;

  run();
  draw(performance.now()); // the first frame, before the fade lifts

  return {
    zoom: setZoom,
    /** A card's button opens another (Talk: the crate's). */
    show: (c: ShopCard) => setCard(c),
    recenter: () => {
      follow = true;
    },
    stop: () => {
      alive = false;
      halt();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      removeEventListener("keydown", onKey);
      cv.removeEventListener("pointerdown", onDown);
      cv.removeEventListener("pointermove", onMove);
      cv.removeEventListener("pointerup", onUp);
      cv.removeEventListener("pointercancel", onCancel);
      cv.removeEventListener("wheel", onWheel);
      delete hooks.__shopAt;
      delete hooks.__shopCam;
      delete hooks.__shopBench;
      delete hooks.__shopRide;
      delete hooks.__shopIntro;
      delete hooks.__shopCrew;
    },
  };
}
