/**
 * The town square (hidden page /town; slice 1: the world, five homes, their bosses and a few bots, nothing else). A slim
 * bar with the back button and the title; the world fills the rest of the screen, on a phone and a computer alike, and
 * works its camera out from its box's shape (camera.ts). Tap a square to walk there (around the homes, a square at a
 * time); tap a home, a boss or a bot to walk next to it; drag to look around; "Back to me" (the focus button); −/+ (and the wheel) zoom;
 * the chips at the edge point to the homes off screen, and a tap glides the camera there. Slice 4: a finger presses the
 * square you'd walk to like a button (press.ts), one pawn a square (world.ts), your trail, and the cards: a boss's
 * ("Challenge alone", which leaves for the Boss raid screen, its tile picked, after a confirm) and a home's (its shop, greyed, "Coming soon").
 * Slice 5: the Colosseum in the middle (solid; a tap walks you to the apron at its gate and opens its card: "Raids with
 * people", greyed, "Coming soon": the menu Eric plans will live there), with an edge chip of its own. Slice 6: the park
 * in front of it; a tap on a chess table (or a stool) walks you to its nearest free stool, where you sit, and opens its
 * card ("Casual" and "Ranked" greyed, "Coming soon"; at a table where two others play, "Spectate" greyed); a tap elsewhere
 * closes it and you stand. Each table's board shows who sits there (render.ts, `tableStates`). Oct 27: the bots (`BOTS`,
 * dressed in their crate items): a tap on one opens its card ("<name> (bot)", its rating, Play: you both walk to a free
 * table and the game opens once you sit, `onPlayBot`); a table where a bot waits offers "Play <name> (bot) · <rating>".
 * Back from the game (`seat`), you sit at that table, the bot across.
 * Oct 28 (Eric's mockup): every card is dark with a gold border; a person's card (a bot's, and a real player's when they come) is
 * one row at one size: their picture in a round ring, their name ("(bot)" in gray), a sidekick's line, the rating and, under it, "Tables are
 * full" when they are (that row always there), and Play with crossed swords. A real player's picture is a button for their
 * profile; a bot's isn't.
 *
 * One requestAnimationFrame loop draws everything on one canvas; it stops when the screen closes or the tab is hidden.
 * Test hooks (e2e only): the canvas carries `data-you="c,r"` (your square) and `data-ready="1"` once a frame is drawn;
 * with the test switches on, `window.__townAt("boss" | "home" | "coliseum" | "statue" | "table", id)` gives where to tap a
 * boss, a home, the Colosseum (its gate), a statue or a chess table (by its index) now, `__townAt("lamp", i)` where a
 * park lamp's glass is (by its index in LAMPS) and `__townAt("light", id)` a lit pixel of a home's (or "coliseum") first
 * light with nothing in front of it (the lights at dusk and night); the canvas's `data-sit="1"` while you sit at a table; and
 * `window.__townGather()` sends the three nearest bots to stand beside you; `__townAt("bot", i)`, `__townCall(i)` and
 * `__townBots()` for the bots (docs/areas/town-square.md); `__townGlide(id)` glides the camera to a home, as its chip does;
 * `__townPlayer(uid, name, icon?, rating?)` stands a test player (a pawn with an account id) beside you, and
 * `__townAt("player", uid)` says where to tap it (the real town has no players yet); `__townFull(on)` fills every table's west stool
 * with someone unseen (no table is free for a game: a bot's card greys its Play); `__townTags()` the name tags drawn in the last frame.
 * docs/areas/town-square.md.
 */
import { roomLoadSlice } from "./shops/load-slice.ts";
import { F as RF, FPS, FpsCount, FrameRec, NP, P, REC, browserOf, setFps, setRec, summarize, timerStep } from "./frame-report.ts";
import { reportPanel, reportPill, type Device } from "./frame-report-panel.ts";
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { createPortal } from "preact/compat";
import { RIGHT_SLOT_TOOLS } from "../components/FrontMenu.tsx";
import { UserIcon } from "../components/PixelIcon.tsx";
import { openProfile } from "../profile-nav.ts";
import { account, myPawnColor, onAccountChange, playerName } from "../account.ts";
import { TOWN_ASKED, testSwitchesAllowed } from "../test-switches.ts";
import { play, warmSounds } from "../sound.ts";
import { musicWanted, preloadMusic, roomMusic, roomMusicLoad, splashDone, splashMusic } from "../music.ts";
import { AreaBanner, areaBannerOf, type AreaBannerText } from "./AreaBanner.tsx";
import { SELECT_SOUND, TOWN_SOUNDS, townSound } from "../characters/boss-select.ts";
import { N, colI, newPt, proj, rel, rowI, wrapFX, wrapFY, wrapI } from "./camera.ts";
import { HIDDEN_ROOM_FEEL, SHOP_FEEL, TOWN_FEEL } from "./feel.ts";
import { ZEBRA_OUTSIDE_LINES, pickLine } from "./shops/zebra-lines.ts";
import { canChallengeInside, homeTheme, roomTheme, shopOf } from "./shops/shops.ts";
import type { RoomPart } from "./shops/room.ts";
import type { LoadedRoom, RoomFx, RoomIntro, ShopCtl, ShopRoom } from "./shops/ShopRoom.tsx";
import { CHALLENGE_FEEL, introOf, nextFlow, type ChallengeEvent, type ChallengeFlow } from "./shops/challenge.ts";
import { BarsIcon, SwordsIcon } from "./CardIcons.tsx";
import { TownChat } from "./TownChat.tsx";
import { TownChatTools } from "./TownChatTools.tsx";
import { Press } from "./press.ts";
import { anyHeld, hold, isHeld, keyWalk, listenKeys, onHeld, type Dir } from "./arrows.ts";
import { LookAround, Turn, freshView, lockIn, nearestTurn, quarterOf, screenStep } from "./turn.ts";
import { FingerRun } from "./run.ts";
import { mapFrame } from "./minimap.ts";
import { TownMap, type MapFace } from "./TownMap.tsx";
import { baseHeading, stripAt } from "./strips.ts";
import { StreetZoom, parkSide } from "./zoom-steps.ts";
import { PAWN_HEAD, PAWN_PX, Renderer, pawnImage, type Hit, type YouArt } from "./render.ts";
import { dropRiders, leaveRider, ridersHeld, rideArt, shareRider, type Rider, type RiderPawn } from "./rides.ts";
import { rideSpeed } from "../components/rides/scale.ts";
import { HIDDEN_ROOM, MUSIC, mountOf, secondColor, shownLook, sideOfPawn } from "@chessroyale/core";
import { painter2d, type Backend, type Painter } from "./paint.ts";
import { painterGL } from "./paint-gl.ts";
import { reportTownFallback } from "../problems.ts";
import type { TownGlFallback } from "@chessroyale/core";
import { sameWeights, skyOverride, skyWeights, type SkyWeights } from "./sky.ts";
import { TOWN_BOTS, COLISEUM_PLACE, CROWD_MAX, HOMES, addCrowd, figureName, hasTownBoss, walkYou, addTestPlayer, fillTables, homeDoor, inSquare, stayOut, START, STATUES, TABLES, anyTableFree, botLabel, cancelMeet, comeOut, createTown, destFor, holdBot, homeNear, isSprite, spotNear, meet, meetReady, meetSeat, onColiseum, playAtTableText, plotAt, ratingLine, ratingText, seated, sidekickText, spriteAnim, statueAt, stoolAt, tableAt, tableFor, tableStates, taken, tdist, tick, townLine, walkable, waitingBot, walkWalker, type HomeId, seatOf, seatText, standOf, type Person, type Place, type Seat, type Sq, type Stand, type StatueId, type Target } from "./world.ts";
import { afterFail, lossWatch } from "./gl-fail.ts";
import { guestLimitMs, watchAway, watchGuest } from "./here-net.ts";
import { FdButton } from "../components/FrontDoor.tsx";
import { LeaveTownConfirm, TOWN_BACK_TO, setRequestWaiting } from "./LeaveTown.tsx";
import { HiddenRoomClient, type RoomOutcome } from "./hidden-net.ts";
import { HiddenCard, HiddenCount, RoomNote } from "./HiddenRoom.tsx";
import type { LivePawn, RecluseScene } from "./shops/recluse-scene.ts";
import { tooYoung } from "../account.ts";
import { dressedPawn, lookKey, offFace, offRide } from "./you-look.ts";
import type { ItemLook } from "@chessroyale/core";
import type { BotGameAsk } from "./TownPage.tsx";
import "./town.css";

const CHIPS = TOWN_FEEL.maxChips;

/**
 * The card open over a boss, a home, the Colosseum, a chess table or a person (`i`: its index in HOMES, the bosses being in
 * the same order; the Colosseum's is HOMES.length; a table's, its index in TABLES; a person's, its index in the town's
 * people), and its confirm.
 */
export interface Card {
  kind: "boss" | "home" | "coliseum" | "table" | "person";
  i: number;
  confirm: boolean;
  /** A table where two others are playing: its card offers to watch their game (Eric, Oct 27), not a seat. */
  watch?: boolean;
  /** A table where a bot waits alone: its index in the people (its card's first button plays it). */
  bot?: number;
  /** A bot's card: no table has both stools free (Play greyed, "Tables are full"). */
  full?: boolean;
  /** A boss's or a home's card: its line this time (`townLine`: only Hollow's has lines, the next one each time it opens). */
  line?: string | null;
  /** A bot's card: its picture, made once as the card opens (a sidekick's face, a pawn's look as it's dressed; an image's address). */
  face?: string | null;
}

type Ctl = ReturnType<typeof startTown>;

/**
 * Each `.town-fit` row of a card at its stylesheet size, or smaller until its words fit the row (Eric, Oct 29: a long name
 * makes its own words smaller, not the card bigger), never below its `--fit-min`. Its height is the row's line height, so
 * nothing moves. Run as a card opens (never per frame).
 */
function fitRows(card: HTMLElement): void {
  for (const row of card.querySelectorAll<HTMLElement>(".town-fit")) {
    row.style.fontSize = "";
    const cs = getComputedStyle(row);
    const min = parseFloat(cs.getPropertyValue("--fit-min")) || parseFloat(cs.fontSize);
    let size = parseFloat(cs.fontSize);
    while (row.scrollWidth > row.clientWidth + 0.5 && size > min) {
      size = Math.max(min, Math.floor(((size * row.clientWidth) / row.scrollWidth) * 4) / 4);
      row.style.fontSize = `${size}px`;
    }
  }
}

