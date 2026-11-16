# Crowd (50 v 50) Party: invite friends into the queue screen, then Find match (Eric, Nov 16). Opus, xhigh, alone. QUEUED

Effort xhigh (the server, matchmaking, the shared protocol and a new screen state: a bug here breaks matchmaking for everyone). The
`hub` delegate for the screen, working across into matchmaking (`docs/areas/matchmaking.md`) and the friends/invites pieces
(`docs/areas/accounts.md` "Friends and invites"). Targeted lane plus the matchmaking specs; if it changes the protocol's core or stored
data, the full lane (`full-e2e` label: say so in `.pr-body.md`). New branch `claude/crowd-party` from main. Include
`notes/briefs/rules-common.md`. Read `.claude/LESSONS.md`, CLAUDE.md ("Nothing hidden, nothing shifts", "Simple beats flashy"),
`docs/areas/hub.md` (PLAY, the Crowd mode's Party option, greyed "Soon", `CROWD_PARTY_MAX` = 8), `docs/areas/squads.md` (Squads'
parties: `squads-party.ts`, the leader queuing, invites), `docs/areas/crowd.md`.

## Eric's words (Nov 16)
"We haven't implemented squad or being able to play with friends yet in the 50v50. It just says coming soon ... the 50v50 screen
when you're queued and it shows 50 people loading in, we just want to mirror that. So when you hit party and then you hit like find
match, it just takes you to that screen ... you can tap on one of the empty like space to invite someone. So make like seven of the
like 50 available spots, or 49 rather, like have a plus like there, and then you can tap and then it'll take you to your friends list
and you can invite. Actually, yeah, we don't need a friend, or we don't need a code, so you can only invite if people are on your
friends list. That's easier, I think, for now. And then there's just like a queue button then. So essentially it's the same thing
that already exists, except you don't just start finding a match right away. You it sits there idling while you invite your
friends, and then there's like a start or like a find match button."

## The design (the director's reading; record any call you make in a decision note)
- **Party in Crowd** stops being "Soon". Pick Party, then PLAY: you land on the **same queue screen** the solo queue shows (the 50
  seats filling in), but **idle**: no search runs. Your seat is yours; **7 of the other seats show a "+"** (party room: you + 7 =
  `CROWD_PARTY_MAX` 8). The rest are the usual empty seats, waiting.
- **Tap a "+":** your **friends list** opens (the existing friends sheet; online friends first); tap a friend to **invite** them
  (the existing invite: their setting, `FRIENDS.inviteMinutes`, blocks). **No codes, no links** (Eric: friends only, for now).
- **An invited friend** gets the existing invite notice; accepting brings them to the same idle screen, in a "+" seat with their
  name; a seat shows "Invited…" while it waits. Declined or expired: back to "+".
- **The leader** (who made the party) has **Find match**: the party queues together into the public Crowd matchmaking, as a
  ticket on one team (sides random as today's plan says), and the screen turns into today's searching state with the party's seats
  already filled. Members see "Waiting for <leader>" where Find match is (greyed, never hidden). Cancel returns the party to idle.
- **Leaving:** a member's Leave frees their seat (back to "+"); the leader leaving passes the lead on (or ends the party if alone),
  as Squads' parties do (reuse their rules and code where you can: `squads-party.ts`).
- **Ranked, fair play, XP:** follow what the matchmaking page already says for parties (the pooled rating rule; a party's XP and
  ranked as Squads' parties); list anything new as a call in the decision note. Kill switch: the existing friends/party pauses apply.
- Phone and computer. Nothing shifts: the screen keeps its layout between idle and searching.

## Added by Eric (Nov 16, sent to the helper too)
- **The invite notice:** a small top-right box "<Name> invited you" with Accept / Decline (not full screen; never over a board in a
  match). Reuse today's invite notice if one exists.
- **Do Not Disturb** in your profile (beside "display offline" and the invite setting): no invites, friend requests or messages
  reach you; senders get the quiet "no one" refusal. Stored data -> full lane.
- **Streamer mode:** one line in ROADMAP.md only.

## Mockup first
Stills (phone and computer) of the idle party screen with 7 "+" seats, the friends sheet open from a "+", an invited seat, a joined
friend, and the leader's Find match vs a member's greyed one. About 6 images to `stills/crowd-party` with a README; `.mockup` (content
"party round 1") to `claude/crowd-party`; wait in one foreground Bash call
(`timeout 590 bash -c 'until git fetch -q origin claude/crowd-party && git show origin/claude/crowd-party:.go 2>/dev/null | grep -q party; do sleep 30; done'`,
repeated, up to 3 hours) for the director's `.go` ("party redo" with notes, or "party build").

## On build
The server pieces (party state, invites to it, the leader's queue ticket into the Crowd matchmaker on one team), the protocol's
optional fields, the screen. Tests: unit (the party's rules, the matchmaker placing a party on one team), the lobby/server tests,
`e2e` for the flow (two signed-in friends: invite, accept, Find match, both on the same team), the specs `ci-select` names. Update
`docs/areas/hub.md` and `matchmaking.md`, a decision note, `.pr-body.md` (what changed, player-visible, checks old -> new, the lane),
`.done`. No PRs, no CI waits, no images under docs/, no model names in commits. Push work in progress at each real step.
