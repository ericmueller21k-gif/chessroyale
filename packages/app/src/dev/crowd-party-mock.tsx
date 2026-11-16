import { useLayoutEffect, useMemo, useState } from "preact/hooks";
import { CROWD_PARTY_MAX, DEFAULT_SETTINGS, botLook, modeSettings, type FriendEntry, type Settings } from "@chessroyale/core";
import type { LobbyPlayer } from "@chessroyale/chess";
import { QueueScreen, type PartySlot, type QueueView } from "../screens/Queue.tsx";
import { InviteSheet } from "../components/Friends.tsx";
import { friendsState, mockFriendsList, onFriendsChange } from "../friends.ts";
import { testParams } from "../test-switches.ts";

/**
 * The 50 v 50 party's mockup (round 1, Nov 16; docs/decisions/2026-11-16-crowd-party.md): the real queue screen in party mode with
 * fake data, no server. `?crowdparty=<step>` (test switches only): alone, sheet (the friends sheet open from a "+"), invited,
 * joined, member (a friend's view of the same party), searching (Find match pressed: the lobby filling round the party).
 */
export type MockStep = "alone" | "sheet" | "invited" | "joined" | "member" | "searching";
const STEPS: readonly MockStep[] = ["alone", "sheet", "invited", "joined", "member", "searching"];

export function crowdPartyMockAsked(): MockStep | null {
  const v = testParams().get("crowdparty");
  return v && (STEPS as readonly string[]).includes(v) ? (v as MockStep) : null;
}

const HOUR = 3_600_000;
const friend = (id: string, name: string, extra: Partial<FriendEntry>): FriendEntry => ({ id, name, since: 0, online: false, busy: false, hidden: false, ...extra });
/** The mock's friends (handles, never a real person's name). */
const FRIENDS: FriendEntry[] = [
  friend("u-knight", "KnightOwl", { online: true, doing: "home" }),
  friend("u-pawn", "PawnStorm", { online: true, doing: "town" }),
  friend("u-queen", "QueenBee42", { online: true, doing: "home" }),
  friend("u-castle", "Castle_Kid", { online: true, busy: true, doing: "crowd" }),
  friend("u-rook", "RookieRook", { lastSeen: Date.now() - 2 * HOUR }),
  friend("u-bishop", "BishopBlue", { lastSeen: Date.now() - 26 * HOUR }),
];

const pal = (uid: string, name: string, extra: Partial<Extract<PartySlot, { kind: "friend" }>> = {}): PartySlot => ({ kind: "friend", key: uid, uid, name, ...botLook(name), ...extra });
const open = (n: number, from = 0): PartySlot[] => Array.from({ length: n }, (_, i) => ({ kind: "open", key: `open-${from + i}` }));

/** The party's other seats at each step (CROWD_PARTY_MAX - 1 of them). */
function slotsFor(step: MockStep): PartySlot[] {
  const seven = (xs: PartySlot[]) => [...xs, ...open(CROWD_PARTY_MAX - 1 - xs.length, xs.length)];
  switch (step) {
    case "alone":
    case "sheet":
      return seven([]);
    case "invited":
      return seven([{ kind: "invited", key: "inv-queen", name: "QueenBee42" }]);
    case "joined":
    case "searching":
      return seven([pal("u-knight", "KnightOwl"), pal("u-pawn", "PawnStorm"), { kind: "invited", key: "inv-queen", name: "QueenBee42" }]);
    case "member":
      return seven([pal("u-lead", "Castle_Kid", { lead: true }), pal("u-knight", "KnightOwl"), pal("u-pawn", "PawnStorm", { away: true })]);
  }
}

/** Strangers in the lobby while it fills (searching): people who pressed PLAY too. */
const STRANGERS = ["Gambit_Girl", "e4enjoyer", "TacticToad", "MateInTwo", "SilentRook", "Zugzwang99", "ForkFinder", "LuftLord", "PinMaster", "BlunderBus", "EnPassantPal"];

export function CrowdPartyMock({ step }: { step: MockStep }) {
  const [sheet, setSheet] = useState(step === "sheet");
  // (The friends list as if the server had sent it, before the first paint.)
  // (Before the first render, so the sheet reads it; again whenever the account's arrival clears it.)
  const fake = () => mockFriendsList({ friends: FRIENDS, requests: [], sent: [], invites: [], blocked: [], settings: { invites: "everyone", showOnline: true } });
  useState(fake);
  useLayoutEffect(() => onFriendsChange(() => !friendsState() && fake()), []);
  const slots = useMemo(() => slotsFor(step), [step]);
  const searching = step === "searching";
  const leading = step !== "member";
  const view = useMemo<QueueView>(() => {
    const settings = { ...DEFAULT_SETTINGS, ...modeSettings("crowd") } as Settings;
    const me: LobbyPlayer = { id: "me", name: "You", isBot: false, connected: true };
    // (Searching: the lobby's copy of the party, and strangers who joined round it.)
    const lobby: LobbyPlayer[] = searching
      ? [
          me,
          { id: "p-knight", name: "KnightOwl", uid: "u-knight", isBot: false, connected: true },
          { id: "p-pawn", name: "PawnStorm", uid: "u-pawn", isBot: false, connected: true },
          ...STRANGERS.map((name, i) => ({ id: `s${i}`, name, uid: `u-s${i}`, isBot: false, connected: true, ...botLook(name) })),
        ]
      : [me];
    const looks = new Map(lobby.flatMap((p) => (p.look ? [[p.id, p.look] as const] : [])));
    return { settings, myId: "me", players: lobby, looks, fillAt: searching ? Date.now() + 41_000 : null, filledAt: null, queueType: "default" };
  }, [step]);
  const inParty = new Set(slots.flatMap((s) => (s.kind === "friend" && s.uid ? [s.uid] : [])));
  const invited = new Set(slots.some((s) => s.kind === "invited") ? ["u-queen"] : []);
  const noop = () => undefined;
  return (
    <>
      <QueueScreen
        match={view}
        onCancel={noop}
        chat={false}
        party={{ slots, leaderName: leading ? "You" : "Castle_Kid", leading, idle: !searching, onInvite: () => setSheet(true), onFind: noop, onCancel: noop, onLeave: noop }}
      />
      {sheet && <InviteSheet onClose={() => setSheet(false)} party={{ inParty, invited, full: inParty.size + invited.size >= CROWD_PARTY_MAX - 1 }} />}
    </>
  );
}
