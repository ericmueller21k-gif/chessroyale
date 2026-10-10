# Chat: quick chat, lobby chat, global chat

Lane: `social`.

## How it works today

- **No free text anywhere.** A message is the id of a line from a fixed list (a phrase or an emoji), so there's
  nothing to moderate. The server relays only known lines the sender owns, within the limits; names come from the
  server, never from the message.
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
- **Bots chat** a little: a line or two at the start and end, now and then after a great move
  (`QUICK_CHAT.bot*`), never more than `botMaxPerMinute`.
- **Lobby chat:** the same quick chat while a match fills (the queue's grid), one channel for everyone waiting; its
  lines stay in the match's feed once teams begin.
- **Global chat on the home page** (a computer's right column): one shared room, preset lines only, one message per
  account every `GLOBAL_CHAT.gapMs`, the last `keep` lines kept for newcomers. Reading rides on the live line's poll
  (`/api/live?chat=N`): no socket or poll of its own. Posting is POST `/api/chat`; guests read only. With
  `GLOBAL_CHAT_BOTS` on, a bot line now and then while someone has it open (made when someone asks, never on a timer).

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

## Settings

`QUICK_CHAT` (limits, bots, defaults, pack prices), `GLOBAL_CHAT`, `GLOBAL_CHAT_BOTS`.

## Tests and tools

- Unit: `packages/core/test/chat.test.ts`, `global-chat.test.ts`, `packages/app/test/chat.test.ts`,
  `global-chat.test.ts`, `packages/server/test/lobby-chat.test.ts`, `global-chat.test.ts`.
- e2e: `e2e/chat.spec.ts`, `lobby-chat.spec.ts`, `global-chat.spec.ts`, `panel.spec.ts`.
- Frames: `npm run frames:chat`, `frames:lobbychat`.

## Rules for this area

- It never gets in the way of the chess: never cover the board, never steal a tap meant for a move, never a sound
  louder than a move.
- For a panel with several controls, test every button from every state with a reload after each, and assert it's
  never an empty box (`e2e/panel.spec.ts`).
- When a screen adopts a shared component (`PlayerName`), check its own styles still apply.
