# Friends and invites (Oct 15, 2026)

Eric (Oct 14): "we're gonna need like a, something where you can tap on somebody and just add them as a friend"; tap any
name for **invite to your game** or **view their profile**; invites aren't only for friends ("one piece of code"); a
profile setting to turn off invites from people who aren't friends; no chat with friends. The director's brief (Oct 15)
added requests that are accepted or declined, block, "Allow invites: everyone / friends only / no one", whether
friends see you online, rate limits and stored data that account deletion covers. How it works now:
[`docs/areas/accounts.md`](../areas/accounts.md) (rules, data) and [`docs/areas/hub.md`](../areas/hub.md)
(screens). The calls, each the simplest that does the job:

- **Requests are accepted or declined** (Eric's open question; the director's brief). Asking someone who already asked
  you makes you friends at once. Declining tells the sender nothing: the request just stops showing as sent.
- **Adding is from a profile only.** Every name in the game already opens one (results, lobbies, the queue, chat,
  leaderboards), so "Add friend" there covers the results row and the lobby name with no new code. No friend code and
  no name search: names aren't unique (16 characters, anyone can be "Magnus"), and a search lets anyone list players
  and spam them. Someone met outside the game shares a lobby code first, as today.
- **Invites are for anyone, as the other player allows:** Everyone (the default, Eric's "public invites"), Friends, or
  No one. A refusal always reads "This player isn't taking invites right now.", whether it's their setting or a block.
- **"Show when I'm online" hides it from everyone**, friends and profiles alike: profiles already showed "Online now"
  and "Last seen" to anyone, so a friends-only switch would have hidden nothing. Off, the profile says "Online status
  hidden", friends' lists show no dot, and others get only the day of each recent match, not its time (the profile
  shows days anyway; you still get yours exact, which "See your result" needs).
- **An invite reuses the existing links:** your private lobby while it's still waiting (its mode: Crowd, raid or
  Classic) or your Squads party; Join is joining that lobby or party. At the front door with neither, "Invite" first
  asks the server whether they'd take it (`{check: true}`, so a refusal never leaves you in an empty lobby), then makes
  a lobby (with Squads picked, a party) in the home screen's mode and invites them into it. Not into a matchmade
  queue (the server refuses one), and not during a match (there's no game of yours to join). The server checks the
  lobby is still waiting (or the party open), not that you're in it: a code is already an invite anyone can share.
  What an invite says it's for (a Crowd lobby, a raid) comes from the lobby itself, never from the app. Joining a
  lobby's invite asks whether it's still waiting first, so a stale one never makes you leave your party.
- **An invite lasts 10 minutes** (`FRIENDS.inviteMinutes`), one per pair (a new one replaces it; again only after
  `reinviteMs`, 30 s). Joining takes it off your list; ✕ declines it.
- **Invited while in a match** (Eric's open question): it waits in your list, and shows as a toast when you're back on a
  front-door page if it's still open. Nothing ever shows over a match or the queue; the inviter sees "In a match" on
  your row.
- **Where it lives, until Eric's layout rework:** Eric asked for friends online "in their own list above the players
  online". A computer's live panel gets a FRIENDS section right above its live line; a phone's home a one-line
  "Friends · N online" button above its live line (always there for anyone who can have friends, so nothing pops in
  late). Both open the full list at `/friends`. No new side-menu item: the panel is on every front-door page.
- **What it costs to run.** No D1 write per request, and the news needs no poll of its own: something new for you (a
  request, an invite, an accepted request) is a note in the live hub's memory; the presence batch each Worker instance
  already sends gets it back for the accounts in the batch, and your next `/api/live` says `inbox: <time>`. The app
  fetches its whole list (six D1 reads and one hub call) when that grows, when your account loads and after each
  action. The one new recurring request: while a friends list is on screen (the phone home's line, the computer's
  live panel, the list, Invite friends) and you have a friend who shows when they're online, `GET /api/friends/online`
  once every `FRIENDS.refreshMs` (60 s): the session from the Worker instance's cache (usually no D1 read), one D1 read
  of your friends and one hub call. With no such friend it isn't made. A hub restart reloads the last hour's notes from
  D1. Who's online is the hub's memory (one call per list, however long); "in a match" is the app's own word on its
  live-line request (`?busy=1`), so it covers every mode, Squads included, at no cost. (A wrong "in a match" from a
  modified app harms nobody: it's only shown to friends.)
- **Block** ends the friendship and deletes requests and invites between you. From then on their requests are kept
  but never shown to you (they see "sent", as with anyone who doesn't answer, so a block can't be found out), their
  invites are refused with the same words as a setting, and their chat lines are hidden in your app: the global chat by
  account, quick chat in a match by their seat's account. The match chat's hook is shared with the chat-moderation
  mute (`MatchChat.hidden()`, the host's `uidOf`): one mapping from seat to account.
- **Who:** signed-in accounts, where signing in is set up (guests can't play online there anyway). Not while banned:
  requests and invites refused with the ban notice.
- **Limits:** a burst limit per account on friends' actions (`CAPACITY.rateLimits.friends`, 30 a minute, `limits.ts`,
  in each Worker's memory) for runaway scripts; the real caps in D1, since an account's requests land on many Worker
  instances: 30 requests a day, 60 invites an hour (`friend_limits`), at most 50 requests waiting at once, 200 friends,
  500 blocked. Unanswered requests go after 30 days. A cap is counted in one statement that only counts while under it
  (no row back: refused), so requests sent all at once can't slip past it (a review found 40 at once all accepted when
  it read then wrote). The 50-waiting check reads before it writes, so a burst can pass it by about one wave, which the
  daily cap bounds.
- **A block at the same moment as an accept wins:** the block row goes in first, and making friends is one statement
  that never runs past a block either way.
- **Kill switch:** `PAUSE_FRIENDS` ("1", true, yes or on) switches it off for everyone (the API answers `{off}` and the
  app hides friends). It's the gates' naming (`PAUSE_<NAME>`); once their `kill-switches.ts` is on main,
  `friendsOn(env)` becomes `!isPaused(env, "friends")`.
- **Data:** five tables and two `users` columns, listed with what's kept and for how long in accounts.md's "Data stored
  by friends", all deleted with an account (`deleteSocial`).
- **Testing:** full lane (stored data, the client-server protocol, security): unit tests (server `friends.test.ts`,
  app `friends.test.ts`), the two-player `e2e/friends.spec.ts` on a phone and a computer, and the whole `npm run e2e`.
