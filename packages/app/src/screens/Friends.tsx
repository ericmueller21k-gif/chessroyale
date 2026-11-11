import { useEffect, useRef, useState } from "preact/hooks";
import { FRIENDS, pausedLine, type FriendEntry, type PlayerSearchEntry } from "@chessroyale/core";
import { FdButton, BackButton } from "../components/FrontDoor.tsx";
import { FriendRow, InviteButton, InviteRow, friendStatus } from "../components/Friends.tsx";
import { PlayerName } from "../components/PlayerName.tsx";
import { UserIcon } from "../components/PixelIcon.tsx";
import { answerFriend, cancelFriendRequest, findPlayers, inviteMode, keepSearch, keptSearch, openInvites, unblockPlayer, useFriends } from "../friends.ts";
import { openProfile } from "../profile-nav.ts";

/**
 * Friends (/friends; Eric, Nov 11: "We just need this friends page", docs/decisions/2026-11-11-friends-page.md): a page, with Back,
 * in place of the pop-up home's Friends opened. From the top: a search box (players by name, as you type: tap one for their profile,
 * where Add friend is), Private lobby (make one or join with a code), invites and friend requests to you when there are any, your
 * friends online (with what they're doing) and offline (with when they were last online), then "Requests sent and blocked ›"
 * (requests you sent, who you've blocked) and the settings' link. Nothing moves as things load: the search's results open in a
 * box of their own over the page, a fixed size, and the lists stand on greyed rows until they come. Classes start with `fp-`.
 */
export function FriendsScreen({
  onBack,
  onSettings,
  onPrivateLobby,
  onSignIn,
}: {
  onBack: () => void;
  onSettings: () => void;
  /** Play with friends' sheet: a private lobby, made or joined by its code. */
  onPrivateLobby: () => void;
  onSignIn: () => void;
}) {
  const { state, status } = useFriends(true);
  const [more, setMore] = useState(false);
  // (The page's own address, back from a profile opened here too: a reload or a shared link lands on it. Its query and hash
  // stay: test switches and links, Nov 11.)
  useEffect(() => {
    if (location.pathname !== "/friends") history.replaceState(null, "", `/friends${location.search}${location.hash}`);
  }, []);
  const [note, setNoteState] = useState<{ text: string; error: boolean } | null>(null);
  const setNote = (text: string, error = true) => setNoteState({ text, error });
  const run = (p: Promise<unknown>) => {
    setNoteState(null);
    p.catch((e: Error) => setNote(e.message));
  };
  const on = status === "on" && !!state;
  if (more && on) return <SentAndBlocked onBack={() => setMore(false)} run={run} note={note} />;
  const invites = on ? openInvites() : [];
  const { online, offline } = friendGroups(state?.friends ?? []);
  const mode = inviteMode();
  return (
    <div class="fd-page fr-page fp-page">
      <header class="fd-page-head">
        <BackButton onClick={onBack} />
        <h1>Friends</h1>
        <span class="fd-head-spacer" />
      </header>
      <PlayerSearch on={on} signIn={status === "signIn"} />
      {/* (The private lobby: Play with friends' sheet, signed out too, as the pop-up's was.) */}
      <button type="button" class="fp-private" aria-label="Private lobby: make one or join with a code" onClick={onPrivateLobby}>
        <span class="fr-row-text">
          <strong class="fp-name">Private lobby</strong>
          <span class="fr-status">Make one or join with a code</span>
        </span>
        <span class="fp-chev" aria-hidden="true">
          ›
        </span>
      </button>
      {note && (
        <p class={note.error ? "fd-error" : "fd-note fr-note"} role={note.error ? "alert" : "status"}>
          {note.text}
        </p>
      )}
      {status === "signIn" && (
        <div class="fp-empty">
          <p class="fd-note">Sign in to add friends, see when they're online and invite them to play.</p>
          <FdButton primary class="small" onClick={onSignIn}>
            Sign in
          </FdButton>
        </div>
      )}
      {status === "off" && <p class="fd-note fp-empty">{pausedLine("friends")}</p>}
      {(on || status === "unknown") && (
        <>
          <section class="fd-section" aria-labelledby="fp-online">
            <h2 class="fd-label" id="fp-online">
              ONLINE{on ? ` · ${online.length}` : ""}
            </h2>
            {!on && <Placeholders n={2} />}
            {on && !state.friends.length && <p class="fd-note fp-empty">No friends yet. Search for a player above, or tap a name anywhere, then Add Friend.</p>}
            {on && !!state.friends.length && !online.length && <p class="fd-note fp-empty">None of your friends are online right now.</p>}
            <div class="fr-list">
              {online.map((f) => (
                <FriendRow key={f.id} f={f}>
                  <InviteButton uid={f.id} onNote={setNote} greyed />
                </FriendRow>
              ))}
            </div>
          </section>
          <section class="fd-section" aria-labelledby="fp-offline">
            <h2 class="fd-label" id="fp-offline">
              OFFLINE{on ? ` · ${offline.length}` : ""}
            </h2>
            {!on && <Placeholders n={2} />}
            <div class="fr-list fp-offline">
              {offline.map((f) => (
                <FriendRow key={f.id} f={f}>
                  <InviteButton uid={f.id} onNote={setNote} greyed disabled={!f.hidden} title={mode && !f.hidden ? `${friendStatus(f)}: you can invite them once they're online.` : undefined} />
                </FriendRow>
              ))}
            </div>
          </section>
        </>
      )}
      {/* (Invites and requests under the lists, Nov 11: they arrive after the lists' placeholders, so nothing above them moves.) */}
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
      {on && !!state.requests.length && (
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
      <div class="fp-foot">
        <button type="button" class="fd-row-link" disabled={!on} onClick={() => setMore(true)}>
          Requests sent and blocked ›
        </button>
        <button type="button" class="fd-row-link" onClick={onSettings}>
          Who can invite you, and showing when you're online: Settings ›
        </button>
      </div>
    </div>
  );
}

/** Greyed rows where a list will be, while it loads (so what's under it moves as little as it can). */
function Placeholders({ n }: { n: number }) {
  return (
    <div class="fr-list" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} class="fr-row fp-skel">
          <span class="fp-skel-bar" />
        </div>
      ))}
    </div>
  );
}

