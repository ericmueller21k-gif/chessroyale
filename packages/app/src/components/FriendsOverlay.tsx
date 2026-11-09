import { useLayoutEffect, useRef, useState } from "preact/hooks";
import { pausedLine, type FriendEntry } from "@chessroyale/core";
import { answerFriend, inviteMode, openInvites, useFriends } from "../friends.ts";
import { openProfile } from "../profile-nav.ts";
import { FdButton } from "./FrontDoor.tsx";
import { Dot, InviteButton, InviteRow, friendStatus } from "./Friends.tsx";
import { PlayerName } from "./PlayerName.tsx";

/**
 * The friends overlay (Eric, Nov 9; docs/decisions/2026-11-09-friends-overlay.md): a phone's top-bar Friends opens your friends
 * in a centered box over home, in the Quests overlay's shell (the same dim, card, crest and ✕; tap the dim or Escape to close).
 * Inside, scrolling in the box only: invites to you (Join, ✕), friend requests (Accept, Decline), then your friends, online
 * first (the server's order), the offline ones greyed with when they were last online. Tap a friend: a small menu at the
 * box's foot with Invite to play (greyed with its reason when it can't go) and View profile. The footer's links: the full
 * list (requests sent, blocked) and, until home's Party option has it, the lobby code sheet. Classes start with `fo-`.
 */
