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

- **Mute** (one tap: a name or a line opens its menu: Profile, Mute, Report). By account, on this device
  (`localStorage` `brc.muted`, at most 300), for every chat (global, lobby, match) until unmuted (the menu, a chat's
  options, the global chat's "N muted · unmute"). A player without an account (a bot) is muted for that match only, as
  before. In a match the server also stops sending their lines to that device (`chatPrefs`). Blocking (friends) counts
  as muted (`MatchChat.hidden`).
- **Report** a line (the same menu): POST `/api/chat/report {n, lobby?}`. The server takes the line from its own copy
  (the lobby's log, `QUICK_CHAT.logSize`; the global chat's last `keep`), never from the device: a line the reporter
  could see (not the other team's plan), not a bot's, not their own. It stores the line and the lines around it
  (`CHAT_MOD.contextBefore`/`contextAfter`). One report per reporter, player and place a day (another answers "You've
  already reported this player here."), `CHAT_MOD.reportsPerDay` a day per reporter; signed in wherever sign-in is set
  up. The reporter sees "Reported. Thanks: a moderator will look at it." Reporting a player from their profile is fair
  play's (`fairplay.md`), unchanged.
- **The automatic pause:** reports from `CHAT_MOD.autoMuteReporters` different players, all within
  `autoMuteWindowMs` and none reviewed yet, pause the player's chat until a moderator looks (at most `autoMuteMs`).
- **The review page** `/admin/chat` (admins only, `ADMIN_EMAILS`, like `/admin/fairplay`; with `CHAT_MOD_TEST` "1"
  and no sign-in set up, anyone: local and e2e only). Players with open reports, by how many players reported them;
  each report with its lines around it (the line reported in bold). Decisions, each with a reason for the log (except
  to dismiss) and an optional note to the player: dismiss the reports, warn, chat ban for 1, 7 or 30 days
  (`CHAT_MOD.banDays`) or with no end, lift a pause, reset the name and icon. A decision reaches the lobbies the
  player was reported in within the day at once; other lobbies read a chatting player's standing when they join and
  every `CHAT_MOD.recheckMs`.
- **A pause only stops sending** (lobby: refused with reason "mod" and the `ChatBlock`; global chat: 403 with it).
  The player still reads chat and plays. The panels show why instead of their buttons ("Your chat is off until
  Oct 18, 2:00 PM: a moderator's decision.", "…off: a moderator's decision.", "Your chat is paused while a moderator
  looks at reports about it."). A warning or a chat ban shows once on the home screen (never over a match), with the
  note ("Got it": POST `/api/chat/notice`). The profile (`/api/me`) carries `chatMod: {block?, notice?}`.
- **The name filter** (`server/src/text-filter.ts`): the free text players see is names. A small list of our own
  (slurs and hate terms, not swearing), ROT13-encoded in the file, matched through case, accents, look-alike letters,
  invisible characters, leetspeak and spacing; short words only as whole words. A profile can't take such a name
  ("That name isn't allowed. Pick another one."); a new account or sign-in gets "Player"; a lobby or Squads seat asked
  for with one is "Player N"; the global chat shows an old one as "Player".
- **Send limits** (unchanged, per account): a lobby's chat one line every `QUICK_CHAT.minGapMs`, `burstMax` in
  `burstWindowMs`, no repeat within `repeatMs` (by account, so a new seat doesn't reset them); the global chat one
  every `GLOBAL_CHAT.gapMs`.

### What's stored, and for how long (for the privacy page)

- **A chat report** (D1 `chat_reports`): who reported, who said it (account ids), the line's words and when it was
  said, the sender's name as shown, where (the global chat or a lobby's code), and the lines around it (up to
  `CHAT_MOD.contextBefore` (6) before and `contextAfter` (3) after; each a name, the words and a time; no account
  ids). Kept until a moderator resolves it, then `CHAT_MOD.keepResolvedDays`
  (30) days.
- **A moderator's decision** (D1 `chat_mod_log`): the player's account id, what (warning, chat ban and its end,
  lift, dismissal, reset, automatic pause), when, by whom, the reason and the note to the player. Kept
  `CHAT_MOD.keepDecisionsDays` (180) days after it ended (a warning from when it was made); a chat ban with no end
  stays while it's in force.
- **Mutes** stay on the player's device only. Nothing about who muted whom reaches the server beyond a match's own
  `chatPrefs` (gone with the lobby).
- Old records are deleted by the Worker's schedule (every 15 minutes), and as reports come in and the review page is
  used (`pruneChatMod`, at most every 10 minutes per instance).

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
| Moderation: reports, pauses, decisions, keeping (D1) | `packages/server/src/chat-mod.ts`, tables `chat-mod-schema.ts`; routes `chat-mod-api.ts`; the review page `chat-mod-admin.ts` |
| Moderation in a lobby (a pause, a report's line) | `packages/server/src/lobby.ts` (`chatStanding`, `chatReportLine`), `lobby-do.ts` |
| The name filter | `packages/server/src/text-filter.ts` (accounts, lobbies, Squads seats) |
| Moderation in the app (mutes, reporting, your pause, the notice) | `packages/app/src/chat-mod.ts`, `components/ChatNotice.tsx`, the menus in `QuickChat.tsx` and `GlobalChat.tsx` |

## Settings

`QUICK_CHAT` (limits, bots, defaults, pack prices), `GLOBAL_CHAT`, `GLOBAL_CHAT_BOTS`, `CHAT_MOD` (reports, the
automatic pause, bans, keeping); Worker variables `ADMIN_EMAILS` (the review page) and `CHAT_MOD_TEST` (local and e2e
only).

## Tests and tools

- Unit: `packages/core/test/chat.test.ts`, `global-chat.test.ts`, `packages/app/test/chat.test.ts`,
  `global-chat.test.ts`, `packages/server/test/lobby-chat.test.ts`, `global-chat.test.ts`, `chat-mod.test.ts`
  (reports, the pause, decisions, keeping, the routes, the review page), `text-filter.test.ts`.
- e2e: `e2e/chat.spec.ts`, `lobby-chat.spec.ts`, `global-chat.spec.ts`, `panel.spec.ts`, `chat-mod.spec.ts` (mute,
  report, the review page, a chat ban, the name filter).
- Frames: `npm run frames:chat`, `frames:lobbychat`.

## Rules for this area

- It never gets in the way of the chess: never cover the board, never steal a tap meant for a move, never a sound
  louder than a move.
- For a panel with several controls, test every button from every state with a reload after each, and assert it's
  never an empty box (`e2e/panel.spec.ts`).
- When a screen adopts a shared component (`PlayerName`), check its own styles still apply.
- A report is only ever about what the server itself kept; never store what a device says a message was.
- Nothing about moderation pops up over a match: notices wait for the home screen.
