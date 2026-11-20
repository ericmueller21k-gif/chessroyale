# The Battle Tower (designed; being built)

Lane: the director (the rules: `god-king`; the floor art: `characters`; saving: the director, full lane). **Built so far: the
board layer (PR 1); every boss on it (PRs 2-5); several bosses in the match runner (PR 6: a runner option, `settings.bossIds`); the
climb's rules (PR 8: core `tower.ts`, a floor's start from the deal); saving (PR 9: server `tower.ts`, the routes); the solo battle (PR 10); the
town's tower is the tower, no screen of its own (PR 11b); the party (PR 12: a copy each, climbing on together, alone after; the clerk's
three ways); two lives (Nov 20).**
The design, its calls settled with Eric (Nov 18): [docs/decisions/2026-11-18-battle-tower-design.md](../decisions/2026-11-18-battle-tower-design.md).

## What it will be

- A climb of up to 99 floors (a skyscraper), alone or as a party of up to 4, opened from the town's clerk only (Eric, Nov 19: no home card). Each floor is
  one game from the starting position against 1, 2 or 3 bosses at once on one board (the pattern 1, 2, 2, 3 looping), taking turns
  to move, each with its own powers and meter, stronger every floor: Maia from 600, +20 a floor to floor 5, +30 to 10, +40 to 30,
  then +4 a floor (held about 1630 to 1710 to floor 50; a lone boss +100); from floor 51 Stockfish from 1750, +31 a floor, its best
  on floor 99 (Eric, Nov 20).
- Every boss's moves are in, a few with a one-line rule; Hollow and Smudgy never share a floor, and for now neither do Smudgy + Alfil, Alfil + Jefferson and Dash + Smudgy (Nov 19); the Hidden Boss isn't in the tower.
- You play White (random sides later). Two lives (Nov 20, below): a floor lost, drawn or left counts and costs one, the climb going on; the
  third loss ends the run. Every floor is one snug room in HunChess's colors (the town's
  challenge room as the model: `town/shops/challenge.ts`), its number big on both side walls; you walk in to the board and the
  floor's bosses come out of the top door. Between floors you may stop: the run is saved on the server (guests too) and resumes
  on that floor; a solo floor rejoins after a reload.
- A party (up to 4) picks every move: the most picked is played, a tie goes to the engine's best (`partyMove`, `partyCloseCp` 0), the
  Boss Battle party's no-pick rules. Every member keeps a copy of the party's climb (below, "The party").
- Built on **the board layer** (`packages/chess/src/board-layer.ts`, built Nov 18): one state per square, edge and piece, every
  boss's marks at once, the most restrictive winning, one "always a legal move" lift; today's bosses move onto it with no change
  to any boss battle (PRs 2-5).

## The board layer (built)

- **Marks:** square (`noLand`, `noPass`, both a wall, neither drawn: fire), edge (`across: "straight"`: rank and file moves only;
  `"all"`: every move whose line meets it, corners included), piece (`held`, `shieldFrom: "pawns" | "all"`, or drawn); each with
  `binds` ("both", "crowd", "bosses": the layer's `crowd` says which side is the crowd's), `until` (its last crowd turn) and `by`.
- **Functions:** `movePaths` (castling's king and rook, Chess960's too), `layerStop` (the first mark that stops a legal move:
  held, squares, edges, shields), `layerMoves` (`{ moves, lifted }`), `followLayer`, `wearLayer`, `mergeLayers`. Sawyer's
  `edgeOf` and `moveEdges` live here now.
- Calls made: [2026-11-18-board-layer.md](../decisions/2026-11-18-board-layer.md).

## Several bosses in the runner (built, PR 6)

