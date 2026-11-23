import { Component } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { CROWD_PARTY, CROWD_PARTY_MAX, FRONT_DOOR, MATCHMAKING, isRankedMatch, rankedMinHumans, type ItemLook, type MatchmakingType, type Settings } from "@chessroyale/core";
import type { LobbyPlayer } from "@chessroyale/chess";
import { BackButton, DressedPawn, FdButton } from "../components/FrontDoor.tsx";
import { MuteButton } from "../components/MuteButton.tsx";
import { account } from "../account.ts";
import { play } from "../sound.ts";
import { openProfile } from "../profile-nav.ts";
import { pawnLook } from "../looks.ts";
import { LobbyChat } from "../components/LobbyChat.tsx";
import type { MatchChat } from "../chat.ts";
import { clockShown } from "../clock-text.ts";
import { keepInQueue, rememberKeepInQueue } from "../search.ts";

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

/**
 * A 50 v 50 party's seat after yours (Eric, Nov 16: "make seven of the 49 spots have a plus ... tap and it'll take you to your
 * friends list"): a friend in the party (away: not connected), a friend invited and not in yet, or room to invite one.
 */
export type PartySlot =
  | { kind: "friend"; key: string; name: string; uid?: string; look?: ItemLook; away?: boolean; lead?: boolean }
  | { kind: "invited"; key: string; name: string }
  | { kind: "open"; key: string };

/**
 * The queue screen as a 50 v 50 party's (docs/decisions/2026-11-16-crowd-party.md): idle (no search yet: your seat, the party's
 * seven others, "+" where a friend can be invited; the leader's Find match) or searching (the party's seats filled, the lobby
 * filling round them as today's queue does).
 */
