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
    strength; the God King's help blocked and mocked; his ultimate at turn 7, the bullet clock for the rest of the
    battle (3:00, no added time, out of time loses); beaten, he collapses and mumbles, then phase 2. Placeholder
    lines (and five verified quotes) in one table, `characters/recluse-lines.ts`, for Eric's own.
  - **Phase 2 is built (Oct 14), for admins only, in Boss alone** (DECISIONS.md, "The Hidden Boss, phase 2"): beaten
    in phase 1, he collapses and mumbles, then the phase change (about 7 s: the book's slam, Sawyer's crack lines, the
    quarters growing into four boards, the Chess960 shuffle as the book's pages flip, his revive), then four boards
    at once, each its own Chess960 start: you on one, bots on three. Stockfish only, at 2750, at most 0.9 s a move;
    2:00 a board, no added time, out of time loses that board; a lost board's neighbors play on; all four must be
    won ("Victory!"), else a defeat that says how many of four were won. Test switches: `?win=1` (a mate in one in
    both phases, the bots take theirs), `?phase=2` (straight to the phase change).
    - **Left for later:** his real name and lines (phase 2's are placeholders too); how players reach him (the red
      book Mercenary item and the Squads win); his "super saiyan" transformation (a placeholder today: the spellbook's
      glow); the special crate and its reward; a server-side brain (the engine server's move endpoint) and fair-play
      review for real fights; online and Squads play (today the server never makes a battle with him); the
      engine-against-engine sim in Chess960 at the real clock (next step, for 2750 and the 2:00 bank); sim-tuning
      phase 1's numbers (turn 7, 180 s); the FAQ's Chess960 words once players can meet him.

Added Oct 14, 2026 (Eric; notes only, nothing built):

- **Friends and invites** (Eric, Oct 14: "we're gonna need like a, something where you can tap on somebody and just
  add them as a friend").
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
- **privacy@hunchess.com:** forward it to yourself with Cloudflare Email Routing (free), or name another address.
- **Workers Paid ($5 a month):** only when real traffic outgrows the free limits.
- **Privacy policy and terms:** drafted at /privacy and /terms; Eric to read them over.
- **Real-phone testing** of matchmaking with friends.
- **Art:** simple icons and emotes can be drawn in code; polished custom art would mean an artist or a paid pack.
- **At launch (Eric, Oct 13-14):**
  - Flip the repository to private. Before that: trim CI, and set an Actions budget (the free private plan gives
    2,000 minutes a month; CI uses about 100-120 a day). The Maia and Stockfish source must be served from the site.
  - Test lanes: every logic change goes back to the full lane per PR (CLAUDE.md, "Test lanes": the targeted lane
    and batch full runs are pre-launch only).