export function TownScreen({
  onBack,
  askLeave,
  onBossAlone,
  onBossChallenge,
  onHiddenFight,
  onPlayBot,
  onColosseum,
  seat = null,
  stand = null,
  framed = false,
  onAway,
  onSignIn,
}: {
  onBack: () => void;
  /** Leaving the town for another screen (the back button, a guest's chat sign-up): the app's "Leave Chess Town?" first (LeaveTown.tsx). */
  askLeave: (dest: string, go: () => void) => void;
  /** A guest's "Sign up" (their town time is up): the app's sign-in, out of the town. */
  onSignIn?: () => void;
  /** Away too long (afk.ts): out of the town to home, with "You were away". */
  onAway?: () => void;
  onBossAlone?: (id: HomeId) => void;
  /**
   * A boss with an intro challenged (shops/challenge.ts): its transition covers the screen; start its battle (Boss alone, as its
   * screen's START does) and resolve once the battle shows (the transition slides off it). `stand`: where you stood, to come back to.
   */
  onBossChallenge?: (id: HomeId, stand: Stand | null) => Promise<void>;
  /** The Hidden Boss's room's four go in (hidden-net.ts): the summoning has played to black; into his fight with your pass and seat. */
  onHiddenFight?: (lobby: string, pass: string, seat: number, stand: Stand | null) => void;
  onPlayBot?: (game: BotGameAsk) => void;
  onColosseum?: () => void;
  seat?: string | null;
  /** Back from a boss's challenge: where you stood as you challenged it (you start there, facing the same way). */
  stand?: Stand | null;
  framed?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const chips = useRef<(HTMLDivElement | null)[]>([]);
  const cardEl = useRef<HTMLDivElement>(null);
  const live = useRef<HTMLDivElement>(null);
  const ctl = useRef<Ctl | null>(null);
  const [zoomedOut, setZoomedOut] = useState<boolean>(TOWN_FEEL.streetStartZoomedOut);
  const [card, setCard] = useState<Card | null>(null);
  // Inside a shop (Nov 2, round 1; shops/ShopRoom.tsx, loaded when you go in): the room, and its zoom (− / + switch Close and the
  // town's zoomed-in camera there). `fade` is the black the town zooms into and the room fades in from.
  // (Rolling Dough, Nov 11: a home with two rooms; `arrived` you came through the door between them, `n` the room's mount, a new one each
  // time through it.)
  const [inside, setInside] = useState<{ room: LoadedRoom; View: typeof ShopRoom; intro: RoomIntro | null; arrived?: boolean | RoomPart; n?: number; fx?: RoomFx | null } | null>(null);
  const insideNow = useRef(inside);
  insideNow.current = inside;
  /** The shop you're in (its home's id), for the away rule's beats; null in the town square. */
  const shopIn = useRef<string | null>(null);
  shopIn.current = inside?.room.def.home ?? null;
  /** A guest's town time is up: "Make an account to keep exploring" over the town, which takes no more steps. */
  const [gated, setGated] = useState(false);
  /**
   * The street town's loading screen (Nov 11, Eric: "I have no issue with doing a loading screen for the town… even if it takes 3 or 5
   * seconds… loads it all in at once and then it stays there"): up while every picture is painted and uploaded (startTown's `loadTown`).
   * Its bar is moved directly (`loadBar`), not by a render a step.
   */
  const [loading, setLoading] = useState(true);
  const loadBar = useRef<HTMLElement>(null);
  /** The street town can't run here (no WebGL 2), or didn't load even after a reload (startTown's `onFail`; gl-fail.ts): a plain message in its box. */
  const [broken, setBroken] = useState<TownBroken | null>(null);
  /** Its last step (Nov 12): the bosses' music still on its way once the town is built ("Loading music…"). */
  const [loadingMusic, setLoadingMusic] = useState(false);
  useLayoutEffect(() => {
    if (!gated) return;
    // (No key reaches the town or a room under the pop-up: the arrow keys would walk you on.)
    const stopKeys = (e: KeyboardEvent) => {
      if (!(e.target instanceof Element && e.target.closest(".town-gate"))) e.stopImmediatePropagation();
    };
    addEventListener("keydown", stopKeys, true);
    return () => removeEventListener("keydown", stopKeys, true);
  }, [gated]);
  const awayOut = useRef(() => {});
  awayOut.current = () => (onAway ?? onBack)();
  /** A boss's challenge (shops/challenge.ts), where it is: "town" when there's none. */
  const flow = useRef<ChallengeFlow>("town");
  const step = (e: ChallengeEvent) => (flow.current = nextFlow(flow.current, e));
  const [shopOut, setShopOut] = useState(false);
  const shopCtl = useRef<ShopCtl | null>(null);
  const fade = useRef<HTMLDivElement>(null);
  /** Going in or out: taps wait, and another way in or out isn't started. */
  const doorBusy = useRef(false);
  /** The back button (or Go out) tapped while the room was still fading in: out as soon as it has (Nov 12: the tap was lost). */
  const outNext = useRef(false);
  /**
   * A way through to another room (the stairs' Go up, a back door) tapped while this one was still fading in: through as soon as it has
   * (Nov 13, hidden-boss-room:242: the tap was dropped, as Go out's was on Nov 12).
   */
  const passNext = useRef<RoomPart | null>(null);
  /** Going out now (goOut, until the town is back). */
  const leaving = useRef(false);
  /**
   * You're walking into a room through its door on your own (the town's door, or Rolling Dough's door between rooms), not arriving by
   * a challenge: as it shows, its banner (Eric's mockup, Nov 11) and its boss's music (music.ts roomMusic).
   */
  const byDoor = useRef(false);
  const [banner, setBanner] = useState<(AreaBannerText & { n: number }) | null>(null);
  const bannerN = useRef(0);
  // ---- The Hidden Boss's room challenge (Eric, Nov 12 and 13; hidden-net.ts, HiddenRoom.tsx; the server's: server/src/hidden-room.ts).
  /** The room's client (made as you first climb to his room), and his room's scene (the child, the others, the summoning). */
  const hidden = useRef<HiddenRoomClient | null>(null);
  const recluse = useRef<RecluseScene | null>(null);
  /** The others in his room as the scene draws them (a new list only when the server answers: nothing made per frame). */
  const livePeople = useRef<readonly LivePawn[]>([]);
  /** A small note with OK ("The door is locked.", "Sorry, not enough players."). */
  const [note, setNote] = useState<string | null>(null);
  /** "Cancel your game request?" before leaving his room with your request in: where you were going. */
  const [asking, setAsking] = useState(false);
  const cancelGo = useRef<(() => void) | null>(null);
  /** The summoning is playing: nothing else happens (no taps, no keys, no leaving), then his fight. */
  const summoning = useRef(false);
  const [frozen, setFrozen] = useState(false);
  /** The town has closed (the side menu, the back gesture): a fight told after that goes straight in. */
  const gone = useRef(false);
  const hiddenClient = () =>
    (hidden.current ??= new HiddenRoomClient(
      () => {
        const p = shopCtl.current?.youAt?.();
        // (Idle 0: the town's own away rule, watchAway, runs in rooms too and takes an idle player out of the town, so out of his room.)
        return p ? { c: Math.round(p.c), r: Math.round(p.r), idleMs: 0 } : null;
      },
      (o) => (o.kind === "fight" ? void summon(o) : setNote(o.message)),
      (message) => {
        setNote(message);
        void goThrough("landing");
      },
    ));
  /** In his room with your request in, leaving asks first ("Cancel your game request?"); anywhere else it goes at once. */
  const askIfWaiting = (go: () => void) => {
    if (summoning.current) return;
    if (!hidden.current?.waiting) return go();
    cancelGo.current = go;
    setAsking(true);
  };
  const fadeTo = (to: 0 | 1, ms: number, delay = 0) => {
    const el = fade.current;
    if (!el) return;
    el.style.transition = `opacity ${ms}ms linear ${delay}ms`;
    el.style.opacity = String(to);
    el.style.pointerEvents = to ? "auto" : "none";
  };
  const townCanvas = () => box.current?.querySelector<HTMLCanvasElement>("canvas.town-canvas") ?? null;
  /** (`?report`) The frames from now on are going in or out of a building (RF.goIn, RF.goOut; 0: neither): frame-report.ts. */
  const doorPhase = (f: number) => {
    if (REC) REC.door = f;
  };
  const later = (ms: number) => new Promise<void>((ok) => setTimeout(ok, ms));
  /**
   * A room's own scene (RoomFx), loaded with it, or null: none (every room but the walk-up's, Nov 13: its hall's and landing's side walls,
   * one surface each; his room's walls and the child at his game, on the clock, so his game is where it is whenever you come up).
   */
  const roomFxOf = (id: HomeId, part: RoomPart): Promise<RoomFx | null> | null =>
    id !== "recluse"
      ? null
      : part === "top"
        ? import("./shops/recluse-scene.ts").then((m) => {
            const me = account().profile?.user.id ?? "you";
            const sc = m.recluseScene(Date.now() - performance.now(), true, {
              live: true,
              people: () => livePeople.current,
              you: () => {
                const p = shopCtl.current?.youAt?.();
                return p ? { id: me, c: p.c, r: p.r } : null;
              },
            });
            recluse.current = sc;
            return sc.fx;
          })
        : import("./shops/recluse-stairs-scene.ts").then((m) => m.RECLUSE_STAIRS_FX);
  /**
   * You stand at a shop's door (its "Go in"): the town zooms in on the door (`x`, `y` in the box) and fades to black; the room opens.
   * A boss's challenge (`challenge`) goes in the same way, the boss beside you, with its intro's art loading too; the room plays it.
   */
  const goIn = async (id: HomeId, x: number, y: number, challenge = false) => {
    if (doorBusy.current) return;
    doorBusy.current = true;
    outNext.current = false;
    passNext.current = null;
    doorPhase(RF.goIn);
    const F = SHOP_FEEL;
    // (The room's pictures painted a slice a frame while the town zooms, the rest once it's black: shops/load-slice.ts.)
    roomLoadSlice(F.loadSliceMs);
    if (challenge) step("atDoor");
    // (The boss's theme loads as the door zooms: walked in on your own, it plays as the room shows; by a challenge, not until its
    // splash. Eric, Nov 11.)
    byDoor.current = !challenge;
    // (A challenge's too: its splash starts the theme, Eric, Nov 11; loaded now it's ready by then.)
    roomMusicLoad(homeTheme(id));
    // (Its code and art load now, while the town zooms: nothing of a shop loads while you walk round the town.)
    const load = import("./shops/ShopRoom.tsx").then((m) => m.loadRoom(id).then((room) => ({ room, View: m.ShopRoom })));
    const scene = roomFxOf(id, "front");
    // (A challenge's intro art too: loaded only now, as you go in to fight.)
    const intro = challenge ? import("./shops/intro.ts").then(async (m) => ({ m, intro: await m.loadIntro(id)! })) : null;
    const cv = townCanvas();
    if (cv) {
      cv.style.transformOrigin = `${x.toFixed(1)}px ${y.toFixed(1)}px`;
      cv.style.transition = `transform ${F.doorZoomMs}ms ease-in`;
      cv.style.transform = `scale(${F.doorZoom})`;
    }
    fadeTo(1, F.fadeMs, F.doorZoomMs - F.fadeMs);
    await later(F.doorZoomMs);
    roomLoadSlice(0);
    const got = await load.catch(() => null);
    const fight = intro ? await intro.catch(() => null) : null;
    const fx = scene ? await scene.catch(() => null) : null;
    if (!got || !box.current || (challenge && !fight) || (scene && !fx)) {
      // (It didn't load: back out to the town as you were.)
      roomMusic(null);
      if (cv) cv.style.transform = "";
      fadeTo(0, F.fadeMs);
      doorBusy.current = false;
      doorPhase(0);
      if (challenge) {
        step("cancel");
        ctl.current?.endChallenge();
      }
      return;
    }
    ctl.current?.pause();
    // (You start inside zoomed out, the − pressed: SHOP_FEEL.startZoom, a challenge's camera too.)
    setShopOut(F.startZoom === 1);
    if (fight) step("inside");
    setInside({ ...got, fx, intro: fight ? { intro: fight.intro, onMarks: () => step("onMarks"), onDone: () => void stormIn(id, fight.m, fight.intro) } : null });
  };
  /**
   * The intro is done: the boss's transition sweeps in (outside the town's tree: it stays as the town closes), the battle starts
   * under it (the app's, as Boss alone's START), and once the battle shows it slides out.
   */
  const stormIn = async (id: HomeId, m: typeof import("./shops/intro.ts"), intro: RoomIntro["intro"]) => {
    if (flow.current !== "intro") return;
    step("introDone");
    const storm = m.startTransition(intro);
    // (Eric, Nov 11: the boss's theme starts the moment his splash starts, the battle carrying it on. Not ready yet: the splash's
    // covering frame (each boss's last frame, Folio's crumpled ball) holds until it is, MUSIC.splashHoldMs at most.)
    const music = splashMusic(id);
    await storm.covered;
    const ready = Promise.race([music, later(MUSIC.splashHoldMs)]);
    step("stormCovers");
    try {
      await onBossChallenge?.(id, ctl.current?.challengeStand() ?? null);
    } finally {
      step("battleReady");
      await ready;
      await storm.out();
      step("stormGone");
      splashDone();
    }
  };
  /**
   * Through the door to the home's other room (Rolling Dough's back room, Nov 11; the walk-up's stairs, Nov 13: `to`, the room it leads
   * to): the same fade as going in (to black, the other room loads, from black), no zoom; you arrive just inside its door. Each room
   * keeps its own camera and clock: it starts again each time. (The walk-up's top floor: his room's scene, the child playing, comes with
   * it: shops/recluse-scene.ts, on the clock, so the game is where it is whenever you come up.)
   */
  const goThrough = async (to: RoomPart) => {
    const at = insideNow.current;
    // (Tapped as the room fades in: it waits for the room, then goes through. Not while going out.)
    if (doorBusy.current && at && !leaving.current && !outNext.current) passNext.current = to;
    if (doorBusy.current || !at || flow.current !== "town" || summoning.current) return;
    doorBusy.current = true;
    outNext.current = false;
    passNext.current = null;
    const F = SHOP_FEEL;
    const from: RoomPart = at.room.def.part ?? "front";
    // (Up to his room: four at most, Eric, Nov 12. A 5th: "The door is locked." and stays out.)
    if (at.room.def.home === "recluse" && to === "top") {
      const r = await hiddenClient().enter();
      if (!r.ok) {
        // (The stairs' card closes under the note: you stay on the landing. No words: your fight's summoning is taking you.)
        shopCtl.current?.close?.();
        if (r.message) setNote(r.message);
        doorBusy.current = false;
        return;
      }
    }
    byDoor.current = true;
    doorPhase(RF.goIn);
    // (The back door's creak is off with the bakery's other room sounds: Eric, Nov 11.)
    const load = import("./shops/ShopRoom.tsx").then((m) => m.loadRoom(at.room.def.home, to));
    const scene = roomFxOf(at.room.def.home, to);
    fadeTo(1, F.fadeMs);
    await later(F.fadeMs);
    const room = await load.catch(() => null);
    const fx = scene ? await scene.catch(() => null) : null;
    if (!room || !box.current || (scene && !fx)) {
      fadeTo(0, F.fadeMs);
      doorBusy.current = false;
      doorPhase(0);
      return;
    }
    setShopOut(F.startZoom === 1);
    setInside({ room, View: at.View, intro: null, arrived: from, n: (at.n ?? 0) + 1, fx });
  };
  /**
   * A challenge started inside (Don Dough's, once his Challenge's beat and walk-out have played in his back room, you through its door;
   * Nov 11): his intro and the front room load, the back room fades to black and the front room fades in in challenge mode (Eric: "The
   * main room is still where you fight"): you and he come out of the back door to the pad, his goons carrying the set-up after you, then
   * his transition and the battle.
   * "Back to town" puts you at his door in the town, where you stood to go in.
   */
  const challengeHere = async () => {
    const at = insideNow.current;
    if (doorBusy.current || !at || flow.current !== "town") return;
    const id = at.room.def.home;
    doorBusy.current = true;
    outNext.current = false;
    byDoor.current = false;
    step("fight");
    step("atDoor");
    const F = SHOP_FEEL;
    // (Eric, Nov 11: "The main room is still where you fight": his intro plays in the front room, you both coming out of the back door.)
    const intro = import("./shops/intro.ts").then(async (m) => ({ m, intro: (await m.loadIntro(id))! }));
    const front = import("./shops/ShopRoom.tsx").then((m) => m.loadRoom(id, "front"));
    doorPhase(RF.goIn);
    fadeTo(1, F.fadeMs);
    await later(F.fadeMs);
    const fight = await intro.catch(() => null);
    const room = await front.catch(() => null);
    if (!fight?.intro || !room || !box.current) {
      step("cancel");
      fadeTo(0, F.fadeMs);
      doorBusy.current = false;
      doorPhase(0);
      return;
    }
    ctl.current?.standHere();
    step("inside");
    setInside({ room, View: at.View, intro: { intro: fight.intro, onMarks: () => step("onMarks"), onDone: () => void stormIn(id, fight.m, fight.intro) }, arrived: true, n: (at.n ?? 0) + 1 });
  };
  /** The room drew its first frame: the black lifts. */
  const shopReady = () => {
    const at = insideNow.current;
    if (byDoor.current && at) {
      byDoor.current = false;
      roomMusic(roomTheme(at.room.def));
      setBanner({ ...areaBannerOf(at.room.def, HOMES.find((h) => h.id === at.room.def.home)?.name ?? ""), n: ++bannerN.current });
    }
    fadeTo(0, SHOP_FEEL.fadeMs);
    setTimeout(() => {
      doorBusy.current = false;
      doorPhase(0);
      const through = passNext.current;
      passNext.current = null;
      if (outNext.current) void goOut();
      else if (through) void goThrough(through);
    }, SHOP_FEEL.fadeMs);
  };
  /** "Go out" (or the back button inside): the room fades to black, and the town zooms back out from the door. */
  const goOut = async () => {
    if (summoning.current) return;
    if (doorBusy.current) {
      // (Tapped as the room fades in: it waits for the room, then goes out. Not while already going out.)
      if (insideNow.current && !outNext.current && !leaving.current) outNext.current = true;
      return;
    }
    outNext.current = false;
    passNext.current = null;
    // (A challenge can be called off, with the back button, until its transition starts: the battle is coming from then on.)
    if (flow.current !== "town" && flow.current !== "walkIn" && flow.current !== "intro") return;
    doorBusy.current = true;
    leaving.current = true;
    if (flow.current !== "town") {
      step("cancel");
      ctl.current?.endChallenge();
    }
    const F = SHOP_FEEL;
    roomMusic(null);
    setBanner(null);
    doorPhase(RF.goOut);
    fadeTo(1, F.fadeMs);
    await later(F.fadeMs);
    setInside(null);
    ctl.current?.resume();
    const cv = townCanvas();
    if (cv) {
      cv.style.transition = `transform ${F.doorZoomMs}ms ease-out`;
      cv.style.transform = "";
    }
    fadeTo(0, F.fadeMs);
    await later(F.doorZoomMs);
    if (cv) cv.style.transition = cv.style.transformOrigin = "";
    doorBusy.current = false;
    leaving.current = false;
    doorPhase(0);
  };

  /**
   * His room's four go in (Eric, Nov 12: "a freeze frame… the frozen players burst into particles… absorbed into the light… the board
   * wobbles up and down, settles; the room goes quiet. Then a transition into the match"): the scene's summoning (shops/recluse-scene.ts,
   * HIDDEN_ROOM_FEEL.summon), everyone frozen where they stand, no taps or keys; at its end (the room irised to black) a black cover over
   * the page while his fight opens (the app's onHiddenFight: your pass, your seat). "Back to town" brings you to his door.
   */
  const summon = async (o: Extract<RoomOutcome, { kind: "fight" }>) => {
    if (summoning.current) return;
    summoning.current = true;
    // (The town closed with "Leave and cancel" just as the fourth joined: the summoning has started for everyone, so straight into the
    // fight with them; review m1.)
    if (gone.current) return onHiddenFight?.(o.lobby, o.pass, o.seat, null);
    hidden.current?.stop();
    setRequestWaiting(null);
    setFrozen(true);
    setNote(null);
    setAsking(false);
    shopCtl.current?.close?.();
    // (The room goes quiet: its music stops at the freeze.)
    roomMusic(null);
    recluse.current?.summon(performance.now());
    await later(HIDDEN_ROOM_FEEL.summon.end);
    const cover = document.createElement("div");
    cover.className = "hb-cover";
    document.body.append(cover);
    ctl.current?.standHere();
    onHiddenFight?.(o.lobby, o.pass, o.seat, ctl.current?.challengeStand() ?? null);
    setTimeout(() => {
      cover.style.opacity = "0";
      setTimeout(() => cover.remove(), 700);
    }, 900);
  };
  /** In the walk-up's top floor, his room: the room's client asks the server while you're there (its count, its people, your start). */
  const inTop = inside?.room.def.home === "recluse" && inside.room.def.part === "top";
  useEffect(() => {
    if (!inTop) return;
    const c = hiddenClient();
    c.start();
    setRequestWaiting(() => c.waiting);
    const others = () => {
      let bot = 0;
      livePeople.current = (c.info?.others ?? []).map((o) => (o.bot ? { id: o.id, c: null, r: null, spot: 1 + bot++ } : { id: o.id, c: o.c, r: o.r }));
    };
    others();
    const off = c.subscribe(others);
    const onHide = () => c.leave(true);
    addEventListener("pagehide", onHide);
    // (Tests) The room's challenge now: the server's last answer, the summoning's time, and whether you're frozen.
    const hooks = window as unknown as { __hiddenRoom?: () => unknown };
    if (testSwitchesAllowed()) hooks.__hiddenRoom = () => ({ info: c.info, refused: c.refused, summonT: recluse.current?.state().summonT ?? null, frozen: summoning.current });
    return () => {
      off();
      removeEventListener("pagehide", onHide);
      setRequestWaiting(null);
      // (Into his fight: the server has taken you out of the room already.)
      if (summoning.current) c.stop();
      else c.leave(true);
      livePeople.current = [];
      delete hooks.__hiddenRoom;
    };
  }, [inTop, inside?.n]);
  // (The summoning: no key reaches the room or the town.)
  useLayoutEffect(() => {
    if (!frozen) return;
    const stop = (e: KeyboardEvent) => e.stopImmediatePropagation();
    addEventListener("keydown", stop, true);
    return () => removeEventListener("keydown", stop, true);
  }, [frozen]);

  // (A layout effect: the world's first frame is drawn before the screen first shows.)
  useLayoutEffect(() => {
    /** The town is drawn (its loading screen gone): until then the away clock holds, as under a challenge. */
    let loaded = false;
    /** The town failed (its message shows instead): the away clock runs again, so a player who can't play is dropped as idle, never held present. */
    let broken = false;
    // A guest's town time (Eric, on #542: 30 s, then "make an account"): the town stops under the pop-up; its rooms count too. It starts
    // once the town is drawn (Nov 13: everyone's town has a loading screen now, which can take seconds on a slow phone); a town that
    // fails never starts it.
    const guestMs = guestLimitMs();
    let stopGuest = () => {};
    const startGuest = () => {
      if (guestMs === null || gone.current) return;
      stopGuest = watchGuest(guestMs, () => {
        if (!shopIn.current) t.pause();
        setGated(true);
      });
    };
    const t = startTown(box.current!, canvas.current!, chips.current, cardEl.current!, live.current!, setZoomedOut, setCard, seatOf(seat), (s, face) => {
      const b = TOWN_BOTS[s.bot]!;
      onPlayBot?.({ seat: seatText(s), name: botLabel(b), rating: b.rating, look: isSprite(b.look) ? null : b.look.wear, face });
    }, (id, x, y, challenge) => void goIn(id, x, y, challenge), stand, () => step("cancel"), (share, music) => {
      if (share === null) {
        loaded = true;
        startGuest();
        return setLoading(false);
      }
      if (music) setLoadingMusic(true);
      const bar = loadBar.current;
      if (bar) {
        bar.style.transform = `scaleX(${share})`;
        bar.parentElement!.setAttribute("aria-valuenow", String(Math.round(share * 100)));
      }
    }, (why) => {
      broken = true;
      setLoading(false);
      setBroken(why);
    });
    ctl.current = t;
    // Away (Eric, Nov 7; afk.ts, here-net.ts): the "zzz" over your pawn (the town's and a shop's), out to home after too long, and the
    // beats that put you (and your "zzz") in everyone else's town. A boss's challenge (from the fight to the battle) and the claw
    // machine hold the clock: they aren't idle presence. So does the loading screen (Nov 13: everyone's town has one now).
    const stopAway = watchAway({
      town: t.town,
      shop: () => shopIn.current,
      busy: () => (!loaded && !broken) || flow.current !== "town" || summoning.current || !!shopCtl.current?.busy?.(),
      onState: (st) => void (t.town.you.zzz = st === "zzz"),
      onOut: () => awayOut.current(),
      onOthers: t.others,
    });
    return () => {
      gone.current = true;
      stopGuest();
      stopAway();
      t.stop();
      roomMusic(null);
    };
  }, []);
  const home = card && (card.kind === "boss" || card.kind === "home") ? HOMES[card.i]! : null;
  const people = ctl.current?.town.people;
  // A person's card (a bot's; a real player's), or the bot waiting at a table's (a bot from BOTS: its name and rating).
  const person = card?.kind === "person" ? (people?.[card.i] ?? null) : null;
  const bot = person ? person.bot : card?.kind === "table" && card.bot !== undefined ? people?.[card.bot]?.bot : null;
  // A person's card: a long name or sidekick's line shrinks to fit its row (as the card opens, and again once the web font is in).
  const fitKey = card?.kind === "person" ? card.i : -1;
  useLayoutEffect(() => {
    if (fitKey < 0) return;
    const el = cardEl.current!;
    fitRows(el);
    let live = true;
    void document.fonts?.ready.then(() => live && fitRows(el));
    return () => void (live = false);
  }, [fitKey]);
  // The right column's top slot (a computer's frame): where the town's tools go.
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => setSlot(framed ? document.getElementById(RIGHT_SLOT_TOOLS) : null), [framed]);
  const label = card?.kind === "coliseum" ? COLISEUM_PLACE.name : card?.kind === "table" ? "Chess table" : person ? (bot ? botLabel(bot) : person.name) : home ? (card!.confirm ? (introOf(home.id) ? `Challenge ${home.boss}?` : "Leave the town square?") : card!.kind === "boss" ? figureName(home) : home.name) : undefined;
  /** A boss with an intro: "Fight" on its confirm. You and the boss walk to its door and in (once: a challenge already going is left alone). */
  const fight = (i: number) => {
    if (flow.current !== "town" || doorBusy.current) return;
    if (ctl.current?.challenge(i)) step("fight");
  };

  return (
    <div class={framed ? "town-screen in-frame" : "town-screen"}>
      {/* On a computer (in the frame) the bar is gone (Eric, Nov 7): the map, chat and settings buttons are in the right column's top slot,
          under "TOWN" (FrontMenu.tsx RightPanel), in the town and in its rooms; a room's door card (Go out) and the side menu lead out. */}
      {framed ? (
        <>
          {/* (The page's title stays for screen readers.) */}
          <h1 class="town-sr-title">{inside ? (HOMES.find((h) => h.id === inside.room.def.home)?.name ?? "Town square") : "Town square"}</h1>
          {slot && createPortal(<TownChatTools map mapDisabled={!!inside} />, slot)}
        </>
      ) : (
        <header class="town-bar">
          {/* (Inside a shop, back takes you out to the town square.) */}
          <button type="button" class="town-back" aria-label="Back" onClick={inside ? () => askIfWaiting(() => void goOut()) : () => askLeave(TOWN_BACK_TO, onBack)}>
            ‹
          </button>
          {/* (Inside a shop, the shop's name: "Babur's Circus"; Nov 2. On a computer's narrow header, on up to two smaller lines.) */}
          {inside ? (
            <h1 class="town-shop-name" title={HOMES.find((h) => h.id === inside.room.def.home)?.name}>
              {HOMES.find((h) => h.id === inside.room.def.home)?.name ?? "Town square"}
            </h1>
          ) : (
            <h1>Town square</h1>
          )}
          {/* The chat's icon (its three modes) and the gear (Town settings), at the right end of the same line (on a computer, in the frame: the chat icon beside the title, the gear at the right end). */}
          <TownChatTools map mapDisabled={!!inside} />
        </header>
      )}
      <div class={inside ? "town-box town-inside" : "town-box"} ref={box}>
        <canvas class="town-canvas" ref={canvas} aria-label="The town square" />
        {/* A statue's quote, for screen readers, while you stand up close to it (it's drawn on its pedestal). */}
        <div class="town-sr" ref={live} aria-live="polite" />
        {/* Inside a shop: the room over the town (the town waits, as you left it). */}
        {inside && (
          <inside.View
            key={inside.n ?? 0}
            room={inside.room}
            youArt={() => ctl.current?.youArt() ?? null}
            youRider={() => ctl.current?.youRider() ?? null}
            youName={playerName}
            onZoom={setShopOut}
            onOut={() => askIfWaiting(() => void goOut())}
            onReady={shopReady}
            ctl={shopCtl}
            intro={inside.intro}
            zzz={() => !!ctl.current?.town.you.zzz}
            arrived={!!inside.arrived}
            onPass={(to) => askIfWaiting(() => void goThrough(to))}
            fx={inside.fx ?? null}
            challengeCard={inTop ? <HiddenCard client={hiddenClient()} /> : null}
            onChallenge={() => void challengeHere()}
            canChallenge={canChallengeInside(inside.room.def.home)}
          />
        )}
        {/* The room's name as you walk in (under the cards and chat; taps pass through it). */}
        {inside && banner && <AreaBanner key={banner.n} text={banner} onDone={() => setBanner(null)} />}
        {/* His room's count ("Challengers 2 of 4"), for everyone in it from the start (0 of 4); the summoning's freeze over it all. */}
        {inTop && <HiddenCount client={hiddenClient()} />}
        {frozen && <div class="hb-freeze" aria-hidden="true" />}
        {note && <RoomNote text={note} onOk={() => setNote(null)} />}
        {asking && (
          <LeaveTownConfirm
            dest=""
            request
            onStay={() => setAsking(false)}
            onLeave={() => {
              setAsking(false);
              const go = cancelGo.current;
              cancelGo.current = null;
              // (The cancel's answer first, for a moment at most: just as the fourth joined, it hands you into the fight with the others,
              // the summoning here, instead of out; review m1.)
              void Promise.race([hidden.current?.cancel(), later(HIDDEN_ROOM.pollMs)]).then(() => !summoning.current && go?.());
            }}
          />
        )}
        <div class="town-overlay">
          {/* The chat log, top left (its own file): under the cards; while it shows it takes every touch on its own area (the map under it gets none), faded none; the chips keep off its box (CHAT_BOX). */}
          <TownChat tone={inside?.room.def.chatTone} onSignIn={onSignIn && (() => askLeave("Sign in", onSignIn))} />
          {/* The card: over the boss's head or the home's top, its tail pointing there (placed every frame). Dark, with a gold border
              (Eric's mockup, Oct 28); a person's is one row at one size (`town-person`). */}
          <div class={card?.kind === "person" ? "town-card town-person" : card?.kind === "home" && !card.confirm && home && shopOf(home.id) ? "town-card town-door" : "town-card"} ref={cardEl} role="dialog" aria-label={label} style={{ display: card ? "" : "none" }}>
            {/* A boss with an intro (every boss whose home has an inside, Nov 2: shops/challenge.ts): you fight it in its home, then come back here. */}
            {card && home && card.confirm && introOf(home.id) && (
              <>
                <h2>Challenge {home.boss}?</h2>
                <p class="town-card-text">You'll fight {home.boss} in Boss Battle, then come back here.</p>
                <button type="button" class="town-btn primary" onClick={() => fight(card.i)}>
                  Fight
                </button>
                <button type="button" class="town-btn" onClick={() => ctl.current?.closeCard()}>
                  Stay
                </button>
              </>
            )}
            {card && home && card.confirm && !introOf(home.id) && (
              <>
                <h2>Leave the town square?</h2>
                <p class="town-card-text">You'll fight {home.boss} in Boss Battle.</p>
                <button type="button" class="town-btn primary" onClick={() => onBossAlone?.(home.id)}>
                  Leave
                </button>
                <button type="button" class="town-btn" onClick={() => ctl.current?.closeCard()}>
                  Stay
                </button>
              </>
            )}
            {/* A stand-in (Rolling Dough's guard out front, Nov 11): his name, his line's row (kept, empty until he talks, so nothing moves),
                and Talk: the boss is inside. */}
            {card && home && !card.confirm && card.kind === "boss" && !hasTownBoss(home) && (
              <>
                <h2>{figureName(home)}</h2>
                <p class="town-card-text town-card-line town-stand-in">{card.line ?? "\u00a0"}</p>
                <button type="button" class="town-btn primary" onClick={() => ctl.current?.talk()}>
                  Talk
                </button>
              </>
            )}
            {card && home && !card.confirm && card.kind === "boss" && hasTownBoss(home) && (
              <>
                <h2>{home.boss}</h2>
                {card.line && <p class="town-card-text town-card-line">{card.line}</p>}
                <button type="button" class="town-btn primary" onClick={() => ctl.current?.confirm()}>
                  Challenge alone
                </button>
              </>
            )}
            {/* A home with its inside built (Nov 2: Babur's and Puddles'): its name and "Go in", centered, nothing else (Eric, Nov 2: "chop
                the Shop and Coming soon"); you walk to its door and go in. Hollow Peak's (Nov 3) keeps his line over it, the next each
                time (Eric's approved words, Oct 28): only its Shop and Coming soon went. */}
            {card && home && !card.confirm && card.kind === "home" && shopOf(home.id) && (
              <>
                <h2>{home.name}</h2>
                {card.line && <p class="town-card-text town-card-line">{card.line}</p>}
                <button type="button" class="town-btn primary" onClick={() => ctl.current?.goIn(card.i)}>
                  Go in
                </button>
              </>
            )}
            {/* Every other home: its name (its line, Hollow's), its shop greyed and "Coming soon". */}
            {card && home && !card.confirm && card.kind === "home" && !shopOf(home.id) && (
              <>
                <h2>{home.name}</h2>
                {card.line && <p class="town-card-text town-card-line">{card.line}</p>}
                <button type="button" class="town-btn" disabled>
                  Shop
                </button>
                <div class="town-soon">Coming soon</div>
              </>
            )}
            {/* The Colosseum's: raids with people start here (Eric's menu for them comes later); shown greyed, not hidden. */}
            {card?.kind === "coliseum" && (
              <>
                <h2>{COLISEUM_PLACE.name}</h2>
                <button type="button" class="town-btn" disabled>
                  Raids with people
                </button>
                <div class="town-soon">Coming soon</div>
                {/* The first look inside (Oct 30, Eric: a preview, docs/areas/colosseum.md): /colosseum, its Exit back here. */}
                <a
                  class="town-btn town-look"
                  href="/colosseum"
                  onClick={(e) => {
                    e.preventDefault();
                    onColosseum?.();
                  }}
                >
                  Look inside (preview)
                </a>
              </>
            )}
            {/* A chess table's (no title: Eric, Oct 27): a casual or ranked game of normal chess will start here (the tables'
                matchmaking is the next job); at a table where two others play, watching their game. Shown greyed, not hidden. */}
            {/* A person's (Oct 27, Eric; Oct 28, his mockup): one row at one size, whoever it is. Their picture in a round ring (a
                sidekick's face in blue, a pawn's own look in ivory; a real player's profile icon, in ivory, a button for their
                profile: a bot's picture is no button), their name ("(bot)" in gray after a bot's), a sidekick's line (for a real
                player, whom you can't challenge yet: "Coming soon"), the rating with its bars; and Play with crossed swords: you
                both walk to a free table and the game opens when you sit. Every table taken: Play greyed, reading "Full" (Oct 29,
                Eric: the card his mockup's size; a long name or line shrinks to fit its row, `fitRows`). */}
            {card?.kind === "person" && person && (
              <>
                {person.uid ? (
                  <button type="button" class="town-pic player" aria-label={`View ${person.name}'s profile`} onClick={() => openProfile({ uid: person.uid, name: person.name, you: person.uid === account().profile?.user.id })}>
                    <UserIcon icon={person.icon ?? "♟"} />
                  </button>
                ) : (
                  <div class={bot?.boss ? "town-pic sidekick" : "town-pic pawn"} aria-hidden="true">
                    {card.face && <img src={card.face} alt="" draggable={false} />}
                  </div>
                )}
                <div class="town-who">
                  <h2 class="town-fit">
                    <span class="town-name">{bot ? bot.name : person.name}</span>
                    {bot && <span class="town-bot"> (bot)</span>}
                  </h2>
                  {/* A boss's sidekick (Oct 28): whose, under its name; the row is there for a pawn too (empty). */}
                  <p class="town-sub town-fit">{bot ? sidekickText(bot) : "Coming soon"}</p>
                  <p class="town-rate">
                    <BarsIcon />
                    <span>{bot ? ratingText(bot) : person.rating !== undefined ? ratingLine(person.rating) : ""}</span>
                  </p>
                </div>
                <button
                  type="button"
                  class="town-btn primary town-play"
                  disabled={!bot || card.full}
                  aria-label={card.full ? "Play: tables are full" : undefined}
                  onClick={() => ctl.current?.play()}
                >
                  <SwordsIcon />
                  {card.full ? "Full" : "Play"}
                </button>
              </>
            )}
            {card?.kind === "table" && !card.watch && (
              <>
                {/* A bot waiting alone here: play it, first (Casual and Ranked, the tables' matchmaking, still to come). */}
                {bot && (
                  <button type="button" class="town-btn primary" onClick={() => ctl.current?.playSeated()}>
                    {playAtTableText(bot)}
                  </button>
                )}
                <button type="button" class="town-btn" disabled>
                  Casual
                </button>
                <button type="button" class="town-btn" disabled>
                  Ranked
                </button>
                <div class="town-soon">Coming soon</div>
              </>
            )}
            {card?.kind === "table" && card.watch && (
              <>
                <button type="button" class="town-btn" disabled>
                  Spectate
                </button>
                <div class="town-soon">Coming soon</div>
              </>
            )}
          </div>
          {Array.from({ length: CHIPS }, (_, i) => (
            <div class="town-chip" key={i} ref={(el) => void (chips.current[i] = el)} style={{ display: "none" }}>
              <div class="town-chip-rot">
                <div class="town-chip-arrow" />
              </div>
              <button type="button" class="town-chip-face" onClick={() => ctl.current?.chip(i)}>
                <canvas width={92} height={92} />
              </button>
            </div>
          ))}
        </div>
        {/* The street town's minimap (Nov 5): small at the top right, under the chips and cards; a tap opens it large over everything. Not
            inside a building (it's the town's). */}
        <TownMap hidden={!!inside} faces={() => ctl.current?.mapFaces() ?? []} onHome={(id) => ctl.current?.walkHome(id)} />
        {/* The street town's loading screen (Nov 11): the boss's loading card's look, its bar real progress. */}
        {loading && (
          <div class="boss-loading town-loading" role="status" aria-live="polite">
            <strong class="boss-loading-title">{loadingMusic ? "Loading music…" : "Building the town…"}</strong>
            <span class="boss-loading-bar" role="progressbar" aria-label="Building the town" aria-valuemin={0} aria-valuemax={100} aria-valuenow={0}>
              <i ref={loadBar} />
            </span>
          </div>
        )}
        {/* The street town can't run here or didn't load (Eric, Nov 13: never the old town instead): the loading card's look, a line, and
            Retry when retrying can help. */}
        {broken && (
          <div class="boss-loading town-loading town-broken" role="alert">
            <strong class="boss-loading-title">{broken === "unsupported" ? "Chess Town can't run on this device." : "The town didn't load. Please retry."}</strong>
            {broken === "retry" && (
              <button type="button" class="town-btn" onClick={() => location.reload()}>
                Retry
              </button>
            )}
          </div>
        )}
        {/* The black the town zooms into as you go in, and the room fades in from (and back, going out). */}
        <div class="town-fade" ref={fade} />
        <div class="town-controls">
          {/* The arrow keys (Eric, Nov 4): hold one to walk that way (arrows.ts; the keyboard's arrows and WASD do the same). A press
              is the walk; the key lights while it's held. Inside a shop they walk you in the room. */}
          <div class="town-keys" aria-hidden="true">
            {ARROW_KEYS.map((d) => (
              <div key={d} class={`town-key town-key-${d}`} data-dir={d} onPointerDown={(e) => padPress(e, d, true)} onPointerUp={(e) => padPress(e, d, false)} onPointerCancel={(e) => padPress(e, d, false)} onLostPointerCapture={(e) => padPress(e, d, false)}>
                <svg viewBox="0 0 12 12" aria-hidden="true">
                  <path d={ARROW_CHEVRON[d]} fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </div>
            ))}
          </div>
          <div class="town-hud">
          {/* (Inside a shop the same buttons work the room's camera: Close, or the town's zoomed-in camera.) */}
          <div class="town-zoom">
            <button type="button" aria-label="Zoom out" aria-pressed={inside ? shopOut : zoomedOut} onClick={() => (inside ? shopCtl.current?.zoom(true) : ctl.current?.zoom(true))}>
              −
            </button>
            <button type="button" aria-label="Zoom in" aria-pressed={inside ? !shopOut : !zoomedOut} onClick={() => (inside ? shopCtl.current?.zoom(false) : ctl.current?.zoom(false))}>
              +
            </button>
          </div>
          {/* The focus button (Eric, Oct 28: "replace with circular focus icon"): a ring, four ticks and a dot, a map's locate-me;
              still named "Back to me", and still brings the camera back to you. */}
          <button type="button" class="town-recenter" aria-label="Back to me" onClick={() => (inside ? shopCtl.current?.recenter() : ctl.current?.recenter())}>
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <circle cx="12" cy="12" r="6.2" fill="none" stroke="currentColor" stroke-width="2" />
              <path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
              <circle cx="12" cy="12" r="2.1" fill="currentColor" />
            </svg>
          </button>
          </div>
        </div>
      </div>
      {/* A guest's town time is up (Eric, on #542): the app's sheet over the town; Sign up is the app's own sign-in, Back goes home.
          A device the age gate marked too young can't make an account: Sign up greyed, and why. */}
      {gated && (
        <div class="fd-sheet-scrim town-gate-scrim">
          <div class="fd-sheet town-gate" role="alertdialog" aria-modal="true" aria-labelledby="town-gate-title" aria-describedby="town-gate-text">
            <div class="fd-sheet-head">
              <h2 id="town-gate-title">{GATE_TITLE}</h2>
            </div>
            <p class="fd-sub" id="town-gate-text">
              {tooYoung() ? GATE_YOUNG : GATE_FREE}
            </p>
            <FdButton primary disabled={tooYoung()} onClick={() => (onSignIn ?? onBack)()}>
              Sign up
            </FdButton>
            <FdButton onClick={onBack}>Back</FdButton>
          </div>
        </div>
      )}
    </div>
  );
}

