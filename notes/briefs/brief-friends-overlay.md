# Phone: the Friends button opens a centered friends overlay (Eric, Nov 9)

Eric: "The friends icon at the top that should show your friends list. And then from there, you can invite them to your party ...
I just want the friends list to be in the same way that the quests are just centered, like as a centered kind of rectangle overlay.
It should show your friends like that. And, you know, just normal, like if your friends are grey, they're grey, or it'll say like
last online. I actually think you can just look at how we do it on the desktop to kind of get an idea of the logic. But for this,
yeah, we'll just make it like a center overlay square and then sort of dim the background while that's tapped. And then you can tap on
their name to just either do like ... invite to lobby, view profile, so whatever."

- Today: the phone's top-bar Friends button (Home.tsx ~1108, `setFriends(true)`) opens the "Play with friends" sheet (a code to share,
  join by code, "Your friends ›" to /friends). The computer's live panel has FRIENDS › with the list and Invite buttons (Nov 7,
  Eric's mockup): reuse that logic and its pieces (components/Friends.tsx: FriendRow, InviteRow, InviteButton; friends.ts useFriends,
  openInvites). Read docs/areas/hub.md's Friends section and docs/decisions/2026-10-15-friends-and-invites.md.
- New: the Friends button opens a centered overlay with the Quests overlay's shell (components/QuestsOverlay.tsx: same dim, not blur;
  same width, radius, close ✕, tap-the-dim closes). Its title "Friends". Inside, scrolling within the box only: invites to you first
  (Join / ✕, as today), friend requests (Accept / Decline), then your friends: online first (In a match, then online), then offline,
  greyed, with "Last online 2 h ago" (if the server already sends a last-seen; if it doesn't, add it the cheapest way: the hub already
  knows who's online, the account row may have a last-seen; a simple day-granularity value is fine; if it needs a migration, keep it
  additive the repo's way and say so in the PR, which moves the PR to the full lane: prefer "Offline" with no time over a migration
  unless it's trivial). A small footer link "Requests sent and blocked ›" to the existing /friends page (keep that page).
- Tap a friend: a small menu over the row (or a compact action sheet inside the box): **Invite to play** (the existing invite logic:
  into your lobby / Squads party, or it makes one in home's mode, as today; greyed with a reason when they can't take one or are
  offline), **View profile**. Closing paths obvious.
- The share-a-code / join-by-code part of the old sheet moves to home's new **Party** option (another helper is building that, in the
  options under RANKED). In this PR, don't delete the sheet's lobby code (the other helper reuses it), just stop opening it from the top
  bar; if the sheet's code is left without a caller once both land, the director removes it.
- Where an invite to you shows: unchanged (the toast at the top of front-door pages, and the count on the Friends button), plus first in
  the overlay.
- Empty states: signed out ("Sign in to add friends ..."), no friends ("Add friends from their profile: tap their name anywhere").
  Friends paused: `pausedLine("friends")`.

Lane: targeted (hub/social front end). Effort high. Don't touch the top bar's look (another helper is recoloring its icons) beyond the
Friends button's onClick. Tests: one focused e2e check in the friends spec (open from the top bar, the list, tap → Invite/View profile,
the dim closes it) and update any spec that opened the old sheet from the top bar. Decision note docs/decisions/2026-11-09-friends-overlay.md
(short); update docs/areas/hub.md. Stills (deviceScaleFactor 2, 390x844 light + dark, and 320 px) with a seeded friends list on orphan
branch `stills/friends-overlay`.