export function FriendsOverlay({
  onClose,
  onAllFriends,
  onLobbyCode,
  onSignIn,
}: {
  onClose: () => void;
  /** The full friends list (/friends): requests sent, who's blocked. */
  onAllFriends: () => void;
  /** Play with friends' sheet: a lobby code to share, or join one. */
  onLobbyCode: () => void;
  onSignIn: () => void;
}) {
  const { state, status } = useFriends(true);
  const [picked, setPicked] = useState<string | null>(null);
  const [note, setNote] = useState<{ text: string; error: boolean } | null>(null);
  const x = useRef<HTMLButtonElement>(null);
  // (Escape closes the friend's menu first, then the box. A layout effect, as the Quests overlay's: from its first frame.)
  const pickedRef = useRef(picked);
  pickedRef.current = picked;
  useLayoutEffect(() => {
    x.current?.focus({ preventScroll: true });
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (pickedRef.current) setPicked(null);
      else onClose();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  const say = (text: string, error = true) => setNote({ text, error });
  const invites = status === "on" ? openInvites() : [];
  const friend = picked ? (state?.friends.find((f) => f.id === picked) ?? null) : null;
  const on = status === "on" && !!state;
  return (
    <div class="qo-back" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="qo-card fo-card" role="dialog" aria-modal="true" aria-labelledby="fo-title">
        <span class="qo-crest" aria-hidden="true">
          <img class="qo-crest-img" src="/icons/icon.svg" alt="" />
        </span>
        <button type="button" class="qo-x" aria-label="Close" ref={x} onClick={onClose}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <header class="qo-head">
          <h2 id="fo-title" class="qo-title">
            Friends
          </h2>
        </header>
        <div class="fo-list">
          {status === "signIn" && (
            <div class="fo-empty">
              <p class="fd-note">Sign in to add friends, see when they're online and invite them to play.</p>
              <FdButton primary class="small" onClick={onSignIn}>
                Sign in
              </FdButton>
            </div>
          )}
          {status === "off" && <p class="fd-note fo-empty">{pausedLine("friends")}</p>}
          {status === "unknown" && <p class="fd-note fo-empty">Loading…</p>}
          {on && !!invites.length && (
            <section aria-labelledby="fo-invites">
              <h3 class="fo-label" id="fo-invites">
                Invites
              </h3>
              {invites.map((inv) => (
                <InviteRow key={`${inv.from}:${inv.at}`} inv={inv} onNote={(t) => say(t)} />
              ))}
            </section>
          )}
          {on && !!state.requests.length && (
            <section aria-labelledby="fo-requests">
              <h3 class="fo-label" id="fo-requests">
                Friend requests
              </h3>
              {state.requests.map((r) => (
                <div key={r.id} class="fr-row">
                  <span class="fr-row-text">
                    <PlayerName name={r.name} uid={r.id} class="fr-name" />
                    <span class="fr-status">wants to be friends</span>
                  </span>
                  <span class="fr-row-actions">
                    <FdButton primary class="small" onClick={() => answerFriend(r.id, true).catch((e: Error) => say(e.message))}>
                      Accept
                    </FdButton>
                    <FdButton class="small" onClick={() => answerFriend(r.id, false).catch((e: Error) => say(e.message))}>
                      Decline
                    </FdButton>
                  </span>
                </div>
              ))}
            </section>
          )}
          {on && (
            <section aria-labelledby="fo-friends">
              <h3 class="fo-label" id="fo-friends">
                Friends · {state.friends.length}
              </h3>
              {!state.friends.length && <p class="fd-note fo-empty">Add friends from their profile: tap their name anywhere.</p>}
              {state.friends.map((f) => (
                <FriendButton key={f.id} f={f} picked={f.id === picked} onPick={() => setPicked(f.id === picked ? null : f.id)} />
              ))}
            </section>
          )}
        </div>
        {note && (
          <p class={note.error ? "fd-error fo-note" : "fd-note fo-note"} role={note.error ? "alert" : "status"}>
            {note.text}
          </p>
        )}
        <div class="fo-foot">
          <button type="button" class="fd-link fo-foot-link" disabled={!on} onClick={onAllFriends}>
            Requests sent and blocked ›
          </button>
          <button type="button" class="fd-link fo-foot-link" onClick={onLobbyCode}>
            Private lobby ›
          </button>
        </div>
        {friend && <FriendMenu f={friend} onNote={(t, e) => say(t, !!e)} onClose={() => setPicked(null)} onProfile={onClose} />}
      </div>
    </div>
  );
}

/** A friend's row: the whole row is the button that opens their menu; offline friends are greyed. */
function FriendButton({ f, picked, onPick }: { f: FriendEntry; picked: boolean; onPick: () => void }) {
  const off = !f.online && !f.hidden;
  return (
    <button type="button" class={`fo-friend${off ? " off" : ""}${picked ? " picked" : ""}`} aria-expanded={picked} aria-label={`${f.name}, ${friendStatus(f)}`} onClick={onPick}>
      <Dot f={f} />
      <span class="fr-row-text">
        <span class="fo-name">{f.name}</span>
        <span class="fr-status">{friendStatus(f)}</span>
      </span>
      <span class="fo-more" aria-hidden="true">
        ⋯
      </span>
    </button>
  );
}

/** Why Invite to play is greyed for this friend, or null when it can go. */
export function inviteBlocked(f: FriendEntry, mode: ReturnType<typeof inviteMode>): string | null {
  if (!mode) return "You can invite friends from home, between matches.";
  if (!f.online && !f.hidden) return "Offline: you can invite them once they're online.";
  return null;
}

/** A friend's menu, at the foot of the box over the list: Invite to play and View profile. */
function FriendMenu({ f, onNote, onClose, onProfile }: { f: FriendEntry; onNote: (t: string, error?: boolean) => void; onClose: () => void; onProfile: () => void }) {
  const why = inviteBlocked(f, inviteMode());
  return (
    <div class="fo-menu" role="menu" aria-label={`${f.name}: what to do`}>
      <div class="fo-menu-head">
        <Dot f={f} />
        <span class="fr-row-text">
          <strong class="fo-name">{f.name}</strong>
          <span class="fr-status">{friendStatus(f)}</span>
        </span>
        <button type="button" class="fd-icon-btn fo-menu-x" aria-label="Close the menu" onClick={onClose}>
          ✕
        </button>
      </div>
      <InviteButton uid={f.id} label="Invite to play" small={false} primary greyed disabled={!!why} title={why ?? undefined} onNote={(t, e) => onNote(t, e)} />
      {why && <p class="fd-note fo-why">{why}</p>}
      <FdButton
        onClick={() => {
          onProfile();
          openProfile({ uid: f.id, name: f.name });
        }}
      >
        View profile
      </FdButton>
    </div>
  );
}