export const GATE_TITLE = "Make an account to keep exploring";
export const GATE_FREE = "It's free.";
export const GATE_YOUNG = "Accounts are for players 13 and older.";

/** The on-screen arrows: their directions, and their chevrons (12 × 12, the stroke in the key's color). */
const ARROW_KEYS: readonly Dir[] = ["up", "left", "down", "right"];
const ARROW_CHEVRON: Readonly<Record<Dir, string>> = { up: "M2.8 7.6 6 4.4l3.2 3.2", down: "M2.8 4.4 6 7.6l3.2-3.2", left: "M7.6 2.8 4.4 6l3.2 3.2", right: "M4.4 2.8 7.6 6 4.4 9.2" };
/** A press on an on-screen arrow holds its direction until it's let go (the pointer is captured, so a slide off it still ends it). */
function padPress(e: PointerEvent, d: Dir, down: boolean): void {
  if (down) {
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    e.preventDefault();
  }
  hold(d, down);
}

/** Your look as the town dresses you (dress(), readyYou): what's drawn (an outfit, Nov 10: only it and any eyewear, the outfit by the
 * rides' machinery: core's shownLook, mountOf), your ride, your pawn's color and the key your pictures are made for. */
function yourLook() {
  const look = shownLook(account().profile?.locker?.look);
  const color = myPawnColor();
  const side: "light" | "dark" = color === "black" ? "dark" : "light";
  return { on: mountOf(look), color, side, key: `${side}|${lookKey(look)}`, wear: offRide(look) };
}
/**
 * A pawn's dressed picture, and (`riding`: its ride has a back view) the same seen from behind, its face items left off (Nov 1,
 * rides v2, the director's call: from behind a face item doesn't show, a hat does).
 */
