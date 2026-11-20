import { useEffect, useRef, useState } from "preact/hooks";
import { createPortal } from "preact/compat";
import { TOWER_PARTY } from "@chessroyale/core";
import { Confirm } from "../components/MatchMenu.tsx";
import { InviteSheet } from "../components/Friends.tsx";
import { PARTY_COLORS } from "../board/logic.ts";
import { TOWER_WORDS, loadKept, settle, towerApi, type RunKind, type TowerState } from "../tower.ts";
import { joinTowerPartyAnswer, leaveTowerParty, makeTowerParty, onTowerParty, openTowerParties, openTowerParty, planWaiting, planWords, towerParty, type OpenParty } from "../tower-party.ts";
import { chatTestRoom } from "./chat-net.ts";
import "../tower.css";

/**
 * The Battle Tower's clerk's card (PR 11b, Eric, Nov 19: "you walk into the battle tower, you talk to the clerk, you start a match"): the
 * only way into the climb. Its three ways to climb, always shown (Eric, Nov 20: "there should be a solo mode, and then there have an
 * invite friends, or another option, which is like basically like open party"; docs/decisions/2026-11-20-tower-party.md):
 * - **Solo** (today's): Start, or "Continue: floor N", and a small "Start over" that asks first; beside it, "Alone: floor N", your party
 *   climb played on by yourself (from then on solo: Eric, "you can continue on your own, but it's just solo from that point forward").
 * - **Invite friends**: a party (made the first time) and your friends list to invite from.
 * - **Open your own party**: a party, and its line in the town's chat ("Ann is looking for 3 more to climb the Battle Tower", with "Go to the
 *   tower", which brings a player here, by the clerk).
 * Under them, the parties open to newcomers now (Eric, Nov 20: "you should be able to click on the clerk and see the parties and like which
 * ones you could join"): each one's leader, how many are in it ("2/4") and Join; a box of one size whatever it holds (it scrolls inside),
 * "No open parties right now." when there are none.
 * The panel under them holds the same things, in the same places, whatever you're doing (Eric's "nothing hidden": the review of #835,
 * finding 11): the party's four seats (each other member's Kick: the leader's, greyed during a floor), the line saying what START does
 * (`plan`) or how your climb stands, READY or START and Leave party, then your solo climb (Continue or Start, Start over, Alone). What
 * doesn't apply now shows greyed: the party's half until you're in one, the solo half while you are. `onGo`: a floor of yours is ready,
 * you walk into the elevator (Town.tsx).
 */