export interface QueueParty {
  /** The party's other seats (CROWD_PARTY_MAX - 1), in order: friends, then invited, then open. */
  slots: PartySlot[];
  leaderName: string;
  leading: boolean;
  /** No search yet: the count is the party's, its line says what to do. */
  idle: boolean;
  /** Asking for a lobby: "Servers are busy" with its wait (seconds), or null while the matchmaker answers. */
  asking?: { busy: number | null };
  /** A "+" tapped: the friends sheet. */
  onInvite: () => void;
  onFind: () => void;
  onCancel: () => void;
  onLeave: () => void;
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
class SeatPawn extends Component<{ look?: ItemLook }> {
  shouldComponentUpdate(next: { look?: ItemLook }) {
    return next.look !== this.props.look;
  }
  render() {
    return <DressedPawn size="seat" look={this.props.look} />;
  }
}

/** The grid of seats: filled ones in order, then empty ones. Re-rendered only when someone arrives or leaves. */
function Seats({
  seats,
  size,
  me,
  myLook,
  looks,
  bots,
  trickle,
  party,
}: {
  seats: LobbyPlayer[];
  size: number;
  me: string | null;
  myLook?: ItemLook;
  looks: ReadonlyMap<string, ItemLook>;
  bots: number;
  trickle?: boolean;
  /** A 50 v 50 party: its members' seats (dashed gold), then its invited and open ("+") seats after the filled ones. */
  party?: { friends: ReadonlySet<string>; away: ReadonlySet<string>; slots: readonly PartySlot[]; onInvite?: () => void };
}) {
  const pop = usePops();
  // Bots wear what they wear in the match (looks.ts: seeded by their name, the same outfit on the vote board), worked
  // out once each so their pawns aren't redrawn.
  const botLooks = useRef(new Map<string, { look?: ItemLook }>());
  const botLook = (p: LobbyPlayer) => {
    let l = botLooks.current.get(p.id);
    if (!l) botLooks.current.set(p.id, (l = pawnLook({ id: p.id, name: p.name, isYou: false, isBot: true, look: undefined })));
    return l;
  };
  // Bots cascade into their seats within the moment before the match begins (all at once, from the server). Solo's
  // arrive a few at a time already, so each pops as it comes and the count never runs ahead of the grid.
  const botGap = trickle ? 8 : Math.max(8, Math.min(STAGGER_MS, (FRONT_DOOR.fillShowMs - 600) / Math.max(1, bots)));
  return (
    <div class={`fd-seats${size <= 50 ? " half" : ""}${party ? " party" : ""}`} role="img" aria-label={`${seats.length} of ${size} seats filled`}>
      {Array.from({ length: size }, (_, i) => {
        const p = seats[i];
        const slot = !p ? party?.slots[i - seats.length] : undefined;
        if (slot?.kind === "open")
          return (
            <button type="button" key={slot.key} class="fd-seat party-open" disabled={!party?.onInvite} aria-label="Invite a friend" title="Invite a friend" onClick={party?.onInvite}>
              <PlusMark />
            </button>
          );
        if (slot?.kind === "invited")
          return (
            <span key={slot.key} class="fd-seat party-invited" role="img" aria-label={`${slot.name}: invited`} title={`${slot.name}: invited`}>
              <WaitMark />
            </span>
          );
        if (!p) return <span key={`empty-${i}`} class="fd-seat empty" />;
        // Your seat is always the first, under one key whatever your id (none yet, or a new lobby's after a switch), so
        // it never pops twice or blinks out.
        const you = i === 0 && (p.id === me || p.id === SELF);
        const key = you ? SELF : p.id;
        const delay = pop(key, p.isBot, p.isBot ? botGap : STAGGER_MS);
        const dress = you ? { look: myLook } : p.isBot ? botLook(p) : { look: looks.get(p.id) };
        const pawn = <SeatPawn look={dress.look} />;
        const cls = `fd-seat pop${you ? " you" : ""}${p.isBot ? " bot" : ""}${party?.friends.has(p.id) ? " friend" : ""}${party?.away.has(p.id) ? " away" : ""}`;
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

/** A party's open seat: a "+" (drawn, so it scales with the seat). */
const PlusMark = () => (
  <svg class="fd-seat-mark" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 6v12M6 12h12" />
  </svg>
);
/** A party's invited seat: three dots (waiting for their answer). */
const WaitMark = () => (
  <svg class="fd-seat-mark" viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="6.5" cy="12" r="1.6" />
    <circle cx="12" cy="12" r="1.6" />
    <circle cx="17.5" cy="12" r="1.6" />
  </svg>
);

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

/**
 * The queue (docs/mockups/front-door/Queue.dc.html): "38 / 100", a bar, the seconds left, and a seat for everyone.
 * Each person's dressed pawn pops into the next seat as they join, yours first and ringed in gold. When time's up,
 * bots pop into the empty seats (quieter pops) and the match begins. The same screen for each way of being matched:
 * Default (bots after a minute), Bots off (people only, until it's full; one tap lets bots fill instead) and Solo
 * (your bots pop in at once). It says when a match won't count for ranking.
 */
export function QueueScreen({
  match,
  onCancel,
  onLetBotsFill,
  onAway,
  chat = true,
  party,
}: {
  match: QueueView & { readonly chat?: MatchChat };
  onCancel: () => void;
  onLetBotsFill?: () => void;
  /** 50 v 50's public queue: Exit with "Keep me in the queue" (checked) steps out to browse, still queued (search.ts). */
  onAway?: () => void;
  /** The lobby's chat here, under Cancel (a phone). A computer shows it beside the lobby instead (HomeScreen's `chat`). */
  chat?: boolean;
  /** A 50 v 50 party's queue (idle, or searching together). */
  party?: QueueParty;
}) {
  const now = useNow();
  const since = useRef(Date.now());
  const raid = !!match.settings.raid;
  const type = match.queueType;
  const size = match.settings.lobbySize;
  const me = match.myId;
  const players = match.players;
  // Your seat first (even before the server has said so: you're in from the tap), then everyone else in the order they
  // joined, then the bots.
  // A party: its friends right after you, under keys that hold from idle to searching (so nobody pops twice), and the lobby's
  // copy of each left out; idle, their invited and open ("+") seats follow. Searching, an away friend isn't coming: not drawn.
  const partySeats = useMemo(() => {
    if (!party) return null;
    const friends = party.slots.filter((x): x is Extract<PartySlot, { kind: "friend" }> => x.kind === "friend" && (party.idle || !x.away));
    const seatsOf = friends.map((f) => ({ id: `f:${f.uid ?? f.key}`, name: f.name, isBot: false, connected: !f.away, ...(f.uid ? { uid: f.uid } : {}), ...(f.look ? { look: f.look } : {}) }) as LobbyPlayer);
    const uids = new Set(friends.map((f) => f.uid).filter(Boolean));
    return {
      players: seatsOf,
      uids,
      ids: new Set(seatsOf.map((p) => p.id)),
      away: new Set(seatsOf.filter((p) => !p.connected).map((p) => p.id)),
      looks: new Map(seatsOf.flatMap((p) => (p.look ? [[p.id, p.look] as const] : []))),
      slots: party.idle ? party.slots.filter((x) => x.kind !== "friend") : [],
    };
  }, [party]);
  const seats = useMemo(() => {
    const people = players.filter((p) => !p.isBot && !(p.uid && partySeats?.uids.has(p.uid)));
    const mine = people.find((p) => p.id === me) ?? ({ id: SELF, name: "You", isBot: false, connected: true } as LobbyPlayer);
    return [mine, ...(partySeats?.players ?? []), ...people.filter((p) => p !== mine), ...players.filter((p) => p.isBot)].slice(0, size);
  }, [players, me, size, partySeats]);
  const bots = seats.filter((p) => p.isBot).length;
  const left = match.fillAt ? Math.max(0, Math.ceil((match.fillAt - now) / 1000)) : null;
  const filled = !!match.filledAt;
  const myLook = account().profile?.locker?.look;
  const looks = useMemo(() => (partySeats?.looks.size ? new Map([...match.looks, ...partySeats.looks]) : match.looks), [match.looks, partySeats]);
  const grid = useMemo(
    () => (
      <Seats
        seats={seats}
        size={size}
        me={me}
        myLook={myLook}
        looks={looks}
        bots={bots}
        trickle={type === "solo"}
        {...(partySeats ? { party: { friends: partySeats.ids, away: partySeats.away, slots: partySeats.slots, ...(party?.idle ? { onInvite: party.onInvite } : {}) } } : {})}
      />
    ),
    [seats, size, me, myLook, bots, looks, partySeats, party?.idle],
  );
  const idle = !!party?.idle;
  const members = 1 + (partySeats?.players.length ?? 0);
  const line = party?.asking
    ? party.asking.busy !== null
      ? `Servers are busy, you're in line: about ${party.asking.busy} s`
      : "Finding a lobby for your party…"
    : idle
      ? party!.leading
        ? "Tap + to invite friends, then Find match"
        : `${party!.leaderName} starts the search`
      : filled
    ? raid
      ? "Here we go: the Boss Battle begins"
      : bots
        ? `${type === "solo" ? "Full" : "Bots fill the rest"} · here we go`
        : "Full · here we go"
    : type === "solo"
      ? "Solo · your bots are taking their seats"
      : type === "botsoff"
        ? `No bots · waiting ${clockShown(now - since.current)} for ${raid ? `50 (or ${MATCHMAKING.raidBotsOffMinPlayers} after a minute)` : `all ${size}`}`
        : `Finding players · ${left ?? "…"} s, then bots fill the rest`;
  // Whether it will count for your ranking, in words: Solo never does; online, once the bots are in.
  const unranked =
    type === "solo"
      ? "Unranked: solo games don't count for ranking"
      : (filled || bots > 0) && !isRankedMatch(seats.length - bots, size)
        ? `Unranked: fewer than ${rankedMinHumans(size)} real players`
        : null;
  const modeName = raid ? "Boss Battle" : match.settings.mode === "classic" ? `Classic · ${size} players` : "Crowd · 50 v 50";
  const exit = useQueueExit(onCancel, onAway, filled);
  // A party's row, in Cancel's place: Leave, and the leader's Find match (Cancel once searching; greyed once the lobby has
  // filled) or a member's greyed "Waiting for <leader>" (never hidden). Under it, greyed, that party matches aren't ranked
  // (CROWD_PARTY.ranked: the fix round of #747, M3), on every one of its screens, so nothing moves.
  const partyRow = party && (
    <div class="fd-party-actions">
      <div class="fd-party-row">
        <FdButton class="fd-party-leave" onClick={party.onLeave}>
          Leave
        </FdButton>
        {!party.leading ? (
          <FdButton class="fd-party-go" disabled>
            Waiting for {party.leaderName}
          </FdButton>
        ) : idle ? (
          <FdButton primary class="fd-party-go" onClick={party.onFind}>
            Find match
          </FdButton>
        ) : (
          <FdButton class="fd-party-go" disabled={filled} onClick={party.onCancel}>
            Cancel
          </FdButton>
        )}
      </div>
      {!CROWD_PARTY.ranked && <div class="fd-party-note">Party matches aren't ranked</div>}
    </div>
  );
  return (
    <div class={`fd-page fd-queue${raid ? " raid" : ""}${party ? " party" : ""}`}>
      <header class="fd-page-head">
        <BackButton onClick={party ? party.onLeave : exit.go} label={party ? "Leave the party" : exit.label} />
        <h1 class="fd-queue-mode">
          {modeName}
          {party ? " · Party" : type === "solo" ? " · Solo" : type === "botsoff" ? " · Bots off" : ""}
        </h1>
        <span class="fd-queue-mute">
          <MuteButton />
        </span>
      </header>
      <div class="fd-queue-info">
        <div class="fd-queue-count" aria-live="polite">
          <span class="fd-count-n">{idle || party?.asking ? members : seats.length}</span> <span class="fd-count-of">/ {idle || party?.asking ? CROWD_PARTY_MAX : size}</span>
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
        <i style={{ width: `${idle || party?.asking ? (100 * members) / CROWD_PARTY_MAX : (100 * seats.length) / size}%` }} />
      </div>
      <div class="fd-queue-panel">
        {grid}
        <div class={`fd-queue-you${party ? " party" : ""}`}>
          <DressedPawn size="card" look={myLook} own />
          <div>
            <div class="fd-you-title">{party ? partyTitle(party) : "You're in · seat 1"}</div>
            <div class="fd-you-sub">{party ? partySub(party) : "Your pawn is gold-ringed in the grid"}</div>
            {party && <div class="fd-you-line">{partyLine(party)}</div>}
          </div>
        </div>
      </div>
      {partyRow ??
        exit.row ?? (
          <button type="button" class="fd-btn fd-cancel" onClick={onCancel}>
            Cancel
          </button>
        )}
      {/* (A phone: the lobby's chat under Cancel, so the count, the grid and Cancel are all in view; it fills the rest.) */}
      {chat && (
        <div class="fd-queue-chat">
          <LobbyChat match={match} />
        </div>
      )}
    </div>
  );
}

/** Who's in the party and who's invited, by name. */
function partyNames(p: QueueParty): { friends: string[]; invited: string[] } {
  // (The leader is named on their own: "Sam leads", "Sam's party".)
  const names = (k: "friend" | "invited") => p.slots.flatMap((x) => (x.kind === k && !(x.kind === "friend" && x.lead) ? [x.name] : []));
  // (Searching, an invite still out isn't coming along: only the idle party names it.)
  return { friends: names("friend"), invited: p.idle ? names("invited") : [] };
}
/** A computer's card: whose party, how many are in. */
function partyTitle(p: QueueParty): string {
  const n = 1 + p.slots.filter((x) => x.kind === "friend").length;
  return `${p.leading ? "Your party" : `${p.leaderName}'s party`} · ${n} of ${CROWD_PARTY_MAX}`;
}
/** A computer's card sub line: who's in with you, who's invited. */
function partySub(p: QueueParty): string {
  const { friends, invited } = partyNames(p);
  if (!friends.length && !invited.length) return p.idle ? "Tap a + to invite a friend" : "Just you";
  return [friends.length ? `With ${friends.join(", ")}` : "", invited.length ? `Invited: ${invited.join(", ")}` : ""].filter(Boolean).join(" · ");
}
/**
 * A phone's one line under the grid: who's in and who's invited (leading, Find match says the rest); a member's starts with who
 * leads. Long names run out of room: each seat's pawn opens its player's profile.
 */
function partyLine(p: QueueParty): string {
  const { friends, invited } = partyNames(p);
  const parts = [p.leading ? "" : `${p.leaderName} leads`, friends.length ? friends.join(", ") : "", invited.length ? `${invited.join(", ")} invited` : ""].filter(Boolean);
  if (parts.length) return parts.join(" · ");
  return p.idle && p.leading ? "Your party · tap a + to invite a friend" : "Your party";
}

/**
 * A lobby's way out (Eric, Nov 10: "an exit ... but stay in the queue"): where Cancel was, in the same box, "Keep me in the
 * queue" (checked unless this device unchecked it) and Exit. Checked, Exit steps out to browse with the search going (home's
 * rows, the bar on other pages: search.ts); unchecked, it leaves the queue, as Cancel did. The header's back does the same.
 * Once the lobby has filled (the match is about to begin) a checked Exit greys: there's nothing left to wait for.
 * Without `onAway` (Solo filling, a raid's or a party's queue): Cancel, as before.
 */
export function useQueueExit(onCancel: () => void, onAway: (() => void) | undefined, filled: boolean) {
  const [keep, setKeep] = useState(keepInQueue);
  if (!onAway) return { go: onCancel, label: "Leave the queue", row: null };
  const stays = keep && filled;
  const go = () => (keep ? !stays && onAway() : onCancel());
  const row = (
    <div class="fd-exit-row">
      <label class="fd-keep">
        <input
          type="checkbox"
          checked={keep}
          onChange={(e) => {
            const v = (e.target as HTMLInputElement).checked;
            setKeep(v);
            rememberKeepInQueue(v);
          }}
        />
        <span>Keep me in the queue</span>
      </label>
      <button type="button" class="fd-btn fd-cancel fd-exit" disabled={stays} onClick={go}>
        Exit
      </button>
    </div>
  );
  return { go, label: keep ? "Exit, keep searching" : "Exit, leave the queue", row };
}

/**
 * Servers busy (the matchmaker's overload line): no seat yet, so no grid of people. The same header and Cancel as the
 * queue, with "Servers are busy, you're in line: about N s" (the server's estimate, refreshed every few seconds).
 */
export function QueueLine({ raid, waitSeconds, onCancel, title, seats }: { raid: boolean; waitSeconds: number; onCancel: () => void; title?: string; seats?: number }) {
  const size = seats ?? (raid ? 50 : 100);
  return (
    <div class={`fd-page fd-queue${raid ? " raid" : ""}`}>
      <header class="fd-page-head">
        <BackButton onClick={onCancel} label="Leave the queue" />
        <h1 class="fd-queue-mode">{title ?? (raid ? "Boss Battle" : "Crowd · 50 v 50")}</h1>
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
        <Seats seats={[]} size={size} me={null} looks={new Map()} bots={0} />
        <div class="fd-queue-you">
          <DressedPawn size="card" look={account().profile?.locker?.look} own />
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