const dressed = (wear: ItemLook | null, plain: HTMLCanvasElement, riding: boolean, side: "w" | "b" = "w"): Promise<[YouArt | null, YouArt | null]> => {
  const front = dressedPawn(wear, plain, PAWN_PX, side);
  if (!riding || !wear?.face) return front.then((a) => [a, a]);
  return Promise.all([front, dressedPawn(offFace(wear), plain, PAWN_PX, side)]);
};
/**
 * A rider (rides.ts) for a pawn wearing `ride`: its dressed picture (or the plain pawn) on it, and from behind (`back`), shared
 * with anyone whose pawn looks the same (`pawnKey`: its side, tint and items); `done` once it's ready. Null if it isn't a ride.
 */
const ride = (on: NonNullable<ItemLook["ride"]>, art: YouArt | null, back: YouArt | null, plain: HTMLCanvasElement, side: "w" | "b", pawnKey: string, done: (rd: Rider) => void): Rider | null => {
  const ra = rideArt(on.def);
  const bare: RiderPawn = { img: plain, pad: 0, top: PAWN_HEAD - 0.75 / 45 };
  const colors = { color: on.color, color2: secondColor(on) ?? on.color, side };
  return ra ? shareRider(ra, colors, pawnKey, art ?? bare, back ?? art ?? bare, done) : null;
};
/** Your pawn made ready before the town shows (readyYou): its dressed pictures and its rider (a share of it held), for its look's key. */
let prepared: { key: string; art: YouArt | null; back: YouArt | null; rider: Rider | null } | null = null;

/**
 * Your pawn made ready before the town shows (Eric, Nov 10: "a big bug happens every town load, your rider doesnt appear for a few
 * seconds"): its dressed pictures, and its rider's frames composed in one go (rides.ts `hurry`; one an animation frame took 1.5 to
 * 2 s), so the town's first frame has you on your ride. `ready` once they are, or after TOWN_FEEL.youWaitMs (the town then shows
 * with you on foot, and the ride appears the moment it's ready); `done` gives back what the town didn't take (TownPage, as it closes).
 */
export function readyYou(): { ready: Promise<void>; done: () => void } {
  const { on, color, side, key, wear } = yourLook();
  const plain = pawnImage(side, null);
  let over = false;
  let mine: typeof prepared = null;
  const ready = new Promise<void>((go) => {
    setTimeout(go, TOWN_FEEL.youWaitMs);
    void dressed(wear, plain, !!on, sideOfPawn(color)).then(([art, back]) => {
      if (over) return go();
      const rider = on ? ride(on, art, back, plain, sideOfPawn(color), `${side}||${lookKey(wear)}`, () => go()) : null;
      rider?.hurry();
      prepared = mine = { key, art, back, rider };
      if (!rider) go();
    });
  });
  return {
    ready,
    done: () => {
      over = true;
      if (prepared !== mine || !mine) return;
      prepared = null;
      if (mine.rider) leaveRider(mine.rider);
    },
  };
}

