# Chat: quick chat, lobby chat, global chat, moderation

Lane: `social`.

## How it works today

- **No free text in chat.** A message is the id of a line from a fixed list (a phrase or an emoji). The server relays
  only known lines the sender owns, within the limits; names come from the lobby or the account, never from the
  message. What players can abuse is how they use the lines (spam, taunts), their name and their icon: see
  Moderation below. Squads has no chat.
- **Quick chat in a match.** A chat button and panel in the places the design names (the match screens are the
  director's: no change to the board, clock, picks or reveal). Four groups of phrases: Hello and Sporting can go to
  everyone (the Team / All switch); Reactions and Plans stay inside your team, so plans stay secret. Emoji can go to
  everyone and float up from the sender's scoreboard row. On a phone the space under the board is split between the
  scoreboard and chat (one view at a time, never an empty box).
- **Your picks.** Each player's profile chooses which lines they see in their games: up to `QUICK_CHAT.maxLines`
  phrases and `maxEmoji` emoji (the defaults until they choose). Bots use the whole list.
- **Packs.** Free packs everyone has; more are sold in the shop (`QUICK_CHAT.packPrices`; `core/shop.ts` lists them
  as "chat" items).
- **Limits** (the server enforces, the app mirrors): `minGapMs` between messages, a burst limit, no repeating a line
  within `repeatMs`. Sounds are quieter than a move and follow the mute switch.
- **Blocked players** (a profile's Block button, [accounts.md](accounts.md)): their lines never show, in the
  global chat (by account) and in quick chat in a match (by their seat's account, `uidOf`): `MatchChat.hidden()` is
  muted or blocked. Hidden in the app only, so it costs the server nothing.
- **Bots chat** a little: a line or two at the start and end, now and then after a great move
  (`QUICK_CHAT.bot*`), never more than `botMaxPerMinute`.
- **Lobby chat:** the same quick chat while a match fills (the queue's grid), one channel for everyone waiting; its
  lines stay in the match's feed once teams begin.
- **Global chat on the home page** (a computer's right column): one shared room, preset lines only, one message per
  account every `GLOBAL_CHAT.gapMs`, the last `keep` lines kept for newcomers. Reading rides on the live line's poll
  (`/api/live?chat=N`): no socket or poll of its own. Posting is POST `/api/chat`; guests read only. With
  `GLOBAL_CHAT_BOTS` on, a bot line now and then while someone has it open (made when someone asks, never on a timer).
  A deleted account's lines leave it (`GlobalChat.forgetAccount`, through the live hub), and a player's own lines are
  in their data download ([accounts.md](accounts.md)).

## Moderation

Why it's built this way: [docs/decisions/2026-10-16-chat-moderation.md](../decisions/2026-10-16-chat-moderation.md).
The preset lines are all friendly, so what can offend is a player's name and drawn icon.

- **Mute** (one tap: a name opens its menu, Profile / Mute). By account, on this device (`localStorage` `brc.muted`,
  at most 300), for every chat (global, lobby, match) until unmuted (the menu, a chat's options, the global chat's
  "N muted · unmute"). A player without an account (a bot) is muted for that match only, as before ("Mute for this
  match"). In a match the server also stops sending their lines to that device (`chatPrefs`), and sends their recent
  lines again when they're unmuted. Blocking (friends) counts as muted (`MatchChat.hidden`).
- **Reporting** is fair play's report on a player's profile ("Offensive name or icon", [fairplay.md](fairplay.md)),
  reached from their name in a chat (Profile). It opens a watch case on fair play's review page. There's no report of
  a chat line.
- **Moderators** (admins, `ADMIN_EMAILS`) act from a player's page on fair play's review page (`/admin/fairplay`,
  `admin.ts`), reached from the reports in its open cases or from the box that takes a player's id or profile link.
  Its "Chat" section: warn, chat ban for 1, 7 or 30 days (`CHAT_MOD.banDays`) or with no end, lift the ban, reset the
  name and icon ("Player", a pawn; only their lines leave the global chat too, `LiveHub.dropChatLines`). Each needs a
  reason for the log; a warning or a ban can carry a note to the player. A link opens the player's profile in the
  game, to see the name and icon. A chat decision doesn't close the report's watch case (fair play's Clear does; its
  own ban button is "Ban from online play"). Known and rare: a ban lifted while its panel is on screen shows there
  until the panel is shown again or the page reloads.
- **A chat ban only stops sending** (lobby: refused with reason "mod" and the `ChatBlock`; global chat: 403 with it).
  The player still reads chat and plays. A lobby reads a chatting player's ban as they join and again at most every
  `CHAT_MOD.recheckMs` (30 s) as they chat. The panels show why instead of their buttons ("Your chat is off until
  Oct 18, 2:00 PM: a moderator's decision." or "Your chat is off: a moderator's decision."), and showing one reads the
  profile again (at most every 30 s), so a lift shows without a reload. A warning or a chat ban shows once on the
  home screen (never over a match), with the note ("Got it": POST `/api/chat/notice`, and the app forgets it). The
  profile (`/api/me`) carries `chatMod: {block?, notice?}`.
- **The name filter** (`server/src/text-filter.ts`): the free text players see is names. A small list of our own
  (slurs and hate terms, not swearing), ROT13-encoded in the file; the list and the words left off on purpose are in
  the decision file. It reads at most 64 characters, word by word: case, accents, look-alike letters, invisible
  characters and leetspeak fold away; symbols inside a word go; a run of two or more short words (two letters or fewer
  each) joins into one; digits at a word's end are read as letters and as a number left out. Long terms match inside a
  word (with q for g; the n-word's also across the whole name), short ones only as the exact whole word (or its
  plural). A
  profile can't take such a name ("That name isn't allowed. Pick another one."); a guest asking for one with its first
  visit gets "Player"; a lobby or Squads seat asked for with one is "Player N"; the global chat shows an old one as
  "Player". Lobby and Squads seats take the account's name as a player joins, so a reset holds.
- **Send limits** (unchanged, per account): a lobby's chat one line every `QUICK_CHAT.minGapMs`, `burstMax` in
  `burstWindowMs`, no repeat within `repeatMs` (by account, so a new seat doesn't reset them); the global chat one
  every `GLOBAL_CHAT.gapMs`.

### What's stored, and for how long (for the privacy page)

- **A moderator's decision** (D1 `chat_mod_log`): the player's account id, what (a warning, a chat ban and its end, a
  lift, a reset, or a guest's decisions merged in), when, by whom, the reason, the note to the player, and whether
  they've seen it. Kept `CHAT_MOD.keepDecisionsDays` (180) days after it ended (a warning, a lift or a reset from when
  it was made); a chat ban with no end stays while it's in force. Deleted by the Worker's 15-minute schedule
  (`pruneChatMod`).
- **Mutes** stay on the player's device only. Nothing about who muted whom reaches the server beyond a match's own
  `chatPrefs` (gone with the lobby).
- **The name filter** keeps nothing: a refused name isn't stored.
- **Download my data** (`account-data.ts`, store `chatModeration`): the decisions about their chat as they saw them
  (what, when, until, the note). Not the moderators' reasons and names (a person answers a request).
- **Delete account:** every decision about their chat goes; nothing is kept (a chat ban is the account's alone).
- **A guest signing in to an account:** its decisions move to the account (`chatModMoves`, in the sign-in's one
  batch), so a chat ban can't be shed by signing in; a "merged" line says so.

## Where the code is

| What | Where |
| --- | --- |
| The line list, groups, packs, picks, limits (pure, shared) | `packages/core/src/chat.ts` |
| Quick chat panel, picker, feed | `packages/app/src/components/QuickChat.tsx`, `chat.ts` (app side); profile picks `ChatPicks.tsx` |
| Lobby chat | `packages/app/src/components/LobbyChat.tsx` |
| Global chat | `packages/app/src/components/GlobalChat.tsx`, `global-chat.ts`; server `packages/server/src/global-chat.ts` (pure), `global-chat-api.ts`, kept by the live hub (`live-hub.ts`) |
| Messages over the wire | `packages/chess/src/protocol.ts` (chat message types), `packages/app/src/net.ts` |
| Relaying, rate limits, bots' lines in a match | `packages/server/src/lobby.ts` / `lobby-do.ts` (chat handling) |
| Packs in the shop | `packages/core/src/shop.ts`, `packages/server/src/accounts.ts`, `api.ts` (`/api/shop/chat`) |
| Moderation: decisions, bans, the notice, keeping (D1) | `packages/server/src/chat-mod.ts`, table `chat-mod-schema.ts`; the moderator's section of fair play's page `admin.ts`; the notice's route `api.ts` |
| Moderation in a lobby (a ban read as they join and every 30 s) | `packages/server/src/lobby-do.ts` (`joiningProfileOf`), `lobby.ts` (`chatStanding`) |
| The name filter | `packages/server/src/text-filter.ts` (accounts, lobbies, Squads seats) |
| Moderation in the app (mutes, your ban, the notice) | `packages/app/src/chat-mod.ts`, `components/ChatNotice.tsx`, the menus in `QuickChat.tsx` and `GlobalChat.tsx` |

## Settings

`QUICK_CHAT` (limits, bots, defaults, pack prices), `GLOBAL_CHAT`, `GLOBAL_CHAT_BOTS`, `CHAT_MOD` (ban lengths, the
lobby's recheck, keeping); the Worker variable `ADMIN_EMAILS` (fair play's review page). No kill switch of its own:
moderators turn off one player's chat; every player can turn chat off on their device.

## Tests and tools

- Unit: `packages/core/test/chat.test.ts`, `global-chat.test.ts`, `packages/app/test/chat.test.ts`,
  `global-chat.test.ts`, `packages/server/test/lobby-chat.test.ts`, `global-chat.test.ts`, `chat-mod.test.ts`
  (decisions, the notice, keeping, the routes, fair play's page), `lobby-do-chat.test.ts` (the lobby's reads),
  `text-filter.test.ts`, `account-data.test.ts` (the download, deleting, a guest's merge).
- e2e: `e2e/chat.spec.ts`, `lobby-chat.spec.ts`, `global-chat.spec.ts`, `panel.spec.ts`, `chat-mod.spec.ts` (mute, a
  profile report, a moderator's chat ban, the notice, the name filter).
- Frames: `npm run frames:chat`, `frames:lobbychat`.

## Rules for this area

- It never gets in the way of the chess: never cover the board, never steal a tap meant for a move, never a sound
  louder than a move.
- For a panel with several controls, test every button from every state with a reload after each, and assert it's
  never an empty box (`e2e/panel.spec.ts`).
- When a screen adopts a shared component (`PlayerName`), check its own styles still apply.
- Nothing about moderation pops up over a match: notices wait for the home screen.
