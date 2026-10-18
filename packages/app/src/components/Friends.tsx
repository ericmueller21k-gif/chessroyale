import { useEffect, useRef, useState } from "preact/hooks";
import type { ComponentChildren } from "preact";
import { FRIENDS, inviteWhat, type FriendEntry, type InviteEntry } from "@chessroyale/core";
import {
  addFriend,
  answerFriend,
  blockPlayer,
  cancelFriendRequest,
  dismissInvite,
  friendsBadge,
  hideToast,
  inviteMode,
  invitePlayer,
  inviteToast,
  joinInvite,
  relationTo,
  removeFriend,
  saveFriendSettings,
  toastOnScreen,
  unblockPlayer,
  useFriends,
} from "../friends.ts";
import { FdButton } from "./FrontDoor.tsx";
import { useMedia } from "./QuickChat.tsx";
import { PlayerName } from "./PlayerName.tsx";

/**
 * Friends' pieces (docs/decisions/2026-10-15-friends-and-invites.md): a friend's row, the phone home's line and the computer's live
 * panel section (friends who are online), the new invite's toast, the "Invite friends" sheet of a lobby or party, the
 * settings, and the friend buttons on a profile. Classes start with `fr-`.
 */

/** "Online", "In a match", "Offline", or "Online status hidden" for a friend who hides it. */
export function friendStatus(f: FriendEntry): string {
  if (f.hidden) return "Online status hidden";
  return f.busy ? "In a match" : f.online ? "Online" : "Offline";
}

function Dot({ f }: { f: FriendEntry }) {
  return <span class={`fr-dot${f.hidden ? " hidden" : f.busy ? " busy" : f.online ? "" : " off"}`} aria-hidden="true" />;
}

/** "Invite": to your game (or a new one at the front door); "Invited" for a moment after. What happened goes to `onNote`. */
export function InviteButton({ uid, onNote, label = "Invite", small = true }: { uid: string; onNote: (text: string, error?: boolean) => void; label?: string; small?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);
  if (!inviteMode()) return null;
  return (
    <FdButton
      class={`${small ? "small " : ""}fr-invite`}
      disabled={busy || done}
      onClick={() => {
        setBusy(true);
        invitePlayer(uid)
          .then(() => {
            setDone(true);
            onNote(`Invited. The invite lasts ${FRIENDS.inviteMinutes} minutes.`);
            timer.current = setTimeout(() => setDone(false), FRIENDS.reinviteMs);
          })
          .catch((e: Error) => onNote(e.message, true))
          .finally(() => setBusy(false));
      }}
    >
      {done ? "Invited" : label}
    </FdButton>
  );
}

/** A friend: their dot, name (it opens their profile), whether they're online, and the buttons given. */
export function FriendRow({ f, children }: { f: FriendEntry; children?: ComponentChildren }) {
  return (
    <div class="fr-row">
      <Dot f={f} />
      <span class="fr-row-text">
        <PlayerName name={f.name} uid={f.id} class="fr-name" />
        <span class="fr-status">{friendStatus(f)}</span>
      </span>
      {children && <span class="fr-row-actions">{children}</span>}
    </div>
  );
}

/** "3 new": requests and invites waiting for you. */
export function FriendsBadge({ n }: { n: number }) {
  return n > 0 ? (
    <span class="fr-badge" aria-label={`${n} new`}>
      {n} new
    </span>
  ) : null;
}