/** Runs the world in `box` on `cv`: the loop, the camera, the input and the chips. Returns its controls and its stop. */
function startTown(
  box: HTMLDivElement,
  cv0: HTMLCanvasElement,
  chipEls: (HTMLDivElement | null)[],
  cardEl: HTMLDivElement,
  liveEl: HTMLDivElement,
  onZoom: (out: boolean) => void,
  onCard: (c: Card | null) => void,
  seat: Seat | null,
  onPlay: (seat: Seat, face: string | null) => void,
  onGoIn: (id: HomeId, x: number, y: number, challenge: boolean) => void,
  /** Back from a boss's challenge: where you stood (you start there). */
  stand: Stand | null = null,
  /** A boss's challenge called off on the way to its door (a tap elsewhere walked you away). */
  onChallengeOff: () => void = () => {},
  /** The loading screen's progress (0 to 1; `music`: its "Loading music…" step), then null once the town is loaded (`loadTown`). */
  onLoading: (share: number | null, music?: boolean) => void = () => {},
  /** The street town can't run here (no WebGL 2), or didn't load again after its reload (gl-fail.ts): the town's box says so. */
  onFail: (why: TownBroken) => void = () => {},
) {
  const f = TOWN_FEEL;
  /** The world's canvas (a new one if the street town's WebGL fails as it starts: a canvas keeps the first kind of context it gave). */
  let cv = cv0;
  // The drawing (paint.ts): today's town with Canvas 2D; the street town with WebGL 2 only (Nov 6). The street town never falls back to
  // today's town (Eric, Nov 13, a standing rule: docs/rules/eric.md; gl-fail.ts). No WebGL 2: "Chess Town can't run on this device." Its
  // WebGL failing as it starts (no context, or its shader fails), or its context lost and not back within LOST_WAIT_MS of the page showing
  // (a loss while hidden waits), reloads the street town once; failing again soon after, "The town didn't load. Please retry." with Retry
  // (`onFail`). A lost context: nothing is drawn until it's back. Each page reports its failure once (problems.ts, `reportTownFallback`:
  // nothing shows; never on the frame loop; what's waiting goes as the page is hidden): its reason, or `retry` when it gives up.
  let failed = false;
  const fail = (why: TownGlFallback) => {
    if (failed) return;
    failed = true;
    loss.stop();
    if (why === "no-webgl2") {
      reportTownFallback(why);
      return onFail("unsupported");
    }
    if (afterFail() === "message") {
      reportTownFallback("retry");
      return onFail("retry");
    }
    reportTownFallback(why);
    const u = new URL(location.href);
    u.pathname = "/town";
    location.replace(u.href);
  };
  const loss = lossWatch(() => painter.lost, () => document.hidden, LOST_WAIT_MS, () => alive && fail("not-back"));
  const onLost = (lost: boolean) => {
    loss.changed();
    if (!lost && alive && !failed) draw(performance.now());
  };
  const makePainter = (): Painter => {
    const p = painterGL(cv, onLost);
    if (typeof p !== "string") return shim(p);
    fail(p);
    // (Until the page goes, or under the message: Canvas 2D on a new canvas, as this one may have given a WebGL context before failing.
    // No frames run: `run` checks `failed`.)
    const n = cv.cloneNode() as HTMLCanvasElement;
    cv.replaceWith(n);
    cv = n;
    return painter2d(cv);
  };
  /**
   * (Tests) The pixel reads the town's specs make (`canvas.getContext("2d").getImageData(…)`) work on a WebGL canvas too:
   * its "2d" gives the last frame's pixels, drawn again at once (same moment, same camera) and read right after the draw.
   * Only with the test switches on; otherwise a WebGL canvas has no "2d", as always.
   */
  const shim = (p: Painter): Painter => {
    const c = cv as unknown as { getContext: (type: string, o?: unknown) => unknown };
    const own = c.getContext.bind(c);
    c.getContext = (type: string, o?: unknown) => (type === "2d" && painter === p && testSwitchesAllowed() ? pixelReader : own(type, o));
    return p;
  };
  const pixelReader = {
    getImageData: (x: number, y: number, w: number, h: number) => {
      if (!painter.lost) r.draw(drawnAt, camX, camY, zoomCur, 0);
      return painter.pixels(x, y, w, h);
    },
  };
  const painter: Painter = makePainter();
  cv.dataset.backend = painter.kind;
  const town = createTown(performance.now(), undefined, seat, undefined, stand);
  /** (Its speech, for the loading's end: loadTown's `town` is a share.) */
  const speech = town.speech;
  /** The world itself (the loader below names its share of the bar `town`). */
  const world = town;
  const r = new Renderer(painter, town, HOMES);
  // The arrow keys (arrows.ts): hold one and you walk that way, on squares you can stand on and nobody's (the walker's own check).
  // (The street town's turning camera, Nov 5, round 3: the keys go through its heading, so up is always up the screen.)
  const turned = { dc: 0, dr: 0 };
  const keys = keyWalk(
    town.you.walker,
    (c, r) => walkable(c, r) && !taken(town, c, r, town.you.walker),
    wrapI,
    (c, r, dc, dr) => {
      // (Round 4's chase camera: through the way you faced as the hold began, so a held left or right turns you once and runs on.
      // keyWalk has turned `dr` by the walker's rowsUp (#502): 1 in the town, so it's still up the screen here.)
      screenStep(dc, dr, keyQuarter, turned);
      // (Off the world past the north or south edge: a row of -1, which no one stands on.)
      return { c: colI(c + turned.dc), r: rowI(r + turned.dr) };
    },
  );
  const keyEls = [...box.querySelectorAll<HTMLElement>(".town-key")];
  const paintKeys = () => {
    for (const el of keyEls) el.classList.toggle("on", isHeld(el.dataset.dir as Dir));
  };
  const stopKeys = listenKeys();
  const offHeld = onHeld(paintKeys);
  // (An arrow's press locks a snapped look round in first, so its step goes by the new base heading, not the old one's.)
  const offQuarter = onHeld(() => {
    const b = lockIn(turn, look, performance.now());
    if (b !== null) base = b;
    keyQuarter = quarterOf(turn.to);
  });
  // (The signs' pixel font is the game's own; it's loaded on first use, so ask for it now.)
  void document.fonts?.load('8px "Press Start 2P"').catch(() => {});
  // The bosses' sounds for a tap on one, made ahead off the page's thread (the sound worker), so a tap never costs a frame.
  warmSounds([...Object.values(SELECT_SOUND), ...Object.values(TOWN_SOUNDS).flat()]);
  /** How often each boss has been tapped (its town sounds go in turn); how often each home's card (its boss's or its own) has opened (its lines go in turn). */
  const taps = new Map<string, number>();
  const opens = new Map<string, number>();
  // (On you: back from a game with a bot, you're at its table.)
  let camX = town.you.walker.c;
  let camY = town.you.walker.r;
  /**
   * The street town's turning camera (Nov 5, round 3; turn.ts): north everywhere but Seam Avenue, east there, turning in its crossings
   * as you walk (the square you're on says which), eased; a chip's glide turns it to where it glides. Today's town: always north.
   */
  const turn = new Turn(0);
  let heading = turn.to;
  /** (The street town's keys: the quarter you faced as the keys held changed.) */
  let keyQuarter = 0;
  /** (Round 5) A drag's look round, on top of the normal heading (north, or a home's strip's). */
  const look = new LookAround();
  /**
   * The base heading (Nov 5, brief-street-controls-map.md): the normal heading off a home's strip, north, east, south or west. A look round
   * snapped to a quarter and locked in by any way of setting off (a tap, a run, an arrow: turn.ts lockIn) sets it. North as the town
   * opens and as you come out of a building (`resume`); a strip's turn leaves it alone (stepping off goes back to it).
   */
  let base = 0;
  /** (Tests) The heading held (the turn's stills), or null. */
  let pinHeading: number | null = null;
  let follow = true;
  /** The camera's speed while it follows you (squares a second): the spring's state. */
  let vx = 0;
  let vy = 0;
  let glide: { x: number; y: number } | null = null;
  // The street town's zoom (round 4, zoom-steps.ts): steps, and the park's step out; zoomCur is its step there (0 in .. 3 the overview).
  const startSq = town.you.walker.here();
  const sz = new StreetZoom(f.streetStartZoomedOut ? f.streetZoomStart + 1 : f.streetZoomStart, parkSide(startSq.c, startSq.r) !== false);
  let zoomCur = sz.step;
  let zoomTarget = zoomCur;
  // The sky by the device's clock, read about once a minute; `?sky=day|dawn|dusk|night` holds one look (for Eric, tests).
  const pinned = skyOverride(new URLSearchParams(location.search).get("sky"));
  const clock = (): SkyWeights => {
    const d = new Date();
    return skyWeights(d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60);
  };
  let sky = pinned ?? clock();
  let skyAt = performance.now();
  r.setSky(sky);
  // Your pawn as your profile shows it (your crate items), drawn again only when your look or your default pawn color changes
  // (pawn-color.ts); plain meanwhile. On your ride if you wear one (Oct 31): its frames with you on them composed once (rides.ts),
  // the last ones kept until they're ready.
  let youLook: string | null = null;
  const dress = () => {
    const { on, color, side, key, wear } = yourLook();
    if (key === youLook) return;
    youLook = key;
    town.you.look = { side, tint: null, wear: null };
    // (Your ride's pace, Nov 1: Cheetah Shoes walk twice as fast; RIDES.speed. As the look is put on, before its frames are ready.)
    town.you.walker.stepMs = f.youStepMs / rideSpeed(on?.def);
    // (The ride drawn now stays drawn until the new one's frames are ready; then it's given back. One share of a rider each.)
    const mount = (art: YouArt | null, back: YouArt | null) => {
      const prev = youRide;
      youRide = on
        ? ride(on, art, back, pawnImage(side, null), sideOfPawn(color), `${side}||${lookKey(wear)}`, (rd) => {
            if (rd !== youRide || !alive) return;
            if (youShown && youShown !== rd) leaveRider(youShown);
            youShown = r.youRider = rd;
          })
        : null;
      if (prev && (prev !== youShown || prev === youRide)) leaveRider(prev);
      // (Its frames on their way, the drawing's chunk first: you walk on foot meanwhile, in its box, under its tag.)
      r.youSoon = youRide;
      // (Its frames already composed, as the town opens (readyYou): drawn from this frame on, not the next.)
      if (youRide?.ready && youShown !== youRide) {
        if (youShown) leaveRider(youShown);
        youShown = r.youRider = youRide;
      }
      if (!youRide) {
        if (youShown) leaveRider(youShown);
        youShown = r.youRider = null;
      }
    };
    // (Made ready before the town showed, readyYou: in its first frame. Its share of the rider given back once mount has its own.)
    const pre = prepared?.key === key ? prepared : null;
    if (pre) {
      prepared = null;
      r.youArt = pre.art;
      mount(pre.art, pre.back);
      if (pre.rider) leaveRider(pre.rider);
    } else if (!lookKey(wear)) {
      r.youArt = null;
      mount(null, null);
    } else
      void dressed(wear, pawnImage(side, null), !!on, sideOfPawn(color)).then(([art, back]) => {
        if (youLook !== key || !alive) return;
        r.youArt = art;
        mount(art, back);
      });
  };
  /** The rider your look asked for last (its frames may still be coming), and the one drawn now: each holds a share. */
  let youRide: Rider | null = null;
  let youShown: Rider | null = null;
  /** Someone else's pawn (a bot, the test player; real players later) as the square draws it, made once: its items, its ride. */
  const dressPerson = (p: Person) => {
    const lk = p.look;
    if (isSprite(lk) || !lk.wear) return;
    const plain = pawnImage(lk.side, lk.tint);
    const shown = shownLook(lk.wear);
    const on = mountOf(shown);
    const wear = offRide(shown);
    // (Its pace on its ride, as yours: Cheetah Shoes twice a bot's.)
    p.walker.stepMs = TOWN_FEEL.botStepMs / rideSpeed(on?.def);
    const mount = (art: YouArt | null, back: YouArt | null) => {
      const rd = on && ride(on, art, back, plain, lk.side === "dark" ? "b" : "w", `${lk.side}|${lk.tint ?? ""}|${lookKey(wear)}`, (rd) => alive && r.riders.set(p.id, rd));
      // (Its frames on their way: on foot meanwhile, in its rider's box.)
      if (rd && alive) r.ridersSoon.set(p.id, rd);
    };
    if (!lookKey(wear)) mount(null, null);
    else
      void dressed(wear, plain, !!on, lk.side === "dark" ? "b" : "w").then(([art, back]) => {
        if (!alive) return;
        if (art) r.botArt.set(p.id, art);
        mount(art, back);
      });
  };
  const offAccount = onAccountChange(dress);
  dress();
  // The testers' crowd (`?crowd=N`, up to CROWD_MAX: N more pawns with names wandering the square, to measure the frame
  // rate with many figures). Anyone's (Eric, Oct 30: the site is behind Cloudflare Access): only this device draws them.
  const crowdN = Math.min(CROWD_MAX, Math.floor(TOWN_ASKED.crowd) || 0);
  if (crowdN > 0) {
    addCrowd(town, crowdN);
    cv.dataset.crowd = String(crowdN);
  }
  // The bots' dressed pawns, drawn once now (their crate items over their pawns), never per frame; plain meanwhile. (The
  // sidekicks' frames are cut from their sheets as the renderer is made.)
  for (const p of town.bots) dressPerson(p);
  // `/town?fps`, anyone's (Eric, Oct 30: no admin needed, the site is behind Cloudflare Access): a pill in the world's top-right
  // corner, "60 fps · 16.7 ms", frames over the last second and their mean time, the text set twice a second. Plain counters in
  // the frame loop, nothing else.
  // (FpsCount, frame-report.ts: a room's frames count too, Nov 11.)
  let fpsEl: HTMLElement | null = null;
  let fps: FpsCount | null = null;
  if (TOWN_ASKED.fps) {
    fpsEl = document.createElement("div");
    fpsEl.className = "town-fps";
    fpsEl.dataset.fps = "";
    // (The backend follows the numbers, "· WebGL" or "· 2D", from town.css: the pill's text stays the numbers.)
    fpsEl.dataset.backend = BACKEND_LABEL[painter.kind];
    cv.parentElement?.append(fpsEl);
    setFps((fps = new FpsCount(fpsEl)));
  }
  // `/town?report`, anyone's, as `?fps` (Eric, Nov 11): the frame report (frame-report.ts). Every frame of a run recorded from your
  // first move, for 30 s or until Done, then one panel to screenshot. Without `?report` there's no recorder: the marks are null checks.
  const rec = TOWN_ASKED.report ? new FrameRec() : null;
  setRec(rec);
  let recPill: ReturnType<typeof reportPill> | null = null;
  let recPanel: HTMLElement | null = null;
  if (rec) {
    const host = cv.parentElement!;
    const timer = timerStep();
    recPill = reportPill(host, () => rec.finish());
    recPill.set("Report: walk or turn to start", false);
    // (The pill's seconds, once a second, from whichever loop records: the town's or a room's. Nov 11, Eric: "?report is pausing when
    // I run into the building": they were set by the town's frames alone, so inside a room the pill stood still.)
    rec.onSec = (sec) => recPill?.set(`● Recording ${sec} s`, true);
    rec.onDone = () => {
      recPill?.set("Report ready", false);
      setRec(null);
      const dev: Device = { browser: browserOf(navigator.userAgent), ratio: window.devicePixelRatio || 1, drawn: r.DPR, w: cv.width, h: cv.height, backend: `${BACKEND_LABEL[painter.kind]}${TOWN_ASKED.back2d ? " (rooms 2D)" : ""}`, timer };
      recPanel = reportPanel(
        host,
        summarize(rec.run),
        dev,
        () => {
          recPanel?.remove();
          recPanel = null;
          rec.again();
          setRec(rec);
          recPill?.set("Report: walk or turn to start", false);
        },
        () => {
          recPanel?.remove();
          recPanel = null;
        },
      );
    };
  }
  /** The game with a bot has been asked for (once). */
  let opened = false;
  let raf = 0;
  let last = performance.now();
  let alive = true;
  /** (Tests, `__townHold`) The frame loop held: the last frame stays, and nothing moves. */
  let held = false;
  /** The loading screen is up (`loadTown`): no frames yet. */
  let loading = painter.kind === "webgl";
  /** Inside a shop: the town waits as you left it (no frames, nothing moves) until you come out. */
  let away = false;
  /** A home's "Go in" sent you to its door (its index in HOMES; -1: none): you go in once you stand there. */
  let goingIn = -1;
  /**
   * A boss's challenge (shops/challenge.ts): the boss walking to its door with you (its index in the bosses; -1: none), and where you
   * stood as you challenged it (the battle's "Back to town" brings you back there).
   */
  let challenging = -1;
  let challengeStand: Stand | null = null;
  /** Calls a challenge off on the town's side: its boss is let go (it roams again, at its own pace). */
  const endChallenge = () => {
    const b = town.bosses[challenging];
    if (b) {
      b.held = false;
      b.walker.stepMs = f.bossStepMs;
    }
    if (challenging >= 0) town.you.walker.stepMs = f.youStepMs / rideSpeed(mountOf(shownLook(account().profile?.locker?.look))?.def);
    challenging = -1;
  };
  /** When the last frame was drawn (its `now`). */
  let drawnAt = performance.now();
  let ready = false;
  let youKey = "";
  /** The open card (also in the screen's state, which draws it), and its size once laid out (NaN: measure it). */
  let card: Card | null = null;
  let cardW = NaN;
  let cardH = NaN;
  /** Where the card was last placed (its corner, its tail's place; NaN: write them): written only when they move, as the chips' are. */
  let cardX = NaN;
  let cardY = NaN;
  let cardA = NaN;
  const chipPlace: (Place | null)[] = chipEls.map(() => null);
  // ---- The close-up on a statue: which (its index in STATUES; -1: none, also once the glide out ends), whether the
  // camera is gliding in (or out), how far (0 to 1, linear in time), and a tap on a statue that sent you walking (the
  // close-up comes when you stop). The quote: ms since it began to render in (-1: not showing), and how much is left as
  // you leave. Only the world's camera moves: the HUD stays put.
  let closeOn = -1;
  let closeIn = false;
  let closeT = 0;
  let pending = -1;
  let wasMoving = false;
  let quoteMs = -1;
  let quoteLeft = 1;
  const enterClose = (i: number) => {
    closeOn = i;
    closeIn = true;
    follow = true;
    glide = null;
  };
  /** Back out to the zoom you had (− and + set their own as well). */
  const leaveClose = () => {
    pending = -1;
    if (closeOn < 0 || !closeIn) return;
    closeIn = false;
    liveEl.textContent = "";
  };
  const stepClose = (dt: number) => {
    const moving = town.you.walker.moving();
    if (wasMoving && !moving) {
      // You stopped: on a statue's square, or where a tap on a statue sent you.
      const h = town.you.walker.here();
      const st = statueAt(h.c, h.r);
      const i = st ? STATUES.indexOf(st) : pending;
      pending = -1;
      if (i >= 0) enterClose(i);
    }
    wasMoving = moving;
    if (closeOn >= 0) {
      closeT = Math.max(0, Math.min(1, closeT + ((closeIn ? 1 : -1) * dt * 1000) / f.closeGlideMs));
      if (!closeIn && closeT === 0) closeOn = -1;
    }
    // The quote renders in once the camera has arrived, and fades as you leave.
    if (closeIn && closeT === 1) {
      if (quoteMs < 0) {
        quoteMs = 0;
        liveEl.textContent = STATUES[closeOn]!.quote;
      } else quoteMs += dt * 1000;
      quoteLeft = 1;
    } else if (quoteMs >= 0) {
      quoteLeft -= (dt * 1000) / f.quoteOutMs;
      if (quoteLeft <= 0) ((quoteMs = -1), (quoteLeft = 1));
    }
    const c = r.close;
    c.i = closeOn;
    c.e = closeT * closeT * (3 - 2 * closeT);
    c.quoteMs = quoteMs;
    c.quoteLeft = quoteLeft;
  };
  const chipXY = chipEls.map(() => ({ x: NaN, y: NaN, a: NaN }));

  /** Sizes the canvas to its box; true if it changed. (Setting a canvas's size clears it, even to the same size.) */
  const resize = () => {
    const rc = box.getBoundingClientRect();
    const W = Math.max(1, rc.width);
    const H = Math.max(1, rc.height);
    const DPR = Math.min(2, window.devicePixelRatio || 1);
    if (W === r.W && H === r.H && DPR === r.DPR) return false;
    cv.width = Math.round(W * DPR);
    cv.height = Math.round(H * DPR);
    cv.style.width = `${W}px`;
    cv.style.height = `${H}px`;
    r.resize(W, H, DPR);
    // The buttons' box, in the world's pixels: the chips keep off it.
    const ctl = box.querySelector(".town-controls")?.getBoundingClientRect();
    if (ctl) Object.assign(r.keepClear, { x: ctl.left - rc.left, y: ctl.top - rc.top, w: ctl.width, h: ctl.height });
    return true;
  };
  // A resize runs after the frame's drawing (before its paint) and clears the canvas: draw again at once, so no frame
  // shows it blank.
  const ro = new ResizeObserver(() => {
    if (resize()) draw(performance.now());
  });
  ro.observe(box);
  resize();

  const updateCamera = (dt: number, now: number) => {
    if (glide) {
      const k = 1 - Math.exp(-f.glideRate * dt);
      camX += wrapFX(glide.x - camX) * k;
      camY += wrapFY(glide.y - camY) * k;
      if (Math.hypot(wrapFX(glide.x - camX), wrapFY(glide.y - camY)) < 0.03) glide = null;
    } else if (follow) {
      // A critically damped spring toward your pawn (or, up close, the statue's square), solved exactly for the frame
      // (steady at any frame rate).
      const p = town.you.walker.pose(now, POSE);
      if (closeOn >= 0 && closeIn) ((p.x = STATUES[closeOn]!.c), (p.y = STATUES[closeOn]!.r));
      const w = f.followSpring;
      const e = Math.exp(-w * dt);
      const x = wrapFX(camX - p.x);
      const y = wrapFY(camY - p.y);
      const jx = vx + w * x;
      const jy = vy + w * y;
      camX = p.x + (x + jx * dt) * e;
      camY = p.y + (y + jy * dt) * e;
      vx = (vx - w * jx * dt) * e;
      vy = (vy - w * jy * dt) * e;
    }
    if (!follow || glide) vx = vy = 0;
    // (Kept near the world's middle so the numbers never grow, however far you walk round.)
    camX = START.c + wrapFX(camX - START.c);
    camY = START.r + wrapFY(camY - START.r);
    // The street town's one view (round 5; Eric: "There should be one view point no matter what, always"): north, but on a boss home's
    // strip, facing its front (strips.ts), eased either way; walking, the arrows and taps never turn it. A drag's look round goes on top
    // (LookAround), eased back as you set off.
    const h = town.you.walker.here();
    turn.aim(nearestTurn(baseHeading(h.c, h.r, base), turn.to), now);
    // (Any way of setting off locks a snapped quarter in, the base heading; with nothing snapped, your first step eases the view back.)
    if (town.you.walker.moving()) {
      const b = lockIn(turn, look, now);
      if (b !== null) base = b;
      else look.back(now);
    }
    heading = pinHeading ?? turn.at(now) + look.at(now);
  };

  const draw = (now: number, dt = 0) => {
    drawnAt = now;
    if (!painter.lost) r.draw(now, camX, camY, zoomCur, dt, heading);
    placeChips();
    placeCard();
    const h = town.you.walker.here();
    const key = `${h.c},${h.r}`;
    if (key !== youKey) cv.dataset.you = youKey = key;
    const sit = seated(town.you) ? "1" : "0";
    if (cv.dataset.sit !== sit) cv.dataset.sit = sit;
    if (!ready) cv.dataset.ready = String(+(ready = true));
  };

  const frame = (now: number) => {
    raf = 0;
    if (!alive || failed) return;
    REC?.begin(now);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    {
      // (The park's step out as you come fully into it, back as you leave: zoom-steps.ts.)
      const h = town.you.walker.here();
      sz.where(parkSide(h.c, h.r), now);
      zoomCur = sz.at(now);
      if (zoomTarget !== sz.step) onZoom((zoomTarget = sz.step) > f.streetZoomStart);
    }
    town.you.name = playerName();
    if (!pinned && now - skyAt > f.skyCheckMs) {
      skyAt = now;
      const w = clock();
      if (!sameWeights(w, sky)) r.setSky((sky = w));
    }
    // (A press held still past the hold time: a run, street town only.)
    if (press.hold(performance.now())) startRun(performance.now());
    keysWalk();
    tick(town, now);
    // A bot's card: whether a table is free for you both, to grey its Play (checked only while one is open: no search).
    if (card?.kind === "person" && town.people[card.i]!.bot) {
      const full = !anyTableFree(town, town.people[card.i]!);
      if (full !== !!card.full) setCard({ ...card, full });
    }
    // You and the bot both sit at the table: the game opens (the town closes).
    if (town.meet && !opened && meetReady(town)) {
      const s = meetSeat(town);
      if (s) {
        opened = true;
        onPlay(s, r.spriteFace(town.meet.bot));
      }
    }
    // At a shop's door after its "Go in": the town zooms in on the door and you go in (TownScreen's goIn).
    if (goingIn >= 0 && !town.you.walker.moving()) {
      const h = HOMES[goingIn]!;
      goingIn = -1;
      const at = { x: r.W / 2, y: r.H / 2 };
      r.squareAt(h.entry.c, h.entry.r, at);
      onGoIn(h.id, at.x, at.y, challenging >= 0);
    }
    stepClose(dt);
    updateCamera(dt, now);
    REC?.mark(P.logic);
    draw(now, dt);
    REC?.mark(P.chips);
    // (The minimap's dots: you and the way the camera faces; a transform only when they move. minimap.ts.)
    {
      const y = town.you.walker.pose(now, POSE);
      mapFrame(y.x, y.y, heading);
    }
    const rc = REC;
    if (rc) {
      rc.mark(P.minimap);
      rc.end(town.you.walker.moving(), heading, zoomCur);
    }
    FPS?.tick(now);
    raf = requestAnimationFrame(frame);
  };
  /** The frames start again. `gap`: after a pause (a hidden tab, a test's hold): the recorder and the pill start afresh. Back from a
   * room (`resume`) they don't: the room's frames led up to this one, and its time is seen. */
  const run = (gap = true) => {
    if (raf || !alive || failed || document.hidden || held || away || loading) return;
    if (gap) {
      rec?.pause();
      FPS?.restart();
    }
    last = performance.now();
    raf = requestAnimationFrame(frame);
  };
  const halt = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };
  const onVisibility = () => {
    loss.changed();
    if (document.hidden) halt();
    else run();
  };
  document.addEventListener("visibilitychange", onVisibility);

  // ---- The chips: moved only when they move; a boss's face drawn into its chip when the chip changes home.
  function placeChips() {
    for (let i = 0; i < chipEls.length; i++) {
      const el = chipEls[i];
      if (!el) continue;
      const c = r.chips[i]!;
      if (c.place !== chipPlace[i]) {
        chipPlace[i] = c.place;
        el.style.display = c.place ? "" : "none";
        if (!c.place) el.querySelector("button")!.removeAttribute("aria-label");
        else {
          el.style.setProperty("--town-chip", c.place.color);
          const face = el.querySelector("button")!;
          face.setAttribute("aria-label", `Go to ${c.place.name}`);
          const { img, box } = r.chipFace(c.place);
          drawFace(face.querySelector("canvas")!, img, box);
          chipXY[i]!.x = chipXY[i]!.a = NaN; // (placed below: NaN is never "close enough")
        }
      }
      if (!c.place) continue;
      const xy = chipXY[i]!;
      if (!(Math.abs(xy.x - c.x) <= 0.3 && Math.abs(xy.y - c.y) <= 0.3)) {
        el.style.transform = `translate3d(${c.x.toFixed(1)}px, ${c.y.toFixed(1)}px, 0)`;
        xy.x = c.x;
        xy.y = c.y;
      }
      if (!(Math.abs(xy.a - c.angle) <= 0.5)) {
        (el.firstElementChild as HTMLElement).style.transform = `rotate(${c.angle.toFixed(1)}deg)`;
        xy.a = c.angle;
      }
    }
  }

  // ---- The card: open, its confirm, closed; placed over what it's about every frame.
  /**
   * A bot's picture for its card, made once as the card opens (never in the frame loop): a sidekick's face (`spriteFace`, its idle's
   * first frame), a pawn's own look as it stands in the square (its crate items on, the dressed art `botArt`; the plain pawn until that's
   * made), cut to what's drawn.
   */
  const faceOf = (p: Person): string | null => (isSprite(p.look) ? r.spriteFace(p) : pawnFace(r.botArt.get(p.id)?.img ?? pawnImage(p.look.side, p.look.tint)));
  /** The person a card holds still: a person's own, or the bot waiting at a table's. */
  const heldBy = (c: Card | null): Person | null => (c?.kind === "person" ? town.people[c.i]! : c?.kind === "table" && c.bot !== undefined ? town.people[c.bot]! : null);
  function setCard(c: Card | null) {
    // A boss's card opening: it says something (Eric, Oct 27), once a tap (its confirm opening is the same card).
    if (c?.kind === "boss" && !(card?.kind === "boss" && card.i === c.i) && hasTownBoss(HOMES[c.i]!)) {
      const id = HOMES[c.i]!.id;
      const n = taps.get(id) ?? 0;
      taps.set(id, n + 1);
      const sound = townSound(id, n);
      if (sound) play(sound);
    }
    // A boss's or a home's card opening (not its confirm): its line this time, the next in turn (only Hollow's has lines).
    if (c && (c.kind === "boss" || c.kind === "home") && !(card && card.kind === c.kind && card.i === c.i)) {
      const id = HOMES[c.i]!.id;
      const n = opens.get(id) ?? 0;
      const line = townLine(id, n);
      if (line) ((c = { ...c, line }), opens.set(id, n + 1));
    } else if (c && card && c.kind === card.kind && c.i === card.i && card.line && c.line === undefined) c = { ...c, line: card.line };
    // A person's card opening: a sidekick waves, once (Oct 28), and its picture is made, once (kept while the card stays: `full` changing
    // sets the card again).
    if (c?.kind === "person" && !(card?.kind === "person" && card.i === c.i)) {
      const who = town.people[c.i]!;
      who.waved = performance.now();
      if (who.bot) c = { ...c, face: faceOf(who) };
    } else if (c?.kind === "person" && card?.kind === "person" && card.face !== undefined) c = { ...c, face: card.face };
    if (card?.kind === "boss") town.bosses[card.i]!.held = false;
    const was = heldBy(card);
    if (was && town.hold === was && town.meet?.bot !== was) holdBot(town, null);
    const holds = heldBy(c);
    if (holds) holdBot(town, holds);
    // A table's card closing: you stand up (you stay on the stool's square).
    if (card?.kind === "table" && c?.kind !== "table") town.you.sit = false;
    card = c;
    // (A boss stays where it is while its card is open, so you can walk up to it.)
    if (c?.kind === "boss") town.bosses[c.i]!.held = true;
    cardW = cardH = cardX = cardY = cardA = NaN;
    onCard(c);
  }
  const A = { x: 0, y: 0 };
  function placeCard() {
    if (!card) return;
    if (Number.isNaN(cardW)) {
      if (cardEl.style.display === "none") return; // (drawn next time round)
      cardW = cardEl.offsetWidth;
      cardH = cardEl.offsetHeight;
    }
    if (!r.anchor(card.kind === "boss" ? "boss" : card.kind === "table" ? "table" : card.kind === "person" ? "person" : "home", card.i, A)) {
      cardEl.style.visibility = "hidden";
      return;
    }
    cardEl.style.visibility = "";
    const left = Math.max(8, Math.min(r.W - cardW - 8, A.x - cardW / 2));
    const top = Math.max(8, Math.min(r.H - cardH - 8, A.y - cardH - 14));
    // (Written only when it has moved: a card over someone standing still writes nothing, and a change to `--ax`, which every
    // part of the card inherits, would make the browser work out the card's styles again every frame.)
    if (!(Math.abs(left - cardX) < 0.05 && Math.abs(top - cardY) < 0.05)) {
      cardEl.style.transform = `translate3d(${left.toFixed(1)}px, ${top.toFixed(1)}px, 0)`;
      cardX = left;
      cardY = top;
    }
    // (The tail keeps 20 px from the card's ends: its point is 14 px wide at the base, the corners round at 14.)
    const ax = Math.max(20, Math.min(cardW - 20, A.x - left));
    if (!(Math.abs(ax - cardA) < 0.05)) {
      cardEl.style.setProperty("--ax", `${ax.toFixed(1)}px`);
      cardA = ax;
    }
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "Escape") return;
    if (card) setCard(null);
    else leaveClose();
  };
  addEventListener("keydown", onKey);

  // ---- Input: a finger presses the square you'd walk to (press.ts); one that moves is a drag (look around); in the street town, one
  // held still past `streetHoldMs` is a run (run.ts), steered by the finger, which never turns the camera.
  const press = new Press(f.dragPx, f.streetHoldMs);
  /** The finger's run (the street town): the arrows' direction it holds. */
  const finger = new FingerRun();
  /** Where the press's finger is now (client px). */
  const fingerAt = { x: 0, y: 0 };
  const steerPose = { x: 0, y: 0, hop: 0, tilt: 0, step: false, t: 0 };
  const steerQ = { dx: 0, dz: 0 };
  const steerAt = newPt();
  const steerRest = newPt();
  /**
   * The finger steers the run: the way from your pawn's middle on screen to the finger, snapped to up, down, left or right of the normal
   * view (the arrows'), held as an arrow is. Within `streetRunDeadPx` of your pawn, the way it had. Your pawn as it stands still: where
   * the last frame drew it, less its lead on the camera (running, the camera's follow lets it get up to about a square ahead on screen;
   * steering from there would feed the run's own lead back into its way, and a finger near it would flip it back and forth).
   */
  const steer = () => {
    const rc = box.getBoundingClientRect();
    const b = r.drawnBox(0);
    let x = b ? (b.x0 + b.x1) / 2 : r.W / 2;
    let y = b ? (b.y0 + b.fy) / 2 : r.H * 0.6;
    // (Your pose as the last frame drew it, with that frame's camera: on a slow frame the walk has gone on since.)
    const pose = town.you.walker.pose(drawnAt, steerPose);
    rel(r.view, camX, camY, pose.x, pose.y, steerQ);
    if (proj(r.view, steerQ.dx, steerQ.dz, 0, steerAt) && proj(r.view, 0, 0, 0, steerRest)) {
      x -= steerAt.x - steerRest.x;
      y -= steerAt.y - steerRest.y;
    }
    finger.steer(fingerAt.x - rc.left - x, fingerAt.y - rc.top - y, f.streetRunDeadPx);
  };
  /**
   * A press held still became a run (Eric, Nov 5: "if you hold it in the direction … right away … it starts running"): the pressed square
   * lets go, a snapped look round is locked in (the new base heading: the camera stays), and you run the way the finger is.
   */
  const startRun = (now: number) => {
    if (closing) return;
    r.release(now, false);
    leaveClose();
    const b = lockIn(turn, look, now);
    if (b !== null) base = b;
    steer();
  };
  /** The drag's start: the pointer, the camera, and pixels per square across and along. */
  let drag: { id: number; x: number; y: number; cx: number; cy: number; kx: number; ky: number } | null = null;
  /** This press only closes the open card (a tap anywhere else closes it, as in the prototype). */
  let closing = false;
  /** What the press's finger went down on (a tap a busy frame took for a run walks to it: press.ts). */
  let downHit: Hit | null = null;
  const local = (e: PointerEvent) => {
    const rc = box.getBoundingClientRect();
    return { x: e.clientX - rc.left, y: e.clientY - rc.top };
  };
  /** What a tap on `hit` means: its key (the same thing at down and up), where you'd walk, and the card it opens. */
  const plan = (hit: Hit | null): { key: string; dest: Sq | null; card: Card | null; statue: number } | null => {
    if (!hit) return null;
    let target: Target;
    let key: string;
    let c: Card | null = null;
    let statue = -1;
    if (hit.kind === "statue") {
      // A statue: to its square (the close-up when you stop there). No card: its quote is on its pedestal.
      key = `statue:${hit.statue.id}`;
      target = { kind: "statue", statue: hit.statue };
      statue = STATUES.indexOf(hit.statue);
    } else if (hit.kind === "coliseum" || (hit.kind === "square" && onColiseum(hit.c, hit.r))) {
      // The Colosseum (its picture or its ground): to the apron at its gate, and its card.
      key = "coliseum";
      target = { kind: "coliseum" };
      c = { kind: "coliseum", i: HOMES.length, confirm: false };
    } else if (hit.kind === "table" || (hit.kind === "square" && (tableAt(hit.c, hit.r) || stoolAt(hit.c, hit.r)))) {
      // A chess table (or one of its stools): to its nearest free stool, to sit; and its card.
      const table = hit.kind === "table" ? hit.table : (tableAt(hit.c, hit.r) ?? stoolAt(hit.c, hit.r))!;
      key = `table:${table.i}`;
      target = { kind: "table", table };
      const wb = waitingBot(town, table);
      c = { kind: "table", i: table.i, confirm: false, watch: tableStates(town.people)[table.i]!.kind === "playing", ...(wb ? { bot: town.people.indexOf(wb) } : {}) };
    } else if (hit.kind === "square") {
      // (Nov 12, Eric: "more grace": its plot, or the row right in front of a home (its door's), is that home, by its door: homeNear.)
      const home = homeNear(hit.c, hit.r);
      key = home ? `home:${home.id}` : `sq:${hit.c},${hit.r}`;
      target = home ? { kind: "home", home } : { kind: "square", c: hit.c, r: hit.r };
      if (home) c = { kind: "home", i: HOMES.indexOf(home), confirm: false };
    } else if (hit.kind === "house") {
      key = `home:${hit.home.id}`;
      target = { kind: "home", home: hit.home };
      c = { kind: "home", i: HOMES.indexOf(hit.home), confirm: false };
    } else if (hit.kind === "boss") {
      key = `boss:${hit.boss.home.id}`;
      target = { kind: "beside", at: hit.boss.walker.here() };
      c = { kind: "boss", i: town.bosses.indexOf(hit.boss), confirm: false };
    } else {
      if (hit.person.you) return null;
      key = `p:${hit.person.id}`;
      target = { kind: "beside", at: hit.person.walker.here() };
      // A bot: its card (its picture, name, rating and Play), and it stops while it's open.
      // (A real player's too, once they walk in the town: Oct 28, only the test player has an account id.)
      if (hit.person.bot || hit.person.uid) c = { kind: "person", i: town.people.indexOf(hit.person), confirm: false, full: !!hit.person.bot && !anyTableFree(town, hit.person) };
    }
    return { key, dest: destFor(town, town.you.walker, target), card: c, statue };
  };
  /**
   * What a tap at (x, y) in the box lands on. Your own pawn takes no tap (a tap on it does nothing), but standing at a home's foot it
   * hides the door (Eric, Nov 12): a tap on you over a home (its picture, plot or foot row: `homeNear`) is that home's.
   */
  const pickTap = (x: number, y: number): Hit | null => {
    const hit = r.pick(x, y);
    if (hit?.kind !== "person" || !hit.person.you) return hit;
    const under = r.pick(x, y, true);
    return under?.kind === "house" || (under?.kind === "square" && homeNear(under.c, under.r)) ? under : hit;
  };
  /** Any walk of yours, a tap or the arrow keys: it stands you up, calls off a game you were walking to with a bot and a way into a shop. */
  const walkOff = () => {
    cancelMeet(town);
    goingIn = -1;
    if (challenging >= 0) {
      endChallenge();
      onChallengeOff();
    }
    town.you.sit = false;
  };
  // The arrow keys set off: as a tap walk does, the card closes, the camera follows you and the walk stands you up. Held, the walker
  // runs on (keys.start: each frame while it stands still; the walk itself asks for each next square).
  let keysOn = false;
  /** The place the held arrows last ran you into (its card asked once a hold): "" none. */
  let keysAsked = "";
  /**
   * (Eric, Nov 5: "if I use the arrow keys and you run up to a building, it should also ask you if you want to enter".) Standing
   * still with one arrow held against a home's plot (or the Colosseum's ground): its card opens, once a hold, as a tap on it would.
   */
  const keysAsk = () => {
    if (town.you.walker.moving()) return;
    const dc = (isHeld("right") ? 1 : 0) - (isHeld("left") ? 1 : 0);
    const dr = (isHeld("up") ? 1 : 0) - (isHeld("down") ? 1 : 0);
    if ((dc === 0) === (dr === 0)) return;
    const h = town.you.walker.here();
    // (Through the street town's normal heading, never a look round's: up is the normal view's up.)
    screenStep(dc, dr, quarterOf(turn.to), turned);
    const c = colI(h.c + turned.dc);
    const rr = rowI(h.r + turned.dr);
    if (c < 0 || rr < 0) return;
    const home = plotAt[rr * N + c];
    const next: Card | null = home ? { kind: "home", i: HOMES.indexOf(home), confirm: false } : onColiseum(c, rr) ? { kind: "coliseum", i: HOMES.length, confirm: false } : null;
    const key = next ? `${next.kind}:${next.i}` : "";
    if (next && key !== keysAsked && !card) setCard(next);
    keysAsked = key;
  };
  const keysWalk = () => {
    if (!anyHeld()) {
      keysOn = false;
      keysAsked = "";
      return;
    }
    if (!keysOn) {
      keysOn = true;
      leaveClose();
      walkOff();
      if (card) setCard(null);
      follow = true;
      glide = null;
      if (town.you.walker.moving()) town.you.walker.go([]);
    }
    keys.start();
    keysAsk();
  };
  /**
   * When the pointer's event happened (its timeStamp, on performance.now()'s clock), not when it's handled: a slow frame holds a move back,
   * and the hold time must not turn a drag that started at once into a run (or a quick tap into one).
   */
  const evAt = (e: PointerEvent) => {
    const t = performance.now();
    return e.timeStamp > 0 && e.timeStamp <= t ? e.timeStamp : t;
  };
  const onDown = (e: PointerEvent) => {
    // (The street town: a mouse's left button only, for a tap, a look round and a run alike.)
    if (e.pointerType === "mouse" && e.button !== 0) return;
    // (A new press ends a run a finger left going.)
    finger.stop();
    cv.setPointerCapture?.(e.pointerId);
    fingerAt.x = e.clientX;
    fingerAt.y = e.clientY;
    // Pixels per square at the focus point, across and along (for the drag).
    const v = r.view;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, cx: camX, cy: camY, kx: v.kf, ky: Math.max(8, rowSpan(r)) };
    closing = !!card;
    const now = evAt(e);
    if (closing) return press.down(e.clientX, e.clientY, "", now);
    const xy = local(e);
    downHit = pickTap(xy.x, xy.y);
    const p = plan(downHit);
    if (p?.dest) r.pressSquare(p.dest.c, p.dest.r);
    press.down(e.clientX, e.clientY, p?.dest || p?.card ? p.key : "", now);
  };
  const onMove = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    fingerAt.x = e.clientX;
    fingerAt.y = e.clientY;
    const was = press.gesture();
    if (!press.move(e.clientX, e.clientY, evAt(e))) {
      const now = performance.now();
      // A run (held still past the hold time; a move that comes in late starts it too): the finger steers, the camera never turns.
      if (press.running()) {
        if (was !== "run") startRun(now);
        else if (!closing) steer();
      }
      return;
    }
    if (was === "press") {
      // Past the threshold: the square lets go (no pulse, no walk) and you look around.
      r.release(performance.now(), false);
      leaveClose();
      // (The street town, round 5: a drag turns the camera about your pawn, which stays put and keeps facing its way.)
      look.grab(performance.now());
      glide = null;
    }
    look.drag(e.clientX - drag.x, r.W);
  };
  const onUp = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    drag = null;
    const now = performance.now();
    // (Letting go of a look round: in the street town, within `streetSnapDeg` of a quarter it eases there and is snapped, LookAround.)
    look.release(now, turn.to);
    // (Letting go of a run: you stop at the next square.)
    finger.stop();
    // (The release's own time: a frame that ran while a quick tap's release waited in the queue made it a run, and this says it was a tap.)
    const at = evAt(e);
    if (closing) {
      if (press.up("", at) !== "drag") setCard(null);
      return;
    }
    const xy = local(e);
    let p = plan(pickTap(xy.x, xy.y));
    const was = press.gesture();
    const res = press.up(p ? p.key : "", at);
    // (A tap a busy frame took for a run, press.ts: its finger never moved, the run's camera did. It taps what it pressed.)
    if (was === "run" && res === "walk") p = plan(downHit);
    if (res !== "walk" || !p) {
      if (res === "cancel") r.release(now, false);
      return;
    }
    // (A tap a busy frame took for a run: the run let its square go; it presses again, to pulse as you set off.)
    if (was === "run" && p.dest) r.pressSquare(p.dest.c, p.dest.r);
    // Released on the same thing: the border pulses once and you set off (no sound, no vibration: Eric).
    r.release(now, true);
    // (A tap's walk after a look round snapped to a quarter locks it in: the new base heading, the camera staying where it is.)
    if (p.dest) {
      const b = lockIn(turn, look, now);
      if (b !== null) base = b;
    }
    // A tap on anything but the statue you're looking at walks you away from it: the camera glides back out.
    if (p.statue < 0 || p.statue !== closeOn) leaveClose();
    // You sit when a tap on a table sent you to its stool; any other walk stands you up (walkOff).
    walkOff();
    town.you.sit = p.card?.kind === "table";
    if (p.dest && walkWalker(town.you.walker, p.dest)) {
      follow = true;
      glide = null;
      if (p.statue >= 0) {
        if (town.you.walker.moving()) pending = p.statue;
        else enterClose(p.statue); // (already standing there)
      }
    }
    if (p.card) setCard(p.card);
  };
  const onCancel = () => {
    drag = null;
    look.release(performance.now(), turn.to);
    finger.stop();
    press.cancel();
    r.release(performance.now(), false);
  };
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    setZoom(e.deltaY > 0);
  };
  function attach() {
    cv.addEventListener("pointerdown", onDown);
    cv.addEventListener("pointermove", onMove);
    cv.addEventListener("pointerup", onUp);
    cv.addEventListener("pointercancel", onCancel);
    cv.addEventListener("wheel", onWheel, { passive: false });
  }
  function detach() {
    cv.removeEventListener("pointerdown", onDown);
    cv.removeEventListener("pointermove", onMove);
    cv.removeEventListener("pointerup", onUp);
    cv.removeEventListener("pointercancel", onCancel);
    cv.removeEventListener("wheel", onWheel);
  }
  attach();

  function setZoom(out: boolean) {
    leaveClose();
    zoomTarget = sz.press(out, performance.now());
    onZoom(zoomTarget > f.streetZoomStart);
  }

  // A test hook (e2e, with the test switches on: test-switches.ts): where to tap a boss, a home or the Colosseum (its gate)
  // now, in the box.
  const hookAt = (kind: "boss" | "home" | "coliseum" | "statue" | "table" | "lamp" | "light" | "bot" | "player" | "square" | "tap-square", id?: HomeId | StatueId | "coliseum" | number | string | readonly [number, number]) => {
    const out = { x: 0, y: 0 };
    if (kind === "square") return testSwitchesAllowed() && Array.isArray(id) && r.squareAt(id[0]!, id[1]!, out) ? out : null;
    // (Round 4: where a tap on the square reaches it, clear of whatever stands over its middle on screen.)
    if (kind === "tap-square") return testSwitchesAllowed() && Array.isArray(id) && r.tapSquareAt(id[0]!, id[1]!, out) ? out : null;
    if (kind === "player") return testSwitchesAllowed() && r.tapPoint("person", town.people.findIndex((p) => p.uid === id), out) ? out : null;
    if (kind === "bot") return testSwitchesAllowed() && r.tapPoint("person", town.people.findIndex((p) => p.bot === TOWN_BOTS[Number(id)]), out) ? out : null;
    if (kind === "table") return testSwitchesAllowed() && r.tapPoint("table", Number(id), out) ? out : null;
    if (kind === "lamp") return testSwitchesAllowed() && r.lampAt(Number(id), out) ? out : null;
    if (kind === "light") return testSwitchesAllowed() && r.lightAt(id === "coliseum" ? HOMES.length : HOMES.findIndex((h) => h.id === id), out) ? out : null;
    if (kind === "statue") return testSwitchesAllowed() && r.tapPoint("statue", STATUES.findIndex((s) => s.id === id), out) ? out : null;
    const i = kind === "coliseum" ? HOMES.length : HOMES.findIndex((h) => h.id === id);
    // (A home not in this town, Timber's in a player's: nowhere.)
    if (i < 0) return null;
    return testSwitchesAllowed() && r.tapPoint(kind === "boss" ? "boss" : "home", i, out) ? out : null;
  };
  // ... `__townCam()`: the camera now: its zoom (0 in, 1 out), its lens (1: none; more up close), where it looks (the
  // focus square), the statue it's close on (null: none), how far its glide has come, and its quote; the street town's heading, the
  // figures drawn and the boxes' draws.
  const hookCam = () =>
    testSwitchesAllowed()
      ? {
          zoom: zoomCur,
          zoomTarget,
          // (Round 5: the normal heading (north, or a home's strip's) and a drag's look round on top.)
          headingBase: turn.to,
          strip: stripAt(town.you.walker.hereC(), town.you.walker.hereR())?.home ?? null,
          look: look.at(performance.now()),
          // (Nov 5: the base heading, a quarter a let-go snapped to (null: none), the press's gesture and the run's held way.)
          base,
          snapped: look.snapped,
          gesture: press.gesture(),
          run: finger.dir,
          // (Your pawn as the last frame drew it: the finger's run is steered from its middle.)
          you: r.drawnBox(0),
          // (The street town: its zoom step's memory in the park: the step you had coming in, null if none.)
          parkBefore: sz.before,
          mag: r.lensMag,
          focus: [camX, camY],
          statue: closeOn >= 0 ? STATUES[closeOn]!.id : null,
          close: closeT,
          closingIn: closeIn,
          quote: quoteMs >= 0,
          // The statue up close: its drawn box (top and bottom, as shares of the world's box) and its quote's letters' height.
          box: closeOn >= 0 ? [r.statueBox[closeOn]!.y0 / r.H, r.statueBox[closeOn]!.y1 / r.H] : null,
          cap: r.quoteCap,
          // The street town's heading (degrees from north; 90 east) as the last frame drew it, and where it's turning to.
          heading,
          headingTo: turn.to,
          // Every figure drawn in the last frame (bosses, you, the bots): its box on screen and how strongly it showed (Eric, Nov 4:
          // whole on screen at rest).
          figures: r.figureBoxes(),
          // (Round 4: the horizon's height in the box, px; the sky over it, the street below.)
          horizon: r.view.hy,
          // The street town's boxes drawn in the last frame.
          boxes: r.boxDraws(),
          // The boss whose speech bubble is up (null: none): drawn over the world, so a pixel check of the world quiets it (`__townHush`).
          speech: town.speech.boss?.home.id ?? null,
          // (The line in that bubble, "" for none: a boss's goodbye on the way back from its battle, Eric, Nov 7.)
          speechLine: town.speech.boss ? town.speech.line : "",
        }
      : null;
  // ... and `__townGather()` sends the three bots nearest you to stand beside you (to see a ring form).
  const hookGather = () => {
    if (!testSwitchesAllowed()) return;
    const me = town.you.walker.here();
    const near = town.bots.filter((b) => !b.home).sort((a, b) => tdist(a.walker.here(), me) - tdist(b.walker.here(), me)).slice(0, 3);
    for (const b of near) {
      const to = destFor(town, b.walker, { kind: "beside", at: me });
      if (to) walkWalker(b.walker, to);
    }
  };
  // ... `__townSeat(i, n)` sends the n (1 or 2) bots nearest table i to sit on its stools (the west one first) and holds
  // every bot where it is from then on (a game or a wait that stays put for the test); `__townTables()` each table's state.
  const hookSeat = (i: number, n: 1 | 2) => {
    if (!testSwitchesAllowed()) return;
    town.nextBotAt = Infinity;
    const table = TABLES[i]!;
    const on = (b: (typeof town.bots)[number], sq: Sq) => {
      const h = b.walker.here();
      return h.c === sq.c && h.r === sq.r;
    };
    // Its first n stools: each one nobody stands on gets the nearest bot not sitting anywhere.
    const free = town.bots.filter((b) => !b.home && !seated(b) && !b.walker.moving()).sort((a, b) => tdist(a.walker.here(), table) - tdist(b.walker.here(), table));
    for (const sq of table.stools.slice(0, n)) {
      if (town.bots.some((b) => on(b, sq))) continue;
      const b = free.shift();
      if (!b) return;
      b.sit = true;
      walkWalker(b.walker, sq);
    }
  };
  const hookTables = () => (testSwitchesAllowed() ? tableStates(town.people).map((s) => (s.kind === "waiting" ? `waiting:${s.free}` : s.kind)) : null);
  // ... `__townCall(i)`: the bot TOWN_BOTS[i] walks to stand beside you (out from home first, if it's there), and every bot holds
  // still from then on (to tap it);
  // `__townBots()`: each bot (TOWN_BOTS' order): its name, its square ("c,r"), the table it sits at (-1: none), whether it walks.
  const hookCall = (i: number) => {
    if (!testSwitchesAllowed()) return;
    town.nextBotAt = Infinity;
    town.leave = null;
    const b = town.bots.find((p) => p.bot === TOWN_BOTS[i]);
    if (b?.home) comeOut(town, b, performance.now(), 3);
    if (b) stayOut(b);
    const to = b && destFor(town, b.walker, { kind: "beside", at: town.you.walker.here() });
    if (b && to) walkWalker(b.walker, to);
  };
  const hookBots = () =>
    testSwitchesAllowed()
      ? TOWN_BOTS.map((bt) => {
          const p = town.bots.find((q) => q.bot === bt)!;
          const h = p.walker.here();
          const now = performance.now();
          const d = homeDoor(bt);
          // (The turns, Oct 28: on its way home, where it's headed, fading out or in, its door, whether it stands in the square, its place in the queue home.)
          const fading = p.home ? null : p.leaves < Infinity ? "out" : now - p.came < f.botFadeMs ? "in" : null;
          return { name: p.name, at: `${h.c},${h.r}`, table: seated(p)?.i ?? -1, moving: p.walker.moving(), home: p.home, anim: isSprite(p.look) ? spriteAnim(p, now) : null, going: p.going, trip: p.trip && `${p.trip.c},${p.trip.r}`, fading, door: `${d.c},${d.r}`, inSquare: inSquare(h.c, h.r), queue: town.homeQueue.indexOf(p) };
        })
      : null;
  // ... `__townBossBack(id)`: that home's boss walks round behind its home (the square two rows past its middle, or the
  // nearest free one) and stays there, so nothing of it stands in front of the home's doorway (its picture's box is wide).
  // True once it stands there (call it again to ask).
  const hookBossBack = (id: HomeId): boolean => {
    if (!testSwitchesAllowed()) return false;
    const b = town.bosses.find((x) => x.home.id === id);
    if (!b) return false;
    if (!b.held) {
      b.held = true;
      // (The street town: to its rest square, the end of its box away from its door; nothing can stand behind a home there.)
      const to = spotNear(town, b.walker, b.home.wander ? b.home.rest : { c: b.home.cx, r: b.home.cy + 2 }, false);
      if (to) walkWalker(b.walker, to);
    }
    return !b.walker.moving();
  };
  // ... `__townGlide(id)`: the camera glides to a home as its chip would glide it (to tap a home far off: Hollow Peak);
  // `__townGlide([c, r])`: to look at that square (to measure the frame rate at a spot).
  const hookGlide = (id: HomeId | readonly [number, number]) => {
    if (!testSwitchesAllowed()) return;
    if (typeof id !== "string") {
      follow = false;
      glide = { x: camX + wrapFX(id[0] - camX), y: camY + wrapFY(id[1] - camY) };
      return;
    }
    const h = HOMES.find((x) => x.id === id);
    if (!h) return;
    follow = false;
    glide = { x: camX + wrapFX(h.cx - camX), y: camY + wrapFY(h.cy - h.foot + 0.5 - f.glideAhead - camY) };
  };
  // ... `__townTags()`: the name tags drawn in the last frame: name, kind ("you", "bot", "sidekick"), alpha, pill and ink colors, and
  // where the pill is on the screen (Oct 28: they show only near you unless Town settings says "Everyone"; a sidekick's is blue).
  const hookTags = () => (testSwitchesAllowed() ? r.tagList() : null);
  // ... `__townTurns(ms)`: the bots' turns every `ms` instead of a minute, the next one now (to watch one go home and another come out).
  const hookTurns = (ms: number) => {
    if (!testSwitchesAllowed()) return;
    town.turnMs = ms;
    town.nextTurnAt = 0;
  };
  // ... `__townPlayer(uid, name, icon?, rating?, wear?)`: a test player (a pawn with an account id: a real player's card, whose picture
  // opens their profile) stands still beside you, wearing `wear` (crate items, a ride: as others see a player); answers its index in
  // the people. The real town has no players yet.
  const hookPlayer = (uid: string, name: string, icon?: string, rating?: number, wear?: ItemLook): number => {
    if (!testSwitchesAllowed()) return -1;
    const i = addTestPlayer(town, { uid, name, icon, rating, wear });
    dressPerson(town.people[i]!);
    return i;
  };
  // ... `__townFull(on)`: someone unseen on one stool of every table (no table free for you and a bot: its card's Play greys), or not.
  const hookFull = (on: boolean) => testSwitchesAllowed() && fillTables(town, on);
  // ... `__townRide()` (Oct 31, rides): yours (its ride, color and size (Nov 1), whether its frames are ready, as the last frame drew it: "idle" or
  // "move" ("" on foot), the frame, which way it faced; your box, foot and head on screen, your square; Nov 1, `coming`: the ride whose
  // frames are on their way, its drawing loading or its frames being composed, while you walk on foot in its box) and each other rider's.
  /** (Tests) Where you stand (your square, the way you face) and whether you're walking: a boss's challenge brings you back here. */
  // ... `__townHere()`: the real players in the town (here-net.ts) and you: each one's account id, name, square, whether they're
  // still here (not left), their "zzz" as told, and whether the last frame drew one over them.
  const hookHere = () => {
    if (!testSwitchesAllowed()) return null;
    const drawn = new Set(r.zzzList());
    const tagged = new Set(r.tagList().map((t) => t.who));
    return town.people
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => p.remote || p.you)
      .map(({ p, i }) => ({
        uid: p.uid ?? null,
        you: p.you,
        name: p.name,
        at: [p.walker.hereC(), p.walker.hereR()],
        here: !p.home,
        zzz: !!p.zzz,
        drawn: drawn.has(i),
        // (What they wear as the town has it, and whether the renderer has their dressed picture: drawn in it, not a plain pawn.)
        look: isSprite(p.look) ? null : p.look.wear ? Object.fromEntries(Object.entries(p.look.wear).map(([k, v]) => [k, v?.def])) : null,
        // (Their default pawn color, as drawn: "white" or "black"; null for a sprite.)
        pawn: isSprite(p.look) ? null : p.look.side === "dark" ? "black" : "white",
        dressed: r.botArt.has(p.id) || r.riders.has(p.id),
        tag: tagged.has(i),
      }));
  };
  const hookYou = () => (testSwitchesAllowed() ? { ...standOf(town.you.walker), moving: town.you.walker.moving(), way: [town.you.walker.wdc, town.you.walker.wdr] } : null);
  // ... `__townWalk([c, r])`: you walk to that square (or the free one nearest it) as a tap on it would, the camera following (to measure
  // the frame rate walking a set route, Nov 5). True if there's a way.
  const hookWalk = (sq: readonly [number, number]) => {
    if (!testSwitchesAllowed()) return false;
    follow = true;
    glide = null;
    return walkYou(town, { kind: "square", c: wrapI(sq[0]), r: wrapI(sq[1]) });
  };
  // ... `__townHeading(deg | null)` (the street town's turn, Nov 5, round 3): the camera faces `deg` from north and stays so (the turn's
  // stills: its middle frame), or (null) turns as you walk again.
  const hookHeading = (deg: number | null) => {
    if (!testSwitchesAllowed()) return;
    pinHeading = deg;
  };
  const hookRide = () => {
    if (!testSwitchesAllowed()) return null;
    const you = town.people.indexOf(town.you);
    const h = town.you.walker.here();
    const rd = r.youRider;
    return {
      you: { ride: rd?.id ?? null, color: rd?.color ?? null, scale: rd?.scale ?? null, ready: !!rd?.ready, coming: r.youSoon?.coming ? r.youSoon.id : null, ...r.youRide, box: r.drawnBox(you), at: [h.c, h.r], stepMs: town.you.walker.stepMs, marks: r.marksShown() },
      others: [...r.riders].map(([id, x]) => ({ id, ride: x.id, color: x.color, scale: x.scale, ready: x.ready, box: r.drawnBox(town.people.findIndex((p) => p.id === id)), stepMs: town.people.find((p) => p.id === id)?.walker.stepMs ?? null })),
      // (Sets of rider frames held, shared by riders who look the same.)
      held: ridersHeld(),
    };
  };
  // ... `__townHold(on)`: the frame loop stops (the last frame stays, nothing moves) or goes on; `__townPaint()`: the backend, the last
  // frame's draw calls (WebGL's; 0 for Canvas 2D) and whether its context is lost.
  const hookHold = (on: boolean) => {
    if (!testSwitchesAllowed()) return;
    held = on;
    if (on) halt();
    else run();
  };
  // ... `__townBench(n)`: the held frame drawn again n times in a row, in ms a draw (the drawing's own cost, the same frame for
  // either backend: nothing moves, nothing new to make).
  const hookBench = (n: number) => {
    if (!testSwitchesAllowed() || painter.lost) return null;
    r.draw(drawnAt, camX, camY, zoomCur, 0);
    const t0 = performance.now();
    for (let i = 0; i < n; i++) r.draw(drawnAt, camX, camY, zoomCur, 0);
    return (performance.now() - t0) / n;
  };
  // ... `__townHush(on)`: the bosses' speech bubbles stop (the one up goes at once) or start again, so a pixel check sees the world alone.
  const hookHush = (on: boolean) => {
    if (!testSwitchesAllowed()) return;
    town.speech.boss = null;
    town.speech.next = on ? Infinity : 0;
  };
  // ... `__townStill()`: no bot sets off from now on (the bots' source and their turns paused, as `__townSeat` and `__townCall` do);
  // the walks under way end (`__townBots()`' moving), so a test can measure what the world's walkers would otherwise nudge.
  const hookStill = () => {
    if (!testSwitchesAllowed()) return;
    town.nextBotAt = Infinity;
  };
  // ... `__townReport()` (`?report`): the recorder's state ("wait", "rec", "done"; null without `?report`), the frames so far, and once
  // done the panel's summary (frame-report.ts summarize).
  const hookReport = (raw = false) => {
    if (!testSwitchesAllowed() || !rec) return null;
    const u = rec.run;
    const n = u.n;
    return {
      state: rec.state,
      frames: n,
      summary: rec.state === "done" ? summarize(u) : null,
      // (raw: every frame's numbers, for a measurement script.)
      raw: raw ? { total: [...u.total.subarray(0, n)], part: [...u.part.subarray(0, n * NP)], flags: [...u.flags.subarray(0, n)], turn: [...u.turn.subarray(0, n)], ups: [...u.ups.subarray(0, n)], bakes: [...u.bakes.subarray(0, n)] } : null,
    };
  };
  const hookPaint = () => {
    if (!testSwitchesAllowed()) return null;
    const p = painter as Painter & { uploads?: number; resets?: number; stats?: () => unknown };
    return { backend: painter.kind, drawCalls: painter.drawCalls, lost: painter.lost, uploads: p.uploads ?? 0, resets: p.resets ?? 0, atlas: p.stats?.() ?? null, loading, loadMs, loadPaintMs, loadMusicMs };
  };
  /** (Tests, the stills) What a tap at (x, y) in the box would do now: its key ("home:alfil", "sq:c,r", …), where you'd walk, its card's kind. */
  const hookPick = (x: number, y: number) => {
    if (!testSwitchesAllowed()) return null;
    const p = plan(pickTap(x, y));
    return p ? { key: p.key, dest: p.dest, card: p.card?.kind ?? null } : null;
  };
  const hooks = window as unknown as { __townPick?: typeof hookPick; __townFull?: typeof hookFull; __townPlayer?: typeof hookPlayer; __townTurns?: typeof hookTurns; __townGlide?: typeof hookGlide; __townAt?: typeof hookAt; __townGather?: typeof hookGather; __townCam?: typeof hookCam; __townSeat?: typeof hookSeat; __townTables?: typeof hookTables; __townCall?: typeof hookCall; __townBots?: typeof hookBots; __townBossBack?: typeof hookBossBack; __townTags?: typeof hookTags; __townHold?: typeof hookHold; __townPaint?: typeof hookPaint; __townBench?: typeof hookBench; __townWalk?: typeof hookWalk; __townRide?: typeof hookRide; __townYou?: typeof hookYou; __townHeading?: typeof hookHeading; __townHush?: typeof hookHush; __townStill?: typeof hookStill; __townHere?: typeof hookHere; __townReport?: typeof hookReport };
  hooks.__townAt = hookAt;
  hooks.__townPick = hookPick;
  hooks.__townGlide = hookGlide;
  hooks.__townGather = hookGather;
  hooks.__townCam = hookCam;
  hooks.__townSeat = hookSeat;
  hooks.__townTables = hookTables;
  hooks.__townCall = hookCall;
  hooks.__townBots = hookBots;
  hooks.__townTurns = hookTurns;
  hooks.__townPlayer = hookPlayer;
  hooks.__townFull = hookFull;
  hooks.__townBossBack = hookBossBack;
  hooks.__townTags = hookTags;
  hooks.__townHold = hookHold;
  hooks.__townPaint = hookPaint;
  hooks.__townBench = hookBench;
  hooks.__townWalk = hookWalk;
  hooks.__townHeading = hookHeading;
  hooks.__townHush = hookHush;
  hooks.__townStill = hookStill;
  hooks.__townRide = hookRide;
  hooks.__townYou = hookYou;
  hooks.__townHere = hookHere;
  hooks.__townReport = hookReport;

  /**
   * The loading screen (Nov 11, Eric: "loads it all in at once and then it stays there if you go in and out of buildings"): every
   * picture the street town can show painted (render.ts `warm`), then uploaded for good, tallest first, onto an atlas made once as deep
   * as they need (paint-gl.ts `keep`, `kept`), a slice a frame (`f.loadSliceMs`) so the bar moves: painting its first share
   * (`f.loadPaintShare`), uploading the rest. The frames, and so the town's clock, start once it's done. Today's town (Canvas 2D) has
   * nothing to upload: it starts at once.
   * The bosses' music (Eric, Nov 12: "loading music in the loading bar"): every theme fetched (not decoded: music.ts `preloadMusic`)
   * from the start, beside the painting (the network beside the processor). Music wanted, the town takes the bar up to
   * 1 - MUSIC.townShare and "Loading music…" the rest: what hasn't landed once the town is built, waited for at most MUSIC.townWaitMs
   * (a slow network never holds the town long; the rest lands in the background, and a theme not in yet is fetched as it's needed).
   */
  const loadTown = async () => {
    const t0 = performance.now();
    const keep = (src: CanvasImageSource) => painter.keep?.(src);
    const tick = () => new Promise<void>((go) => requestAnimationFrame(() => go()));
    const town = musicWanted() ? 1 - MUSIC.townShare : 1;
    let musicShare = 0;
    let musicIn = false;
    void preloadMusic((s) => (musicShare = s)).then(() => (musicIn = true));
    // (Whatever goes wrong here, the town opens: what wasn't made is made as it shows, as before.)
    try {
      for (let share = 0; share < 1 && alive; ) {
        share = r.warm(f.loadSliceMs, keep);
        onLoading(share * f.loadPaintShare * town);
        await tick();
      }
      loadPaintMs = performance.now() - t0;
      for (let share = 0; share < 1 && alive; ) {
        share = painter.kept?.(f.loadSliceMs) ?? 1;
        onLoading((f.loadPaintShare + (1 - f.loadPaintShare) * share) * town);
        if (share < 1) await tick();
      }
    } catch (e) {
      console.warn("town load:", e);
    }
    const built = performance.now();
    for (const until = built + MUSIC.townWaitMs; !musicIn && alive && performance.now() < until; await tick()) {
      onLoading(town + (1 - town) * musicShare, true);
    }
    loadMusicMs = performance.now() - built;
    if (!alive) return;
    loadMs = performance.now() - t0;
    loading = false;
    onLoading(null);
    // (A boss's goodbye as you come back from its battle, set as the town was made: its time starts with the first frame, not under the
    // loading screen, which can outlast it. Nov 13: the street town's loading screen is everyone's now.)
    const sp = speech;
    const late = sp.boss ? performance.now() + f.speechMs - sp.until : 0;
    if (late > 0) ((sp.until += late), (sp.next += late));
    // (So does the bot across your table after a game with it: it gets up botLeaveAfterGameMs after the first frame, not under the
    // loading screen, which can outlast it.)
    const lv = world.leave;
    if (lv) lv.at = Math.max(lv.at, performance.now() + f.botLeaveAfterGameMs);
    run();
    draw(performance.now());
  };
  let loadMs = 0;
  let loadPaintMs = 0;
  /** How long the town waited on the music once built (the "Loading music…" step). */
  let loadMusicMs = 0;
  // (The street town failed as it started (its painter is Canvas 2D then): the loading card stays up until the page reloads, or the
  // message has replaced it. No frames ever run on a 2D painter.)
  if (loading) void loadTown();

  return {
    /**
     * The server's list put in the town (here-net.ts): a card open on someone who left closes; someone in new clothes is dressed as
     * the bots are (their pictures made once, off the frame loop).
     */
    others: (left: Person[], dressed: Person[]) => {
      if (card?.kind === "person" && left.includes(town.people[card.i]!)) setCard(null);
      for (const p of dressed) {
        r.botArt.delete(p.id);
        r.riders.delete(p.id);
        r.ridersSoon.delete(p.id);
        p.walker.stepMs = TOWN_FEEL.botStepMs;
        dressPerson(p);
      }
    },
    zoom: setZoom,
    recenter: () => {
      leaveClose();
      follow = true;
      glide = null;
      // (A look round snapped to another quarter eases back too: "Back to me" is the normal view on you. Nov 13, review m3.)
      look.back(performance.now());
    },
    town,
    closeCard: () => setCard(null),
    /** A bot's card's Play: you both walk to the nearest table free for you, to sit; the game opens when you both do. */
    play: () => {
      if (card?.kind !== "person" || !town.people[card.i]!.bot) return;
      const m = tableFor(town, town.people[card.i]!);
      if (!m) return;
      setCard(null);
      leaveClose();
      meet(town, m);
      follow = true;
      glide = null;
    },
    /** A table's "Play <bot>": you sit across from the bot waiting there (on your way, or there already); then the game. */
    playSeated: () => {
      if (card?.kind !== "table" || card.bot === undefined) return;
      const bot = town.people[card.bot]!;
      const table = TABLES[card.i]!;
      const g = town.you.walker.goal();
      const yours = table.stools.find((s) => s.c === g.c && s.r === g.r);
      if (!yours || seated(bot) !== table) return;
      meet(town, { bot, table, yours, theirs: bot.walker.here() });
    },
    confirm: () => card && setCard({ ...card, confirm: true }),
    /** A stand-in's Talk (Rolling Dough's guard out front): his card says the boss is inside, a line at random, never the same twice running. */
    talk: () => card?.kind === "boss" && setCard({ ...card, line: pickLine(ZEBRA_OUTSIDE_LINES, card.line ?? null) }),
    /** A home's "Go in" (a shop's: shops/shops.ts): you walk to the square in front of its door, and go in once there. */
    goIn: (i: number) => {
      const h = HOMES[i]!;
      setCard(null);
      leaveClose();
      cancelMeet(town);
      town.you.sit = false;
      const to = spotNear(town, town.you.walker, h.door, false);
        if (!to || !walkWalker(town.you.walker, to)) return;
      goingIn = i;
      follow = true;
      glide = null;
    },
    /**
     * A boss's "Fight" (its confirm, for a boss with an intro: shops/challenge.ts): where you stand is kept (you come back here after
     * the battle), and you and the boss walk to its home's door, side by side, at a walk (CHALLENGE_FEEL.doorStepMs); you go in together once you're there.
     */
    challenge: (i: number): boolean => {
      const h = HOMES[i]!;
      const boss = town.bosses[i]!;
      const stood = standOf(town.you.walker);
      setCard(null);
      leaveClose();
      cancelMeet(town);
      town.you.sit = false;
      const to = spotNear(town, town.you.walker, h.door, false);
        if (!to || !walkWalker(town.you.walker, to)) return false;
      challengeStand = stood;
      challenging = i;
      boss.held = true;
      // (A calm walk to the door together, at the town's walking pace: not your run. Nov 2, "they both run in… it all happens so quick".)
      town.you.walker.stepMs = CHALLENGE_FEEL.doorStepMs;
      boss.walker.stepMs = CHALLENGE_FEEL.doorStepMs;
      const beside = spotNear(town, boss.walker, to, true);
      if (beside) walkWalker(boss.walker, beside);
      goingIn = i;
      follow = true;
      glide = null;
      return true;
    },
    /** Where you stood as you challenged a boss (null: no challenge). */
    challengeStand: () => challengeStand,
    /** A challenge started inside a home (Don Dough's): you come back to where you stand in the town now, at its door. */
    standHere: () => void (challengeStand = standOf(town.you.walker)),
    endChallenge,
    /** Inside a shop the town waits (`away`: no frames); coming out, it goes on. */
    pause: () => {
      away = true;
      goingIn = -1;
      finger.stop();
      halt();
    },
    resume: () => {
      away = false;
      // (Out of a building: the view is north again, Eric: "It'll always default back to the normal [view] if you go into a building and
      // come out". Under the black, so nothing is seen to turn.)
      const h = town.you.walker.here();
      base = freshView(turn, look, baseHeading(h.c, h.r, 0));
      heading = turn.to;
      run(false);
    },
    /** The large map's portraits (TownMap.tsx): each boss home's place and its boss's face, as its chip shows it. */
    mapFaces: (): MapFace[] =>
      HOMES.map((h) => {
        const { img, box } = r.chipFace(h);
        return { id: h.id, x: h.cx, y: h.cy, color: h.color, img, box };
      }),
    /**
     * (Eric, Nov 11: "When you open the mini map, if you tap on one of the bosses' buildings, it'll make your guy run there. And that's
     * it.") The large map's tap on a home: you walk to where a tap on that home in the town would take you (by its door), as that tap
     * walks you; no card (tap the home when you're there).
     */
    walkHome: (id: string) => {
      const home = HOMES.find((h) => h.id === id);
      if (!home || away) return;
      const dest = destFor(town, town.you.walker, { kind: "home", home });
      if (!dest) return;
      const b = lockIn(turn, look, performance.now());
      if (b !== null) base = b;
      leaveClose();
      walkOff();
      if (card) setCard(null);
      if (walkWalker(town.you.walker, dest)) {
        follow = true;
        glide = null;
      }
    },
    /** Your pawn's picture as the town draws it (your items on), for the room inside a shop. */
    youArt: () => r.youArt,
    /** The rider you're on as the town draws you (its frames ready), or null: on foot. Inside a shop it comes in with you. */
    youRider: () => r.youRider,
    chip: (i: number) => {
      const h = chipPlace[i];
      if (!h) return;
      if (card) setCard(null);
      leaveClose();
      follow = false;
      // To a few squares in front of its picture's foot (a home's: half a square in front of its plot's middle).
      const y = h.cy - h.foot + 0.5 - f.glideAhead;
      glide = { x: camX + wrapFX(h.cx - camX), y: camY + wrapFY(y - camY) };
    },
    stop: () => {
      alive = false;
      // (Every rider's frames freed: they'd stay in memory into a game otherwise.)
      r.youRider = r.youSoon = null;
      r.riders.clear();
      r.ridersSoon.clear();
      dropRiders();
      loss.stop();
      offAccount();
      fpsEl?.remove();
      if (FPS === fps) setFps(null);
      recPill?.remove();
      recPanel?.remove();
      if (REC === rec) setRec(null);
      halt();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      removeEventListener("keydown", onKey);
      stopKeys();
      offHeld();
      offQuarter();
      delete hooks.__townAt;
      delete hooks.__townGlide;
      delete hooks.__townGather;
      delete hooks.__townCam;
      delete hooks.__townSeat;
      delete hooks.__townTables;
      delete hooks.__townCall;
      delete hooks.__townBots;
      delete hooks.__townTurns;
      delete hooks.__townPlayer;
      delete hooks.__townFull;
      delete hooks.__townBossBack;
      delete hooks.__townTags;
      delete hooks.__townHold;
      delete hooks.__townPaint;
      delete hooks.__townBench;
      delete hooks.__townWalk;
      delete hooks.__townHeading;
      delete hooks.__townHush;
      delete hooks.__townStill;
      delete hooks.__townRide;
      delete hooks.__townYou;
      delete hooks.__townHere;
      delete hooks.__townReport;
      delete hooks.__townPick;
      painter.dispose();
      if (card?.kind === "boss") town.bosses[card.i]!.held = false;
      detach();
    },
  };
}

