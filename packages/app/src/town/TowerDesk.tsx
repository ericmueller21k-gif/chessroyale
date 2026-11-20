import { useEffect, useRef, useState } from "preact/hooks";
import { createPortal } from "preact/compat";
import { TOWER_PARTY } from "@chessroyale/core";
import { Confirm } from "../components/MatchMenu.tsx";
import { InviteSheet } from "../components/Friends.tsx";
import { PARTY_COLORS } from "../board/logic.ts";
import { TOWER_WORDS, loadKept, settle, towerApi, type RunKind, type TowerState } from "../tower.ts";
import { leaveTowerParty, makeTowerParty, onTowerParty, openTowerParty, planWords, towerParty } from "../tower-party.ts";
import { chatTestRoom } from "./chat-net.ts";
import "../tower.css";

/**
 * The Battle Tower's clerk's card (PR 11b, Eric, Nov 19: "you walk into the battle tower, you talk to the clerk, you start a match"): the
 * only way into the climb. Its three ways to climb, always shown (Eric, Nov 20: "there should be a solo mode, and then there have an
 * invite friends, or another option, which is like basically like open party"; docs/decisions/2026-11-20-tower-party.md):
 * - **Solo** (today's): Start, or "Continue: floor N", and a small "Start over" that asks first; beside it, "Alone: floor N", your party
 *   climb played on by yourself (from then on solo: Eric, "you can continue on your own, but it's just solo from that point forward").
 * - **Invite friends**: a party (made the first time) and your friends list to invite from.
 * - **Open party**: a party, and its line in the town's chat ("Ann is looking for 3 more to climb the Battle Tower", with Join).
 * The panel under them keeps its size: your solo climb, or, in a party, its seats, what START does (`plan`) and READY or START. Nothing
 * hidden: an option that doesn't apply now shows greyed. `onGo`: a floor of yours is ready, you walk into the elevator (Town.tsx).
 */
