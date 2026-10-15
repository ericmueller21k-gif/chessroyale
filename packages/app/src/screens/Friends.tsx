import { useState } from "preact/hooks";
import { FdButton, BackButton } from "../components/FrontDoor.tsx";
import { FriendRow, InviteButton, InviteRow } from "../components/Friends.tsx";
import { PlayerName } from "../components/PlayerName.tsx";
import { answerFriend, cancelFriendRequest, openInvites, unblockPlayer, useFriends } from "../friends.ts";

/**
 * Friends (/friends; docs/decisions/2026-10-15-friends-and-invites.md): invites to you, friend requests, your friends (online first,
 * each with Invite), the requests you sent, and who you've blocked. Adding a friend is from their profile (tap their
 * name anywhere); who can invite you is in Settings.
 */
export function FriendsScreen({ onBack, onSettings }: { onBack: () => void; onSettings: () => void }) {
  const { state, status } = useFriends(true);
  const [note, setNoteState] = useState<{ text: string; error: boolean } | null>(null);
  const setNote = (text: string, error = true) => setNoteState({ text, error });
  const run = (p: Promise<unknown>) => {
    setNoteState(null);
    p.catch((e: Error) => setNote(e.message));
  };
  const invites = openInvites();
  return (
    <div class="fd-page fr-page">
      <header class="fd-page-head">
        <BackButton onClick={onBack} />
        <h1>Friends</h1>
        <span class="fd-head-spacer" />
      </header>
      {status === "signIn" && <p class="fd-sub">Sign in to add friends, see when they're online and invite them to play.</p>}
      {status === "off" && <p class="fd-sub">Friends are switched off for now. Try again later.</p>}
      {status === "unknown" && <p class="fd-sub">Loading…</p>}
      {note && (
        <p class={note.error ? "fd-error" : "fd-note fr-note"} role={note.error ? "alert" : "status"}>
          {note.text}
        </p>
      )}
      {state && status === "on" && (
        <>
          {!!invites.length && (
            <section class="fd-section" aria-labelledby="fr-invites">
              <h2 class="fd-label" id="fr-invites">
                INVITES
              </h2>
              <div class="fr-list">
                {invites.map((inv) => (
                  <InviteRow key={`${inv.from}:${inv.at}`} inv={inv} onNote={setNote} />
                ))}
              </div>
            </section>
          )}
          {!!state.requests.length && (
            <section class="fd-section" aria-labelledby="fr-requests">
              <h2 class="fd-label" id="fr-requests">
                FRIEND REQUESTS
              </h2>
              <div class="fr-list">
                {state.requests.map((r) => (
                  <div key={r.id} class="fr-row">
                    <span class="fr-row-text">
                      <PlayerName name={r.name} uid={r.id} class="fr-name" />
                      <span class="fr-status">wants to be friends</span>
                    </span>
                    <span class="fr-row-actions">
                      <FdButton primary class="small" onClick={() => run(answerFriend(r.id, true))}>
                        Accept
                      </FdButton>
                      <FdButton class="small" onClick={() => run(answerFriend(r.id, false))}>
                        Decline
                      </FdButton>
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
          <section class="fd-section" aria-labelledby="fr-friends">
            <h2 class="fd-label" id="fr-friends">
              FRIENDS · {state.friends.length}
            </h2>
            {!state.friends.length && <p class="fd-note">No friends yet. Tap a player's name anywhere (a match, its results, a lobby, the chat), then Add friend.</p>}
            <div class="fr-list">
              {state.friends.map((f) => (
                <FriendRow key={f.id} f={f}>
                  <InviteButton uid={f.id} onNote={setNote} />
                </FriendRow>
              ))}
            </div>
          </section>
          {!!state.sent.length && (
            <section class="fd-section" aria-labelledby="fr-sent">
              <h2 class="fd-label" id="fr-sent">
                SENT
              </h2>
              <div class="fr-list">
                {state.sent.map((r) => (
                  <div key={r.id} class="fr-row">
                    <span class="fr-row-text">
                      <PlayerName name={r.name} uid={r.id} class="fr-name" />
                      <span class="fr-status">waiting for an answer</span>
                    </span>
                    <span class="fr-row-actions">
                      <FdButton class="small" onClick={() => run(cancelFriendRequest(r.id))}>
                        Cancel
                      </FdButton>
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
          {!!state.blocked.length && (
            <section class="fd-section" aria-labelledby="fr-blocked">
              <h2 class="fd-label" id="fr-blocked">
                BLOCKED
              </h2>
              <div class="fr-list">
                {state.blocked.map((b) => (
                  <div key={b.id} class="fr-row">
                    <span class="fr-row-text">
                      <PlayerName name={b.name} uid={b.id} class="fr-name" />
                    </span>
                    <span class="fr-row-actions">
                      <FdButton class="small" onClick={() => run(unblockPlayer(b.id))}>
                        Unblock
                      </FdButton>
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
          <button type="button" class="fd-row-link" onClick={onSettings}>
            Who can invite you, and showing when you're online: Settings ›
          </button>
        </>
      )}
    </div>
  );
}
