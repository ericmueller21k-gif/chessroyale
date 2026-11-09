# The friends overlay (Nov 9, 2026)

Eric, Nov 9: "I just want the friends list to be in the same way that the quests are just centered, like as a centered kind of
rectangle overlay … if your friends are grey, they're grey, or it'll say like last online … tap on their name to just either do
like … invite to lobby, view profile." Brief: `notes/briefs/brief-friends-overlay.md`.

- A phone's top-bar Friends opens `components/FriendsOverlay.tsx` in the Quests overlay's shell (its classes reused, the crest
  too, so the two read as one family); the old Play with friends sheet is no longer opened from the top bar.
- Last online: `users.last_seen` was already read by the friends query, so the list now carries it (`FriendEntry.lastSeen`,
  optional, null for a friend who hides it). No migration, no new query. When the minute's refresh sees a friend go offline,
  the app sets their last-seen to then (fresher than the list's load).
- The box has a fixed height (`min(560px, 100dvh - 62px)`): loading, a note or a menu never resizes it.
- A friend's menu sits over the box's foot (not under the row): it covers, never pushes (nothing shifts). Invite to play is
  always in it, greyed with "Offline: you can invite them once they're online." A friend who hides their status can be invited
  (we can't tell), as one in a match can (the invite waits in their list).
- Until home's Party option (another helper) lands, the share-a-code / join-by-code sheet is reached from the box's footer
  ("Lobby code ›"), so phones keep it either way; e2e's `openPlayWithFriends` goes that way. The director drops the link (and
  the sheet, if nothing else calls it) once Party has it.
- `friendStatus` says "Last online …" on every friends list (the /friends page and the computer's panel too): one set of words.