export function TowerDesk({ onGo, onBest }: { onGo: (kind: RunKind) => void; onBest: (best: number) => void }) {
  const [st, setSt] = useState<TowerState | null>(null);
  const [busy, setBusy] = useState(true);
  const [note, setNote] = useState<string | null>(null);
  const [ask, setAsk] = useState<{ kind: "over"; floor: number } | { kind: "ready" | "start"; floor: number } | null>(null);
  const [inviting, setInviting] = useState(false);
  const [, redraw] = useState(0);
  const alive = useRef(true);
  useEffect(() => () => void (alive.current = false), []);
  useEffect(() => onTowerParty(() => redraw((n) => n + 1)), []);
  const load = async () => {
    setBusy(true);
    const kept = loadKept();
    if (kept?.done) {
      const end = await settle(kept);
      if (end.error && alive.current) setNote(end.error);
    }
    const s = await towerApi.state();
    if (!alive.current) return;
    setBusy(false);
    if (!s.ok) return setNote(s.body.message ?? TOWER_WORDS.offline);
    setSt(s.body);
    onBest(s.body.best.solo);
  };
  useEffect(() => void load(), []);
  /** A new run (`confirm`: in place of the saved one), then up the elevator. */
  const start = async (confirm: boolean) => {
    setBusy(true);
    setNote(null);
    const a = await towerApi.newRun(confirm);
    if (!alive.current) return;
    setBusy(false);
    if (a.ok) return onGo("solo");
    if (a.status === 409 && a.body.run) return setAsk({ kind: "over", floor: a.body.run.floor });
    setNote(a.body.message ?? TOWER_WORDS.offline);
  };
  /** Into a party (made the first time). False: it couldn't be (its words shown). */
  const party = async (): Promise<boolean> => {
    if (towerParty()) return true;
    setBusy(true);
    setNote(null);
    const err = await makeTowerParty();
    if (!alive.current) return false;
    setBusy(false);
    if (err !== null) setNote(err || null);
    return err === null;
  };
  const invite = async () => {
    if (await party()) setInviting(true);
  };
  const open = async () => {
    if (await party()) openTowerParty(chatTestRoom() ?? undefined);
  };
  const run = st?.runs.solo ?? null;
  const copy = st?.runs.party ?? null;
  const p = towerParty();
  const view = p?.party ?? null;
  const me = p?.me ?? null;
  const leading = !!p?.isLeader;
  const full = (view?.members.length ?? 0) >= TOWER_PARTY.max;
  const nameOf = (id: string) => view?.members.find((m) => m.id === id)?.name ?? "A member";
  const plan = planWords(view?.tower?.plan, p?.memberId ?? null, nameOf);
  const waiting = view ? view.members.filter((m) => m.id !== view.leaderId && m.connected && !m.ready) : [];
  // (Your party copy under way with your party: its floor is the room's; played alone: the clerk's Continue picks it up.)
  const copyBusy = !!copy?.fight?.lobby;
  const seats = Array.from({ length: TOWER_PARTY.max }, (_, seat) => view?.members.find((m) => m.seat === seat) ?? null);
  const readyOrStart = (confirmed = false) => {
    if (!p) return;
    if (leading) {
      if (plan.endsMine !== null && !confirmed) return setAsk({ kind: "start", floor: plan.endsMine });
      return p.start(confirmed);
    }
    if (!me?.ready && plan.endsMine !== null && !confirmed) return setAsk({ kind: "ready", floor: plan.endsMine });
    p.ready(!me?.ready);
  };
  return (
    <div class="tw-desk">
      <div class="tw-desk-ways" role="group" aria-label="How to climb">
        <button type="button" class={`tw-way${p ? "" : " on"}`} aria-pressed={!p} disabled={!!p} title={p ? "Leave the party to climb alone" : undefined}>
          Solo
        </button>
        <button type="button" class="tw-way" disabled={busy || (!!p && full)} onClick={() => void invite()}>
          Invite friends
        </button>
        <button type="button" class={`tw-way${view?.tower?.open ? " on" : ""}`} aria-pressed={!!view?.tower?.open} disabled={busy || (!!p && (!leading || full || !!view?.tower?.open))} onClick={() => void open()}>
          Open party
        </button>
      </div>
      <div class="tw-desk-panel">
        {!p ? (
          <>
            {run ? (
              <button type="button" class="town-btn primary" disabled={busy} onClick={() => onGo("solo")}>
                Continue: floor {run.floor}
              </button>
            ) : (
              <button type="button" class="town-btn primary" disabled={busy || !st} onClick={() => void start(false)}>
                Start
              </button>
            )}
            <div class="tw-desk-row">
              <button type="button" class="town-btn tw-over" disabled={busy || !run} onClick={() => run && setAsk({ kind: "over", floor: run.floor })}>
                Start over
              </button>
              <button type="button" class="town-btn tw-over" disabled={busy || !copy || copyBusy} title={copy ? undefined : "No party climb to go on with"} onClick={() => onGo("party")}>
                {copy ? `Alone: floor ${copy.floor}` : "Alone"}
              </button>
            </div>
            <p class="town-card-text tw-desk-note" role="status">
              {note ??
                (st
                  ? copy && copyBusy
                    ? `Your party is on floor ${copy.floor}.`
                    : run
                      ? "Your run is saved."
                      : copy
                        ? `Your party climb is on floor ${copy.floor}.`
                        : "A climb of 99 floors. One loss ends it."
                  : "Reading your climb…")}
            </p>
          </>
        ) : (
          <>
            <ul class="tw-seats" aria-label="Your party">
              {seats.map((m, seat) => (
                <li key={seat} class={`tw-seat${m ? "" : " free"}${m && !m.connected ? " away" : ""}`} style={{ "--pt-c": PARTY_COLORS[seat] ?? PARTY_COLORS[0] }}>
                  <span class="tw-seat-dot" aria-hidden="true" />
                  <span class="tw-seat-name">{m ? `${m.name}${m.id === p.memberId ? " (you)" : ""}` : "Open seat"}</span>
                  {m && (m.id === view?.leaderId ? <span class="tw-seat-mark" aria-label="leader">★</span> : m.ready ? <span class="tw-seat-mark" aria-label="ready">✓</span> : null)}
                </li>
              ))}
            </ul>
            <p class="town-card-text tw-desk-note tw-plan" role="status">
              {p.error ?? note ?? (plan.ok && leading && waiting.length ? `${plan.line} Waiting for ${waiting.map((w) => w.name).join(", ")}.` : plan.line || "Joining…")}
            </p>
            <div class="tw-desk-row">
              <button type="button" class="town-btn primary" disabled={!view || !plan.ok || (leading && waiting.length > 0)} aria-pressed={leading ? undefined : !!me?.ready} onClick={() => readyOrStart()}>
                {leading ? "START" : me?.ready ? "READY ✓" : "READY"}
              </button>
              <button type="button" class="town-btn tw-over" onClick={() => (leaveTowerParty(), void load())}>
                Leave party
              </button>
            </div>
          </>
        )}
      </div>
      {/* (Over the whole page, not inside the card: the card is placed by a transform.) */}
      {ask &&
        createPortal(
          <div class="mm-scrim" onClick={() => setAsk(null)}>
            {ask.kind === "over" ? (
              <Confirm heading="Start over from floor 1?" note={TOWER_WORDS.replace(ask.floor)} go="Start over" onCancel={() => setAsk(null)} onGo={() => (setAsk(null), void start(true))} />
            ) : (
              <Confirm heading="Start a new climb?" note={`Your party climb on floor ${ask.floor} ends, and this party starts on floor 1.`} go={ask.kind === "start" ? "Start" : "Ready"} onCancel={() => setAsk(null)} onGo={() => (setAsk(null), readyOrStart(true))} />
            )}
          </div>,
          document.body,
        )}
      {inviting &&
        p &&
        createPortal(
          <InviteSheet
            onClose={() => setInviting(false)}
            party={{ inParty: new Set(view?.members.flatMap((m) => (m.uid ? [m.uid] : [])) ?? []), invited: new Set(), full, line: `Up to ${TOWER_PARTY.max - 1} friends climb with you, everyone picking every move.` }}
          />,
          document.body,
        )}
    </div>
  );
}

