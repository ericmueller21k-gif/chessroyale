# Roadmap: the next phase (Oct 4, 2026)

Eric wants to build out the real site: server, matchmaking, ranking and profiles, plus icons and a coin system. Paid
hosting and a good domain are fine (see `DECISIONS.md`, "Paid hosting and a domain"). Everything stays on Cloudflare,
on Eric's account.

## Build order

1. **Domain.** Done: hunchess.com.
2. **Accounts and profiles.** Done (Google and email codes). Online play needs signing in; guests play bots. Play as a guest at once (an account tied to the device), then link a sign-in to keep it
   across devices. Profile: name, icon, games played, wins (the 2v2 final, and the team's game result in Crowd),
   average placement, rating and its history, best moves, recent matches. Storage: Cloudflare D1 (SQL).
3. **Matchmaking.** Done for 50 v 50 and boss raids (unranked): PLAY fills a lobby for 60 s on the queue screen,
   then bots take the empty seats (a raid starts with whoever's there). The home screen shows who's online, matches
   running and the queue (the front door, Oct 6). Next: bots matched to the players' ratings, a ranked queue by
   rating, the live count on the landing page, watching a match from outside, and a live 50 v 50 in place of the demo
   video once there are enough games. Private lobbies with a code stay as they are.
4. **Ranked.** A rating per mode, moved by finishing position (beating everyone you outplace, like a big multiplayer
   Elo) and shown as tiers. Rated matches have mostly real players. Seasons with a soft reset, later. Unranked quick
   play stays for practice.
5. **50 v 50 endings.** Done: pre-game votes (format, speed) by pawn push; team final, boss battle, duel. Next: a third
   vote (Eric has an idea to come back to), more boss personalities, an "engine helper" the crowd recruits in the boss
   battle (an assist, not a player that wins it for you: e.g. it can be called on once or twice for a hint), and playtesting the team-final cut pace and boss
   strength with real players (see reports/boss-calibration.md).
6. **Fair play.** Built (Oct 8, the `fairplay` delegate; DECISIONS.md, "Fair play"): reports (per match, three
   different players' cheating reports in a week put someone in review), signals from each match's judged picks
   measured against the crowd in the same position, a deep re-check of flagged players' moves on the engine server,
   reviews (results held) and automatic bans only on overwhelming evidence (the false-ban rate measured in
   `reports/fairplay.md`), appeals for a person, ban emails, the review page (`/admin/fairplay`) and an API for an
   automated reviewer (`docs/fairplay-reviewer.md`). Next: refit the evidence model from real cleared players; block
   disposable email domains and add Cloudflare Turnstile (free) on email sign-in against scripted sign-ups.
7. **Coins, icons and emotes.** Coins for doing well (placement, surviving cuts, a good move streak, daily first match),
   spent on cosmetic things only: profile icons, emotes to send during a match, board and piece themes, name colours.
   Nothing that changes play: no power-ups, no hints, no extra time. Earned only, not bought, unless Eric decides
   otherwise later.

8. **Showing off your look** (Eric, Oct 6; ideas, not started). The game board stays standard chess pieces. Your crate
   look appears around it, in places where people notice:
   - **Your pick wears your look.** In Crowd, when your pick is a pawn move, its ghost on the board is your dressed
     pawn (skin, hat, beard, weapon). In the reveal, the top pickers' ghosts show theirs.
   - **The waiting room fills with pawns.** Instead of only a number counting up, your dressed pawn stands in the
     middle and others drop in around it as they join (the cut screen's 10 × 10 grid, filling up). Bots fill the
     last seats in plain pawns when the 60 s runs out.
   - **The podium.** The results screen puts the top three's dressed pawns on a podium, the winner's biggest.
   - **Tap a name** (leaderboard, cut screen, podium) for a card: their pawn, each item's tier, colour and purity.
   - **A small head** (pawn plus hat) beside each name on the leaderboard.
   - **The moment's star.** The brilliant-move badge, the queen-kill banner and the boss raid's victory shot feature
     the player's dressed pawn.
   - **A share card.** A results image with your pawn, place and best move, to post.
   - **Rare drops,** later: "X opened a Shiny Pearl Crown" in the waiting room. Social, but only once crates matter
     more, and with care if crates ever involve money.
   - Who builds it: the `item-builder` delegate (it owns `Avatar`), briefed screen by screen. The waiting room and
     the podium first.

## Queued next (Oct 9, 2026)

A small polish batch, to start once Hollow's rules are merged: one helper, one PR.

1. **God King's wings off:** remove the small upward wings in every pose, both colours, and the portraits and
   cut-ins; keep the cape.
2. **God King no longer takes your king's place:** when he plays a move for you or strikes the boss, he stays where he
   stands, commands his sword, and the bolt hits the piece or the boss's king. The in-between animation goes, so these
   moves are quicker; the old code stays behind a setting. His Last Stand still appears on the board.
3. **Queen-capture sound:** one try at a short, dignified woman's cry or gasp (never anything that could read as
   sexual); keep it only if it's clearly better.
4. **G-REX's Roman candle whistles:** higher and shriller, like real whistling fireworks: a sliding, almost screeching
   whistle with a little rasp.
5. **Hollow's lights:** a long strand held in the middle, hanging in two loops, about 5 bulbs a side, as in Eric's
   reference; the countdown and Lights out work on it a section at a time.
6. **The God King talks less:**
   - one opening line from a much bigger pool;
   - "brilliant" and other move remarks only now and then;
   - critical moments always spoken;
   - everyday chatter at least halved, by settings. Report lines per match before and after.
7. **A note for later:** every boss gets random quips and short exchanges with the God King. The design is to be
   worked out with Eric.

## Later: Eric's ideas (Oct 9, 2026; not started, not queued)

Eric: "too big a change for now". Recorded so they aren't lost; nothing gets built until he says so.

- **A plain boss mode.** Bare-bones chess against Stockfish at a choice of difficulty levels: no God King, no powers,
  no power-ups. Eric thinks many players will want exactly this.
- **How a 50 v 50 plays out, as a pre-game vote** (another vote round, like format and speed), so players choose each
  game and the data later shows what people prefer:
  - **Elimination** (today's style): players are cut as the match goes on and leave; the hardcore option, and they
    can queue straight into another match.
  - **Play to the end:** nobody is cut. Players who would have been cut are marked out on the scoreboard (struck
    through, say) but keep playing and scoring to the end; the result is a ranking by score.
  - **A third option for a clean three:** perhaps a hybrid (one cut of about 25% of the lobby, then everyone plays
    through). Not settled.
  - Eric doesn't want "Classic" as the name necessarily.
  - To think through:
    - tiebreakers and the endgame in play-to-the-end;
    - players far down the scoreboard who may quit mid-match (what happens to their seat and score, and whether
      bots step in);
    - how it fits the team final, boss battle and duel endings;
    - whether ranked uses only one style.

## Needs Eric

- **privacy@hunchess.com:** forward it to yourself with Cloudflare Email Routing (free), or name another address.
- **Workers Paid ($5 a month):** only when real traffic outgrows the free limits.
- **Privacy policy and terms:** drafted at /privacy and /terms; Eric to read them over.
- **Real-phone testing** of matchmaking with friends.
- **Art:** simple icons and emotes can be drawn in code; polished custom art would mean an artist or a paid pack.