export function TowerDesk({ onGo, onBest }: { onGo: (kind: RunKind) => void; onBest: (best: number) => void }) {
  const [st, setSt] = useState<TowerState | null>(null);
  const [busy, setBusy] = useState(true);
  const [note, setNote] = useState<string | null>(null);
  const [ask, setAsk] = useState<{ kind: "over"; floor: number } | { kind: "ready" | "start"; heading: string; note: string } | { kind: "kick"; id: string; name: string } | null>(null);
  const [inviting, setInviting] = useState(false);
  const [, redraw] = useState(0);
  /**
   * The parties open to newcomers (null: not read yet), read as the card opens and every TOWER_PARTY.listPollMs while it shows; `message`,
   * why you can't join one (a guest where signing in is set up), shown in the list's box, and then it isn't read again while the card shows.
   */
  const [opens, setOpens] = useState<{ parties: OpenParty[]; message: string | null } | null>(null);
  useEffect(() => {
    let live = true;
    const read = () =>
      void openTowerParties(chatTestRoom() ?? undefined).then((l) => {
        if (!live || !l) return;
        setOpens(l);
        if (l.message) clearInterval(t);
      });
    const t = setInterval(read, TOWER_PARTY.listPollMs);
    read();
    return () => {
      live = false;
      clearInterval(t);
    };
  }, []);
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
  /** A press of yours: the party's last refusal (its words on the plan line) is answered. */
  const fresh = () => {
    const live = towerParty();
    if (live) live.error = null;
  };
  const invite = async () => {
    fresh();
    if (await party()) setInviting(true);
  };
  const open = async () => {
    fresh();
    if (await party()) openTowerParty(chatTestRoom() ?? undefined);
  };
  /** Join from the list: seated once the party welcomes you; turned away, its words on the line. */
  const joinOpen = async (code: string) => {
    setBusy(true);
    setNote(null);
    const words = await joinTowerPartyAnswer(code);
    if (!alive.current) return;
    setBusy(false);
    setNote(words);
    void openTowerParties(chatTestRoom() ?? undefined).then((l) => alive.current && l && setOpens(l));
  };
  const run = st?.runs.solo ?? null;
  const copy = st?.runs.party ?? null;
  const p = towerParty();
  const view = p?.party ?? null;
  const me = p?.me ?? null;
  const leading = !!p?.isLeader;
  const full = (view?.members.length ?? 0) >= TOWER_PARTY.max;
  const plan = planWords(view?.tower?.plan, p?.memberId ?? null);
  const waiting = view ? view.members.filter((m) => m.id !== view.leaderId && m.connected && !m.ready) : [];
  // (Your party copy under way with your party: its floor is the room's; played alone: the clerk's Continue picks it up.)
  const copyBusy = !!copy?.fight?.lobby;
  const seats = Array.from({ length: TOWER_PARTY.max }, (_, seat) => view?.members.find((m) => m.seat === seat) ?? null);
  // (A floor of the party's under way: no Kick until it ends (the director's call on the review of #835, finding 6).)
  const floorOn = !!view?.tower?.floor;
  const readyOrStart = (confirmed = false) => {
    if (!p) return;
    fresh();
    if (leading) {
      if (plan.ask && !confirmed) return setAsk({ kind: "start", ...plan.ask });
      return p.start(confirmed);
    }
    if (!me?.ready && plan.ask && !confirmed) return setAsk({ kind: "ready", ...plan.ask });
    p.ready(!me?.ready);
  };
  const soloNote = st
    ? copy && copyBusy
      ? `Your party is on floor ${copy.floor}.`
      : run
        ? "Your run is saved."
        : copy
          ? `Your party climb is on floor ${copy.floor}.`
          : "A climb of 99 floors. One loss ends it."
    : "Reading your climb…";
  const status = p ? (p.error ?? note ?? (plan.ok && leading && waiting.length ? planWaiting(plan.line, waiting.length) : plan.line || "Joining…")) : (note ?? soloNote);
  return (
    <div class="tw-desk">
      <div class="tw-desk-ways" role="group" aria-label="How to climb">
        <button type="button" class={`tw-way${p ? "" : " on"}`} aria-pressed={!p} disabled={!!p} title={p ? "Leave the party to climb alone" : undefined}>
          Solo
        </button>
        <button type="button" class="tw-way" disabled={busy || (!!p && full)} onClick={() => void invite()}>
          Invite friends
        </button>
        <button type="button" class={`tw-way${view?.tower?.open ? " on" : ""}`} aria-pressed={!!view?.tower?.open} disabled={busy || (!!p && (!leading || full || !!view?.tower?.open || !!view?.tower?.closed || floorOn))} onClick={() => void open()}>
          Open your own party
        </button>
      </div>
      {/* (The parties open to newcomers: one box whatever it holds, scrolling inside; your own shows "Joined", the others' Join greyed while you're in a party.) */}
      <div class="tw-open" role="group" aria-label="Open parties">
        <p class="tw-open-head">Open parties</p>
        <ul class="tw-open-list">
          {opens === null ? (
            <li class="tw-open-none">Reading the open parties…</li>
          ) : !opens.parties.length ? (
            <li class="tw-open-none">{opens.message ?? "No open parties right now."}</li>
          ) : (
            opens.parties.map((o) => (
              <li key={o.code} class="tw-open-row">
                <span class="tw-open-name">{o.leader}</span>
                <span class="tw-open-n">
                  {o.members}/{o.max}
                </span>
                <button type="button" class="tw-open-join" aria-label={p?.code === o.code ? `Joined ${o.leader}'s party` : `Join ${o.leader}'s party`} disabled={busy || !!p || o.members >= o.max} onClick={() => void joinOpen(o.code)}>
                  <span class="tw-open-size" aria-hidden="true">
                    Joined
                  </span>
                  <span>{p?.code === o.code ? "Joined" : "Join"}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
      <div class={`tw-desk-panel${p ? " in-party" : " solo"}`}>
        <ul class="tw-seats" aria-label="Your party">
          {seats.map((m, seat) => (
            <li key={seat} class={`tw-seat${m ? "" : " free"}${m && !m.connected ? " away" : ""}`} style={{ "--pt-c": PARTY_COLORS[seat] ?? PARTY_COLORS[0] }}>
              <span class="tw-seat-dot" aria-hidden="true" />
              <span class="tw-seat-name">{m ? `${m.name}${m.id === p?.memberId ? " (you)" : ""}` : "Open seat"}</span>
              {m && (m.id === view?.leaderId ? <span class="tw-seat-mark" aria-label="leader">★</span> : m.ready ? <span class="tw-seat-mark" aria-label="ready">✓</span> : null)}
              {/* (Kick: on each other member's seat, the leader's to press, greyed during a floor; asked first: they never come back in.) */}
              {m && p && m.id !== p.memberId && m.id !== view?.leaderId && (
                <button type="button" class="tw-kick" aria-label={`Kick ${m.name}`} disabled={!leading || floorOn} onClick={() => setAsk({ kind: "kick", id: m.id, name: m.name })}>
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
        <p class="town-card-text tw-desk-note tw-plan" role="status">
          {status}
        </p>
        <div class="tw-desk-row">
          <button type="button" class="town-btn primary" disabled={!p || !view || !plan.ok || (leading && waiting.length > 0)} aria-pressed={p && !leading ? !!me?.ready : undefined} onClick={() => readyOrStart()}>
            {p && !leading ? (me?.ready ? "READY ✓" : "READY") : "START"}
          </button>
          <button type="button" class="town-btn tw-over" disabled={!p} onClick={() => (leaveTowerParty(), void load())}>
            Leave party
          </button>
        </div>
        {/* (Your solo climb, greyed while you're in a party: Leave party first.) */}
        {run ? (
          <button type="button" class="town-btn primary tw-solo-go" disabled={busy || !!p} onClick={() => onGo("solo")}>
            Continue: floor {run.floor}
          </button>
        ) : (
          <button type="button" class="town-btn primary tw-solo-go" disabled={busy || !st || !!p} onClick={() => void start(false)}>
            Start
          </button>
        )}
        <div class="tw-desk-row">
          <button type="button" class="town-btn tw-over" disabled={busy || !run || !!p} onClick={() => run && setAsk({ kind: "over", floor: run.floor })}>
            Start over
          </button>
          <button type="button" class="town-btn tw-over" disabled={busy || !copy || copyBusy || !!p} title={copy ? undefined : "No party climb to go on with"} onClick={() => onGo("party")}>
            {copy ? `Alone: floor ${copy.floor}` : "Alone"}
          </button>
        </div>
      </div>
      {/* (Over the whole page, not inside the card: the card is placed by a transform.) */}
      {ask &&
        createPortal(
          <div class="mm-scrim" onClick={() => setAsk(null)}>
            {ask.kind === "over" ? (
              <Confirm heading="Start over from floor 1?" note={TOWER_WORDS.replace(ask.floor)} go="Start over" onCancel={() => setAsk(null)} onGo={() => (setAsk(null), void start(true))} />
            ) : ask.kind === "kick" ? (
              <Confirm heading={`Kick ${ask.name}?`} note="They leave the party and can't come back into it." go="Kick" onCancel={() => setAsk(null)} onGo={() => (setAsk(null), fresh(), p?.kick(ask.id))} />
            ) : (
              <Confirm heading={ask.heading} note={ask.note} go={ask.kind === "start" ? "Start" : "Ready"} onCancel={() => setAsk(null)} onGo={() => (setAsk(null), readyOrStart(true))} />
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
 * everyone's READY) or your READY, with what START does (`plan`: on to its floor, or a new climb when the party changed; asked first when
 * it ends your climb or takes it back floors). The leader's button says where START goes, from the plan (the review of #835, finding 10).
 */
export function TowerPartyUp() {
  const [, redraw] = useState(0);
  const [ask, setAsk] = useState<{ kind: "ready" | "start"; heading: string; note: string } | null>(null);
  useEffect(() => onTowerParty(() => redraw((n) => n + 1)), []);
  const p = towerParty();
  const view = p?.party ?? null;
  const leading = !!p?.isLeader;
  const me = p?.me ?? null;
  const plan = planWords(view?.tower?.plan, p?.memberId ?? null);
  const waiting = view ? view.members.filter((m) => m.id !== view.leaderId && m.connected && !m.ready) : [];
  const go = (confirmed = false) => {
    if (!p) return;
    p.error = null;
    if (plan.ask && !confirmed && (leading || !me?.ready)) return setAsk({ kind: leading ? "start" : "ready", ...plan.ask });
    if (leading) p.start(confirmed);
    else p.ready(!me?.ready);
  };
  const word = leading ? plan.up : me?.ready ? "READY ✓" : "READY";
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
            <Confirm heading={ask.heading} note={ask.note} go={ask.kind === "start" ? "Start" : "Ready"} onCancel={() => setAsk(null)} onGo={() => (setAsk(null), go(true))} />
          </div>,
          document.body,
        )}
    </>
  );
}
