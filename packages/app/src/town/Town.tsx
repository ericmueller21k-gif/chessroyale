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
import { useLayoutEffect, useRef, useState } from "preact/hooks";
import { UserIcon } from "../components/PixelIcon.tsx";
import { openProfile } from "../profile-nav.ts";
import { account, onAccountChange, playerName } from "../account.ts";
import { TOWN_ASKED, testSwitchesAllowed } from "../test-switches.ts";
import { play, warmSounds } from "../sound.ts";
import { SELECT_SOUND, TOWN_SOUNDS, townSound } from "../characters/boss-select.ts";
import { N, proj, wrapF } from "./camera.ts";
import { TOWN_FEEL } from "./feel.ts";
import { BarsIcon, SwordsIcon } from "./CardIcons.tsx";
import { TownChat } from "./TownChat.tsx";
import { TownChatTools } from "./TownChatTools.tsx";
import { Press } from "./press.ts";
import { PAWN_HEAD, PAWN_PX, Renderer, pawnImage, type Hit, type YouArt } from "./render.ts";
import { Rider, rideSheet, type RiderPawn } from "./rides.ts";
import { painter2d, type Backend, type Painter } from "./paint.ts";
import { painterGL } from "./paint-gl.ts";
import { reportTownFallback } from "../problems.ts";
import type { TownGlFallback } from "@chessroyale/core";
import { sameWeights, skyOverride, skyWeights, type SkyWeights } from "./sky.ts";
import { BOTS, COLISEUM_PLACE, CROWD_MAX, HOMES, addCrowd, addTestPlayer, fillTables, homeDoor, inSquare, stayOut, START, STATUES, TABLES, anyTableFree, botLabel, cancelMeet, comeOut, createTown, destFor, holdBot, isSprite, spotNear, meet, meetReady, meetSeat, onColiseum, playAtTableText, plotAt, ratingLine, ratingText, seated, sidekickText, spriteAnim, statueAt, stoolAt, tableAt, tableFor, tableStates, tdist, tick, townLine, waitingBot, walkWalker, type HomeId, seatOf, seatText, type Person, type Place, type Seat, type Sq, type StatueId, type Target } from "./world.ts";
import { dressedPawn, lookKey, offRide } from "./you-look.ts";
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

