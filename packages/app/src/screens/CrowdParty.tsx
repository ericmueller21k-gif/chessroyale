import { useEffect, useMemo, useState } from "preact/hooks";
import { CROWD_PARTY_MAX, DEFAULT_SETTINGS, modeSettings } from "@chessroyale/core";
import type { MatchChat } from "../chat.ts";
import type { PartyClient } from "../squads.ts";
import { InviteSheet } from "../components/Friends.tsx";
import { QueueScreen, type PartySlot, type QueueParty, type QueueView } from "./Queue.tsx";

/**
 * 50 v 50's party (Eric, Nov 16; docs/decisions/2026-11-16-crowd-party.md): the queue screen in party mode, from the party's own
 * state. Idle (no search yet): your seat, the friends in it, "…" for one invited, "+" for room to invite (a tap opens your friends
 * sheet), and the leader's Find match. Asking (the matchmaker's answer on its way). Searching (`lobby`: the 50 v 50 lobby it was
 * placed in, filling round the party), with the leader's Cancel bringing everyone back to idle.
 */

/** The party's other seats (CROWD_PARTY_MAX - 1): its friends as they joined, then those invited, then "+". */
export function partySlots(client: PartyClient, serverNow: number): PartySlot[] {
  const p = client.party;
  if (!p) return Array.from({ length: CROWD_PARTY_MAX - 1 }, (_, i) => ({ kind: "open", key: `open-${i}` }));
  const friends: PartySlot[] = p.members
    .filter((m) => m.id !== client.memberId)
    .map((m) => ({ kind: "friend", key: m.id, name: m.name, ...(m.uid ? { uid: m.uid } : {}), ...(m.look ? { look: m.look } : {}), ...(m.connected ? {} : { away: true }), ...(m.id === p.leaderId ? { lead: true } : {}) }));
  const invited: PartySlot[] = (p.invited ?? []).filter((i) => i.expiresAt > serverNow).map((i) => ({ kind: "invited", key: `inv-${i.uid}`, name: i.name }));
  const taken = [...friends, ...invited].slice(0, CROWD_PARTY_MAX - 1);
  return [...taken, ...Array.from({ length: CROWD_PARTY_MAX - 1 - taken.length }, (_, i): PartySlot => ({ kind: "open", key: `open-${i}` }))];
}

/** The queue screen's numbers while no lobby is open yet (idle, or asking): a 50 v 50's, nobody seated. */
const idleView = (): QueueView => ({
  settings: { ...DEFAULT_SETTINGS, ...modeSettings("crowd", { augments: true }) },
  myId: null,
  players: [],
  looks: new Map(),
  fillAt: null,
  filledAt: null,
  queueType: "default",
});

export function CrowdPartyScreen({
  client,
  lobby,
  onLeave,
  chat = false,
}: {
  client: PartyClient;
  /** Placed: the lobby filling round the party (its queue screen's numbers and chat). */
  lobby?: QueueView & { readonly chat?: MatchChat };
  /** Leave the party (and its lobby, if in one). */
  onLeave: () => void;
  /** The lobby's chat under the buttons (a phone, searching). */
  chat?: boolean;
}) {
  const [, setTick] = useState(0);
  const [sheet, setSheet] = useState(false);
  // (Every change to the party, and a second's tick so an invite that lapses turns back into a "+" without a message.)
  useEffect(() => client.subscribe(() => setTick((n) => n + 1)), [client]);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const idle = useMemo(idleView, []);
  const p = client.party;
  const slots = partySlots(client, Date.now() + client.skew);
  const leader = p?.members.find((m) => m.id === p.leaderId);
  const searching = !!lobby;
  const asking = !searching && p?.state === "queueing";
  const party: QueueParty = {
    slots,
    leaderName: client.isLeader ? "You" : (leader?.name ?? "the leader"),
    leading: client.isLeader,
    idle: !searching && !asking,
    ...(asking ? { asking: { busy: p?.busy ? p.busy.waitSeconds : null } } : {}),
    onInvite: () => setSheet(true),
    onFind: () => client.queue(),
    onCancel: () => client.cancel(),
    onLeave,
  };
  const inParty = new Set(p?.members.flatMap((m) => (m.uid ? [m.uid] : [])) ?? []);
  const invited = new Set(slots.flatMap((s) => (s.kind === "invited" ? [s.key.slice(4)] : [])));
  return (
    <>
      <QueueScreen match={lobby ?? idle} onCancel={onLeave} chat={searching && chat} party={party} />
      {sheet && !searching && !asking && <InviteSheet onClose={() => setSheet(false)} party={{ inParty, invited, full: inParty.size + invited.size >= CROWD_PARTY_MAX }} />}
    </>
  );
}