/**
 * Your party's way up from the floor room (Nov 20): back from a floor it won, the elevator's card is the party's START (the leader's, once
 * everyone's READY) or your READY, with what START does (`plan`: on to floor N+1, or a new climb when the party changed, asked first).
 */
export function TowerPartyUp({ floor }: { floor: number }) {
  const [, redraw] = useState(0);
  const [ask, setAsk] = useState<{ kind: "ready" | "start"; floor: number } | null>(null);
  useEffect(() => onTowerParty(() => redraw((n) => n + 1)), []);
  const p = towerParty();
  const view = p?.party ?? null;
  const leading = !!p?.isLeader;
  const me = p?.me ?? null;
  const nameOf = (id: string) => view?.members.find((m) => m.id === id)?.name ?? "A member";
  const plan = planWords(view?.tower?.plan, p?.memberId ?? null, nameOf);
  const waiting = view ? view.members.filter((m) => m.id !== view.leaderId && m.connected && !m.ready) : [];
  const go = (confirmed = false) => {
    if (!p) return;
    if (plan.endsMine !== null && !confirmed && (leading || !me?.ready)) return setAsk({ kind: leading ? "start" : "ready", floor: plan.endsMine });
    if (leading) p.start(confirmed);
    else p.ready(!me?.ready);
  };
  const word = leading ? `Up to floor ${floor + 1}` : me?.ready ? "READY ✓" : "READY";
  return (
    <>
      <button type="button" class="town-btn primary" disabled={!view || !plan.ok || (leading && waiting.length > 0)} aria-pressed={leading ? undefined : !!me?.ready} onClick={() => go()}>
        {word}
      </button>
      <p class="town-card-text" role="status">
        {p?.error ?? (leading && plan.ok && waiting.length ? `Waiting for ${waiting.map((w) => w.name).join(", ")}.` : plan.line || "Joining your party…")}
      </p>
      {ask &&
        createPortal(
          <div class="mm-scrim" onClick={() => setAsk(null)}>
            <Confirm heading="Start a new climb?" note={`Your party climb on floor ${ask.floor} ends, and this party starts on floor 1.`} go={ask.kind === "start" ? "Start" : "Ready"} onCancel={() => setAsk(null)} onGo={() => (setAsk(null), go(true))} />
          </div>,
          document.body,
        )}
    </>
  );
}
