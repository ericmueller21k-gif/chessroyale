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
   spent on cosmetic things only: profile icons, emotes to send during a match, board and piece themes, name colors.
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
   - **Tap a name** (leaderboard, cut screen, podium) for a card: their pawn, each item's tier, color and purity.
   - **A small head** (pawn plus hat) beside each name on the leaderboard.
   - **The moment's star.** The brilliant-move badge, the queen-kill banner and the boss raid's victory shot feature
     the player's dressed pawn.
   - **A share card.** A results image with your pawn, place and best move, to post.
   - **Rare drops,** later: "X opened a Shiny Pearl Crown" in the waiting room. Social, but only once crates matter
     more, and with care if crates ever involve money.
   - Who builds it: the `item-builder` delegate (it owns `Avatar`), briefed screen by screen. The waiting room and
     the podium first.

9. **Squads** (Eric's design, Oct 10, 2026; [docs/areas/squads.md](docs/areas/squads.md)). A new full mode in the
   Classic slot of the mode menu (Crowd · Squads · Boss raid): 8 squads of 4 play team chess in a bracket, with no
   engine in the game. Round 1 Relay (4 boards, one player a move, rotating), round 2 Pairs (2 boards, two pick and
   a coin chooses), the final Pick and Block (one board, pickers and blockers), Armageddon after a tie.
   - Phase 1, the rules and a bot simulation: **done** (`packages/chess/src/squads/`, `reports/squads-sim.md`).
     Then clocks in place of the pace and the move cap, now one team clock per squad for the whole tournament (Eric,
     Oct 10): **done**. A lobby takes about 31 minutes (median).
   - Phase 2, the server: the squads lobby, parties (invite link or code), matchmaking, bots, the bracket,
     spectating, the test controls ("Next round", start at round 2 or the final), placement rewards: **done**
     (protocol v1 in `packages/chess/src/squads/protocol.ts`; no menu entry yet).
   - Phase 3, the screens: the menu slot, votes, tiny boards and scouting, the pair and pick-and-block panels, the
     final's staging.
   - Phase 4: e2e and polish, then playtests with real players (the sim's open questions: real think times and
     misses, and how often a final is lost on time).

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

Added Oct 12, 2026 (with Squads' modes; notes only, nothing built):

- **A waiting-room board for Squads.** Squads that finish early stand their profile pawns on a board; drag your pawn
  onto a shop piece to open Mercenary's shop. Later it becomes a hangout: an idle world to wait in and chat.
- **Eliminations in Squads,** with a penalty for the squad, so that losing a weak player never helps the team.
- **Points turning into power-ups in other modes** (as Mercenary's coins buy items).
- **Squads' third mode** (the Mode vote's "Coming soon"): Hand & Brain, Bughouse or Fog of War. Eric hasn't picked.
- **Multi-language support** (Eric, Oct 12: "we need multi language support one day"). The plan:
  - one strings layer: a `t()` helper and one file per language;
  - a one-time pass that moves every piece of text into it: the screens, the bosses' and the God King's lines, the
    FAQ, the items, the banners;
  - languages chosen by where chess is big (Spanish, Portuguese, Russian, Hindi, German, French, say);
  - fallback fonts where the pixel title font lacks a script (Cyrillic, Devanagari, CJK);
  - a layout pass for right-to-left languages.

Added Oct 13, 2026 (with Wrangler; notes only, nothing built):

- **Multi-boss** (Eric, Oct 13): a 50 v 50's boss ending against three random bosses at once (it needs rules for how
  three bosses share one side: whose move it is, whose powers fire when, one rage meter or three), and/or a **Boss
  Rush** raid mode: boss after boss, all or nothing. The director suggests Boss Rush first.
- **Engine-shaped ultimates for every boss** (Eric, Oct 13): like Wrangler's showdown, each ultimate searches its
  possible outcomes with the engine and aims for a target swing (about +0.5 to +1.5 pawns for the boss), with fallbacks
  so it never fizzles. Revisit Ginger's blizzard, Hollow's Lights out, Jefferson's Roman candle and the others
  (docs/areas/bosses.md, "An engine-shaped power").

Added Oct 14, 2026 (Eric; notes only, nothing built, more context to come):

- **Bobby Fischer, the hidden boss: Squads' third mode** (it takes the Mode vote's "Coming soon" slot, so the
  Hand & Brain / Bughouse / Fog of War note above is superseded unless Eric says otherwise).
  - **How it plays:** after the Squads tournament, the winning squad faces him: he plays all four at once (a simul),
    split across 4 boards. Desktop shows all 4; phones use today's layout (your board big, the other 3 up top,
    tappable).
  - **The games:** all 4 are Fischer Random (Chess960) and ultra-fast bullet. No power-ups, no blocks, no items.
  - **His ultimate:** after a few moves at normal pace he laughs (a little unhinged), then the pace speeds up sharply:
    only a few seconds a move, no bonus time.
  - **His voice:** lines true to his chess persona: anti-theory, anti-engine, "real chess", and when the four team up
    on him, how the Russians teamed up and conspired against him. Eric will supply specifics.
  - **Difficulty:** fairly easy but still a challenge (to tune later).
  - **Beating him:** a "super saiyan" transformation with special animations (details later).
  - **Before building (director's flags):** he's a real person, so check the rights to use his name, likeness and
    quotes in a commercial game (his estate; post-mortem publicity rights vary by country and state), or make him an
    original character clearly inspired by him. Either way, keep his lines to his chess views and never touch his
    hateful public statements from later life.

## Needs Eric

- **Maia-3 bosses, before players meet them (pre-launch):** your OK to publish the Maia box's source
  (`packages/maia-worker/`, AGPL-3.0): a public repository or a download on the site, so the credits line can link it
  instead of "available on request"; then `BOSS_BRAIN.forPlayers` on (one value). Every boss is on Maia for admins
  already, calibrated against bot crowds (DECISIONS.md, "Every boss on Maia"; `reports/maia-calibration.md`). Also
  your real-phone check (`TESTING.md`, "Maia").
- **privacy@hunchess.com:** forward it to yourself with Cloudflare Email Routing (free), or name another address.
- **Workers Paid ($5 a month):** only when real traffic outgrows the free limits.
- **Privacy policy and terms:** drafted at /privacy and /terms; Eric to read them over.
- **Real-phone testing** of matchmaking with friends.
- **Art:** simple icons and emotes can be drawn in code; polished custom art would mean an artist or a paid pack.