export function TownScreen({ onBack, onBossAlone, onPlayBot, onColosseum, seat = null, framed = false }: { onBack: () => void; onBossAlone?: (id: HomeId) => void; onPlayBot?: (game: BotGameAsk) => void; onColosseum?: () => void; seat?: string | null; framed?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const chips = useRef<(HTMLDivElement | null)[]>([]);
  const cardEl = useRef<HTMLDivElement>(null);
  const live = useRef<HTMLDivElement>(null);
  const ctl = useRef<Ctl | null>(null);
  const [zoomedOut, setZoomedOut] = useState<boolean>(TOWN_FEEL.startZoomedOut);
  const [card, setCard] = useState<Card | null>(null);

  // (A layout effect: the world's first frame is drawn before the screen first shows.)
  useLayoutEffect(() => {
    const t = startTown(box.current!, canvas.current!, chips.current, cardEl.current!, live.current!, setZoomedOut, setCard, seatOf(seat), (s, face) => {
      const b = BOTS[s.bot]!;
      onPlayBot?.({ seat: seatText(s), name: botLabel(b), rating: b.rating, look: isSprite(b.look) ? null : b.look.wear, face });
    });
    ctl.current = t;
    return t.stop;
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
  const label = card?.kind === "coliseum" ? COLISEUM_PLACE.name : card?.kind === "table" ? "Chess table" : person ? (bot ? botLabel(bot) : person.name) : home ? (card!.confirm ? "Leave the town square?" : card!.kind === "boss" ? home.boss : home.name) : undefined;

  return (
    <div class={framed ? "town-screen in-frame" : "town-screen"}>
      <header class="town-bar">
        <button type="button" class="town-back" aria-label="Back" onClick={onBack}>
          ‹
        </button>
        <h1>Town square</h1>
        {/* The chat's icon (its three modes) and the gear (Town settings), at the right end of the same line (on a computer, in the frame: the chat icon beside the title, the gear at the right end). */}
        <TownChatTools />
      </header>
      <div class="town-box" ref={box}>
        <canvas class="town-canvas" ref={canvas} aria-label="The town square" />
        {/* A statue's quote, for screen readers, while you stand up close to it (it's drawn on its pedestal). */}
        <div class="town-sr" ref={live} aria-live="polite" />
        <div class="town-overlay">
          {/* The chat log, top left (its own file): under the cards; while it shows it takes every touch on its own area (the map under it gets none), faded none; the chips keep off its box (CHAT_BOX). */}
          <TownChat />
          {/* The card: over the boss's head or the home's top, its tail pointing there (placed every frame). Dark, with a gold border
              (Eric's mockup, Oct 28); a person's is one row at one size (`town-person`). */}
          <div class={card?.kind === "person" ? "town-card town-person" : "town-card"} ref={cardEl} role="dialog" aria-label={label} style={{ display: card ? "" : "none" }}>
            {card && home && card.confirm && (
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
            {card && home && !card.confirm && card.kind === "boss" && (
              <>
                <h2>{home.boss}</h2>
                {card.line && <p class="town-card-text town-card-line">{card.line}</p>}
                <button type="button" class="town-btn primary" onClick={() => ctl.current?.confirm()}>
                  Challenge alone
                </button>
              </>
            )}
            {card && home && !card.confirm && card.kind === "home" && (
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
                    <span>{bot ? ratingText(bot) : ratingLine(person.rating ?? 0)}</span>
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
        <div class="town-controls">
          <div class="town-zoom">
            <button type="button" aria-label="Zoom out" aria-pressed={zoomedOut} onClick={() => ctl.current?.zoom(true)}>
              −
            </button>
            <button type="button" aria-label="Zoom in" aria-pressed={!zoomedOut} onClick={() => ctl.current?.zoom(false)}>
              +
            </button>
          </div>
          {/* The focus button (Eric, Oct 28: "replace with circular focus icon"): a ring, four ticks and a dot, a map's locate-me;
              still named "Back to me", and still brings the camera back to you. */}
          <button type="button" class="town-recenter" aria-label="Back to me" onClick={() => ctl.current?.recenter()}>
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <circle cx="12" cy="12" r="6.2" fill="none" stroke="currentColor" stroke-width="2" />
              <path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
              <circle cx="12" cy="12" r="2.1" fill="currentColor" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
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
) {
  const f = TOWN_FEEL;
  /** The world's canvas: a new one if the drawing changes backend (a canvas keeps the first kind of context it gave). */
  let cv = cv0;
  // The drawing (paint.ts): Canvas 2D, or WebGL 2 with `?gl=1` (anyone; read once as the page opened). No WebGL 2, no
  // context, or its shader fails: Canvas 2D, silently. A lost context: nothing is drawn until it's back; lost twice within a
  // minute, or not back within LOST_WAIT_MS, Canvas 2D for the rest of the page. Each of these falls back once and is
  // reported once a page with its reason (problems.ts, `reportTownFallback`: nothing shows; never on the frame loop).
  const losses: number[] = [];
  let lostWait = 0;
  const fallBack = (why: TownGlFallback) => {
    reportTownFallback(why);
    useBackend("2d");
  };
  const onLost = (lost: boolean) => {
    clearTimeout(lostWait);
    if (!lost) return void (alive && draw(performance.now()));
    const now = performance.now();
    losses.push(now);
    // (And one that isn't back within a few seconds: the browser isn't giving it back.)
    if (losses.length >= 2 && now - losses[losses.length - 2]! < 60_000) setTimeout(() => alive && fallBack("lost-twice"));
    else lostWait = window.setTimeout(() => alive && painter.lost && fallBack("not-back"), LOST_WAIT_MS);
  };
  let attached = false;
  /** A new canvas in the old one's place (its class, label, size and data), the input moved over. */
  const swapCanvas = () => {
    const n = document.createElement("canvas");
    n.className = cv.className;
    n.setAttribute("aria-label", cv.getAttribute("aria-label") ?? "");
    Object.assign(n.dataset, cv.dataset);
    n.width = cv.width;
    n.height = cv.height;
    n.style.cssText = cv.style.cssText;
    if (attached) detach();
    cv.replaceWith(n);
    cv = n;
    if (attached) attach();
  };
  const makePainter = (kind: Backend): Painter => {
    if (kind === "webgl") {
      const p = painterGL(cv, onLost);
      if (typeof p !== "string") return shim(p);
      reportTownFallback(p);
      swapCanvas(); // (in case it gave a WebGL context before failing)
    }
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
  let painter: Painter = makePainter(TOWN_ASKED.gl ? "webgl" : "2d");
  cv.dataset.backend = painter.kind;
  /** Draws with `kind` from now on (on a new canvas), the frame drawn again at once. */
  const useBackend = (kind: Backend) => {
    painter.dispose();
    swapCanvas();
    painter = makePainter(kind);
    r.setPainter(painter);
    cv.dataset.backend = painter.kind;
    if (fpsEl) fpsEl.dataset.backend = BACKEND_LABEL[painter.kind];
    draw(drawnAt);
  };
  const town = createTown(performance.now(), undefined, seat);
  const r = new Renderer(painter, town, HOMES);
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
  let follow = true;
  /** The camera's speed while it follows you (squares a second): the spring's state. */
  let vx = 0;
  let vy = 0;
  let glide: { x: number; y: number } | null = null;
  let zoomCur = f.startZoomedOut ? 1 : 0;
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
  // Your pawn as your profile shows it (your crate items), drawn again only when your look changes; plain meanwhile. On your
  // ride if you wear one (Oct 31): its frames with you on them composed once (rides.ts), the last ones kept until they're ready.
  let youLook: string | null = null;
  const dress = () => {
    const look = account().profile?.locker?.look;
    const key = lookKey(look);
    if (key === youLook) return;
    youLook = key;
    const wear = offRide(look);
    const mount = (art: YouArt | null) => {
      if (!look?.ride || !rideSheet(look.ride.def)) return void (r.youRider = null);
      ride(look.ride, art, pawnImage("light", null), (rd) => (youLook === key && alive ? void (r.youRider = rd) : rd.drop()));
    };
    if (!lookKey(wear)) {
      r.youArt = null;
      mount(null);
    } else
      void dressedPawn(wear, pawnImage("light", null), PAWN_PX).then((art) => {
        if (youLook !== key || !alive) return;
        r.youArt = art;
        mount(art);
      });
  };
  /** A rider (rides.ts) for a pawn wearing `ride`: its dressed picture (or the plain pawn) on it; `done` once it's ready. */
  const ride = (on: NonNullable<ItemLook["ride"]>, art: YouArt | null, plain: HTMLCanvasElement, done: (rd: Rider) => void) => {
    const sheet = rideSheet(on.def);
    const pawn: RiderPawn = art ?? { img: plain, pad: 0, top: PAWN_HEAD - 0.75 / 45 };
    if (sheet) new Rider(sheet, on.color, pawn, done);
  };
  /** Someone else's pawn (a bot, the test player; real players later) as the square draws it, made once: its items, its ride. */
  const dressPerson = (p: Person) => {
    const lk = p.look;
    if (isSprite(lk) || !lk.wear) return;
    const plain = pawnImage(lk.side, lk.tint);
    const on = lk.wear.ride;
    const mount = (art: YouArt | null) => on && ride(on, art, plain, (rd) => (alive ? r.riders.set(p.id, rd) : rd.drop()));
    const wear = offRide(lk.wear);
    if (!lookKey(wear)) mount(null);
    else
      void dressedPawn(wear, plain, PAWN_PX).then((art) => {
        if (!alive) return;
        if (art) r.botArt.set(p.id, art);
        mount(art);
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
  let fpsEl: HTMLElement | null = null;
  let fpsN = 0;
  let fpsPrev = 0;
  let fpsAt = 0;
  let fpsPrevAt = 0;
  if (TOWN_ASKED.fps) {
    fpsEl = document.createElement("div");
    fpsEl.className = "town-fps";
    fpsEl.dataset.fps = "";
    // (The backend follows the numbers, "· WebGL" or "· 2D", from town.css: the pill's text stays the numbers.)
    fpsEl.dataset.backend = BACKEND_LABEL[painter.kind];
    cv.parentElement?.append(fpsEl);
  }
  /** The game with a bot has been asked for (once). */
  let opened = false;
  let raf = 0;
  let last = performance.now();
  let alive = true;
  /** (Tests, `__townHold`) The frame loop held: the last frame stays, and nothing moves. */
  let held = false;
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
      camX += wrapF(glide.x - camX) * k;
      camY += wrapF(glide.y - camY) * k;
      if (Math.hypot(wrapF(glide.x - camX), wrapF(glide.y - camY)) < 0.03) glide = null;
    } else if (follow) {
      // A critically damped spring toward your pawn (or, up close, the statue's square), solved exactly for the frame
      // (steady at any frame rate).
      const p = town.you.walker.pose(now, POSE);
      if (closeOn >= 0 && closeIn) ((p.x = STATUES[closeOn]!.c), (p.y = STATUES[closeOn]!.r));
      const w = f.followSpring;
      const e = Math.exp(-w * dt);
      const x = wrapF(camX - p.x);
      const y = wrapF(camY - p.y);
      const jx = vx + w * x;
      const jy = vy + w * y;
      camX = p.x + (x + jx * dt) * e;
      camY = p.y + (y + jy * dt) * e;
      vx = (vx - w * jx * dt) * e;
      vy = (vy - w * jy * dt) * e;
    }
    if (!follow || glide) vx = vy = 0;
    // (Kept near the world's middle so the numbers never grow, however far you walk round.)
    camX = START.c + wrapF(camX - START.c);
    camY = START.r + wrapF(camY - START.r);
  };

  const draw = (now: number, dt = 0) => {
    drawnAt = now;
    if (!painter.lost) r.draw(now, camX, camY, zoomCur, dt);
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
    if (!alive) return;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    zoomCur += (zoomTarget - zoomCur) * (1 - Math.exp(-dt * f.zoomRate));
    if (Math.abs(zoomTarget - zoomCur) < 0.001) zoomCur = zoomTarget;
    town.you.name = playerName();
    if (!pinned && now - skyAt > f.skyCheckMs) {
      skyAt = now;
      const w = clock();
      if (!sameWeights(w, sky)) r.setSky((sky = w));
    }
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
    stepClose(dt);
    updateCamera(dt, now);
    draw(now, dt);
    if (fpsEl) {
      fpsN++;
      if (!fpsAt) fpsAt = fpsPrevAt = now;
      else if (now - fpsAt >= 500) {
        const n = fpsN + fpsPrev;
        const ms = now - fpsPrevAt;
        fpsEl.textContent = `${Math.round((n * 1000) / ms)} fps · ${(ms / n).toFixed(1)} ms`;
        fpsEl.dataset.fps = String(Math.round((n * 1000) / ms));
        fpsPrev = fpsN;
        fpsN = 0;
        fpsPrevAt = fpsAt;
        fpsAt = now;
      }
    }
    raf = requestAnimationFrame(frame);
  };
  const run = () => {
    if (raf || !alive || document.hidden || held) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  };
  const halt = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };
  const onVisibility = () => (document.hidden ? halt() : run());
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
    if (c?.kind === "boss" && !(card?.kind === "boss" && card.i === c.i)) {
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
    } else if (c && card && c.kind === card.kind && c.i === card.i && card.line) c = { ...c, line: card.line };
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

  // ---- Input: a finger presses the square you'd walk to (press.ts); one that moves is a drag (look around).
  const press = new Press(f.dragPx);
  /** The drag's start: the pointer, the camera, and pixels per square across and along. */
  let drag: { id: number; x: number; y: number; cx: number; cy: number; kx: number; ky: number } | null = null;
  /** This press only closes the open card (a tap anywhere else closes it, as in the prototype). */
  let closing = false;
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
      key = `sq:${hit.c},${hit.r}`;
      const home = plotAt[hit.r * N + hit.c];
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
  const onDown = (e: PointerEvent) => {
    cv.setPointerCapture?.(e.pointerId);
    // Pixels per square at the focus point, across and along (for the drag).
    const v = r.view;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, cx: camX, cy: camY, kx: v.kf, ky: Math.max(8, rowSpan(r)) };
    closing = !!card;
    if (closing) return press.down(e.clientX, e.clientY, "");
    const xy = local(e);
    const p = plan(r.pick(xy.x, xy.y));
    if (p?.dest) r.pressSquare(p.dest.c, p.dest.r);
    press.down(e.clientX, e.clientY, p?.dest || p?.card ? p.key : "");
  };
  const onMove = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    const was = press.dragged();
    if (!press.move(e.clientX, e.clientY)) return;
    if (!was) {
      // Past the threshold: the square lets go (no pulse, no walk) and you look around.
      r.release(performance.now(), false);
      leaveClose();
      follow = false;
      glide = null;
    }
    camX = drag.cx - (e.clientX - drag.x) / drag.kx;
    camY = drag.cy + (e.clientY - drag.y) / drag.ky;
  };
  const onUp = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    drag = null;
    const now = performance.now();
    if (closing) {
      if (press.up("") !== "drag") setCard(null);
      return;
    }
    const xy = local(e);
    const p = plan(r.pick(xy.x, xy.y));
    const res = press.up(p ? p.key : "");
    if (res !== "walk" || !p) {
      if (res === "cancel") r.release(now, false);
      return;
    }
    // Released on the same thing: the border pulses once and you set off (no sound, no vibration: Eric).
    r.release(now, true);
    // A tap on anything but the statue you're looking at walks you away from it: the camera glides back out.
    if (p.statue < 0 || p.statue !== closeOn) leaveClose();
    // You sit when a tap on a table sent you to its stool; any other walk stands you up (and calls off a game you were
    // walking to with a bot).
    cancelMeet(town);
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
  attached = true;

  function setZoom(out: boolean) {
    leaveClose();
    zoomTarget = out ? 1 : 0;
    onZoom(out);
  }

  // A test hook (e2e, with the test switches on: test-switches.ts): where to tap a boss, a home or the Colosseum (its gate)
  // now, in the box.
  const hookAt = (kind: "boss" | "home" | "coliseum" | "statue" | "table" | "lamp" | "light" | "bot" | "player" | "square", id?: HomeId | StatueId | "coliseum" | number | string | readonly [number, number]) => {
    const out = { x: 0, y: 0 };
    if (kind === "square") return testSwitchesAllowed() && Array.isArray(id) && r.squareAt(id[0]!, id[1]!, out) ? out : null;
    if (kind === "player") return testSwitchesAllowed() && r.tapPoint("person", town.people.findIndex((p) => p.uid === id), out) ? out : null;
    if (kind === "bot") return testSwitchesAllowed() && r.tapPoint("person", town.people.findIndex((p) => p.bot === BOTS[Number(id)]), out) ? out : null;
    if (kind === "table") return testSwitchesAllowed() && r.tapPoint("table", Number(id), out) ? out : null;
    if (kind === "lamp") return testSwitchesAllowed() && r.lampAt(Number(id), out) ? out : null;
    if (kind === "light") return testSwitchesAllowed() && r.lightAt(id === "coliseum" ? HOMES.length : HOMES.findIndex((h) => h.id === id), out) ? out : null;
    if (kind === "statue") return testSwitchesAllowed() && r.tapPoint("statue", STATUES.findIndex((s) => s.id === id), out) ? out : null;
    const i = kind === "coliseum" ? HOMES.length : HOMES.findIndex((h) => h.id === id);
    return testSwitchesAllowed() && r.tapPoint(kind === "boss" ? "boss" : "home", i, out) ? out : null;
  };
  // ... `__townCam()`: the camera now: its zoom (0 in, 1 out), its lens (1: none; more up close), where it looks (the
  // focus square), the statue it's close on (null: none), how far its glide has come, and its quote.
  const hookCam = () =>
    testSwitchesAllowed()
      ? {
          zoom: zoomCur,
          zoomTarget,
          mag: r.lensMag,
          focus: [camX, camY],
          statue: closeOn >= 0 ? STATUES[closeOn]!.id : null,
          close: closeT,
          closingIn: closeIn,
          quote: quoteMs >= 0,
          // The statue up close: its drawn box (top and bottom, as shares of the world's box) and its quote's letters' height.
          box: closeOn >= 0 ? [r.statueBox[closeOn]!.y0 / r.H, r.statueBox[closeOn]!.y1 / r.H] : null,
          cap: r.quoteCap,
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
  // ... `__townCall(i)`: the bot BOTS[i] walks to stand beside you (out from home first, if it's there), and every bot holds
  // still from then on (to tap it);
  // `__townBots()`: each bot (BOTS' order): its name, its square ("c,r"), the table it sits at (-1: none), whether it walks.
  const hookCall = (i: number) => {
    if (!testSwitchesAllowed()) return;
    town.nextBotAt = Infinity;
    town.leave = null;
    const b = town.bots.find((p) => p.bot === BOTS[i]);
    if (b?.home) comeOut(town, b, performance.now(), 3);
    if (b) stayOut(b);
    const to = b && destFor(town, b.walker, { kind: "beside", at: town.you.walker.here() });
    if (b && to) walkWalker(b.walker, to);
  };
  const hookBots = () =>
    testSwitchesAllowed()
      ? BOTS.map((bt) => {
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
      const to = spotNear(town, b.walker, { c: b.home.cx, r: b.home.cy + 2 }, false);
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
      glide = { x: camX + wrapF(id[0] - camX), y: camY + wrapF(id[1] - camY) };
      return;
    }
    const h = HOMES.find((x) => x.id === id);
    if (!h) return;
    follow = false;
    glide = { x: camX + wrapF(h.cx - camX), y: camY + wrapF(h.cy - h.foot + 0.5 - f.glideAhead - camY) };
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
  // ... `__townRide()` (Oct 31, rides): yours (its ride and color, whether its frames are ready, as the last frame drew it: "idle" or
  // "move" ("" on foot), the frame, which way it faced; your box, foot and head on screen, your square) and each other rider's.
  const hookRide = () => {
    if (!testSwitchesAllowed()) return null;
    const you = town.people.indexOf(town.you);
    const h = town.you.walker.here();
    const rd = r.youRider;
    return {
      you: { ride: rd?.sheet.id ?? null, color: rd?.color ?? null, ready: !!rd?.ready, ...r.youRide, box: r.drawnBox(you), at: [h.c, h.r] },
      others: [...r.riders].map(([id, x]) => ({ id, ride: x.sheet.id, color: x.color, ready: x.ready, box: r.drawnBox(town.people.findIndex((p) => p.id === id)) })),
    };
  };
  // ... `__townHold(on)`: the frame loop stops (the last frame stays, nothing moves) or goes on; `__townBackend("2d" | "webgl")`:
  // the drawing's backend from now on (on a new canvas; the held frame drawn again), answering the one it got; `__townPaint()`:
  // the backend and the last frame's draw calls (WebGL's; 0 for Canvas 2D). For the comparison of the two (e2e/town-webgl.spec.ts).
  const hookHold = (on: boolean) => {
    if (!testSwitchesAllowed()) return;
    held = on;
    if (on) halt();
    else run();
  };
  const hookBackend = (kind: Backend) => {
    if (!testSwitchesAllowed()) return null;
    useBackend(kind);
    return painter.kind;
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
  const hookPaint = () => {
    if (!testSwitchesAllowed()) return null;
    const p = painter as Painter & { uploads?: number; resets?: number };
    return { backend: painter.kind, drawCalls: painter.drawCalls, lost: painter.lost, uploads: p.uploads ?? 0, resets: p.resets ?? 0 };
  };
  const hooks = window as unknown as { __townFull?: typeof hookFull; __townPlayer?: typeof hookPlayer; __townTurns?: typeof hookTurns; __townGlide?: typeof hookGlide; __townAt?: typeof hookAt; __townGather?: typeof hookGather; __townCam?: typeof hookCam; __townSeat?: typeof hookSeat; __townTables?: typeof hookTables; __townCall?: typeof hookCall; __townBots?: typeof hookBots; __townBossBack?: typeof hookBossBack; __townTags?: typeof hookTags; __townHold?: typeof hookHold; __townBackend?: typeof hookBackend; __townPaint?: typeof hookPaint; __townBench?: typeof hookBench; __townRide?: typeof hookRide };
  hooks.__townAt = hookAt;
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
  hooks.__townBackend = hookBackend;
  hooks.__townPaint = hookPaint;
  hooks.__townBench = hookBench;
  hooks.__townRide = hookRide;

  run();
  draw(performance.now()); // the first frame, before the screen shows

  return {
    zoom: setZoom,
    recenter: () => {
      leaveClose();
      follow = true;
      glide = null;
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
    chip: (i: number) => {
      const h = chipPlace[i];
      if (!h) return;
      if (card) setCard(null);
      leaveClose();
      follow = false;
      // To a few squares in front of its picture's foot (a home's: half a square in front of its plot's middle).
      const y = h.cy - h.foot + 0.5 - f.glideAhead;
      glide = { x: camX + wrapF(h.cx - camX), y: camY + wrapF(y - camY) };
    },
    stop: () => {
      alive = false;
      clearTimeout(lostWait);
      offAccount();
      fpsEl?.remove();
      halt();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      removeEventListener("keydown", onKey);
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
      delete hooks.__townBackend;
      delete hooks.__townPaint;
      delete hooks.__townBench;
      delete hooks.__townRide;
      painter.dispose();
      if (card?.kind === "boss") town.bosses[card.i]!.held = false;
      detach();
    },
  };
}

const POSE = { x: 0, y: 0, hop: 0, tilt: 0, step: false, t: 0 };
/** How long a lost WebGL context may stay lost before the town goes back to Canvas 2D (it's usually back within a second). */
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