const POSE = { x: 0, y: 0, hop: 0, tilt: 0, step: false, t: 0 };
/** Why the street town shows a message instead of itself (gl-fail.ts): no WebGL 2 here, or it didn't load after its one reload. */
type TownBroken = "unsupported" | "retry";
/** How long the street town's lost WebGL context may stay lost while the page shows before the street town reloads (it's usually back within a second). */
const LOST_WAIT_MS = 5000;
/** The frame-rate pill's name for each backend. */
const BACKEND_LABEL: Record<Backend, string> = { "2d": "2D", webgl: "WebGL" };
const PA = { x: 0, y: 0, k: 0, depth: 0 };
const PB = { x: 0, y: 0, k: 0, depth: 0 };

/** How many pixels one square ahead spans at the focus point (dragging down by this much moves the camera a square). */
function rowSpan(r: Renderer): number {
  const v = r.view;
  return proj(v, 0, -0.5, 0, PA) && proj(v, 0, 0.5, 0, PB) ? PA.y - PB.y : v.kf * 0.5;
}

/** A chip's face: a boss's head (`box`, in its first idle frame's pixels), or the Colosseum's crown, filling the round chip. */
function drawFace(c: HTMLCanvasElement, img: HTMLCanvasElement, box: readonly [x: number, y: number, size: number]) {
  const g = c.getContext("2d")!;
  g.clearRect(0, 0, c.width, c.height);
  g.imageSmoothingEnabled = false;
  g.drawImage(img, box[0], box[1], box[2], box[2], 0, 0, c.width, c.height);
}

