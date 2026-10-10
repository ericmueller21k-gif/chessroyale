# Matchmaking, lobbies and ranked

Lanes: `hub` (joining and filling a lobby, the queue screen), `ranked` (the matching rules and the rating maths),
`ops` (the matchmaker's plumbing under load: [ops.md](ops.md)).

## How it works today

- **"Play now" is the queue.** POST `/api/play` hands the press to the matchmaker (a Durable Object), which answers
  with a lobby code, or "Servers are busy, you're in line: about N s" with a ticket to ask again with.
- **One queue per mode and type** (`queueName`): crowd-default, crowd-botsoff, raid-default, raid-botsoff. The three
  matchmaking types, picked on the home screen under the mode and remembered per device:
  - **Default:** real players; bots fill the empty seats once the lobby has waited `MATCH_FILL_SECONDS` (60 s; 8 s in
    the e2e suite). Bots pop into the seats over `FRONT_DOOR.fillShowMs`.
  - **Bots off:** real players only. A 50 v 50 waits until it's full; a raid starts at 50, or after the minute with at
    least `MATCHMAKING.raidBotsOffMinPlayers` (10). A seat whose person has been gone `botsOffSeatHoldMs` is freed.
    "Switch to Default" moves you to Default's queue with your wait counting (bots no sooner than `switchMinWaitMs`).
  - **Solo:** you and bots, at once, played in your browser (it never touches the matchmaker or the live counts). The
    queue screen fills first (`soloFillMs`, `soloHoldMs`).
- **The queue as pure logic** (`queue.ts`): a PLAY press is a ticket held in memory; tickets are seated in batches
  (one seat reservation per lobby per batch); admission is limited per second and by `maxPlayers` on the servers
  (`CAPACITY.queue`, `CAPACITY.overload`). `MatchRules.group` splits a batch into groups that must not share a lobby
  (where ranked's skill bands will go); the default keeps everyone together in the order they pressed.
- **Lobbies.** One Durable Object per lobby, under a 5-character code with no look-alikes (`codes.ts`; a code is never
  reused while its lobby exists). "Play with friends" makes a private lobby (invite link `/lobby/CODE`); a private raid
  stays people-only. Seats survive reloads (a seat token on the device). The host (a connected computer before a
  phone) or the many judges score each round (see [engine.md](engine.md)).
- **A lobby's life** (`LOBBY_LIFE`): results stay up `lobbyResultsKeepMinutes` (15), then it closes; a lobby that
  never starts closes after `lobbyIdleMinutes`, an abandoned one after `lobbyAbandonedMinutes`. Closing tells anyone
  still connected, records results on profiles, drops it from the live line and deletes its storage (freeing the code).
  An old link or a reopened tab asks `/api/lobby/CODE` before retrying the socket.
- **The boss of a raid** is matched to the people only (bots don't count towards its strength), avoiding the boss most
  of its players met last (each sends theirs on joining).
- **Ranking today** is the rating on your profile (its rank, chart and "Top N%"); there is no ranked mode yet. A match
  counts for ranking only if at least `RANKING.rankedMinHumanShare` (30%) of its seats are real players
  (`isRankedMatch`; 30 of a 50 v 50's 100, 15 of a raid's 50). Solo and practice never count. Stored as
  `results.ranked`. The draft for ranked proper (Weng–Lin ratings, rank points, seasons, ranked queues) is in
  `docs/history/matchmaking-and-lobbies.md` and waits for Eric and for trustworthy scoring.

## Where the code is

| What | Where |
| --- | --- |
| PLAY and its answers, the matchmaker object | `packages/server/src/matchmaker.ts` |
| The queue (pure): tickets, batches, admission, matching rules | `packages/server/src/queue.ts` |
| Lobby codes | `packages/server/src/codes.ts` |
| Joining, filling, the lobby's life, results | `packages/server/src/lobby.ts` (pure), `lobby-do.ts` (Durable Object), routes in `index.ts` |
| The rating estimate and its curve | `packages/core/src/rating.ts`, `rating-curve.ts`; ranks in `profile.ts` and `RATING_RANKS` |
| App side: the queue screen, connecting | `packages/app/src/screens/Queue.tsx`, `Lobby.tsx`, `net.ts` |

## Settings

`MATCHMAKING`, `MATCHMAKING_TYPES`, `RANKING`, `LOBBY_LIFE`, `FRONT_DOOR.fillShowMs`, `CAPACITY.queue` and
`CAPACITY.overload`; the Worker variable `MATCH_FILL_SECONDS` (`wrangler.jsonc`).

## Tests and tools

- Unit: `packages/server/test/matchmaker.test.ts`, `lobby-types.test.ts`, `lobby-life.test.ts`, `lobby.test.ts`,
  `packages/core/test/rating.test.ts`, `profile.test.ts`.
- e2e: `e2e/matchmaking.spec.ts`, `lobby-close.spec.ts`, `multiplayer.spec.ts`, `busy.spec.ts`, `front-door.spec.ts`.
- Frames: `npm run frames:matchmaking`, `frames:queue`, `frames:close`.
- Rating curve: `npx tsx packages/sim/scripts/calibrate-rating.ts` (`reports/rating-calibration.md`).

## Rules for this area (from `.claude/LESSONS.md`)

- Anything the server starts (a lobby, a queue, a session) has an end, written down with its numbers, and a test for
  each way it ends, including "nobody is there any more". Test the stale case: the old link, the tab reopened later.
- A refused WebSocket says nothing about why: ask the server (an ordinary request) before retrying.
- Only real players move ratings; ratings are computed on the server from its own record, never from a browser.
