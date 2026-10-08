import { Component } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { FRONT_DOOR, MATCHMAKING, isRankedMatch, rankedMinHumans, type ItemLook, type MatchmakingType, type Settings } from "@chessroyale/core";
import type { LobbyPlayer } from "@chessroyale/chess";
import { BackButton, DressedPawn, myHat } from "../components/FrontDoor.tsx";
import { MuteButton } from "../components/MuteButton.tsx";
import { account } from "../account.ts";
import { play } from "../sound.ts";
import { openProfile } from "../profile-nav.ts";
import { pawnLook } from "../looks.ts";
import { LobbyChat } from "../components/LobbyChat.tsx";

/**
 * What the queue screen shows: an online queue (NetMatch: Default or Bots off) or Solo filling with its bots
 * (SoloMatch). Times are local.
 */
export interface QueueView {
  readonly settings: Settings;
  readonly myId: string | null;
  readonly players: LobbyPlayer[];
  readonly looks: ReadonlyMap<string, ItemLook>;
  /** Default: when bots fill the empty seats (Bots off, a raid: when it may begin with enough people). */
  readonly fillAt: number | null;
  /** The seats were filled then; the match begins a moment later. */
  readonly filledAt: number | null;
  readonly queueType: MatchmakingType;
}

/** How far apart pops start when several pawns arrive at once (people; bots cascade faster, see below). */
const STAGGER_MS = 40;
/** At most one pop sound this often, however many pawns pop. */
const SOUND_GAP_MS = 70;

/**
 * Pops, scheduled: each pawn that appears gets a start time at least STAGGER_MS after the last one's (bots closer
 * together), and a pop sound unless one played less than SOUND_GAP_MS ago. Mute is respected by play().
 */
function usePops() {
  /** Each seat's delay, fixed the first time it's seen (its animation-delay must never change while it runs). */
  const delays = useRef(new Map<string, number>());
  const last = useRef(0);
  const lastSound = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  /** The delay (ms) before this seat's pop, decided the first time it's seen. */
  return (id: string, bot: boolean, gap: number): number => {
    const known = delays.current.get(id);
    if (known !== undefined) return known;
    const now = performance.now();
    const start = Math.max(now, last.current + gap);
    last.current = start;
    const delay = start - now;
    delays.current.set(id, delay);
    timers.current.push(
      setTimeout(() => {
        const t = performance.now();
        if (t - lastSound.current < SOUND_GAP_MS) return;
        lastSound.current = t;
        play(bot ? "popSoft" : "pop");
      }, delay + 120),
    );
    return delay;
  };
}

/** A seat's pawn, drawn again only when its look changes (the grid re-renders whenever someone arrives). */
class SeatPawn extends Component<{ look?: ItemLook; hat: string }> {
  shouldComponentUpdate(next: { look?: ItemLook; hat: string }) {
    return next.look !== this.props.look || next.hat !== this.props.hat;
  }
  render() {
    return <DressedPawn size="seat" look={this.props.look} hat={this.props.hat} />;
  }
}