/** The computer's live panel: friends who are online (with Invite), above the players online. */
export function FriendsPanel({ onOpen }: { onOpen: () => void }) {
  // (The live panel is a computer's: a phone never draws or refreshes it.)
  const computer = useMedia("(min-width: 1024px)");
  const { state, status } = useFriends(computer);
  const [note, setNote] = useState<string | null>(null);
  if (!computer || status === "off" || status === "signIn") return null;
  const online = state?.friends.filter((f) => f.online) ?? [];
  return (
    <section class="fd-section fr-panel" aria-labelledby="fr-panel-label">
      <div class="fr-panel-head">
        <h2 class="fd-label" id="fr-panel-label">
          FRIENDS
        </h2>
        <FriendsBadge n={friendsBadge()} />
        <button type="button" class="fd-link fr-all" onClick={onOpen}>
          All friends ›
        </button>
      </div>
      {state && !state.friends.length && <p class="fd-note">Tap a player's name anywhere, then Add friend.</p>}
      {state && !!state.friends.length && !online.length && <p class="fd-note">No friends online right now.</p>}
      {online.slice(0, FRIENDS.panelMax).map((f) => (
        <FriendRow key={f.id} f={f}>
          <InviteButton uid={f.id} onNote={setNote} />
        </FriendRow>
      ))}
      {online.length > FRIENDS.panelMax && <p class="fd-note">and {online.length - FRIENDS.panelMax} more online</p>}
      {note && <p class="fd-note">{note}</p>}
    </section>
  );
}

/** "9 min left". */
const minutesLeft = (inv: InviteEntry, now = Date.now()) => `${Math.max(1, Math.ceil((inv.expiresAt - now) / 60_000))} min left`;

/** A new invite, for a moment at the top of a front-door page (never over a match): Join or Dismiss. */
export function InviteToast() {
  useFriends();
  const toast = inviteToast();
  const inv = toast && toast.expiresAt > Date.now() ? toast : null;
  // (On screen now: it counts as shown, and goes after FRIENDS.toastMs. Waiting for this page, it hadn't.)
  useEffect(() => {
    if (inv) toastOnScreen(inv);
  }, [inv?.from, inv?.at]);
  if (!inv) return null;
  return (
    <div class="fr-toast" role="status" aria-label={`${inv.name} invited you`}>
      <span class="fr-toast-text">
        <strong>{inv.name}</strong> invited you to {inviteWhat(inv.kind)}
      </span>
      <FdButton primary class="small" onClick={() => joinInvite(inv)}>
        Join
      </FdButton>
      <button type="button" class="fd-icon-btn fr-toast-x" aria-label="Dismiss the invite" onClick={() => void dismissInvite(inv).catch(hideToast)}>
        ✕
      </button>
    </div>
  );
}

/** An invite to you in a list: who, to what, how long it lasts; Join or Dismiss. */
export function InviteRow({ inv, onNote }: { inv: InviteEntry; onNote: (t: string) => void }) {
  return (
    <div class="fr-row">
      <span class="fr-dot" aria-hidden="true" />
      <span class="fr-row-text">
        <span>
          <PlayerName name={inv.name} uid={inv.from} class="fr-name" /> invited you to {inviteWhat(inv.kind)}
        </span>
        <span class="fr-status">{minutesLeft(inv)}</span>
      </span>
      <span class="fr-row-actions">
        <FdButton primary class="small" onClick={() => joinInvite(inv)}>
          Join
        </FdButton>
        <button type="button" class="fd-icon-btn" aria-label={`Dismiss ${inv.name}'s invite`} onClick={() => void dismissInvite(inv).catch((e: Error) => onNote(e.message))}>
          ✕
        </button>
      </span>
    </div>
  );
}

/** A lobby's or party's "Invite friends": a sheet of your friends (online first), each with Invite. */
export function InviteFriends() {
  const [open, setOpen] = useState(false);
  const { status } = useFriends();
  if (status !== "on") return null;
  return (
    <>
      <FdButton class="fr-invite-friends" onClick={() => setOpen(true)}>
        Invite friends
      </FdButton>
      {open && <InviteSheet onClose={() => setOpen(false)} />}
    </>
  );
}

function InviteSheet({ onClose }: { onClose: () => void }) {
  const { state } = useFriends(true);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, []);
  return (
    <div class="fd-sheet-scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="fd-sheet" role="dialog" aria-modal="true" aria-labelledby="fr-invite-title">
        <div class="fd-sheet-head">
          <h2 id="fr-invite-title">Invite friends</h2>
          <button type="button" class="fd-icon-btn" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>
        {state && !state.friends.length && <p class="fd-sub">No friends yet. Tap a player's name, then Add friend. Or share the link.</p>}
        <div class="fr-list">
          {state?.friends.map((f) => (
            <FriendRow key={f.id} f={f}>
              <InviteButton uid={f.id} onNote={setNote} />
            </FriendRow>
          ))}
        </div>
        {note && <p class="fd-note">{note}</p>}
      </div>
    </div>
  );
}

/** Settings → Friends: who may invite you, and whether others see when you're online. */
export function FriendSettings() {
  const { state, status } = useFriends();
  const [note, setNote] = useState<string | null>(null);
  if (status === "signIn") {
    return (
      <section class="fd-section">
        <h2 class="fd-label">FRIENDS</h2>
        <p class="fd-note">Sign in to add friends and choose who can invite you.</p>
      </section>
    );
  }
  if (status !== "on" || !state) return null;
  const save = (patch: Parameters<typeof saveFriendSettings>[0]) => {
    setNote(null);
    saveFriendSettings(patch).catch((e: Error) => setNote(e.message));
  };
  const s = state.settings;
  return (
    <section class="fd-section">
      <h2 class="fd-label">FRIENDS</h2>
      <div class="fd-toggle-text fr-setting-head">
        <strong>Invites from</strong>
        <span>Who can invite you to their lobby or party. Blocked players never can.</span>
      </div>
      <div class="fd-seg three" role="radiogroup" aria-label="Invites from">
        {(
          [
            ["everyone", "Everyone"],
            ["friends", "Friends"],
            ["none", "No one"],
          ] as const
        ).map(([id, label]) => (
          <button type="button" role="radio" key={id} aria-checked={s.invites === id} class={s.invites === id ? "on" : ""} onClick={() => save({ invites: id })}>
            {label}
          </button>
        ))}
      </div>
      <label class="fd-toggle">
        <span class="fd-toggle-text">
          <strong>Show when I'm online</strong>
          <span>Your profile and your friends' lists show when you're online or in a match. Off: nobody sees it.</span>
        </span>
        <input type="checkbox" role="switch" checked={s.showOnline} onChange={(e) => save({ showOnline: e.currentTarget.checked })} />
      </label>
      {note && <p class="fd-error">{note}</p>}
    </section>
  );
}

/**
 * Someone else's profile: Add friend (or where you stand with them), Invite to play, Block and Report, in one grid. A
 * button that ends something (remove, block) asks for a second tap.
 */
export function ProfileFriendActions({ uid, name, onReport }: { uid: string; name: string; onReport: () => void }) {
  const { status } = useFriends();
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<null | "remove" | "block">(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => setNote(null), [uid]);
  const report = (
    <FdButton danger onClick={onReport}>
      Report
    </FdButton>
  );
  if (status === "off" || status === "signIn") return <div class="fd-actions">{report}</div>;
  const rel = relationTo(uid);
  const run = (fn: () => Promise<unknown>, done?: string) => {
    setBusy(true);
    setNote(null);
    setConfirm(null);
    fn()
      .then(() => done && setNote(done))
      .catch((e: Error) => setNote(e.message))
      .finally(() => setBusy(false));
  };
  const twice = (what: "remove" | "block", fn: () => void) => {
    if (confirm === what) return fn();
    setConfirm(what);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setConfirm(null), 3000);
  };
  const off = busy || status !== "on";
  const friendBtn =
    rel === "friend" ? (
      <FdButton disabled={off} onClick={() => twice("remove", () => run(() => removeFriend(uid), `You and ${name} are no longer friends.`))}>
        {confirm === "remove" ? "Tap again to remove" : "Remove friend"}
      </FdButton>
    ) : rel === "sent" ? (
      <FdButton disabled={off} onClick={() => run(() => cancelFriendRequest(uid))}>
        Cancel request
      </FdButton>
    ) : rel === "received" ? (
      <FdButton primary disabled={off} onClick={() => run(() => answerFriend(uid, true), `You and ${name} are friends.`)}>
        Accept friend
      </FdButton>
    ) : (
      <FdButton primary disabled={off} onClick={() => run(() => addFriend(uid), "Request sent.")}>
        Add friend
      </FdButton>
    );
  return (
    <>
      {rel === "blocked" ? (
        <div class="fd-actions">
          <FdButton disabled={off} onClick={() => run(() => unblockPlayer(uid), `${name} is unblocked.`)}>
            Unblock
          </FdButton>
          {report}
        </div>
      ) : (
        <div class="fd-actions">
          {friendBtn}
          {inviteMode() ? <InviteButton uid={uid} onNote={setNote} label="Invite to play" small={false} /> : <span class="fr-gap" />}
          <FdButton disabled={off} onClick={() => twice("block", () => run(() => blockPlayer(uid), `${name} is blocked: no requests, invites or chat from them.`))}>
            {confirm === "block" ? "Tap again to block" : "Block"}
          </FdButton>
          {report}
        </div>
      )}
      {note && (
        <p class="fd-note fr-note" role="status">
          {note}
        </p>
      )}
    </>
  );
}