/**
 * The search box and its results (GET /api/friends/search): it asks FRIENDS.searchDebounceMs after you stop typing, once there
 * are FRIENDS.searchMinChars characters. The results open in a box under it, over the page, always the same size (FRIENDS.searchMax
 * rows), so nothing on the page moves: greyed rows while the first answer comes, the last answer dimmed while the next one does.
 * A tap on a player opens their profile (Add Friend is there); ✕ or Escape clears it, a tap elsewhere closes the box. Greyed for a
 * guest who must sign in first, and while friends are off.
 */
function PlayerSearch({ on, signIn }: { on: boolean; signIn: boolean }) {
  const [q, setQ] = useState(keptSearch);
  const [open, setOpen] = useState(true);
  const [found, setFound] = useState<{ q: string; players: PlayerSearchEntry[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const term = q.trim();
  const ready = [...term].length >= FRIENDS.searchMinChars;
  useEffect(() => {
    keepSearch(q);
  }, [q]);
  useEffect(() => {
    if (!on || !ready) {
      setFound(null);
      setError(null);
      return;
    }
    const ask = new AbortController();
    const t = setTimeout(() => {
      findPlayers(term, ask.signal)
        .then((players) => {
          setFound({ q: term, players });
          setError(null);
        })
        .catch((e: Error) => {
          if (ask.signal.aborted) return;
          setFound({ q: term, players: [] });
          setError(e.message);
        });
    }, FRIENDS.searchDebounceMs);
    return () => {
      clearTimeout(t);
      ask.abort();
    };
  }, [term, on]);
  // (A tap anywhere else closes the box; the text stays, and a tap in the box opens it again.)
  useEffect(() => {
    const away = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, []);
  const clear = () => {
    setQ("");
    setOpen(true);
    input.current?.focus();
  };
  const waiting = ready && found?.q !== term;
  const label = signIn ? "Sign in to find players" : "Search players by name";
  return (
    <div class="fp-search" ref={box}>
      <label class={`fp-box${on ? "" : " off"}`}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
          <circle cx="10.5" cy="10.5" r="6" />
          <path d="M15 15l5 5" />
        </svg>
        <input
          ref={input}
          type="search"
          class="fp-input"
          placeholder={label}
          aria-label="Search players by name"
          autocomplete="off"
          spellcheck={false}
          enterKeyHint="search"
          maxLength={32}
          value={q}
          disabled={!on}
          onInput={(e) => {
            setQ(e.currentTarget.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              if (q) clear();
              else e.currentTarget.blur();
            }
          }}
        />
        <button type="button" class="fd-icon-btn fp-clear" aria-label="Clear the search" disabled={!q || !on} onClick={clear}>
          ✕
        </button>
      </label>
      {on && open && ready && (
        <div class="fp-results" role="region" aria-label="Players found" aria-busy={waiting}>
          {error ? (
            <p class="fd-error fp-results-note">{error}</p>
          ) : !found ? (
            Array.from({ length: 3 }, (_, i) => (
              <div key={i} class="fp-player fp-skel" aria-hidden="true">
                <span class="fp-skel-icon" />
                <span class="fp-skel-bar" />
              </div>
            ))
          ) : !found.players.length ? (
            <p class={`fd-note fp-results-note${waiting ? " stale" : ""}`}>No players found with a name starting “{found.q}”.</p>
          ) : (
            found.players.map((p) => <PlayerResult key={p.id} p={p} stale={waiting} />)
          )}
        </div>
      )}
    </div>
  );
}

/** A player found: their icon, name and level; the whole row opens their profile. */
function PlayerResult({ p, stale }: { p: PlayerSearchEntry; stale: boolean }) {
  return (
    <button type="button" class={`fp-player${stale ? " stale" : ""}`} aria-label={`${p.name}, Level ${p.level}`} onClick={() => openProfile({ uid: p.id, name: p.name })}>
      <span class="fp-icon">
        <UserIcon icon={p.icon} />
      </span>
      <span class="fr-row-text">
        <span class="fp-name">{p.name}</span>
        <span class="fr-status">Level {p.level}</span>
      </span>
      <span class="fp-chev" aria-hidden="true">
        ›
      </span>
    </button>
  );
}

/** "Requests sent and blocked ›": the requests you sent (Cancel) and who you've blocked (Unblock), with Back to the friends page. */
function SentAndBlocked({ onBack, run, note }: { onBack: () => void; run: (p: Promise<unknown>) => void; note: { text: string; error: boolean } | null }) {
  const { state } = useFriends();
  if (!state) return null;
  return (
    <div class="fd-page fr-page fp-page">
      <header class="fd-page-head">
        <BackButton onClick={onBack} label="Back to friends" />
        <h1>Requests sent and blocked</h1>
        <span class="fd-head-spacer" />
      </header>
      {note && (
        <p class={note.error ? "fd-error" : "fd-note fr-note"} role={note.error ? "alert" : "status"}>
          {note.text}
        </p>
      )}
      <section class="fd-section" aria-labelledby="fr-sent">
        <h2 class="fd-label" id="fr-sent">
          SENT · {state.sent.length}
        </h2>
        {!state.sent.length && <p class="fd-note fp-empty">No requests waiting for an answer.</p>}
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
      <section class="fd-section" aria-labelledby="fr-blocked">
        <h2 class="fd-label" id="fr-blocked">
          BLOCKED · {state.blocked.length}
        </h2>
        {!state.blocked.length && <p class="fd-note fp-empty">You haven't blocked anyone.</p>}
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
    </div>
  );
}

/** Online: shown as online and not hiding it. Everyone else, hiding it included, is in Offline. */
export const friendGroups = (friends: FriendEntry[]) => ({ online: friends.filter((f) => f.online && !f.hidden), offline: friends.filter((f) => !f.online || f.hidden) });