/** The grid of seats: filled ones in order, then empty ones. Re-rendered only when someone arrives or leaves. */
function Seats({ seats, size, me, myLook, hat, looks, bots, trickle }: { seats: LobbyPlayer[]; size: number; me: string | null; myLook?: ItemLook; hat: string; looks: ReadonlyMap<string, ItemLook>; bots: number; trickle?: boolean }) {
  const pop = usePops();
  // Bots wear what they wear in the match (looks.ts: seeded by their name, the same outfit on the vote board), worked
  // out once each so their pawns aren't redrawn.
  const botLooks = useRef(new Map<string, { look?: ItemLook; hat: string }>());
  const botLook = (p: LobbyPlayer) => {
    let l = botLooks.current.get(p.id);
    if (!l) botLooks.current.set(p.id, (l = pawnLook({ id: p.id, name: p.name, isYou: false, isBot: true, look: undefined })));
    return l;
  };
  // Bots cascade into their seats within the moment before the match begins (all at once, from the server). Solo's
  // arrive a few at a time already, so each pops as it comes and the count never runs ahead of the grid.
  const botGap = trickle ? 8 : Math.max(8, Math.min(STAGGER_MS, (FRONT_DOOR.fillShowMs - 600) / Math.max(1, bots)));
  return (
    <div class={`fd-seats${size <= 50 ? " half" : ""}`} role="img" aria-label={`${seats.length} of ${size} seats filled`}>
      {Array.from({ length: size }, (_, i) => {
        const p = seats[i];
        if (!p) return <span key={`empty-${i}`} class="fd-seat empty" />;
        // Your seat is always the first, under one key whatever your id (none yet, or a new lobby's after a switch), so
        // it never pops twice or blinks out.
        const you = i === 0 && (p.id === me || p.id === SELF);
        const key = you ? SELF : p.id;
        const delay = pop(key, p.isBot, p.isBot ? botGap : STAGGER_MS);
        const dress = you ? { look: myLook, hat } : p.isBot ? botLook(p) : { look: looks.get(p.id), hat: "none" };
        const pawn = <SeatPawn look={dress.look} hat={dress.hat} />;
        const cls = `fd-seat pop${you ? " you" : ""}${p.isBot ? " bot" : ""}`;
        const style = { "--pop-delay": `${Math.round(delay)}ms` };
        // A person's pawn opens their profile; bots are just bots.
        return p.isBot ? (
          <span key={key} class={cls} style={style}>
            {pawn}
          </span>
        ) : (
          <button type="button" key={key} class={cls} style={style} title={you ? "You" : p.name} aria-label={`${you ? "Your" : `${p.name}'s`} profile`} onClick={() => openProfile({ uid: p.uid, name: p.name, you })}>
            {pawn}
          </button>
        );
      })}
    </div>
  );
}

/** Now, every quarter second (for the seconds left; the grid doesn't need frames). */
function useNow(ms = 250) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, []);
  return now;
}

/** Your own seat, drawn from the tap on PLAY (before the server has said who you are). */
const SELF = "\u0000you";

