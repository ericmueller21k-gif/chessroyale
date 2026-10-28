# The town square: ten bots out, one goes home each minute (Oct 28, 2026)

Phone and computer. Builds on the sidekicks in town (`2026-10-28-sidekicks-in-town.md`), which kept six of the twenty
bots out at once and swapped one every 10 to 20 s, fading out and in where they stood.

## Eric's words (Oct 28)

> "no lag so I'd say drop in all little guys but do it like this, they work on 1 minute timer, 10 out at a time, randomly
> one each minute starts to head home, is replaced by another and then that same one can't be replaced again until all
> the others have been if that makes sense, even cooler is they walk and fade into their respective house and then the
> new one walks out from their home. They all walk near the town square area and persist there until the trigger tells
> them it's time to leave, for issues like being interrupted because they are in a match, simply check their status and
> pass them for that round and recheck later"

## The rules

- **Ten out** (`botsOut` 10 in `town/feel.ts`): ten of the twenty in the world, ten at home (not drawn, not tapped, on
  no square).
- **One change a minute** (`botTurnMs` 60 000, one fixed number): a timer checked in the town's tick (`takeTurns`), not
  per-frame work.
- **Who goes**: at random among the bots out still **due** this round. A round starts with every bot out; each goes home
  once; the bots that come out meanwhile aren't due until the next round. So no bot is sent home twice before all the
  others have gone once (Eric's "that same one can't be replaced again until all the others have been").
- **Busy bots are passed over** (`canGoHome`): seated (in a game, at a table, or across from you after one), held (its
  card or its table's card open), on its way to or from a game with you (`meet`, `leave`), within `botTurnAway` (5)
  steps of you, or out less than `botOutAtLeastMs` (90 s). Another free bot due goes that minute; none free, the minute
  is skipped and the next one tries again. A passed-over bot stays due. A bot is never sent home mid-game.
- **Who comes**: the one home longest (`homeQueue`, first in, first out), so all twenty come round; never the one that
  just went home.
- **Going home**: the bot walks to its door the town's own way round (on walkable squares, round anyone standing) and fades
  out there over `botFadeMs` (0.5 s); then it's home. A sidekick's door is its boss's home's; a pawn has no house, so it
  goes to the Colosseum's gate. **Coming out** is the same the other way: it fades in at its own door and walks to the
  square. The walk takes as long as it takes (the far homes a while).
- **Ten in the world all along**: the next comes out the moment the other gets home, so the one walking home and the one
  walking out both count toward the ten.
- **Tapping one on its way**: it holds while its card is open, as any bot does, and carries on when the card closes.
  Play keeps it out for the game.
- **Where they stay**: the bots out wander only in the square (`inSquare`: the park with its tables, the walk and the
  Colosseum's apron, as wide as the park, off the bosses' roaming ground). One that ends up elsewhere (a test hook calls
  it to you) walks back.

## Calls

- **Who comes: the one home longest** (the brief's call, kept): all twenty come round in turn, and it can't be the one
  that just left (that one is last in the queue).
- **A pawn's home is the Colosseum's gate** (the brief's call, kept): it fades out on the apron's free square nearest the
  gate, and comes out there. (Stepping into the gate itself would put it behind the Colosseum's picture, which is drawn
  over everything north of its front edge: it would vanish rather than fade.)
- **A sidekick's door** is the middle of its boss's home's front: the plot's front row in its middle column, where the
  bosses start in front of it. The homes' doorways are drawn near their middles; the game never had door positions, and
  a fixed rule needs none (Folio's house moving, Oct 28, changed nothing here). The kid walks to the square in front and
  steps onto the doorway as it fades. When its boss stands on that square, it takes the plot's front square either side
  (`doorway`), so two never share a square.
- **When the next comes out: as the other gets home**, not as it sets off ("and then the new one walks out from their
  home"; the brief's "both count toward the ten" holds either way). Ten in the world at every moment.
- **A round's last bot doesn't turn straight back.** In rounds, the bot that came out at the last minute of one round is
  due at the next round's first minute; picked then it would walk out and straight home. So a bot out less than 90 s
  (`botOutAtLeastMs`) is passed over like a busy one: within a round it changes nothing (a newcomer isn't due anyway).
- **Seated is busy** (the brief): a bot due that sits down at a table waits its turn there, so some minutes pass with
  nobody sent (in the unit test's hour, about 40 changes in 62 minutes). The rotation then runs a little slower than one
  a minute, never faster.
- **Walking through the bosses' grounds**: a bot going home crosses its boss's roaming ground and may pass through the
  boss for a step, as people do when walking (where they stop is what's kept apart).
- **Who's at home as the town opens**: as before, a shuffle by the town's seed (the same each time; back from a game, the
  bot you played is out). The home queue starts in the shuffle's order.
- **The test hook** `__townTurns(ms)` (turns every `ms`, the next one now) speeds the minute for the e2e test and the
  GIFs; `__townBots()` also tells whether a bot is going home, where it's headed, whether it's fading out or in, its door,
  whether it stands in the square, and its place in the queue.

## Tests

- `packages/app/test/town-bots.test.ts`, "the bots take turns" (new): ten out and ten in the world all along, the ones
  out standing in the square; one change a minute, only on the minute; the rounds (every bot out once before any twice,
  never within 90 s of coming out); busy bots passed and still due, the held one next once free, and each kind of busy;
  the one home longest next, as the other gets home, never the same; a sidekick to its boss's door and a pawn to the
  gate, fading out there over `botFadeMs`, the next fading in at its own door and walking to the square, every sidekick's
  door reachable; a bot going home held by its card and carrying on, one you play staying, never sent while seated across
  from you.
- `e2e/town.spec.ts` (phone and desktop, new): with the hook, one bot walks home and fades out at its door and is gone;
  the one home longest fades in at its own door, ten in the world all along, and walks to the square.
- **Test checks changed** (none guards a rule in `docs/rules/eric.md`):
  - `town-bots.test.ts`, "botsOut are out at once, the others at home (on no square); now and then one goes home and
    another comes out" → replaced by the turns tests above: "six out, at most one extra while one fades, every bot out
    within two hours, a held bot never goes" → "ten out exactly, ten in the world, the rounds, the queue, the doors"; the
    held bot's check → "busy bots are passed over… the held one next once free". Its "every bot out over two hours" is
    the rounds and the queue now (all twenty come round in turn).
  - `town-world.test.ts`, "bots sit at the tables now and then, a stool each": its "nobody shares a square" check skips a
    bot walking home or out while it walks (`tripping`): such a bot crosses the bosses' grounds and may pass through a
    boss for a step, as people do; where it stops is still kept apart. The check is unchanged for everyone else.
