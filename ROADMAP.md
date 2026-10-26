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
   - **Open question for players (Eric, Oct 14): limit viewing a teammate's board while they're still to move?** Once
     you've moved you can watch any board full size, and "Jump to my next board" takes you to the one you play next,
     where a teammate may still be thinking: squads can talk it over (on Discord, say) and help. Eric: helping is fine
     for now, "it is squads after all", so viewing stays free; players may weigh in, and it could be restricted later.

## Launch readiness (the director's plan, Oct 15, 2026)

At launch, AI sessions run the game day to day; Eric relays player reports and approves money, account and legal
decisions. In this order:

1. **Error capture and the feedback sheet.** Done (the ops lane): every device reports its errors, the server its own
   (the Worker, the cron, every Durable Object's entry points); players report a bug (with diagnostics and a short id to
   share), send feedback or suggest an idea; `/admin/ops` lists the top errors and the reports by kind. Bounded D1 writes, kept 30 days, no IP addresses or emails
   (docs/areas/ops.md, "Errors and player reports").
2. **A health report and `npm run ops:report`.** Done (the ops lane): an admin-only health view (`/admin/ops`, and
   `/api/admin/health` for scripts through Cloudflare Access: the deployed version, live players and lobbies with
   Squads, errors this hour and today, reports, the engine server's and fair play's budgets, a D1 check, Durable
   Object errors) and a script that prints a short summary from hunchess.com, "Needs attention" first
   (docs/areas/ops.md, "Health").
3. **Alerts:** a cron self-check that emails Eric on spikes (errors, failures, budgets), reusing fair play's mailer
   (`fairplay-mail.ts`), plus a daily scheduled AI triage session that reads the report and the new player reports.
4. **Kill switches and rollback:** per mode, per boss and for the shop, plus a maintenance banner, through Worker
   runtime variables (no deploy needed), and a tested one-command rollback to the previous deploy.
5. **`RUNBOOK.md` for AI sessions:** what to check each day, what each alert means, the switches and the rollback, and
   what to bring to Eric.