/** "1:05": how long you've been waiting. */
const clock = (ms: number) => `${Math.floor(ms / 60_000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;

/**
 * The queue (docs/mockups/front-door/Queue.dc.html): "38 / 100", a bar, the seconds left, and a seat for everyone.
 * Each person's dressed pawn pops into the next seat as they join, yours first and ringed in gold. When time's up,
 * bots pop into the empty seats (quieter pops) and the match begins. The same screen for each way of being matched:
 * Default (bots after a minute), Bots off (people only, until it's full; one tap lets bots fill instead) and Solo
 * (your bots pop in at once). It says when a match won't count for ranking.
 */
export function QueueScreen({ match, onCancel, onLetBotsFill }: { match: QueueView; onCancel: () => void; onLetBotsFill?: () => void }) {
  const now = useNow();
  const since = useRef(Date.now());
  const raid = !!match.settings.raid;
  const type = match.queueType;
  const size = match.settings.lobbySize;
  const me = match.myId;
  const players = match.players;
  // Your seat first (even before the server has said so: you're in from the tap), then everyone else in the order they
  // joined, then the bots.
  const seats = useMemo(() => {
    const people = players.filter((p) => !p.isBot);
    const mine = people.find((p) => p.id === me) ?? ({ id: SELF, name: "You", isBot: false, connected: true } as LobbyPlayer);
    return [mine, ...people.filter((p) => p !== mine), ...players.filter((p) => p.isBot)].slice(0, size);
  }, [players, me, size]);
  const bots = seats.filter((p) => p.isBot).length;
  const left = match.fillAt ? Math.max(0, Math.ceil((match.fillAt - now) / 1000)) : null;
  const filled = !!match.filledAt;
  const myLook = account().profile?.locker?.look;
  const hat = myHat(account().profile);
  const grid = useMemo(
    () => <Seats seats={seats} size={size} me={me} myLook={myLook} hat={hat} looks={match.looks} bots={bots} trickle={type === "solo"} />,
    [seats, size, me, myLook, hat, bots],
  );
  const line = filled
    ? raid
      ? "Here we go: the raid begins"
      : bots
        ? `${type === "solo" ? "Full" : "Bots fill the rest"} · here we go`
        : "Full · here we go"
    : type === "solo"
      ? "Solo · your bots are taking their seats"
      : type === "botsoff"
        ? `No bots · waiting ${clock(now - since.current)} for ${raid ? `50 (or ${MATCHMAKING.raidBotsOffMinPlayers} after a minute)` : `all ${size}`}`
        : `Finding players · ${left ?? "…"} s, then bots fill the rest`;
  // Whether it will count for your ranking, in words: Solo never does; online, once the bots are in.
  const unranked =
    type === "solo"
      ? "Unranked: solo games don't count for ranking"
      : (filled || bots > 0) && !isRankedMatch(seats.length - bots, size)
        ? `Unranked: fewer than ${rankedMinHumans(size)} real players`
        : null;
  const modeName = raid ? "Boss raid · up to 50" : match.settings.mode === "classic" ? `Classic · ${size} players` : "Crowd · 50 v 50";
  return (
    <div class={`fd-page fd-queue${raid ? " raid" : ""}`}>
      <header class="fd-page-head">
        <BackButton onClick={onCancel} label="Leave the queue" />
        <h1 class="fd-queue-mode">
          {modeName}
          {type === "solo" ? " · Solo" : type === "botsoff" ? " · Bots off" : ""}
        </h1>
        <span class="fd-queue-mute">
          <MuteButton />
        </span>
      </header>
      <div class="fd-queue-info">
        <div class="fd-queue-count" aria-live="polite">
          <span class="fd-count-n">{seats.length}</span> <span class="fd-count-of">/ {size}</span>
        </div>
        <div class="fd-queue-line">{line}</div>
        {unranked && <div class="fd-queue-rank">{unranked}</div>}
        {/* Bots off: one tap to Default, right under the wait (in view on any phone). */}
        {type === "botsoff" && !filled && onLetBotsFill && (
          <button type="button" class="fd-btn fd-letbots" onClick={onLetBotsFill}>
            Switch to Default
            <span>Bots fill the rest · you keep your place</span>
          </button>
        )}
      </div>
      <div class="fd-bar" aria-hidden="true">
        <i style={{ width: `${(100 * seats.length) / size}%` }} />
      </div>
      <div class="fd-queue-panel">
        {grid}
        <LobbyChat match={match} />
        <div class="fd-queue-you">
          <DressedPawn size="card" look={myLook} hat={hat} />
          <div>
            <div class="fd-you-title">You're in · seat 1</div>
            <div class="fd-you-sub">Your pawn is gold-ringed in the grid</div>
          </div>
        </div>
      </div>
      <button type="button" class="fd-btn fd-cancel" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}

/**
 * Servers busy (the matchmaker's overload line): no seat yet, so no grid of people. The same header and Cancel as the
 * queue, with "Servers are busy, you're in line: about N s" (the server's estimate, refreshed every few seconds).
 */
export function QueueLine({ raid, waitSeconds, onCancel }: { raid: boolean; waitSeconds: number; onCancel: () => void }) {
  const size = raid ? 50 : 100;
  return (
    <div class={`fd-page fd-queue${raid ? " raid" : ""}`}>
      <header class="fd-page-head">
        <BackButton onClick={onCancel} label="Leave the queue" />
        <h1 class="fd-queue-mode">{raid ? "Boss raid · up to 50" : "Crowd · 50 v 50"}</h1>
        <span class="fd-queue-mute">
          <MuteButton />
        </span>
      </header>
      <div class="fd-queue-info">
        <div class="fd-queue-line fd-queue-busy" role="status" aria-live="polite">
          Servers are busy, you're in line: about {waitSeconds} s
        </div>
      </div>
      <div class="fd-bar" aria-hidden="true">
        <i style={{ width: "0%" }} />
      </div>
      <div class="fd-queue-panel">
        <Seats seats={[]} size={size} me={null} hat="none" looks={new Map()} bots={0} />
        <div class="fd-queue-you">
          <DressedPawn size="card" look={account().profile?.locker?.look} hat={myHat(account().profile)} />
          <div>
            <div class="fd-you-title">You're in line</div>
            <div class="fd-you-sub">You'll get a seat as soon as one is free</div>
          </div>
        </div>
      </div>
      <button type="button" class="fd-btn fd-cancel" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