/**
 * A pawn's picture for its card (Oct 28): its art (the pawn as it stands in the square, items and tint on) cut to what's drawn and set
 * in the middle of a square with a little room round it (the ring is round: a pawn's wide foot would be cut at the corners), as an
 * image's address. Made once as a card opens. Null if there's nothing drawn.
 */
function pawnFace(art: HTMLCanvasElement): string | null {
  const g = art.getContext("2d")!;
  const d = g.getImageData(0, 0, art.width, art.height).data;
  let x0 = art.width;
  let y0 = art.height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < art.height; y++)
    for (let x = 0; x < art.width; x++)
      if (d[(y * art.width + x) * 4 + 3]! > 24) ((x0 = Math.min(x0, x)), (y0 = Math.min(y0, y)), (x1 = Math.max(x1, x)), (y1 = Math.max(y1, y)));
  if (x1 < 0) return null;
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  // The figure fills 84% of the square's side, the biggest side of it; the picture is 128 px: crisp on a phone's screen, light to hold.
  const S = 128;
  const k = (S * 0.84) / Math.max(w, h);
  const out = document.createElement("canvas");
  out.width = out.height = S;
  const o = out.getContext("2d")!;
  o.imageSmoothingQuality = "high";
  o.drawImage(art, x0, y0, w, h, (S - w * k) / 2, (S - h * k) / 2, w * k, h * k);
  return out.toDataURL();
}