- **The side:** `settings.bossIds` (2-3 ids, the order they take turns) starts a raid with them all, from the starting position; never
  two `BATTLE_TOWER.apart` keeps apart (Hollow and Smudgy; Smudgy + Alfil, Alfil + Jefferson, Dash + Smudgy for now: `docs/decisions/2026-11-19-tower-apart-pairs.md`). `MatchState.bosses` holds each one's own part (`BossOwn`: id, strength,
  powers); `state.boss` is always the boss in focus in full, with the battle's shared fields, so every boss's code runs as alone.
  `state.moved`: who made the side's last move.
- **The focus:** the bosses to move: the boss whose move comes out of turn (`BossRules.outOfTurn`: Wrangler's duel reply, Folio's
  move again after Revision), else the boss after the one who moved. The crowd to move: the boss to move next (his turn change),
  or Hollow while his second move is due.
- **Each crowd turn:** every boss's `prepareTurn` (passive, meter at `BATTLE_TOWER.rageScale`); each one's ultimate step only at his
  own turn change (after his move for a `triggerAtHisTurn` ultimate, before it for the rest), one ultimate a turn change. **An
  ultimate that can't wait** (`BossRules.ultimateNow`, Nov 19: Chandy's last chance, a mate in one open as your turn begins) runs
  its step first at any turn change, the others waiting but one the boss who just moved prepared (Wrangler's line-up is on the
  board already); its boss then holds the crowd's turn (`focusNow`), so his Dodge plays as at his own turn change. Its question
  reads the side's allowed moves (`TurnContext.crowdMoves`: every boss's steps on a copy, worked out only when a mate is on the
  board): docs/decisions/2026-11-19-ultimate-now.md. A hook reading a meter outside a step reads the floor's rates
  (`Battle.rageRates`: Folio's `creaseDue`).
- **The side's rules:** the dispatcher's `sideCrowdAllowed` (every boss's marks merged, every `crowdFilter`, one lift, the barred
  move), `sideBossAllowed` (every mark binding the bosses, his own `bossStops`, the others' `sideStops`), the judge, fair play, the
  Last Stand, and the moments queue (the view's `events`: every boss's, the one in focus first).
- **Every move reaches every boss:** after the crowd's move every boss's `afterCrowdMove` (from the boss who moved last: Folio's
  Revision may cross the move out, and then the others never see it), each with its judged numbers; after a boss's move (his extra
  move, the leapfrog hop) every other boss's `followMove`, and the mover's `followedBy` when one changed (Folio's Revision never crosses
  that move out); after every boss's turn and crowd move every boss's `followBoard` (a tracked piece another boss's power moved is let
  go). A move of the side is named as any boss on it masks it (`sideMoveName`: Smudgy's hidden rook stepped as a pawn, "d6"). A
  hook's `bossToMove()` is true only for the boss whose turn it is (`hisTurn`).
- Calls made: [2026-11-18-several-bosses.md](../decisions/2026-11-18-several-bosses.md).

## The climb (built, PR 8)

- **Core `tower.ts`**, plain data and pure functions for the server to save (PR 9): `floorBossCount` (`BATTLE_TOWER.pattern` looping),
  `floorStrength(floor, bosses)` (Maia `maiaStart`, then each floor its `maiaSteps` row's step, `maiaFloorRating`, held at Maia's top; a lone boss `soloBonus` more, within
  the caps; Stockfish from `stockfishFrom` at `stockfishStart` + `stockfishStep`, held at `ENGINE_MAX_ELO` on floor 98, its best on
  99), `towerPool(off)` (every playable boss: never the hidden one or one in the game for admins first; minus the kill switches).
- **A run** (`TowerRun`: `seed`, `floors` dealt so far, the last the floor to fight, `deck`, `decks`, `status` open, top or out):
  `newRun(seed, pool)`, `startFloor(run, pool)` (the only way into a floor: its bosses from the deal, dealt again if the pool no longer
  allows them; its runner settings), `finishFloor(run, "won" | "lost" | "drawn", pool)` (a win deals the next floor; floor 99 played
  through: top; a loss or draw: a life, the next floor dealt as after a win, or with none left out: "Lives", below),
  `leaveFloor(run, crowdMoves, pool)` (free before your 2nd move, `leaveFreeBefore`, else a loss).
- **The deal:** a seeded deck of the pool, in order, a new deck when it runs out: every boss once before any twice, never the same boss
  on two floors in a row, never an `apart` pair (a deck that would leave a pair waiting at its end is shuffled again).
- **In the runner** (`settings.towerFloor`, set by `startFloor`): every boss at the floor's strength (`elo` the floor's rating, no
  offset or difficulty; the brain Maia at that rating for one player or a party alike, Stockfish from floor 51; "best" from 80). A side
  core's `sideRefusal` refuses still throws in `startSide` (test switch, tests); a room never gets there (finding 7).
- Calls made: [2026-11-19-tower-climb-rules.md](../decisions/2026-11-19-tower-climb-rules.md).

## Saving (built, PR 9)

- **Server `tower.ts`**: a climb is stored on the server, a guest's too, so it's stopped after any floor and continued on any device.
  `tower_runs` (one row a climb: `seed` the server's, `floor` the floor to fight, `met` core's deal (`floors` dealt, `deck`, `decks`),
  `fight` the floor under way `{ id, startedAt, device? }` (device: the starting device's id, answered back; a party's floor `{ id,
  startedAt, lobby }`) or null, `last` the last result taken `{ id, outcome, floor, status, party? }`, `status`
  open, top, out or abandoned (only the sign-in merge sets that); `kind` 'party' and `members` for a party copy: PR 12, below) and `tower_best` (the highest floor won, an account and kind, at most `BATTLE_TOWER.floors`; it only rises, worked out
  again from the runs after every result). One open run an account and kind (`tower_runs_open`, a unique index). A run that ended
  (or was set aside by the merge) stays until the next new run of its kind; a confirmed new run deletes the open one it replaces in
  its batch, after the best counts its floors.
- **Lives** (Nov 20, docs/decisions/2026-11-20-tower-lives.md): `met.lost`, the floors lost (each a life), and `met.won`, the highest
  floor won, written only once a floor is lost (a run with none lost is stored as before; one saved before lives reads as none lost);
  the best reads `met.won` (`soloBest`: a floor lost never counts to a best). Every run view, result and stop answers `lives` and
  `lost`; `last` keeps `lost` (a retry's answer); the download lists each climb's `lost`.
- **Routes** (`api.ts` → `towerResponse`, behind the session (a guest's cookie as anyone's), the API's rate limits and the ban gate):
  `GET /api/tower` (open runs, between floors the floor's bosses as its start will deal them now; bests);
  `POST /api/tower/run` (`newRun` from the server's seed; replaces an open run only with `confirm`, else 409 with it);
  `/floor/start` (`startFloor`, the start noted by the server's clock; one under way answers itself, `under`, and `resting` when its
  bosses no longer pass the pool; a run whose deal doesn't parse: 409 `confirm`, start a new one);
  `/floor/finish {fight, outcome}` (only the floor started, once: one statement that applies only while it's under way; won:
  `finishFloor` deals the next floor, refused sooner than `BATTLE_TOWER.soloWinMinSeconds` unless TEST_SWITCHES; lost or drawn: a life
  and the next floor, or with none left out;
  the last result taken, sent again, gets the same answer; any other result for a floor not under way is a 409 with `run` and `best`);
  `/stop {fight?, moves?}` (between floors nothing to do; mid-floor `leaveFloor`: free before your 2nd move, else a loss; no
  `moves` counts (a life, as a loss); free at any move when the floor's bosses no longer pass the pool: a kill switch since it began is our pause, not
  your leave, and its next start deals it again). Solo resting (PAUSE_SOLO) refuses a new run or floor (one under way still answers, finishes, stops); the bosses resting are never dealt. A solo result is the
  device's word (as Boss alone's).
- **The sign-in merge** (`towerMoves`, in the sign-in's batch): the guest's runs and bests join the account; two open runs of a
  kind: the higher floor stays (the account's on a tie), the other is abandoned; bests: the higher. **Download** (store `tower`:
  each climb's floors met and last result, never the seed, deck or a floor's id; bests) and **deleting** (every row):
  `account-data.ts`; the privacy policy's "The Battle Tower".
- A solo best is the device's word (as Boss alone's): it stays off any leaderboard and out of anything that pays.
- Calls made: [2026-11-19-tower-saving.md](../decisions/2026-11-19-tower-saving.md).

## Lives (built, Nov 20)

- **The rule** (Eric, Nov 20: "it just takes you on to the next match, and it just counts. You just advance"): `BATTLE_TOWER.lives` (2) a
  run; a floor lost, drawn, or left after your 2nd move costs one and the climb goes on, the next floor dealt as after a win; the third
  loss ends it. The run keeps the floors lost (`TowerRun.lost`, `livesLeft`); a best counts only floors won (`floorsWonBest`, the
  director's call). Floor 99 lost with a life left: the climb is done (top), its best 98. The climb sim uses core's rule.
- **The party:** one count for the party, every copy alike (the room writes one result to all); climbing on together again, the fewest
  lives any copy holds on that floor (`preparePartyFloor`); the plan says them once one is spent (`NetTowerPlan.lives`).
- **On screen** (nothing hidden, nothing shifts): two hearts, a spent one greyed (`components/TowerHearts.tsx`), always, in the run's
  strip, the floor room's corner (`.tw-room-lives`) and the clerk's card (the solo climb's line: hearts and "Lost floor 8"). After a lost
  floor: "You lost floor 8. It still counts: 1 life left." and the next floor (`data-tower-result="lost"`), the room's elevator open;
  the run's end lists the floors lost ("Lost floors 8, 11 and 12. Best solo: floor 10"). The leave's confirm says what it costs.
- Calls made: [2026-11-20-tower-lives.md](../decisions/2026-11-20-tower-lives.md).

## The solo flow (built, PR 10's battle; PR 11b's flow, Eric, Nov 19)

- **No tower screen** (PR 10's `/tower` page out of the flow, its code kept unused at Eric's word): the clerk's card (`town/TowerDesk.tsx`: Start, or Continue: floor N with a small
  Start over that asks) → you walk into the elevator → the floor room (`shops/tower-floor*.ts`: N on its walls, you to your mark, its bosses out
  of the elevator one by one, the pieces up, the zoom) → `enterTowerFloor()` → Boss alone's battle (no Last Stand; `TowerBar.tsx`) → the
  usual result (`TowerResult.tsx`: one button, Back to the tower) → the floor room on your mark: won (or a life spent), the elevator open
  (Up to floor N+1); out, shut. Bests on the lobby's board. Between floors leave by the way down or Back. A match's address is `/tower`: a reload rejoins it
  (`brc.tower.solo`, the restore). A start carries this device's id (`brc.tower.device`, kept in `fight`): a lost start answer is still its own. Calls: [2026-11-19-tower-solo-screens.md](../decisions/2026-11-19-tower-solo-screens.md), [2026-11-19-tower-flow.md](../decisions/2026-11-19-tower-flow.md).
- **Its music (Nov 19):** the tower's own theme (`tower-loop`, themes.json's `tower`) plays in the lobby and the floor room (`shops.ts`: its home's theme; Town.tsx `towerBack` starts it back in the room). A floor's battle plays one of its bosses' themes, picked at random as it starts and kept for the whole match and a reload (tower.ts `FloorPlay.music` → `KeptFloor.music`), avoiding the themes of the last `MUSIC.towerRecent` (5) floors on the device (`brc.tower.music`), else the least recent (`pickFloorTheme`). [2026-11-19-tower-music.md](../decisions/2026-11-19-tower-music.md).
- **The restore (audit 2):** kept as each round begins **and** as each step of the bosses' turn has played (solo.ts `nextRoundIn`), so a reload
  rejoins after his reply; **the clock** (the director's call): the time used on your turn is kept with the game as the page is hidden
  or closed (`KeptGame.turnMs`) and given back as used on a rejoin, and while the page is hidden your turn's clock stands still (no time
  passes while you're away); the floor's XP game id is kept (`KeptFloor.xp`) and a rejoin goes on with it, never a new one
  (xp.ts `noteFloorGame`). [2026-11-19-tower-audit-2-fixes.md](../decisions/2026-11-19-tower-audit-2-fixes.md).
- **Hollow's wrong tries and the quests (Nov 20):** a wrong try into the dark keeps the floor as it happens (a reload has the same bulbs out); a floor counts for XP and the profile but never the boss quests (the result's `tower`, core `soloQuestMode`). [2026-11-20-tower-hollow-quests.md](../decisions/2026-11-20-tower-hollow-quests.md).
- **A shared floor's screens (audit 2, finding 1):** the view's top level is the boss in focus; each boss's own part (`side.bosses`, his own
  ice too) is drawn as he would be alone (`boss-side.ts`: `sideOf`, `partsOf`, `partOf`, `moverOf`, `plyMoverOf`, `onSide`): `PowerBoard`
  once a boss with his own moments, his decor, gold, elephants, dark and the power-specific board animations from his part; every
  moment names its boss (`PowerEvent.boss`, the view only), so its banner, caster and words are his and his bubble shows by his part of
  the bar (`speakerOf`: a line keyed by his id); `refusedLine` asks every boss on the side; the move list's faces by ply
  (`side.movers`, from `MatchState.movers`) and "Ginger is thinking…" name the boss. One boss: unchanged.

### For PR 10 (the app)

- A 409 on finish means "read the run again", never an error: it carries `run` and `best`. A retry of the result whose answer was
  lost gets that answer again.
- "Leave (free)", offered from a `resting: true` answer, sends `stop` with `free: true`: if the boss is back by then (a 409 "That
  boss is back: leaving now counts as a loss."), ask again on the real terms; nothing was written (the delta review).
- A 409 with `confirm: true` from a start or finish: the run can't be played; offer a new run.
- `under` with `resting: true`: offer "Leave (free)" (the stop is free at any move); its bosses may be ones the app doesn't have.
- Two confirmed new runs at once both answer 200 and one is deleted: show the run each answer carries (every route acts on the open
  run; the fight's id guards results).
- Opening the tower on a second device while the first plays: start answers `under` with the same fight. Ask first ("This floor is
  under way on another device") before sending the counted stop for a floor with nothing to restore.
- `beaten` (and the download's `floors`) can name a boss later renamed or removed from the roster: draw unknown ids safely.

## The party (built, PR 12, Eric, Nov 20)

- **The clerk's card** (`town/TowerDesk.tsx`): three ways, always shown: **Solo** (Start or Continue, Start over, and "Alone: floor N":
  your party copy played on by yourself), **Invite friends** (makes the party; the friends sheet, `InviteSheet` with the tower's line,
  each friend's Invite: the invite kind "tower", "invited you to climb the Battle Tower", whose Accept joins the party and opens the
  town's tower), **Open party** (makes the party; the leader's line in the town's chat, "Ann is looking for 3 more to climb the Battle
  Tower", with **Go to the tower**: `TownChat.tsx` `PartyGo`, Town.tsx `goTower`: on the street the tower's own Go in, landing by the
  clerk with his card open, the clerk riding with that walk (a walk elsewhere calls it off); in the lobby, a walk to the clerk; greyed
  elsewhere, and on the street while a boss's challenge plays). Under the three ways (the third, **Open your own party**),
  the **open parties** (Eric, Nov 20): a box of one size, three rows tall (exactly: no scroll for three), scrolling inside, each party's
  leader, "2/4" and Join (seated on the party's welcome, its words otherwise; `GET /api/tower/parties`: the party lines standing in the
  Worker instance's copy of the town's room, each party's `towerListing`: room in it, no floor under way, not a run's own members climbing
  on; made once an instance every `TOWER_PARTY.listCacheMs` and shared by its readers, `townOpenParties`; read every
  `TOWER_PARTY.listPollMs` while the card shows), "No open parties right now." when none. Only for whoever could join: a guest where
  signing in is set up gets none and "Sign in to climb with a party." (and the card stops asking); none on a device the age gate marked too
  young or while the town's chat is paused, as the town shows no party lines then (the delta review of #835, findings 1 and 4). The panel under them is one layout whatever you're doing (the review of #835, finding 11): the
  party's 4 seats (seat colors, ★ the leader, ✓ ready, each other member's Kick, the leader's, asked first and greyed during a floor),
  the line (the plan, or your solo climb's note; three lines high, fixed, its words written to fit: your own climb named with its floor, the
  others counted, the leader's "2 not ready yet."; `tower-plan.ts`), READY or START (asked first when the plan ends your own party climb or takes it back
  floors) and Leave party, then the solo climb (Continue or Start, Start over, Alone). The party's half is greyed outside a party, the
  solo half inside one. Open your own party greyed but for its leader, full, open, during a floor, or a run's own members climbing on
  (`tower.closed`: such a party isn't opened to newcomers).
- **The party** (`squads-party.ts` kind "tower", `squads-do.ts`; routes `POST /api/tower/party`, `/api/tower/party/CODE[/ws]`): Boss
  Battle's party for `TOWER_PARTY.max` (4), one seat an account, accounts only, no bots, two or more to START. Its plan (`NetParty.tower`:
  "Your climb together goes on: floor N. Yours goes back from floor 30, and 1 more.", or "A new climb from floor 1. It ends 2 party
  climbs.") is the Durable
  Object's read of everyone's copies (`preparePartyFloor`), read again when its people change or a floor ends (3 s later while a member's
  last floor is still being written); a change of plan un-readies everyone; START reads it again and must find the plan they readied for;
  a seat whose account has been deleted holds it ("… Kick them to climb on"; not read again until a kick or a leave). Kick is refused from
  START until the room says the floor is over (`towerFloorOn`; the view's `tower.floor`); should its word never come (a room nobody
  reached, or its call lost), the party asks the room every `TOWER_PARTY.floorCheckMs` (`takeFloorCheck`, the room's `partyBattleDone`)
  and ends the floor itself once the room has closed or reached its results. The open line lapses when the party fills, starts, its leader leaves or its plan turns to
  a run's own members climbing on, and
  `TOWN_CHAT.lineMs` after it went up (`takeLapsedOpen`, the alarm; the live hub's `townRemoveParty`, only its own line); one an account,
  a new one at most every `TOWER_PARTY.openGapMs`, the leader passing the town chat's checks first (`townPartyPoster`); the line carries
  the leader's account (`from`), so muting or blocking them hides it. A party closed to the town (a run's own members climbing on) still
  seats anyone with its code (a friend's invite comes in the same way); a newcomer only turns the plan into a new climb, asked first.
- **One run, a copy each** (server `tower.ts`): a `tower_runs` row of kind 'party' for every member, the same seed and deal, `members`
  `{run, uids, alone?, party?, partyMet?}`. START: the floor's match room made (`towerPartySettings`: the party rule, ties to the engine's best, the floor's
  strength), then the floor begun on every copy in one batch (`commitPartyFloor`: a new run replaces only copies whose holders agreed; a
  run on, only while every copy is as read). The room writes each member's end to their copy (`LobbyCore.takeTowerEnds`, lobby-do's
  `towerQueue`, `writeTowerEnds`: one that fails is passed over, not waited for; a crate that keeps failing stops holding its floor up after
  `MATCH_SAVE.strictMinutes`, then the floor is written without it, logged; `partyFloorWrite`, keyed by the floor's id): the party's result for those
  still in it, a leave for those who left (free before the party's 2nd move, else a loss), a free leave for anyone who never came; a win
  raises the party best and pays a crate on `TOWER_PARTY.crateFloors` (once an account). A device can't finish or leave a party floor.
- **Climbing on together:** two or more members of a run, all holding an open copy of it, nobody new: on together from the lowest floor any
  of them reached with the party (`members.party`, set only by the party's writes; a copy played on alone keeps the deal there, `partyMet`,
  copied as its first floor alone begins), the copies above it going back to it, each named in the plan and asked first (the review of
  #835, finding 1: floors won alone never carry a party, its crates or its best up). Anyone new: a new run from floor 1. **Alone:** the solo routes with `kind: "party"` (`towerApi` `kind`, `KeptFloor.kind`),
  marked `alone`, the device's word; floors won alone raise the solo best. A party floor whose room has gone without its result is let go
  free (`settleStale`, the room's `holdsTowerFloor`).
- **The floor room and the match:** the party's START walks everyone into the elevator and the floor room (`onPartyFloor`, Town.tsx), the
  others' pawns in seat colors walking in after you to their marks (`MATE_MARKS`, `mateAt`); then the room's match (`enterPartyFloor` →
  App's `joinLobby` with the party's pass and seat; `NetMatch.towerParty` for the strip, kept by the room's code across a reload:
  `keepPartyFloor`); its result (`TowerPartyResult`), then back in the floor room (won: the party's START is the way up, `TowerPartyUp`).
- Quests: a party floor is "tower" (any and win, never the boss quests). The sign-in merge names the account in place of the guest in
  others' copies (once, where both were in it; only read through when the guest holds a party copy: `holdsPartyCopy`); deleting takes the
  account out of them, and a new run's copies are written only for accounts still there (the batch refused otherwise); the download says
  how many climbed a copy, never who. `?win=1` (Qxf7 mates) only where `TEST_SWITCHES` is on, never an admin's on the live site.
- Calls made: [2026-11-20-tower-party.md](../decisions/2026-11-20-tower-party.md).

## The audit

An independent auditor (Fable, high) checks the build three times (after PRs 6, 10 and 12): its brief is
[battle-tower-audit.md](battle-tower-audit.md). Audit 1 (after PR 6): [its report](../decisions/2026-11-19-battle-tower-audit-1.md);
findings 1-6 and the nits fixed in one PR (docs/decisions/2026-11-19-tower-audit-1-fixes.md); finding 7 (what the deal must not
take from `startSide`) fixed in PR 8 (above).

## Where the code will be

| Part | Files (planned) |
| --- | --- |
| The board layer | `packages/chess/src/board-layer.ts` (built; exported through `boss-powers.ts`); the dispatcher reads it (`limitCrowd`, `bossAllowed`, `bossStopped`, `boardAltered`) through each boss's `layer` hook: held pieces from PR 2, shields (Don Dough's gold, Chandy's shields) from PR 5, square marks (pies, toy blocks, plants, Chandy's beam and scatter, Don Dough's dough) from PR 3 |
| Several bosses on one board | built: `MatchState.bosses`, `focus`, `moved` (`packages/core/src/match.ts`); the runner's side section (`sideBosses`, `startSide`, `prepareSide`, `focusNow`); the dispatcher's `side*` functions (`boss-powers.ts`); `BATTLE_TOWER.rageScale` and `apart` (`settings.ts`) |
| The climb | built: core `tower.ts`, `BATTLE_TOWER` in `packages/core/src/settings.ts`; the runner's `towerStrength` (`settings.towerFloor`) |
| Saving | built: `packages/server/src/tower.ts` (`tower_runs`, `tower_best`, the routes' logic and `towerResponse`), routed from `api.ts`; `account-data.ts` (store `tower`); the sign-in merge in `accounts.ts` (`towerMoves`) |
| The party | built: `packages/server/src/squads-party.ts` (kind "tower"), `squads-do.ts` (its START, plan, open line), `tower.ts` (the copies: `partyPlan`, `preparePartyFloor`, `commitPartyFloor`, `partyFloorWrite`), `lobby.ts` (`takeTowerEnds`), `lobby-do.ts` (`towerQueue`), `town-chat.ts` (the "party" line); app `tower-party.ts`, `town/TowerDesk.tsx`, `town/TownChat.tsx`, `screens/TowerResult.tsx` (`TowerPartyResult`) |
| The screens | built (solo): the town's tower (`town/TowerDesk.tsx`, `shops/tower-floor.ts`, `tower-floor-scene.ts`, `tower-floor-art.ts`, Town.tsx), `TowerBar.tsx`, `TowerResult.tsx`, app `tower.ts`; no screen and no home card (Eric, Nov 19: the town's clerk only) |

## Tests (planned)

`packages/chess/test/board-layer.test.ts` (every mark, overlaps, the lift, castling, promotion, en passant); each family's twin
(today's rule, frozen, against the layer over seeded battles: `held-layer-twin.test.ts` for the held pieces, `square-layer-twin.test.ts` for the square marks, `shield-layer-twin.test.ts` for the shields); the boss kit (`packages/chess/test/boss-kit.test.ts`) and `e2e/boss-smoke.spec.ts` guard every boss
moved onto the layer; `boss-kit-side.test.ts` runs the kit over every pair and a sample of threes (and audit 1's seeds), `several-bosses.test.ts` the side's
rules (Chandy's last chance in every order, Folio's crease line at the floor's rates), and `boss-kit-parity.test.ts` solo against online
for every boss in a pair and two threes (more by hand: `KIT_PARITY_SIDES`); core `tower.test.ts` (the design's table, the deal over 300 seeds and two pools, the run's steps and lives, finding 7's start) and the runner's
side of finding 7 in `several-bosses.test.ts`; server `tower.test.ts` (the index, every route's happy path and refusals, a result once and
only for the floor started, the same result sent again, a win too soon, a free leave against a counted one, a floor whose bosses rest
since it began, a deal that doesn't parse, the best and its cap, the merge, the download and deleting; lives: a life spent and the climb
on, the third loss out, a run saved before lives, floor 99 lost, a counted leave, lives through the merge) and
`account-data.test.ts` (Ann's climb in every store's world); `e2e/account-delete.spec.ts` (a climb on the local D1: its `e2e/areas.json`
entry, "The Battle Tower's saving"); `e2e/battle-tower.spec.ts` (the clerk, the elevator, floor 1 won, back in the room, up to floor 2's bar, a reload rejoining, a loss costing a
life (a heart greyed in the room and the strip) and the climb going on, the third loss ending the run with its floors lost,
a free leave down to the lobby, Continue after a reload, no Last Stand); the party: server `tower-party.test.ts` (copies to every member,
climbing on together only with the run's own members, someone new a new run once each agreed, a leave, the room's ends, a crate floor,
alone, the merge and deleting, the party's plan, START and open line; lives (Nov 20): a loss a life on every copy alike, a counted leave
on the leaver's alone, the fewest lives climbing on together, the third loss out; since the review of #835: floors won alone never carrying a party
up, a deleted account's seat, the merge naming the account once, the line's lapse, Kick during a floor, the plan's floors going back, the
town's one line an account, the clerk's list) and `tower-party-do.test.ts` (the party's Durable Object on a fake runtime: START's plan changed since READY,
the room made but the commit refused, the raid kill switch, the open line's checks and lapse; the room's writes, `writeTowerEnds`), app
`tower.test.ts` (the plan's words), and `e2e/tower-party.spec.ts` (two pages: Invite friends, the friend's Accept, READY and START, both
walking in, floor 1 won together, both copies on floor 2, one going on alone; Open your own party's line, its "Go to the tower" (no typing
opened) bringing a player to the clerk, who joins from the list of open parties; the clerk's card on both screens); app `tower.test.ts` (the restore's pure parts), `tower-floor.test.ts` (the floor room).
