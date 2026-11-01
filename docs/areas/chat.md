# Chat: quick chat, lobby chat, global chat, the town square's typed chat, moderation

Lane: `social`.

## How it works today

- **No free text in chat, except the town square's** (Eric, Oct 28: "I think it actually is totally fine to allow
  typing"; below). Everywhere else a message is the id of a line from a fixed list (a phrase or an emoji). The server
  relays only known lines the sender owns, within the limits; names come from the lobby or the account, never from the
  message. What players can abuse is how they use the lines (spam, taunts), their name and their icon: see
  Moderation below. Squads has no chat. Ranked 1 v 1 has the match's quick chat, one channel for its two players
  (no teams), with mute by account and the chat ban read as each player connects ([ranked.md](ranked.md)).
- **Quick chat in a match.** A chat button and panel in the places the design names (the match screens are the
  director's: no change to the board, clock, picks or reveal). Four groups of phrases: Hello and Sporting can go to
  everyone (the Team / All switch); Reactions and Plans stay inside your team, so plans stay secret. Emoji can go to
  everyone and float up from the sender's scoreboard row. On a phone's 50 v 50 the chat is a tab in the scoreboard's
  header (Black · White · All · Chat; the unread count shows on Chat while the scoreboard is up): Chat replaces the
  scoreboard in the same box and "‹ Back" returns to it (`CrowdTabs`, `components/QuickChat.tsx`). The Team / All switch
  sits in that header beside Back, so both labels fit whole down to 320 px (`e2e/panel.spec.ts`). A box under 170 px tall
  (a 390 × 664 phone's is 140) has 30 px buttons and 18 px lines, so the feed shows two whole lines; the board never
  resizes for it (`styles.css`, "A short chat tab", a container query). Elsewhere (a
  computer, a raid, Classic) a phone's space under the board is split between the scoreboard and chat, one view at a
  time, never an empty box.
- **The town square's chat log** is its own thing (a fading log in the top left of `/town`: the bosses' and kids' chatter,
  and signed-in players' typed messages, below): its look in [town-square.md](town-square.md), "The chat log".
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
- **The town square's typed chat** (Oct 28; [docs/decisions/2026-10-28-town-chat-typing.md](../decisions/2026-10-28-town-chat-typing.md);
  the log's look: [town-square.md](town-square.md)). The one chat with free text.
  - **Who:** signed-in accounts only (an email or Google: accounts are 13 and older), always, even where signing in
    isn't set up (local runs). Guests, and any device the age gate marked too young (`hc_age=under`, even with someone
    signed in), never ask for or get players' lines, and can't send: their log has the bosses' and kids' chatter alone.
  - **The room** (`server/src/town-chat.ts`, kept by the live hub beside the global chat, **in memory only**): each line
    `{n, at, from, name, text, color?}` for `TOWN_CHAT.lineMs` (**5 minutes** since Oct 28, Eric: "keep up to 5 minutes of chat actually"; it was 60 s: the app's
    log scrolls back that far, and Report and a moderator's Remove work on any line it shows), at most `holdMax` (300: kept
    when the time went from 1 to 5 minutes; a device keeps `deviceMax`, 100, of the newest, so the room needs only more
    than that, and the hub hands its whole room to each Worker instance every `readCacheMs`); a newcomer still gets the last `keep` (12).
    `color` (Oct 28, Eric's phone) is only the name color the sender's device picked when it opened the town (a whole number
    below `TOWN_COLOR_LIMIT`, 32; the app has ten and reads it modulo its palette): `POST /api/town/chat` takes it, `tidyColor`
    drops anything else without refusing the message, the line carries it to every reader so everyone sees the same color for
    that player's visit. Cosmetic: nothing is decided by it.
    The hub's alarm rings when the next line is due to go and sweeps it (`sweep`, `nextExpiry`), so nothing outlives its
    5 minutes even in an empty town; for the wait and the repeat it keeps when and a hash of the words, never the words, for a
    minute (`repeatMs`, which is why the alarm rings at the minute too). A restart forgets it and gives the room a new id (`room`): an app seeing a new room drops its players' lines
    before taking the new ones, so a Remove or a Report never reaches another line by an old number. The name comes from
    the account (one the name filter refuses goes out as "Player").
  - **Reading** rides on the live line's poll: `GET /api/live?town=N&room=R` (`town-chat-api.ts`: a signed-in reader,
    checked with this instance's caches; `{paused: true}` while the switch is off). While the town is open (and the tab
    visible) the app polls every `FRONT_DOOR.livePollMs` (5 s) instead of the 30 s heartbeat; each Worker instance asks
    the hub at most every `TOWN_CHAT.readCacheMs` (2 s) whoever reads, and at once when the reader is ahead of its copy
    (it saw a newer line in its own send's answer), so a stale copy never tells a reader to start over. The copy goes
    from the instance's memory on its next request after those 2 s (`expireTownCache`). No socket.
  - **Sending:** `POST /api/town/chat {text, since, room, color?}` → the line and the room after it, or why not. A body over 8 KB
    is refused in the Worker and the text cut to 1,024 characters before it goes to the shared hub. The server's limits
    (the app mirrors them): at most `maxChars` (80) characters after tidying (invisible and control characters and
    fillers that show as nothing out, a joiner kept only inside an emoji, a pile of accents cut to two, spaces run
    together, trimmed; what shows as one character is one, an emoji with its skin tone or 👩‍💻, up to 8 code points, and a
    longer one counts its code points; at most 240 code points in all), one message per account every `gapMs`
    (15 s; "One message every 15 s."), not the same message again (case, spaces and punctuation aside) within `repeatMs`
    (60 s; "You said that a moment ago."). A refused message doesn't start the wait.
  - **The filter** (`chatRefusal` in `text-filter.ts`): the names' list plus common swear words, refused alike ("That
    message isn't allowed."; Eric, Oct 28: family-friendly, so not masked). Look-alike letters (Cyrillic, Greek,
    Armenian, small capitals, dotless ı…) read as the Latin ones they pass for, in names too; in chat a word with real
    Latin letters and a letter from a look-alike alphabet the map doesn't fold is refused, and so is one drawing on two
    look-alike alphabets with a letter the map doesn't fold (words wholly in another alphabet, or CJK beside Latin, pass). Swear words split into letters anywhere in a
    sentence, split once ("f uck"), or masked with an ending ("f*cking") are caught. Links (also with a path, "t.me/x",
    a spaced or bracketed dot or "dot com"), email addresses and mail services ("at yahoo"), phone numbers and messaging
    apps ("add me on discord", roblox, kik) are refused with "No links or contact details in chat." A message with 7 digits or more in
    all (any script's, however spaced) is refused as contact details: rating ranges, long score lists and full dates go
    with them; one or two numbers pass ("I'm 1500", "gg 1-0", "3+2", "Nf7#"). The decision file, call 4.
  - **A chat ban** stops typing here too (403, `CHAT_OFF` and the `block`), and so does a fair-play ban; they still read.
  - **The kill switch** `PAUSE_TOWN_CHAT` (core's `pauses.ts`, "town-chat"; on unless set): nobody sends (503,
    "Chat is paused."), readers get `{paused: true}` and no players' lines; the field says "Chat is paused." and the
    log keeps the bosses' chatter.
  - **In the app** (`packages/app/src/town/chat-net.ts`): `openTownFeed(sink)` (nothing for a guest or a young device),
    `sendTownChat(text)` (async: the field waits for the answer and shows a refusal's reason over it for 4 s),
    `townChatOff()` (why the field can't send), `reportTownLine`, `removeTownLine`. Lines go into the log through
    `say(name, text, "player", {uid, n})` and out through `unsay` (by number or by player). Muted and blocked players' lines
    never reach the log; muting or blocking someone takes theirs out, and every player's line leaves at once when you may
    no longer see them (signed out, the device marked too young, the chat paused). The field is there for everyone,
    greyed with why for a guest ("Sign in to chat with other players."), a young device ("Chat with other players is
    for accounts 13 and older."), the switch or a chat ban. A tap on a player's line opens its menu (Profile / Mute /
    Report, Remove for a moderator).

## Moderation

Why it's built this way: [docs/decisions/2026-10-16-chat-moderation.md](../decisions/2026-10-16-chat-moderation.md).
The preset lines are all friendly, so what can offend is a player's name and drawn icon.

- **Mute** (one tap: a name opens its menu, Profile / Mute; in the town square a tap on a player's line, name or text,
  opens Profile / Mute / Report, and Remove for a moderator). By account, on this device (`localStorage` `brc.muted`,
  at most 300), for every chat (global, lobby, match) until unmuted (the menu, a chat's options, the global chat's
  "N muted · unmute"). A player without an account (a bot) is muted for that match only, as before ("Mute for this
  match"). In a match the server also stops sending their lines to that device (`chatPrefs`), and sends their recent
  lines again when they're unmuted. Blocking (friends) counts as muted (`MatchChat.hidden`). A name's open menu and a
  chat's open options are the match chat's (`MatchChat.menuFor`, `optionsOpen`), not the panel's: each phase's screen
  draws its own panel, and they stay open when the round moves on (Oct 16, `2026-10-16-flaky-e2e-batch-4.md`).
- **Reporting** is fair play's report on a player's profile ("Offensive name or icon", [fairplay.md](fairplay.md)),
  reached from their name in a chat (Profile). It opens a watch case on fair play's review page. **A line in the town
  square** is reported from its menu: fair play's report with the reason "Offensive chat"
  (`FAIRPLAY.reports.chatReason`, not one of the profile sheet's buttons) and the line's number; the server reads the
  line's text and time from the room (never from the reporter: a line that's gone, or isn't the player's, is refused,
  "That message has gone from the chat. You can still report the player from their profile."), one report per line,
  and fair play's case page shows it under Reports. It opens a watch case as reports do. Only someone who may read the
  town's chat can report a line of it (a guest or a young device can't probe who spoke). The automated reviewer's API
  gets the report without the words and can't clear a case with one ([docs/fairplay-reviewer.md](../fairplay-reviewer.md)).
- **Moderators** take one town square line down from its menu in the town ("Remove", for an admin: `POST
  /api/town/chat/remove {n}`): it leaves the room and every reader's log (the room lists it as `gone` for `lineMs`, 5 minutes).
  Nothing is logged or stored. A reset of a player's name and icon, and a deleted account, take their town lines out
  too.
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
- **The name filter** (`server/src/text-filter.ts`): the free text players see is names (and, since Oct 28, the town
  square's messages: `chatRefusal`, above). A small list of our own
  (slurs and hate terms, not swearing), ROT13-encoded in the file; the list and the words left off on purpose are in
  the decision file. It reads at most 64 characters, word by word: case, accents, look-alike letters, invisible
  characters and leetspeak fold away; symbols inside a word go; a run of two or more short words (two letters or fewer
  each) joins into one; digits at a word's end are read as letters and as a number left out. Long terms match inside a
  word (with q for g; the n-word's also across the words, from the start of a word), short ones only as the exact whole word (or its
  plural). A
  profile can't take such a name ("That name isn't allowed. Pick another one."); a guest asking for one with its first
  visit gets "Player"; a lobby or Squads seat asked for with one is "Player N"; the global chat shows an old one as
  "Player". Lobby and Squads seats take the account's name as a player joins, so a reset holds.
- **Send limits** (per account): a lobby's chat one line every `QUICK_CHAT.minGapMs`, `burstMax` in
  `burstWindowMs`, no repeat within `repeatMs` (by account, so a new seat doesn't reset them); the global chat one
  every `GLOBAL_CHAT.gapMs`; the town square one every `TOWN_CHAT.gapMs`, no repeat within its `repeatMs`.

### What's stored, and for how long (for the privacy page)

- **A moderator's decision** (D1 `chat_mod_log`): the player's account id, what (a warning, a chat ban and its end, a
  lift, a reset, or a guest's decisions merged in), when, by whom, the reason, the note to the player, and whether
  they've seen it. Kept `CHAT_MOD.keepDecisionsDays` (180) days after it ended (a warning, a lift or a reset from when
  it was made); a chat ban with no end stays while it's in force. Deleted by the Worker's 15-minute schedule
  (`pruneChatMod`).
- **Mutes** stay on the player's device only. Nothing about who muted whom reaches the server beyond a match's own
  `chatPrefs` (gone with the lobby).
- **The name filter** keeps nothing: a refused name isn't stored, nor a refused message.
- **The town square's messages** aren't stored: the live hub holds each in memory for `TOWN_CHAT.lineMs` (5 minutes; the privacy page says so), never
  in its storage or D1, and a restart forgets them. There's no table of chat lines. Not in "Download my data" (nothing
  is kept to download).
- **A report of a town square line** (D1 `reports`, columns `line` and `line_at`): the line's text and when it was
  said, with the report, for a moderator. Kept as reports are: until the reporter's or the reported player's account is
  deleted (either deletes it, as before). The reporter's download lists the report without the line (it's the other
  player's words).
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
| The name filter | `packages/server/src/text-filter.ts` (accounts, lobbies, Squads seats; `chatRefusal` for the town's chat) |
| The town square's typed chat | `packages/server/src/town-chat.ts` (the room, pure), `town-chat-api.ts` (the routes, who may), kept by `live-hub.ts`; the report's line in `fairplay.ts` (`reportPlayer`) and `admin.ts`; app `packages/app/src/town/chat-net.ts` |
| Moderation in the app (mutes, your ban, the notice) | `packages/app/src/chat-mod.ts`, `components/ChatNotice.tsx`, the menus in `QuickChat.tsx` and `GlobalChat.tsx` |

## Settings

`QUICK_CHAT` (limits, bots, defaults, pack prices), `GLOBAL_CHAT`, `GLOBAL_CHAT_BOTS`, `TOWN_CHAT` (the town square's
limits, keep and expiry), `CHAT_MOD` (ban lengths, the lobby's recheck, keeping), `FAIRPLAY.reports.chatReason`; the
Worker variables `ADMIN_EMAILS` (fair play's review page) and `PAUSE_TOWN_CHAT` (the town square's typing off
everywhere). The other chats have no kill switch of their own: moderators turn off one player's chat; every player can
turn chat off on their device.

## Tests and tools

- Unit: `packages/core/test/chat.test.ts`, `global-chat.test.ts`, `packages/app/test/chat.test.ts`,
  `global-chat.test.ts`, `packages/server/test/lobby-chat.test.ts`, `global-chat.test.ts`, `chat-mod.test.ts`
  (decisions, the notice, keeping, the routes, fair play's page), `lobby-do-chat.test.ts` (the lobby's reads),
  `text-filter.test.ts` (names, and the chat filter), `account-data.test.ts` (the download, deleting, a guest's merge),
  `town-chat.test.ts` (the town's room, the hub, the routes, the switch, a ban, a moderator's removal, a report's line),
  `packages/app/test/town-chat-net.test.ts`.
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