6. **A D1 restore drill on staging** (Time Travel), and gradual or canary deploys.
7. **The known blockers:**
   - gate the test switches: done (Oct 15, #224; item (d) under the Hidden Boss's notes above);
   - the engine container's Stockfish 17.1 against the browsers' 19;
   - chat moderation (report and mute);
   - the privacy policy and terms (Eric's sign-off);
   - loot-box rules before any real-money crates.

**Only Eric can do:**

- Cloudflare billing and usage alerts (Billing → budget alerts; the suggested $20/month, and D1 and Workers Logs
  usage notifications).
- A read-only monitoring token for the AI sessions (Cloudflare API: Account Analytics and Workers Observability read).
- At launch, when Access comes off the rest of the site: keep an Access application on the health path
  (`hunchess.com/api/admin/health`) with the service-token policy, and give its AUD tag to a session for
  `ACCESS_AUD` in `wrangler.jsonc` (today's is the whole site's application). Without it, `npm run ops:report` is
  refused, and only admins signed in can read the view. Optional, any time: pin the view to the one service token by
  adding the Worker secret `OPS_ACCESS_CLIENT_ID` (its client ID) in Cloudflare (Workers, chessroyale, Settings,
  Variables and Secrets); unset, any service token the application admits may read it.
- Any paid service (an uptime monitor, an error service, a paging service), if we ever want one: asked first with a
  monthly price.
- Legal sign-off: the privacy policy and terms, and the rules for crates before any real money.

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

- **The hidden boss, inspired by Bobby Fischer** (Eric, Oct 14; working name only: he'll have a different name).
  - **Where he lives (open):** maybe Squads' third mode (the Mode vote's "Coming soon"), or a bonus that sometimes
    fires after a Squads tournament. Eric hasn't decided.
  - **How it plays:** the winning squad faces him: he plays all four at once (a simul), split across 4 boards. Desktop
    shows all 4; phones use today's layout (your board big, the other 3 up top, tappable).
  - **Phase 2 is Fischer Random:** the final showdown's second phase is played in Fischer Random (Chess960),
    ultra-fast bullet. No power-ups, no blocks, no items. (The Squads games themselves stay normal chess; Fischer
    Random as a Squads vote option is a separate idea for later.)
  - **His ultimate:** after a few moves at normal pace he laughs (a little unhinged), then the pace speeds up sharply:
    only a few seconds a move, no bonus time.
  - **His voice:** lines true to the chess persona: anti-theory, anti-engine, "real chess", and when the four team up on
    him, how the Russians teamed up and conspired against him. Eric will supply specifics.
  - **Difficulty (Eric, Oct 14; replaces "fairly easy"):** an elite challenge. His strength doesn't follow the
    squad's ratings: it's fixed. In phase 2 it's very strong, **about 2750 to start** (Eric, Oct 14: at that very fast
    pace 2750 "may be sufficient"; the earlier figure was 3000), so it takes four elite players
    (possibly GM level) to beat him. The goal is a fight people talk about and gather their strongest friends for.
    **All four players must beat him** to complete it.
    - **Phase 1 is Maia at its strongest (Eric, Oct 14):** "so it feels like an aggressive human playing, which is
      how [he] would play". The normal-chess board is played by Maia-3 at its top rating (2500 in our setup,
      `maiaRatingFor`), raw (no guard, no Stockfish share), so his moves are a strong human's. Maia has no style
      dial: it plays like people at that rating, so his aggressive flavor comes from his lines, art and ultimate.
    - **Phase 2's brain is Stockfish:** Maia can't play it. It never saw Fischer Random in training, and it tops out far
      below 3000 anyway (it's held at 2500, and Stockfish takes over from 2800 even in normal chess). Stockfish plays
      Fischer Random natively and reaches 3000 (its strength limiter goes up to 3190, already used by raid tier 10).
      It's a fitting irony: in Fischer Random Stockfish has no opening book either and calculates from move 1.
    - **"2750" is on Stockfish's own scale** (engine-calibrated), not a human FIDE rating, and the ultra-fast clock
      hurts people far more than an engine. So the number is a starting point to tune once real players try him
      (`RECLUSE_PHASE2.elo`), not a promise.
    - **The math of "all four must win":** if each player beats him with chance p, the squad wins with p⁴: 70% each
      → 24%; 50% → 6% (1 in 16); 30% → under 1%; 20% → 1 in 625. The dials are his strength, the players' clock,
      and whether a draw counts (today's default: no, a draw isn't a win).
    - **Tuning plan:** a single setting for his strength. First, engine-against-engine tests in Fischer Random at
      the real clock (engine "players" at about 2500–2700 against him at 2750 / 3000 / 3190) for a starting point.
      They can't capture human time trouble, so real tuning comes from strong players trying him after launch.
    - **Decided (built Oct 14):** once one board is lost, the others play on, but the win needs all four.
  - **Fischer Random takes real rules work:** our rules library (chess.js 1.4) has no Fischer Random castling, so
    the rules code and the board need it (full test lane). A simpler fallback is random back ranks with castling
    turned off, but that isn't true Fischer Random. Decide at build time.
  - **Cheating (to handle later; Eric, Oct 14):** a full-strength engine beats a 2750-limited one almost every
    time, so engine help is the main risk. The fast clock slows anyone copying moves from a second device, but it
    doesn't stop automated help. Notes:
    - **The server plays him.** Online, today's bosses are computed on the host player's device; for this fight his
      moves must come from our engine server, never a player's device, or a host could weaken him. Engine server
      cost: about 200 searches a fight (one board, then four) against today's 3,000-a-day budget; rare, since it
      takes the 1,000-coin book and a tournament win.
    - **Hold the reward for review.** A win goes to fair-play review (the deep re-check on the engine server) before
      the crates are granted, and a person decides. Elite players naturally play accurately, so no automatic bans
      from this fight.
    - **Signals:** how often each player's moves match the engine's top choice (Fischer Random has no opening
      theory, so engine-perfect play from move 1 stands out), move-time patterns, and the look-away count.
    - **Public replays** of every win (a hall of fame), so the community can see the games.
    - **Signed-in accounts with match history** only.
    - **Does a server-side brain help catch cheaters? (Eric's question, Oct 14)** Not by itself. It stops tampering
      with the boss (a host can't weaken him), but it can't see a player using an engine on another device. Catching
      that is fair play's job, which already exists game-wide (`docs/areas/fairplay.md`: the server's judged signals,
      the suspicion score, the deep re-check before any ban, the review page). For this fight: feed its four boards
      into fair play like other online matches, hold the reward until the deep re-check and a person clear it, and
      add the fight's own signals above. No separate anti-cheat system just for this mode.
    - **Cost (Eric asked, for about 200 phase 2 fights a day, likely an overestimate):** about 160–200 engine
      searches a fight (four boards, short searches at bullet pace), so roughly 30,000–40,000 a day. At the engine
      server's measured rates (`docs/history/engine.md`: about $25 a month per 3,000 searches a day for deep
      re-checks; bullet-pace boss moves are much shorter searches, and the instance's memory while awake dominates),
      the director's estimate is about $40–100 a month at that volume, a few dollars a month at realistic volumes.
      To verify against Cloudflare's prices when it's built; it needs its own daily cap like `ENGINE_DAILY_SEARCHES`.
  - **Beating him:** a "super saiyan" transformation with special animations (details later). Every player on the
    winning squad gets a special **Fischer Random crate** with a tiny chance at an item that doesn't exist yet. One
    victory reward per account, ever.
  - **How you reach him (Eric, Oct 14):**
    - **For real:** a **fifth Mercenary item**, an ominous **red book**, for **1,000 coins**. Its description is
      along the lines of "A strange red book. It looks powerful..."
    - The squad must **buy it AND win the Squads tournament** to trigger the hidden boss.
    - **Price:** 1,000 is more than one round earns (about 600–700), so a squad has to save across rounds.
    - **The book's symbol:** Eric wants a Russian symbol on it. The director suggests a red star or a Cyrillic
      letter rather than the hammer and sickle, which is banned in some countries (e.g. Lithuania, Latvia, Ukraine).
      Eric's call.
    - **For testing until then:** he's reachable from the boss menu, playing with bots.
    - **Rewards vs. just playing him (Eric, Oct 14; ideas only, undecided, nothing to build yet):** Eric doesn't
      want an awesome boss that most people never get to play, but playing him mustn't take away from the quest.
      - **Rewards only the real way:** a trophy, the Fischer Random crate and any other reward come only from
        beating him through Squads (the red book plus a tournament win).
      - **Ways to play him for fun, no rewards** (any or none; Eric isn't sure yet):
        - Buying the red book once unlocks him in solo Boss alone (with bots, who will lose; that's fine).
        - Friends: a group of four (a party, or queued together) can choose him if all four have him unlocked (or
          a book). Needs a four-player Boss mode, which doesn't exist yet.
        - **The Crowd (50v50) mode** (Eric: "probably a decent compromise"): when it's down to the last four
          players, an extra vote: fight him, or the usual ending. **Decided and built Oct 14** (below, "Internal
          notes"): the vote's boss final is always him, the top 4 against him.
      - Why it matters: if the player base stays small, Squads wins may be rare, and a few players should still
        get a chance at him.
      - Director's notes: the solo unlock is the cheapest. The Crowd vote and the friends' mode both need the
        four-player online fight (his server-side brain, the four boards online) that the Squads path needs anyway.
        Keeping rewards to the Squads path keeps fair-play review to one place.
  - **Phase 1 to phase 2 (Eric, Oct 14):**
    - **Phase 1** is one board against him. Beat him there and **he collapses**: he drops to his knees, slumps and
      mumbles nonsense to himself (lines from Eric later).
    - **The red book takes over:** it flies off and **slams onto the center of the board** (dust, a shockwave).
      Then **the board divides into four**. The director suggests reusing Sawyer's board-saw split: crack lines along
      the middle, then the quarters slide apart and grow into full boards (desktop: all 4; phone: yours big, 3 up top).
    - **He revives:** one sprite only, even with 4 boards. In the revived state his hair is **always flowing**, and
      he isn't evil, but he looks scarier.
    - **The book flips its pages again** and all four boards shuffle into random openings (Fischer Random setups):
      the pieces fly to their new squares as the pages turn. Phase 2 then plays as above.
    - **Each board its own setup (Eric, Oct 14):** four different Fischer Random start positions, no two the same:
      "Every player gets a different one that avoids everybody just discussing the same move in like a Discord."
    - **Decided (Eric, Oct 14: "your pick is fine, we want easier code and less lag over all else, fewer bug
      risks"):** the split reuses Sawyer's board saw (crack lines, then the quarters slide apart). The book's symbol
      is the gold Cyrillic **"ШАХМАТЫ"** ("chess" in Russian) on the shop item's larger icon, and its first
      letter **"Ш"** as a gold monogram on the book in the sprites: clearly Russian, about chess, and not political.
    - **Effort, easiest to hardest:**
      - a slam, a flash, then a cross-fade into four boards;
      - crack lines, then the quarters sliding apart (the pick, reusing the saw);
      - a true tear or 3D split (not worth it).
  - **The God King against him (Eric, Oct 14):** the God King's help **doesn't work** against him (his strike, Last
    Stand and any other help), and when the crowd tries to use it, **he mocks it** as "theory" and "engine" crutches
    (lines from Eric later). The God King gets **unique lines** for this fight, e.g. "I sense a tremendous power
    within this foe."
  - **His real red book:** in 1972 he prepared from what he called "the red book" of his rival's games (a red cloth
    hardcover). In the game it's an unlabeled red book that he holds at his side, consults at logical moments, and
    opens like a spell book for his ultimate.
  - **His art (approved, Eric, Oct 14: "it looks PERFECT"):** tall and lanky, standing, white shirt, patterned blue
    tie, the red book with its gold "Ш" at his side; the face from Eric's photo reference. Drawn and in the code
    (`characters/recluse.ts`, `effects/recluse.ts`) but not registered, so nothing in the game shows him yet.
    - **Sets:** phase 1 (idle, consult, stare, laugh, slam, the spellbook ultimate), the collapse and revive, phase 2
      with the hair always flowing, and the book as its own effect sprite (fly, slam, page flip, close).
    - **Sizes:** 129 px tall on a computer (64×146 frame); on a phone, a head-and-shoulders crop for the boss bar.
    - **When he's built:** his kit needs two drawings (the crop for the phone bar, the full figure for the computer);
      a kit holds one today. Phase 1's idle holds the book at his side and phase 2's in front, so the revive must
      play between them.
  - **Director's flags:** use a different name (agreed). A recognizable likeness carries the same rights question as
    the name, so check before launch (his estate; post-mortem publicity rights vary). **Real quotes (Eric, Oct 14):**
    used verbatim, never altered ("keeping them intact is a must"); Eric checked the law. Only verified ones, with their
    source recorded (DECISIONS.md, "The Hidden Boss, phase 1"); his hateful and political statements stay excluded.
  - **Phase 1 is built (Oct 14), for admins only, in Boss alone** (DECISIONS.md, "The Hidden Boss, phase 1"): pick
    "Hidden Boss" from the boss menu (admins see him after the rest). Maia-3 at its top rating, raw, at a fixed
    strength; the God King's help blocked and mocked (a try spends its charge); no strikes on the crowd; his ultimate at
    turn 7, the bullet clock for the rest of the battle (1:00 with no added time for 3 moves, then he adds 2 s a move;
    out of time loses; Eric, Oct 14: was 3:00, then 1+0); beaten, he collapses and mumbles, then phase 2. Placeholder
    lines (and five verified quotes) in one table, `characters/recluse-lines.ts`, for Eric's own.
  - **Phase 2 is built (Oct 14), for admins only, in Boss alone** (DECISIONS.md, "The Hidden Boss, phase 2"): beaten
    in phase 1, he collapses and mumbles, then the phase change (about 15 s, reworked Oct 14: he absorbs the God King,
    who stood over him, draining his golden power into a raised hand, and becomes half engine (one eye cold blue,
    circuit lines: an overlay, all of phase 2; the God King is gone from then on); up in a rage, he leaps onto the board,
    throws the book down and chants over its light; Sawyer's crack lines with blue arcs striking them, the quarters
    growing into four boards; the book back in his hands, the Chess960 shuffle, his leap back), then four boards
    at once, each its own Chess960 start: you on one, bots on three. Stockfish only, at 2750, at most 0.9 s a move;
    2:00 a board, no added time, out of time loses that board; a lost board's neighbors play on; all four must be
    won ("Victory!"), else a defeat that says how many of four were won. **His phase 2 ultimate** (Eric, Oct 14):
    each move longer than 5 s (anyone's, any board) draws a line about playing faster and marks a red X beside every
    board; on the team's 10th slow move, "That's enough!" and from then on 5 s a move on every board, no bank, a random legal move played for whoever runs
    out (never a loss on time). Test switches: the admins' "Trigger ultimate (testing)", `?win=1` (a mate in one in
    both phases, the bots take theirs), `?phase=2` (straight to the phase change).
    - **Left for later:** his real name and lines (phase 2's are placeholders too); how players reach him (the red
      book Mercenary item and the Squads win); his "super saiyan" transformation (a placeholder today: the spellbook's
      glow); the special crate and its reward; a server-side brain (the engine server's move endpoint) and fair-play
      review for real fights; phase 2 online and Squads play (phase 1 is online since Oct 14: the Crowd's boss final);
      the engine-against-engine sim in Chess960 at the real clock (next step, for 2750 and the 2:00 bank); sim-tuning
      phase 1's numbers (turn 7, 60 s, 3 moves at 1+0, then +2 s).
    - **Internal notes (Eric, Oct 14: "just add it to the internal side"; don't ask him again):**
      - **(a) The reward still to build:** beating him (the real way, the Squads path) gives a **one-time award per
        account, recorded on the account** (so it's never given twice), and the end screen tells the player to **check
        their inventory for a special item**. The item itself comes later (the Fischer Random crate above). Nothing of it
        is built: today no path gives a reward for beating him, the Crowd's included.
      - **(b) The Crowd's boss final is now always him (built Oct 14; DECISIONS.md, "The Crowd's boss final: always the
        Hidden Boss, the top 4"):** the vote's option says his name (from the roster), the top 4 face him, solo and
        online, no reward. Online it's his phase 1 only: his brain on the host's device, a phase 1 win is the crowd's
        victory. Solo (you and bots), his phase 2 follows with the other finalists. **Still to come: phase 2 online**
        (four boards online, his Stockfish on our engine server, its fair-play hooks: a separate, bigger build).
      - **(c) His name will change** (Eric: something like "a powerful foe"; "Hidden Boss" doesn't do him justice).
        Not decided. It's one string, his `name` in `BOSS_ROSTER` (`packages/core/src/boss.ts`): the vote's card, the
        FAQ and every screen take it from there.
      - **(d) The test switches: gated (built Oct 15; DECISIONS.md, "The test switches: admins and test servers
        only").** The lobby-create playtest overrides (`?weakbots`, `?format`, `?rounds`, `?clock`, `?bossMoves`,
        `?keep`, …), a queue's `?pool=`, a crate's forced roll and the app's address switches (`?win`, `?phase`,
        `?mate`, `?debug`, …) work only for admins or where `TEST_SWITCHES` is on (local, e2e, staging); for anyone
        else they're ignored, so no easy wins (docs/areas/ops.md, "Test switches").

Added Oct 14, 2026 (Eric; notes only, nothing built):

- **Friends and invites** (Eric, Oct 14: "we're gonna need like a, something where you can tap on somebody and just
  add them as a friend"). **Built Oct 15** (docs/decisions/2026-10-15-friends-and-invites.md): requests accepted or declined, block,
  invites to your lobby or party for anyone your setting allows, "Show when I'm online"; the open questions below are
  answered there.
  - **Add a friend:** tap a player, then "Add friend". No chat with friends ("in today's day and age, it's not
    necessary").
  - **Friends online:** your friends who are online, in their own list above the players online.
  - **Tap any name, friend or not:** two options, **invite to your game** or **view their profile** (the player
    profile screen exists: `screens/PlayerProfile.tsx`, with "Online now"). Invites aren't only for friends, which
    keeps it to one piece of code.
  - **Too many invites:** a profile setting turns off invites from people who aren't your friends ("public
    invites").
  - **Open, for build time:** where the lists live in the app (Eric expects a layout rework: "we're gonna need to move
    things around"), whether a friend request must be accepted or "Add friend" is one-sided like a follow, and what
    an invite does when the other player is already in a match. It's stored data and a client-server change, so it
    takes the full test lane.

## Needs Eric

- **Maia-3 bosses for players:** done Oct 14. The site serves the Maia box's complete source
  (`/engine/maia/maia-box-source.tar.gz`) and Stockfish's (`/engine/stockfish-source.tar.gz`), and `BOSS_BRAIN.forPlayers`
  is on (Eric: "flip it"), so every player's bosses play with Maia as admins' did. What remains is yours: the
  real-phone check (`TESTING.md`, "Maia").
- **support@hunchess.com** (one address for everything, Oct 17): forward it to yourself with Cloudflare Email Routing (free), and turn on its catch-all so replies to login@ and fairplay@ reach you too.
- **Workers Paid ($5 a month):** only when real traffic outgrows the free limits.
- **Privacy policy, terms and copyright page:** drafts at /privacy, /terms and /copyright, written from the code (Oct
  15). Each lists the decisions that are yours or a lawyer's: who runs HunChess (a person or company, a postal
  address), the contact address, the minimum age outside the US (13 is decided and built: Eric, Oct 16), governing
  law, a DMCA agent ($6 at the US Copyright Office), real-money purchases, the EU/UK points, and how long fair-play
  records are kept.
- **Real-phone testing** of matchmaking with friends.
- **Art:** simple icons and emotes can be drawn in code; polished custom art would mean an artist or a paid pack.
- **At launch (Eric, Oct 13-14):**
  - Flip the repository to private. Before that: trim CI, and set an Actions budget (the free private plan gives
    2,000 minutes a month; CI uses about 100-120 a day). The Maia and Stockfish source must be served from the site.
  - Test lanes: every logic change goes back to the full lane per PR (CLAUDE.md, "Test lanes": the targeted lane
    and batch full runs are pre-launch only).

## Boss raid: the town square (Eric, Oct 25, 2026; being built in slices)

Slice 1 (the world, five homes, bots) is at `/town`, a hidden page. Eric's way of building it (Oct 26): one slice at a time on
the hidden page, Eric tests each one and sends back small changes ("the winning play for us here… is that it feels fun and
good to run around in this kind of world"), then the next slice. The numbers that shape the feel are in
`packages/app/src/town/feel.ts`.

**The name** (Eric, Oct 26): Boss raid will become **Boss Arena**, the mode and its world ("that more implies… an arena or…
a world"). The building in the middle, called the Boss Arena below until now, is **the Coliseum**. The game keeps saying
"Boss raid" until Eric says to switch.

Eric's direction, from a day of mockups: Boss raid becomes a **town square**, a small round world where players hang out,
walk around, and meet the bosses at their homes. The prototype he tested on his phone ("feels great") is
`docs/mockups/town-square/prototype.html` (open it in a browser; its README has the camera numbers). His reference pictures
are `docs/mockups/boss-raid-lobby/chatgpt-town-square.webp` (the view he wants: "this view of it, this is perfect", except
the building art and the names, which are wrong) and `chatgpt-town-square-overview.webp`. The earlier tries
(`gemini-lobby.png`, `eric-paint-crowd.png`) are kept for the record.

**The world**
- A chessboard world seen from a **low camera looking out to a curved horizon**, with sky and clouds behind it. The clouds
  shift a little as you walk sideways. The far edge **dissolves into haze**, and things come into focus as you walk toward
  them. A house, boss or pawn near the edge is never cut off by it (Eric, from his phone test): it shows whole, faded into
  the haze, and the haze is drawn behind it. The world **loops**: walk one way long enough and you're back where you
  started.
- **Every boss has a home** in its own corner of the world (13 now, plus a locked plot for the Hidden Boss). The bosses roam
  near home and sometimes say a line, in a new bubble style made for the square.
- Small pawns, big bosses. You are your own small dressed pawn in the middle of the view; no big picture of you in a corner
  (Eric, Oct 25: "it's fine if he's just the center on the map").
- **A shop** stands in the square. Which shop it is (Shop & crates, or a raid shop) is still open.
- **Every boss's home is also its shop** (Eric, Oct 26): special equippables, animations and the like, sold by that boss.
  For now, tapping a home shows "Shop" greyed with "Coming soon".

**Moving and tapping**
- **Tap a square to walk there:** a quick hobble, about 90 ms a square, the camera following. Drag to look around; "Back to
  me" returns. A **zoom toggle** (Eric: "love the zoom in and out") shows more of the world; the square opens zoomed out
  (Eric, Oct 26).
- **The press** (Eric, Oct 26): a finger down on a square presses it in and lights a bold glowing border on it; lifting the
  finger releases it with a pulse and you set off ("pressing down feels like pressing down, lifting up releases"). No sound
  and no vibration for moving ("other games have no sound when moving around").
- **Your trail:** as you run you leave a few small white droplets behind that fade out, seen only by you.
- **One pawn per square, like chess:** nobody stops on a taken square; you may pass through people on the way. Walking up
  to a person or a boss puts you on a free square beside them, so a crowd forms a ring around them, as in an MMO.
- Small chips at the edge of the view point to bosses off screen; a tap glides the camera there.
- **Tap a boss: "Challenge alone."** Solo stays on the boss select screen, apart from the town square (Eric, Oct 26), so it
  first asks "Leave the town square?" and then takes you out of the square to Boss alone, that boss picked. (This replaces
  the Oct 25 idea of fighting in the square under a "[name] is battling [boss]" label.)
- **Tap a player: "Invite to party"**, and "Trade", shown greyed with "Coming soon" until trading exists.

**Screens**
- **Phone:** the world takes most of the screen, with a slim bar at the top (back) and a strip at the bottom whose content is
  still to design. **Computer:** the world in the middle, the menus around it. Eric is drawing what sits around the world on
  both.
- **The world never assumes a screen size:** it fills whatever box it's given and works its camera out from that box, so the
  panels around it can change without touching the world.
- **Don't build the bottom panel yet** (party, options, Invite, Join, READY): Eric is still deciding how it looks.
- **Loading:** no loading screen. The sky, ground and your pawn show at once; bosses and houses arrive nearest first, out of
  the haze. A thin bar appears only if the square isn't ready after about half a second.
- **"Simple map" in Settings:** the same world drawn flat and top-down (squares, labeled homes, players as named dots, the same
  taps and cards), for slow phones. The game may suggest it when the frame rate drops.

**The raid with people**
- Being in the square doesn't queue you. A raid with people faces **3 bosses picked at random**, each harder than the last
  (maybe 4 later); beat one to face the next. The first should feel winnable. ("The gauntlet" was a working name only; the
  mode has no special name.)
- **The Coliseum** (Eric, Oct 25; named Oct 26): a building in the middle of the town square, where raids with people
  start. Walk up to it (within a square) or tap it to open its menu. What the menu holds is still to brainstorm; Eric
  thinks of something like the God King's strike menu.
- **Idea: gather your three bosses** (Eric, Oct 26; not in the menus yet). Each boss gets "Challenge at the Coliseum".
  Tapping it, the boss names a partner it won't come without (Boingo: "I'm not bouncing anywhere without Babur"); you go
  and ask that boss, who asks for a random third; once you have all three, you challenge them at the Coliseum. A way to
  choose the raid's three instead of the random pick below; which one wins is open.
- **Then today's Boss raid screen becomes the Coliseum's pre-fight screen.** (Boss alone keeps its own select screen as it
  is, Eric, Oct 26.) Your team stands on the left, as in
  `eric-paint-crowd.png`. The boss tiles shuffle, a highlight running across them, and three bosses are picked at random and
  dropped onto the stage. A countdown starts the raid, and the screen may need a button or two.
- **The bosses talk to each other.** The raid's three bosses are on a team, so they get lines for each other, and the
  town square's bosses chat too: everyday lines, short conversations between pairs, nods to what they share or oppose
  (fire and ice, dark and light), and silly questions. A line bank of 100+ lines per boss is being drafted with the Claude
  API from a character sheet per boss and a relationship per pair. Eric reviews every line; only kept lines go in the
  game, so nothing calls the API live.
- Still to settle: the Coliseum's menu and look, whether bots wander in a square, the shop,
  how the three bosses are ordered, what losing mid-way means, scoring across bosses, whether the God King's charges carry
  over, time per boss, and the rewards.

**The park** (Eric, Oct 26: "a little park… filled with chess boards on little tables where you can walk up and sit and
challenge or wait for one for someone for a casual or ranked game of normal chess"). Slice 6 built it in front of the
Coliseum's gate, with ten chess tables, and made the Coliseum about twice its size and the map bigger. A table's card shows
"Casual" and "Ranked" greyed with "Coming soon" for now. Next:
- **Sitting at a table queues you** (the next job; it needs a new casual queue): Casual or Ranked, for park players only for
  30 seconds, then for anyone.
- The game plays on the **normal game screen**; when it ends, you're back at your table.
- Later, with real players in the town: **tap someone seated** to challenge them.
- **Quick chats** in the town (with real players in it): premade lines such as "Who wants to play?" for people idling in the
  square.

**Rooms** (Eric, Oct 26: "we can't have 10,000 people in this little world")
- Each town square is a **room**, its own copy of the world. Opening Boss Arena puts you in the busiest room that still has
  space, so rooms feel lively.
- **Random joins stop at about 75** (a 50 v 50 can't start in a square anyway). Friends you invite can still come in, up to
  a hard cap of about 100. A new room opens when the others are full; an empty room closes.
- Maybe later: a challenge area in the square where you queue other modes.
- How it runs: one Durable Object per room, like the lobbies, Squads and 1 v 1 games, using Cloudflare's sleep mode
  (WebSocket hibernation) as they do. Walking goes square to square, so a phone sends one small message per tap (where to
  walk), not a stream of positions; the bosses and bots move by the same script on every phone, so the server only passes
  taps along and mostly sleeps. Each phone draws only the people near it.
- Cost, from Cloudflare's published prices (Oct 26): a full room of 75 people tapping every few seconds all day comes to
  about $0.50 a month; 100 full rooms nonstop, about $50. Rooms that never sleep would cost far more (Cloudflare's own
  example: about $143 a month for 100 rooms), so the design keeps them asleep. A fresh estimate goes to Eric before rooms
  are built.

**Art**
- One building per boss, in the game's pixel style, drawn in code like the bosses. **Opus draws all art:** Haiku was tested
  twice (the tiger still, Oct 23; Babur's circus tent, Oct 25) and can't do it. A building took Opus about 6 minutes; the
  circus tent test is the first. The reference pictures give the ideas; our style wins, and the names are written by the game
  on each building's sign, never drawn into the art.

## Auto chess: a TFT-style economy (Eric, Oct 25, 2026; for another day, needs testing)

Eric: rework Auto chess's gold so it plays like Teamfight Tactics, with buying, rolling and leveling in small whole numbers.
"Will need to test it a bit so it feels like TFT… not sure yet but this is for another day." His numbers, with today's in
brackets (`AUTOCHESS` in `packages/core/src/settings.ts`; today's are on a ×10 scale):

- **Piece prices:** pawn 1, bishop 3, knight 3, rook 5, queen 7, "unless 8 or 9 is more true to chess value" [today 10, 32,
  30, 50, 90]. The usual chess values are pawn 1, knight 3, bishop 3, rook 5, queen 9 (today's prices are already those,
  ×10); 7 would make the queen cheaper than her worth. Settle by testing.
- **Leveling:** 4 gold buys 4 XP; level 10 is the top [today 20 gold for 4 XP, top 10].
- **Income:** squeezed to TFT's size per round [today 100 the first round, +20 a round, up to 200].
- **Interest:** +1 gold per 10 held, up to +5 at 50 gold [today 10 per 100, up to 30].
- **Rolling:** maybe starts at 2 and rises 2, 3, 4, 5 within a round, capped at 5; not decided [today 5, +1 a roll, up to 10].
- The win-streak gold, selling back, star-ups and every other gold number scale down with it.
