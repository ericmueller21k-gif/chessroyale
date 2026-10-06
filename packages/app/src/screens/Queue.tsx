import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { FRONT_DOOR, type ItemLook } from "@chessroyale/core";
import type { LobbyPlayer } from "@chessroyale/chess";
import { BackButton, DressedPawn, myHat } from "../components/FrontDoor.tsx";
import { MuteButton } from "../components/MuteButton.tsx";
import { account } from "../account.ts";
import { play } from "../sound.ts";
import type { NetMatch } from "../net.ts";

/** How far apart pops start when several pawns arrive at once (people; bots cascade faster, see below). */
const STAGGER_MS = 40;
/** At most one pop sound this often, however many pawns pop. */
const SOUND_GAP_MS = 70;

/**
 * Pops, scheduled: each pawn that appears gets a start time at least STAGGER_MS after the last one's (bots closer
 * together), and a pop sound unless one played less than SOUND_GAP_MS ago. Mute is respected by play().
 */
function usePops() {
  const at = useRef(new Map<string, number>());
  const last = useRef(0);
  const lastSound = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  /** The delay (ms) before this seat's pop, decided the first time it's seen. */
  return (id: string, bot: boolean, gap: number): number => {
    const known = at.current.get(id);
    const now = performance.now();
    if (known !== undefined) return Math.max(0, known - now);
    const start = Math.max(now, last.current + gap);
    last.current = start;
    at.current.set(id, start);
    const delay = start - now;
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

/** The grid of seats: filled ones in order, then empty ones. Re-rendered only when someone arrives or leaves. */
function Seats({ seats, size, me, myLook, hat, looks, bots }: { seats: LobbyPlayer[]; size: number; me: string | null; myLook?: ItemLook; hat: string; looks: Map<string, ItemLook>; bots: number }) {
  const pop = usePops();
  // Bots cascade into their seats within the moment before the match begins.
  const botGap = Math.max(8, Math.min(STAGGER_MS, (FRONT_DOOR.fillShowMs - 600) / Math.max(1, bots)));
  return (
    <div class={`fd-seats${size <= 50 ? " half" : ""}`} role="img" aria-label={`${seats.length} of ${size} seats filled`}>
      {Array.from({ length: size }, (_, i) => {
        const p = seats[i];
        if (!p) return <span key={`empty-${i}`} class="fd-seat empty" />;
        const you = p.id === me;
        const delay = pop(p.id, p.isBot, p.isBot ? botGap : STAGGER_MS);
        return (
          <span key={p.id} class={`fd-seat pop${you ? " you" : ""}${p.isBot ? " bot" : ""}`} style={{ "--pop-delay": `${Math.round(delay)}ms` }} title={you ? "You" : p.name}>
            <DressedPawn size="seat" look={you ? myLook : looks.get(p.id)} hat={you ? hat : "none"} />
          </span>
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

/**
 * The queue (docs/mockups/front-door/Queue.dc.html): "38 / 100", a bar, the seconds left, and a seat for everyone.
 * Each person's dressed pawn pops into the next seat as they join, yours first and ringed in gold. When time's up,
 * bots pop into the empty seats (plain pawns, quieter pops) and the match begins.
 */
export function QueueScreen({ match, onCancel }: { match: NetMatch; onCancel: () => void }) {
  const now = useNow();
  const raid = !!match.settings.raid;
  const size = match.settings.lobbySize;
  const me = match.myId;
  const players = match.players;
  // Your seat first, then everyone else in the order they joined, then the bots.
  const seats = useMemo(() => {
    const people = players.filter((p) => !p.isBot);
    return [...people.filter((p) => p.id === me), ...people.filter((p) => p.id !== me), ...players.filter((p) => p.isBot)].slice(0, size);
  }, [players, me, size]);
  const bots = seats.filter((p) => p.isBot).length;
  const left = match.fillAt ? Math.max(0, Math.ceil((match.fillAt - now) / 1000)) : null;
  const filled = !!match.filledAt;
  const myLook = account().profile?.locker?.look;
  const hat = myHat(account().profile);
  const grid = useMemo(
    () => <Seats seats={seats} size={size} me={me} myLook={myLook} hat={hat} looks={match.looks} bots={bots} />,
    [seats, size, me, myLook, hat, bots],
  );
  const line = filled
    ? raid
      ? "Here we go: the raid begins"
      : bots
        ? "Bots fill the rest · here we go"
        : "Full · here we go"
    : `Finding players · ${left ?? "…"} s, then ${raid ? "the raid begins" : "bots fill the rest"}`;
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
        <div class="fd-queue-count" aria-live="polite">
          <span class="fd-count-n">{seats.length}</span> <span class="fd-count-of">/ {size}</span>
        </div>
        <div class="fd-queue-line">{line}</div>
      </div>
      <div class="fd-bar" aria-hidden="true">
        <i style={{ width: `${(100 * seats.length) / size}%` }} />
      </div>
      <div class="fd-queue-panel">
        {grid}
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
