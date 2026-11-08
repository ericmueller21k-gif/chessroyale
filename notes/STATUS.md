# Director status: the current state only (keep under ~40 lines; old entries go to CHANGELOG.md). Rules: RULES.md.

## Live on main (5fd736a, Nov 3 00:20 UTC)
Nov 1 work plus Nov 2: #456 auto chess reveal, #457 brush ink, #458 shops r1 (Babur, Puddles; buy = Coming soon), #459 Timber
sounds, #460 ride into shops + Timber 2 Gnaws + 🐟 Stockfish + no King praise moves 1-10, #461 boss picker 2 rows on computer, #462 boss tokens + keys + boss crate buying, #463 Colosseum GBA pieces, #464 bot spread, #465 batch B, #466 boss challenge (Alfil custom; Babur, Puddles default), #467 Big Boy home + intro, Timber king attack, #468 challenge pacing (~12 s) + hop clear of stools + e2e sign-in race fix, #469 Last Stand from move 6, #470 boss result screen (two columns, review inline).

## Running
- PR #458 shop interiors r1 (CI watcher). Next: round 2 at xhigh (tokens + purchase).
- PR #463 Colosseum new GBA set as Pixel + Colosseum's own Animations (off): CI watcher.
- PR #464 50 v 50 bot spread + top-3 draw (full-e2e; CI watcher).
- Merged Nov 2 evening: #464 bot spread (retuned wider), #465 batch B. Deploys live again (0431678 live 18:59; the 16:15 cache stall cleared).
- No Opus helper running.
- #463 Colosseum pieces live (with 0431678).
- API art: Colosseum GBA pixel pieces (session_01JuCWRvpifUHBYDWXqYcDtk; asks Eric once, ~$3-6, cap $8).
- One Opus: test-value changes (worktree /home/user/cr-testvalue, branch claude/test-value, brief
  notes/briefs/testvalue-changes.md): flakes first, then speed, formats→crowd-hidden merge, CI selection.
- API art sessions (outside the one-Opus rule, Eric): circus interior (session_01JuCWRrhykEFvvmv5JKWgRX, ~$4-7, cap $10);
  boss tokens for the other 14 (session_01JuCWRuuJUf92wTLxwR6d8N,
  branch claude/boss-art; asks Eric once, ~$4-6, cap $8).

## Queue (one Opus at a time)
0. Timber's home (Eric, Nov 3): art session drawing 1) his town house (none exists), 2) the shop (lumber walls, varnished + raw wood chess pieces, FOR SALE lawn signs, showpiece its pick; Shopkeeper Rivet if a sprite exists), 3) intro (log carried to the middle, gnaw, shavings storm, board revealed, stump seats, sawdust transition, ~12 s). Then code: place his house on the map, make Rivet's town sheet (sidekick-sheets.ts + town/sidekicks/timber.png from characters/sidekicks/timber.ts), shop (SHOP_TIMBER_MARKS), intro (one boss at a time; tell Eric when live).
0. NEXT after shops r2: Colosseum Pixel pieces (Eric Nov 2): Pixel must pixelate ONLY the pieces, never the crowd/arena
   (today arena-gl.ts draws the whole arena into the small target). Draw the pieces from the new GBA-style sprites (API run
   session_01JuCWRvpifUHBYDWXqYcDtk, scripts/boss-art/out/arena-pieces-gba/, after Eric OKs them). If Eric likes them, he
   said the other piece styles aren't needed (ask before removing 3D/2D).
1. Auto chess reveal (Eric's simpler version): your placed pieces gray until revealed to the opponent, then normal; yellow
   2 px border = next to reveal; no green; all ungray at the move step; opponent circles as today; piece-for-piece
   matching (pawn↔pawn, knight/bishop↔knight/bishop, rook↔rook, queen↔queen; unmatched stay hidden); first placer's
   piece concealed, so the first reveal is the opponent's. Every ~3 s.
2. Babur's shop (Eric, Nov 2): walk up to his home → card "Go in" → zoom in, fade into a circus-tent interior (~20x20
   tiles, auto zoomed in). Inside: a copy of his kid's sprite (Stripes) named "Shopkeeper" (tag over its head). Talk to
   it → "Babur's Boss Crate": its prizes always include his ride (Balloon Pup). Cost: 1 crate key + 1 Babur token.
   Tokens: from playing that boss, up to ~3 a boss a day (earning design for Eric's OK; not built yet). For testing,
   admins get keys and tokens in their inventory. Stored data → the data part at Opus xhigh. Only Babur's for now.
3. Brush Ride trail = ink dripping from the brush's back (Haiku; no pad).

## Boss tokens: Eric's rules (Nov 2), director's picks marked (mine)
- Earned by playing any boss battle (win or lose), counted once it reaches 10 of your moves or 5 minutes, whichever is
  first (mine). Which boss's token: random, equal odds over every live boss (not the Hidden Boss, not admins-first) (mine).
- Per account, a rolling 24 h window ("ticker"): the first counted battle with no token in the window always drops one;
  after that 25% a battle, up to 3 in the window. Decided by the server, never the device (fair play).
- On the result screen (victory or defeat): a square box in the gambling warning's style: "You got a [Boss] token!" + OK;
  it goes to your inventory.
- A boss crate costs 3 tokens of that boss, or 1 of its tokens + 1 crate key.
- Build after the shop prototype, at Opus xhigh (stored data). Admins get test keys/tokens.

## Waiting on Eric
- Tokens (#462): guests earn tokens? boss crate ride odds 2% (Fischer Random) ok or higher? Crowd boss final counts?
- Timber's drop limit: 1 pawn ahead (live) or 2 (retune)?
- Bot ratings: 800-1500 chess-site scale (live) or scoreboard scale?
- Boss lines from Gemini (he sends them slowly; kids are family; names Rivet/Tick).
- Crate key picture; payments later.

## Nov 3 (later)
- Cheetah renamed **Dash** (Eric: Blitz confusing). Ids stay `blitz`; player text says Dash. Art session told (send_message).
- Town audio bug (Eric's iPhone, no app switch: Timber chittered → Alfil silent → fight silent, never back): PR #474 `claude/town-audio`
  (worktree /home/user/cr-audio), per-tap health check in `wakeAudio`. CI watcher b9b89ki3f on 0eef6e1d.
- Dash's intro art DONE (weekly usage, Eric OK'd) on claude/boss-art: notes `scripts/boss-art/out/intro-blitz-nov3.md`;
  BOSS_BLITZ_INTRO (blitz-intro 150x108, foot [96,103], faces right; bolt/arrive(drop f4)/dashBy/brag), BLITZ_INTRO_DROP_AT [72,0];
  props `house-intro-blitz.ts` (shoe-box TABLE+_PALETTE/_INK, STOOL seat 11, DUST, POP, STORM/FRONT like Alfil's); ~10.3 s;
  table/board/pieces/stools land on dashes 1-4; cues whoosh/skid/drop/thud/brush/ding (Dash needs his own sound set). → fold into Dash build brief.
- Timber intro PR #475 (f9ab5548) opened; CI watcher bu3c7w7bk. Helper left wrangler on 8857/8858 (respawn after fuser -k; not killed: PIDs need Eric's OK).
- Dash round 1 (the boss: kit, sim, sounds, lines, Tick in battle, admins first) helper started, Opus high, /home/user/cr-dash `claude/boss-dash`,
  brief notes/briefs/brief-dash.md. Round 2: home + sneaker store + Tick town sheet. Round 3: his custom intro.
- LIVE: #475 Timber intro (3a780c73, main CI watcher bhs116o1u); #474 town audio (488e0fb2, main CI watcher bdyerenbj). Eric to retest audio on iPhone.
- Dash round 1 pushed 1bb18fbe (helper report: crowd 0.15±0.07 vs roster 0.12-0.21; FPS 60/17ms both; time = existing dock clock: bank 10+10 solo/party, 20 s move timer raids; slap −30 s bank or −6 s raid move (≥8 s); scramble 3 s ×5; out of time → random of judge's top 4, never a loss; flip live: remove "dash" from BOSS_ADMIN_FIRST in packages/core/src/settings.ts).
  Review: slap stills show his sprite dropping out of the header over the board (a8/b8) → sent back to helper (also "Yoink! T" mid-typing). Then PR with full-e2e.
- Disk was full (216 MB): removed 29 merged worktrees → 23 GB free. Helper wrangler servers left on 8857/8858, 8866/8867 (respawn after fuser -k).
- Nov 3: Dash #476: the FAQ fix 4574a2d2 had not been pushed (watcher got 422s for 80 min); pushed, CI watcher bkgg136vj.
  Round 2 brief written: notes/briefs/brief-dash-home.md (start after #476 merges, worktree /home/user/cr-dashhome).
- #476 check red on 4574a2d2: town-bots wants every sidekick file baked (main's #472). Fixed 3b2fe161: Tick sidekick-blitz.ts -> blitz.ts,
  baked; node_modules symlink (committed by my audio fix 0eef6e1d) removed, .gitignore `node_modules`. Watcher bu7z583lx. PR comment posted.
  Worktree node_modules: never symlink to /home/user/chessroyale (resolves @chessroyale/* to main's source); use npm ci.
- #476 Dash round 1 MERGED 9dc41d67 (green, full e2e). Deploy+main CI watcher byku2wtme. Tell Eric live when deployed.
- Dash round 2 helper started (Opus high), /home/user/cr-dashhome `claude/dash-home`, brief notes/briefs/brief-dash-home.md.
- Eric (Nov 3): too many messages; write only when done or his call. Audio: told him fix live, needs his iPhone retest.
- PR #477 Dash home opened (full-e2e, unsubscribed), head 23854b74, watcher b9gvbyz3x. Desktop counter/halfpipe stills predate panel fix.
  e2e lock /tmp/claude-0/e2e.lock held by helper's leftover wrangler (8823/9347) since ~13:22: stopping it needs Eric's OK (helper was denied).
- Eric Nov 3: OK'd stopping stuck servers (done: e2e lock freed, all leftover wrangler gone). Dash Kicks house/colors fine.
  Dash countdown/slap over pieces: Eric to test first; idea: while a finger is down, the countdown goes see-through until release.
  Boss picker compact (Haiku) started: /home/user/cr-bscompact, brief-boss-select-compact.md. #477 desktop stills retaken 56bb35f5, watcher bspr9tcud.
- Boss picker (Nov 3, Eric on the stills): KEEP the gap above "vs" (pawns are bigger, the boss drops in); don't raise the "?" platform.
  ON HOLD until Eric sends button ideas (from Gemini): the 4 mode buttons (Join a raid, People only, Raid with bots, Boss alone) get a new
  look, one line each ("Join a raid - up to 50 players", "People only - no bots", "Raid with bots - you and 49 bots", Boss alone: something
  cool like "just you and the king"), a 2x2 grid on phone and computer. Card-shrink branch claude/boss-select-compact ebd6d99d waits too.
- Eric Nov 3 desktop Chrome sound death (moved/resized window, clicked to Claude app; silent for good). Fix PR #478 claude/audio-desktop 1563b006:
  devicechange / ctx error / blur>=2s-with-page-visible -> stale -> next tap rebuilds. Watcher bu941o1jq. Merge on green, tell Eric.
- Boss picker: helper's stills were of the old light "Boss raid" screen (buttons), not the live dark Boss Battle (START). All picker work paused (Eric).
- Eric: sound died on desktop after FAST CLICKS on boss tiles (no app switch). Can't repro headless (300+ clicks at 44.1/48/96k: running, loud, no NaN).
  #478 now also has admin "Sound report" (Settings → Testing) dc140033, watcher bln1j6nhr. After merge: Eric reproduces, copies report, pastes.
- #477 Dash home MERGED 23a3a7d4, #478 audio-desktop + sound report MERGED 1a483a56: LIVE 16:03 (deploy took 13 min). Main CI watcher on 1a483a56.
  Eric to reproduce (reload, slow clicks, then 4-5 spam clicks on boss tiles) and paste the sound report or console __soundLog.
- ROOT CAUSE of all "sound dies for good" (iPhone + desktop): Timber chitter had 1 NaN sample at 48k/24k (bump: sin dips <0, ** 0.7 = NaN)
  -> master soften BiquadFilter state bad forever (Chrome console warning). PR #479 claude/sound-nan 9f214f9d (bump clamp in timber+dash,
  buffer() zeroes non-finite once, new boss-sounds-finite test). Watcher b8igr0pk5. Merge on green, tell Eric.
  Also seen in Eric's console: sw.js:62 manifest.webmanifest fetch blocked by CF Access redirect (CORS), repeated: look at later.
- #479 sound NaN fix LIVE c7009d1a (16:35). Eric to retest (reload; fast boss clicks; Timber's house; iPhone).
- Hollow cave (Eric Nov 3): art round started (Opus high, weekly usage OK'd by Eric), /home/user/cr-hollowart on claude/boss-art,
  brief notes/briefs/brief-hollow-cave-art.md. Shopkeeper: dark dog WITH antlers (Eric OK); Glim stays town kid. No names/quotes/film refs.
  Then: code round (cave mask floor, rock walls, dog shopkeeper, crate), later his darkness intro.
- Hollow cave ART DONE a53eba78 on claude/boss-art (notes out/shop-hollow-nov3.md). Stills sent to Eric; waiting his OK, then code round (mask blocking, repeated-piece lights, bake dog sheet, shopkeeper at (5,2)/(6,2)).
- Eric approved Hollow cave art. Code round helper (Opus high) /home/user/cr-hollowshop claude/hollow-shop, brief brief-hollow-shop.md. Intro: proposed lanterns-out/bulbs-on ~12s; Eric to confirm.
- Hollow cave code DONE 53988c7d → PR #480 (full-e2e), CI watcher running; merge on green, tell Eric when live. Lanterns in fight-start view: 4/5 (OK, no art touch-up). Asked Eric: Hollow stands at pond west edge during swing (clear 2.92) — fine or widen pond in art round? Next: Hollow intro round per notes/hollow-intro-eric.md.
- Hollow intro ART round started (Opus high, weekly usage, /home/user/cr-hollowart claude/boss-art, brief brief-hollow-intro-art.md). Then code round.
- Cave #480 LIVE (f7b2aa5f, 20:47). Hollow intro ART DONE 3238dbf4 on claude/boss-art (notes out/intro-hollow-nov3.md, 15.8 s). Sent GIF to Eric; waiting OK on calls (eyes in black, violet dim light, table in black). Then code round.
- Eric approved Hollow intro w/ changes (basic park table+stools in while lit, walk straight to seats, channel lines x4, drain 15% faster, director: iris into match). Code helper Opus high /home/user/cr-hollowintro claude/hollow-intro, brief brief-hollow-intro.md.
- Hollow intro code DONE 036605a8 → PR #481 (targeted), CI watcher; merge on green, tell Eric live. Later: Hollow cave art load ~4.5 s at 4x CPU (own job).
- Hollow intro #481 LIVE (33ad8967, 00:08). Eric Nov 4: desktop battle bugs (Hollow throw figure jumps off page, bubble stays), figures bigger on computer (what were they before?), cave intro bubble 3x and lower. Helper Opus high /home/user/cr-battlefix claude/battle-desktop-fixes, brief brief-battle-desktop-fixes.md. Table rise idea: waiting on Eric.
- Battle desktop fixes DONE 39f73ef4 → PR #482 (full-e2e), CI watcher; merge on green, tell Eric live. Follow-up (not done): board-carrying moments (Big Boy bounce, Sawyer/Wrangler leaps, Boingo funhouse, Jefferson candle, Lights out) + Smudgy blob, Chub&Chirp hop, Babur hoops still start at board top-left on computer.
- Eric Nov 4 (driving): next boss = Wrangler, full start-to-finish (barn interior/shop, intro, transition), weekly usage. Scope proposal sent; waiting his OK.
  His design: barn, hay, wooden pens with black+white knight pieces hop-skipping; a board on a stand set back in a corner; Wrangler spins lasso,
  yanks board to center; two ropes cross-armed, throws both ways, yanks off-screen buckets (white + black 5-gal, handles) that tumble in and land
  upside down as stools; transition: spurs + clearly-toy pistols. Process going forward: each boss built start to finish.
- NOTE (Eric Nov 4): boss QUOTES need expanding per boss (Gemini, Eric to return): challenge lines (shop intro), before fight, after fight
  (win/lose), talk-to lines; challenge lines distinct from in-fight barks. Eric also has another boss idea (later).
- Eric OK (Nov 4): Wrangler full build, my picks (rooster shopkeeper, hay-bale stand, Pen Pony ride, placeholder line), push LIVE, NO GIFs to him. Art helper Opus high on /home/user/cr-hollowart claude/boss-art, brief brief-wrangler-art.md; then code round, PR, merge, tell Eric live.
- Eric Nov 4: Wrangler is a TRIAL of start-to-finish with no review stops. If major issues show up live, go back to the slow rollout (Eric reviews stills/GIFs between art and code rounds) for later bosses.
- Eric Nov 4 (50v50): ≥70% share always plays; AFK = random top-5 default (not in tally), score = lowest teammate that round, 4th miss → removed; delete ChatBubble (never approved). Brief brief-crowd-votes-afk.md. Queued for the next Opus slot (after Wrangler art) unless Eric OKs running in parallel.
- Eric: 50v50 batch runs LATER TONIGHT (midnight shift), one helper at a time. Order: Wrangler art → Wrangler code → 50v50 votes/AFK/bubble.
- PR #482 RED (39f73ef4): 4 desktop e2e: board-layout:335 + boss-character:9 (pawn middle vs boss middle off 12.5px at 1280), grex:186 + desktop-board:250 (14px sideways scroll at 1440: king/pawn grew past window). Real bugs. Fix: resume battlefix helper (same worktree) in the next Opus slot (after Wrangler art), before Wrangler code. Logs: scratchpad/ci482/.
- Wrangler ART DONE 606565da (claude/boss-art). #482 fix: resumed battlefix helper. Then merge #482, then Wrangler code from main (brief updated: rooster on counter, art calls).
- #482 fixed c69166e7 (mirror kept, no sideways scroll) → figures only ~1.1x at 1280/1440/2000 (1.33-1.46x at 1920). Merge on green. FOLLOW-UP (queued after Wrangler code, before 50v50): make figures clearly bigger by letting them overlap the board edge (Eric Nov 4 rule allows; the Oct 28 "clear of the board" + mirror checks are design checks, not eric.md rules) — list changed checks.
- Wrangler art FINAL 0e4c00c6 (buckets + Puddles buckets). #482 MERGED 431c45c0 (deploying). Wrangler code helper launched /home/user/cr-wrangler claude/wrangler-home.
- Eric Nov 4: town movement keys (on-screen up/down/left/right, bottom-right above zoom, see-through clean icons; hold = run; desktop arrow keys move + light up the on-screen key). Sketch sent (A key cluster / B round pad: scratchpad/dpad/). Waiting his pick, then a Haiku/Opus round in the queue.
- Eric chose arrow keys A, ~37% smaller, right edge aligned with recenter. Brief brief-town-arrow-keys.md (+ assets/town-arrow-keys.png). Queue: Wrangler code → bigger figures → 50v50 → arrow keys.
- Wrangler code DONE 6edc3e5d → PR #483 (full-e2e), CI watcher b2b7bfz38; merge on green, tell Eric live. Killed stuck wrangler dev on 8981 (Eric standing OK). Open for Eric: his lash crosses his bucket during his God King attack (kept); he stands at 2.6 not 7.2.
- Bigger-figures round STARTED (resumed battlefix helper, branch claude/bigger-side-figures, ports 8985/9485), alongside nothing else Opus. Then 50v50, then arrow keys (+ shrink zoom/recenter, v3 sketch pending Eric OK).
- #483 Wrangler MERGED 2437cc27 (CI fix: profile ride count 16→17, mine). Deploy watcher running; tell Eric LIVE.
- Bigger figures DONE 28a27b90 → PR #484 (targeted), CI watcher boyp3fikw. 50v50 batch STARTED (Opus high, /home/user/cr-crowdafk claude/crowd-votes-afk from 2437cc27). Next: arrow keys + smaller zoom/recenter.
- Eric Nov 4: phone boss bar: bosses clipped at the bar left edge (Puddles); stack/align his meters; check all bosses. Brief brief-phone-boss-bar.md. Queue after 50v50: arrow keys, phone bar (both UI/Haiku: could run as Haiku beside an Opus only with Eric OK).
- Eric Nov 4 (going to sleep): Jefferson full build OVERNIGHT straight to live, no stops (warehouse ~15x15 mask, racking/pallets/firework boxes w/ boss-named packaging, scissor-lift giraffe + forklift giraffe on loops that stop when blocked, shady dealer giraffe shopkeeper w/ Sharpie SHOP sign, crew comes over in intro, board on crate stack, your piston floor lift, sparkler wipe; crate Giraffe Gallop). Briefs brief-jefferson-art.md + brief-jefferson-code.md. Night order: 50v50 (running) → Jefferson art → Jefferson code → arrow keys → phone bar. Merge each on green; tell Eric in the morning in one short summary.
- 50v50 DONE 89f7a72d → PR #485 (full-e2e), CI watcher bj6ktcn86. Jefferson ART started (Opus high, cr-hollowart). #484 bigger figures: CI watcher b46wa044a on b09d56ae.
- Jefferson ART DONE 0e4f6482 (16x16 floor, 7 crew + dealer). Jefferson CODE started (Opus high, /home/user/cr-jefferson claude/jefferson-home from 2437cc27, ports 8995/9495). #484 fix 0887b5ff (Timber over side menu OK), CI watcher bx4d6pi9m. #485 CI watcher bj6ktcn86.
- #485 50v50 MERGED 5d17e6fa; deploy+main CI watcher running.
- #484 bigger figures MERGED 8af7ee6a; deploy+main CI watcher running (main has #485 + #484 together now).
- 50v50 LIVE (5d17e6fa 08:28). Main e2e after #485 RED: town.spec:348 Babur card centering (33/4.9 px: card read in 3 calls while it moves with the camera) → PR #486 (one-frame read), CI b94wgec9d; also home-polish:149 hop flaky (passed on retry; look later). #484 main CI watcher bnyzycpkp.
- Jefferson CODE DONE ea4c6cf6 → PR #487 (full-e2e), CI watcher b49xshuai. Arrow keys STARTED (Haiku, /home/user/cr-arrows claude/town-arrow-keys from 8af7ee6a). Then phone boss bar (Haiku). Killed helper wrangler on 8995 (Eric OK).
- #486 MERGED 099a8840 (deploy watcher bbjzgbb41). #484 LIVE 09:04. Arrow keys DONE 74242d35 → PR #488 (targeted), CI b2yv5a6mv. Phone boss bar STARTED (Haiku, /home/user/cr-phonebar from 099a8840). #487 Jefferson CI b49xshuai.
- #487 Jefferson MERGED e12ae43e (merge API 502 but it went through); deploy+main CI watcher. Main green after #484.
- Phone boss bar DONE 16ca2677 → PR #489 (targeted), CI bkbm336aq. Queue now empty after #488/#489. Morning: one short summary to Eric.
- #488 arrow keys: CI never started (0 check runs, GitHub 500s at push); merged main in (conflict in ShopRoom frame step: kept keysWalk + crew halt), 4592ddf6, CI watching. #489 phone bar red (boss-bar.spec prop room at 320) → helper fixing. Jefferson LIVE e12ae43e 10:04.
- #488 arrow keys MERGED 233ef3ad; deploy+main CI watcher. #489 phone bar fix 8e77c991 (prop room ≥60 at 320 for name-moved bosses), CI bois622yj. Main green after Jefferson.
- #488 arrow keys LIVE 233ef3ad (11:33). Workers Builds check FAILED after upload: wrangler post-deploy lookup "version could not be found" (CF API race); deployments API shows a1f19b5d at 100% (the new one), /api/status OK, main e2e green. No action; note for Eric. #489 CI bois622yj.
- #489: e2e shards 2,3 stuck queued >1h (runner never started; rerun 403 = no permission, not routed around); merged main in (2f4eabc2, real merge) to re-run CI; watcher running.
- #489 phone bar MERGED eb8e5231; deploy+main CI watcher. Night queue DONE. Morning summary to Eric owed.
- #489 phone bar LIVE eb8e5231 (13:02). Main e2e red: gardener.spec:475 seed meter "one row" (stale vs Eric stacked layout; #489 PR lane did not select it) → PR #490 (check updated; passes locally phone+desktop), CI byu5faw4i.
- #490 MERGED 6fe94b58; main CI watcher (should be green).
- NIGHT DONE: main GREEN at 6fe94b58 (14:03). Live: #483 Wrangler, #484 bigger figures, #485 50v50, #486/#490 test fixes, #487 Jefferson, #488 arrow keys, #489 phone bar. Morning summary sent.
- Eric Nov 5 AM: Jefferson perfect. Fixes: Wrangler name clipped on banner; challenge card text not centered; banners show God King (should be your pawn except his save); "🤠 Boss plays d4" emoji → name+portrait, all bosses. Brief brief-banners-emoji-cards.md (Haiku).
- Banners/emoji/cards DONE 02883a11 → PR #491 (targeted), CI bqg74o3ph.
- #491 banners/emoji/cards MERGED a1f1de50 (fix: "Plays your move: X" keeps words, portrait only); deploy+main CI watcher.
- Eric Nov 5: next boss GINGER full build (igloo circle ~10, candy dispensers 2 rows + catwalk + curved stairs (2nd walk level), elf shopkeeper + elves w/ candy canes, dispensing pair loop, barrels; intro: staff charge, blast, ice shard table cracks floor, 2 elves toss board ("Coming, boss!"), cast pieces from white light; wipe blizzard + colored candy canes). Eric wants a VIEW OF THE SHOP (walls/rows/catwalk) when art done. Crate: ginger-sled. Brief brief-ginger-art.md. Art started.
- #491 LIVE a1f1de50 (17:18), main green.
- Eric Nov 5: Squads move replay (default on, any mode where you return to a board), free time +0.5s/move since you last played (on or off), rewind toggle by settings w/ spinning dot trail when on, first-time Squads tip (dim, gear + replay lit, "dont show again", OK). Eric OK: run beside Ginger art (this case only). Brief brief-squads-replay.md, Opus high, /home/user/cr-replay.
- Squads replay LIVE: #492 merged 70733948, live 19:46 UTC (main CI watcher b67xqwruz).
- Ginger ART DONE 1d7c9427 (circle 10 cols 5-14 rows 5-14, catwalk = back wall squares (6,5)-(13,5) deck 40px, stairs 2 sq each end, table (10,10.5), marks 8.5/11.5; prize ginger-sled). Stills sent to Eric for the walls/catwalk check. Ginger CODE waits for: Eric OK on walls + the replay helper to finish (one Opus). Nov 5 fixes e035870a: centred (9.5,9.5) marks 8/11, own cam INTRO_GINGER_CAM (code needs per-boss cam), icicle table 27px, candy to row 11, stairs landings, wall cards 45px, gnome elves 25px. Sent to Eric.
- Eric Ginger fixes: center battle circle; icicle-shaped falling ice (taller, pointier, round flat top); more candy dispensers wrapping walls; stairs connected to catwalk; no wall gaps. Sent to the Ginger art helper (same art job, Eric-approved pairing).
- Ginger stairs joined 6ef02ce9 (one flight per side, rising along back wall into deck; bays a/e gone). Eric's fallback if he dislikes: straight back-to-front flights. Asked Eric which.
- Ginger CODE started (Eric OK'd stairs 'fine for now; real test = run up with pawn'). Brief brief-ginger-code.md, /home/user/cr-ginger, claude/ginger-home, ports 8983/9483.
- Ginger code DONE dcf4a6c5 → PR #493 (full-e2e), CI watcher bh5qn5ne7. Note: arrows up fixed in every shop; doorway phone fps 35.7 vs 40.8.
- Ginger LIVE 3ad40dde (22:35 UTC). Main e2e red: Ginger stairs spec read lift before step settled (no SHOTS on CI). Fix PR #494 c0e710b2 (settled() + trail 6000), CI watcher brngboghh. Smudgy desktop flaky once in same run (passed on retry).
- Main GREEN + live ab6c8c48 (#494 merged). Nothing open on GitHub. Next: Eric's stair test in Ginger's igloo; boss quotes (Gemini) when Eric sends them.
- Nov 5: Eric: 'the town is not a town'. Sent today's top-down plan + proposed plan (66x66, park centre, 4 avenues, ring street, Colosseum north, 16 boss homes + 6 everyday house designs A-F, hedge edge, no wrap) + Gemini prompt (assets/town-redesign/). Open Qs: wrap vs edge, boss placement, street movers, enterable houses. Waiting on Eric/Gemini concept.
- Nov 5 town direction (Eric): keep 46x46 + wrap (seam street, Pac-Man); streets wall-to-wall dummy buildings, boss homes enterable, bigger bldgs behind, sky visible; chessboard roads; park plus-shape (drop middle table each side, +4 = 12 tables, remove trees in walks); camera ROTATES with street to show fronts (no 3D); default zoomed-in; Colosseum is a flat billboard (Eric right) -> keep front-on or needs angles/3D. Mockups first: art helper on brief-town-street-mockup.md (Opus high).
- Door taps/arrow ask fix: PR #495 842eb55c (town lane), CI watcher bm9hrge4o.
- Town street mockups DONE afbbc7e5 (scripts/boss-art/out/town-street/, notes town-street-mockup-nov5.md); sent to Eric. Calls: camera N on E-W streets, E on Seam Avenue (only N-S street); one-sided streets (fronts one side, back gardens near side); Colosseum front-on only in a grove; turn at Seam Avenue crossings ~0.5s; wrap kept via seam streets; park 20x12, 12 tables. Waiting on Eric.
- #497 Dash intro MERGED 22c77da9 (admins). #496 igloo stairs MERGED e9677869. Deploy+CI watchers b08cqezwu (#496), on 22c77da9 (#497).
- Hollow bulbs/darkness/taunts brief written (brief-hollow-bulbs.md): start AFTER Dash finishes (one Opus). Worktree /home/user/cr-hollowbulbs to create. Eric Nov 5: bulbs SOLO ONLY (griever spam). Eric OK: extra Opus helper beside for the town (medium or high, my call).
- Igloo stair fix PR #496 d7058fd1 (shop lane), CI watcher bz9il4xd2. Local e2e skipped: lock held by helpers.
- Nov 5: Eric approved building the street town from the mockups (afbbc7e5 + depth 4b7ada3d). Plan (one Opus at a time, after Dash then Hollow):
  1. Town art (Opus high, boss-art): final everyday fronts (8 designs x2 colours) + box sides/roofs per material and per boss home, bigger buildings behind, hedges/back gardens, seam streets; exact plan numbers.
  2. Town code A: new layout at today's camera (plus park 12 tables, streets, lots, homes moved, walkable/bots/boss roam, default zoomed-in), town e2e updated.
  3. Town code B: box-building renderer (WebGL + 2D fallback, ~15 draws/building) + camera turn at Seam Avenue crossings (~0.5 s); frame-rate check on phone.
- Town art round 1 DONE 11a4d903 (out/town-buildings/, town-plan-nov5.json, stills out/town-art/). Round 2 (layout, admins first STREET_TOWN) helper: brief-town-layout.md, /home/user/cr-townlayout claude/town-layout, ports 8993/9493 (parallel helper per Eric).
- Hollow bulbs helper started (Opus high), /home/user/cr-hollowbulbs claude/hollow-bulbs, ports 8989/9489.
- #499 street town round 2 (admins, STREET_TOWN) PR open full-e2e 96368a3f, CI watcher bdc92v0bm. #498 igloo one-lane deadlock fix (main red after #496) 365c3b56, CI watcher bgcrum0uq.
- Town round 3 (boxes + camera turn) helper: brief-town-boxes.md, /home/user/cr-townboxes claude/town-boxes from claude/town-layout, ports 8995/9495. Flip STREET_TOWN for everyone after Eric walks it.
- Hollow bulbs DONE -> PR #500 (full-e2e) a045a4c8 (main merged in), CI watcher bi5kmycmh. Taunt clip was a mid-typing still; new e2e checks every line fits.
- Main GREEN + live abffbf53 (#496 #497 #498 merged; igloo pass-through on stairs). #499 street town re-running after JSON import-attribute fix 56a9a387 (watcher b7vgj00d8). #500 Hollow re-running after boss-bar slot fix d05e25f7 (watcher ba24bg6ix). Town round 3 helper running.
- #499 CI: only alfil Mammoth Slam phone failed (both tries); not this PR's (no shared code; passes locally x2 on PR build; main green). Commented on PR. Re-run by merging main when #500 merges.
- #500 Hollow bulbs MERGED b0119b41, LIVE 06:31 UTC (main CI log scratchpad/main-b0119.log, bg). #499 main merged in adcbaf2b, CI watcher bhjot9ros. Banner-events helper running (brief-banner-events.md, /home/user/cr-bannerev, ports 8997/9497) per Eric: banners tethered to events.

## Nov 5 ~07:20 UTC
- #501 banner events (full-e2e) open, CI watcher b0p5xwej0. #499 street round 2 CI watcher bhjot9ros (adcbaf2b).
- Round 3 (claude/town-boxes 42809163) DONE, no own PR: folds into round 4's PR (its fixed camera is replaced by the chase cam).
- Round 4 helper (claude/town-rows, /home/user/cr-townrows, ports 8993/9493): mockup phase → show Eric → "go". Brief has 3 addenda
  (separate fronts butted, look-alike dummies; walled-in streets & hidden landmarks; chase camera along the street, two zooms).
- Follow-up (Eric, Nov 5): the Colosseum taller and bigger, so it looms when it comes into view in the street town. After round 4.

## Nov 5 ~11:00 UTC
- LIVE: #499 street round 2 (admins), #501 banner events, #502 room keys (rowsUp). Main green at d90fc449.
- #503 street town rounds 3+4 (full-e2e) open, CI watcher bbq7z90is. Merge on green → admins see it; Eric walks it in the morning, then
  flip STREET_TOWN for everyone on his OK. Follow-ups: bigger Colosseum; Moo paddock / Ginger dome low in rows; bulgy bodies.
- Disk filled at ~08:00: removed 13 merged+pushed worktrees (clean, nothing ahead). Keep cleaning finished worktrees.
- LIVE 13:06 UTC: #503 street town rounds 3+4 (admins only), main green at 6ce41d19. Next: Eric walks it (morning) → his OK → flip
  STREET_TOWN for everyone. Follow-ups: bigger Colosseum; Moo/Ginger low in rows. Helper slots free.
- Nov 5 ~19:00: Eric: Folio's sanctuary, director's design, "crank through it" (weekly usage resets today): FULL BUILD, NO REVIEW STOPS
  (like the Wrangler trial): art (brief-folio-sanctuary-art.md, helper running on claude/boss-art) → shop code → intro code incl. the
  screen crumple into the match → PRs → live. Beside-you root-cause helper running (claude/fix-beside-you). Queue for the next Opus slot:
  bigger looming Colosseum in the street town; Moo/Ginger low in rows; board-carrying moments on computer (#110 note).
- Nov 5 ~19:20: Eric asked for Squads (Relay on 3 boards, cleaner match screen) to run alongside Folio and OK'd another helper
  (3 Opus at once for this). Brief brief-squads-three-boards.md, branch claude/squads-three-boards (ports 8995/9495). STOPS after
  mockup stills → send Eric → his corrections → PR (full e2e). Open: turn-order list (a) 6 seated + "next in" vs (b) all 8.
- Nov 5 ~23:45: #506 Folio sanctuary merged 0fd7944d (deploying; tell Eric when live). Squads three boards: Eric reviewing the
  long-name stills and glide GIFs (merge only on his OK). Ginger steps helper: app fix (shops pick the tap at press, like the town)
  + test waits. Street town: two helpers in parallel: north edge + 3D Colosseum (claude/street-north-edge, 8987) and controls
  (hold to run, 10° snap and lock, reset to north in and out of buildings) + minimap (claude/street-controls-map, 8988). Merge
  north edge first. Asked Eric: default zoom step (4 steps, opens at index 1, the mockup's) vs "the middle of three".
- Nov 6 ~00:30: CONTAINER RESTART stopped 4 helpers; worktrees survived on disk. Relaunched all 4 to resume from their worktrees
  (commit WIP first, push often): ginger steps (app fix pushed f0a6fc42), north edge (all WIP was uncommitted), controls + minimap
  (2 commits pushed), Smudgy (barely started). Folio LIVE (0fd7944d, main green). Squads waiting on Eric's OK.
- Nov 6 ~02:00: #507 shop tap fix merged de7933db (deploy+main CI watcher). #508 Smudgy: gallery lights + sound-list test fix at
  45a9ed55, CI watcher; merge on green. Started: Welcome Crate (xhigh, claude/welcome-crate, 8985), Boingo Funhouse room (high,
  claude/boingo-home, 8984; no intro this round; claw stub), claw machine (xhigh, claude/claw-machine, 8983; 25% for that boss's
  crate, server-decided, idempotent; admin test tokens). Still running: street north edge (8987), controls + minimap (8988).
  Eric: around 9 o'clock, pause all but one Opus helper and go back to one thing at a time.
- Nov 6 ~02:40: disk full ~02:20 (allowance spent): removed 9 merged/pushed clean worktrees via `git worktree remove` (8.4 GB free).
  Leftover non-git dirs cr-bannerev, cr-result2, cr-roomkeys need a forced delete; the safety check blocked it, so they're left.
  #507 LIVE (de7933db, main green). North edge PAUSED at 03b47ef5: left = frame rate vs main, South Street west sky e2e failing
  (0.126 vs 0.005: Hollow's roof slope beside the camera after the move; needs a design fix), stills. Stuck wrangler on 8987
  killed (Eric's OK). Tutorial (Haiku): Handbook rename + slide module pushed; overlay in progress until 02:59.
- Nov 6 ~02:45: controls + minimap PAUSED at 1c6d7420 (claude/street-controls-map): built; local e2e unproven (disk-full run), the
  WebGL look-round e2e not rerun, WebGL fps not measured; merges main after north edge. Street town ships as north edge then
  controls. #508 Smudgy merged 83ceba92 (deploying). #509 Welcome Crates open, full e2e running.
- Nov 6 ~02:50: Boingo room PAUSED at 70167f81 (left: claw walk-up zoom + slot box, sign text, arcade ceiling, an e2e hop blocked
  by the claw machine, remaining e2e, fps, stills, PR body). Tutorial (Haiku) PAUSED at 94079042 (left: computer side-menu
  data-tour + desktop e2e, stills, PR body, decision note; merge welcome-crate 8dac548a and turn TUTORIAL_CRATE_25 on).
- Nov 6 02:55 ALL HELPERS PAUSED (Eric: resume one at a time on his go-ahead). Claw machine DONE at e7a50ec0 (claude/claw-machine;
  ?claw=1 test switch until Boingo's room merges; Eric's test tokens via the existing admin grant + "Admin: +3 of each token"
  button). Waiting to merge: #509 Welcome Crates (CI running), Squads (Eric's OK), Smudgy deploying (83ceba92).
  Resume order to propose: Squads (needs only Eric's OK) → north edge → controls → Boingo room → claw → tutorial.
- Nov 6 ~03:05: usage reset; ONE OPUS AT A TIME now. Eric: the claw machine must be the real 3D cabinet in Boingo's room (walk up,
  zoom, the in-room claw grabs and usually drops), not a 2D overlay. Resumed Boingo room helper: merge claude/claw-machine (keep the
  server as reviewed), retire the 2D screen, in-room 3D cabinet + claw play, then finish its list. Eric loves the confetti floor.
- Nov 6 ~03:55: Eric: "just start the Colosseum and finish it … I want to see it live … with the movement changes as well."
  Boingo PAUSED (claw in-room WIP). North edge RESUMED (merge main, fix the South Street row hole ≤30 min, fps, stills, e2e) →
  PR full-e2e → merge → then controls + minimap (merge main, rerun e2e) → PR → merge. Then Boingo resumes. #510 e2e fixes in CI;
  #509 Welcome Crates CI after the crate-row test fix.
- Nov 6 ~04:20: #509 Welcome Crates MERGED 7ec28d4b (deploy + main CI watcher). #510 e2e fixes: its PR run failed shop.spec:1067
  "up is up" (desktop, goIn "drawn" null x2), which passed on #509's full run on the same base and 6/6 locally, so it's intermittent
  and not #510's; merged main into #510 (5b9990b1) to rerun. If it recurs, root-cause goIn (likely: after the tap walks you to the
  door, your pawn or ride covers the home's tap point and the card hasn't opened within 1.5 s on a slow runner).
- Nov 6 ~04:50: Eric saw the Meadow Street still: Moo's and Hollow's homes nearly touching with a sliver building and sky between.
  New rule (RULES.md). #511 HELD: north edge helper re-spaces Meadow Street, checks every street, adds a unit test, re-runs, pushes.
  #510 merged c570f6dc; Welcome Crates live. Haiku helper: Welcome Crate meters (claude/welcome-meters).
- Nov 6 ~05:20: main e2e on 7ec28d4b red: webgl-phone town-tags.spec:157 "tags fade … (not a pop)" both tries: no in-between
  alpha frames. Cause (from code): nameAlpha fades by distance over 1 square (4.5→5.5); on the slow software-WebGL CI runner a
  walk crosses that square between two frames, so the tag pops. A real slow phone would see the same pop. Fix queued for the next
  Opus slot (after north edge; render.ts conflict): ease each tag's drawn alpha toward its target over ~150 ms (time-based), so a fade
  shows at any frame rate. Passed on #509's own PR run and main's previous run. Watching c570f6dc's run.

## Nov 6 ~06:30 UTC
- #512 Welcome meters MERGED 5eba461a (deploy + main CI watcher bnf7yw22d).
- Main c570f6dc green.
- #511 north edge: Eric OK'd the stills and the rotation check. Pushed 286ed215, CI watcher bgqfwvi8w; PR body updated. Merge on green, then live.
- Next, one Opus at a time:
  1. controls+minimap (a05e51bee0efe0164: merge main, e2e, PR full-e2e);
  2. tag-fade time easing (render.ts), plus an American-spelling sweep of the comments/docs #511 added (coliseum-ring.ts, coliseum-shape.ts, boxes.ts, decision note, areas doc).
- Then the Boingo and tutorial resumes.

## Overnight queue (Eric, Nov 6 ~07:40 UTC: "queue up everything for the next eight hours … one at a time")
Eric OK'd all of these: more CI shards, the item audit trail, the 3D-engine decision (he said: decide it), and cutting bloat ("it shouldn't be this complicated").

Opus, one at a time:
1. #511 sky-gap fix and account-spec check (a0a05bd6, running) → merge → live.
2. Controls and minimap (a05e51be): merge #511's new head; revert its "minimap off" workaround in the town-rows sky check (it was #511's bug, not the minimap's) → PR full-e2e → merge → live.
3. Architecture audit (read-only, ~1h) → decisions doc:
   - item storage today;
   - room renderers;
   - data vs code;
   - what makes changes slow (dual renderer, stills, docs volume, screenshot specs).
4. Street town WebGL-only (stop the 2D path and 2D test runs for STREET_TOWN; keep today's town 2D until the street town ships to all), plus tag-fade time easing, plus the American-spelling sweep.
5. Item ledger (xhigh): an append-only grants/spends record for every item, token, crate and claw prize; additive migration and backfill; tests.
6. The 3D art kit:
   - low-poly meshes with pixel textures at the town's texel density, nearest filtering, the town palette and the same light (the N64/PS1 approach);
   - rebuild Boingo's claw machine with it;
   - stills for Eric in the morning, no merge until he OKs.
7. Boingo resume (a0c458c8), if there's time.

Haiku alongside: the tutorial (acf647b0), resumed 07:40.
Mine: #513, CI on 10 shards (MAX_SHARDS 10), watcher boarosuz3.

## Nov 6 ~12:00 UTC
- **Live, main green (9e5e826f):**
  - #511 the north edge (Colosseum);
  - #513 CI on 10 shards;
  - #515 minimap and controls;
  - #516 ledger I;
  - #514 the first-login walkthrough.
- **Running:** ledger II (Opus xhigh).
- **Next Opus:**
  1. the street town WebGL-only (and today's town's ?gl=1 retired, per the audit row 4);
  2. the 3D kit;
  3. the claw on the kit;
  4. intros as data.
- **PARKED (waiting on Eric's UI):** the settings split into Sounds and Gameplay, plus move confirm styles (classic, soft press, vote trace). See notes/briefs/idea-settings-and-move-confirm.md. GIFs to Eric before anything goes live.

## Nov 6 ~15:20 UTC: the next Opus slot after the 3D kit (a694ff16), as one "red tests" helper:
1. **#518 (the snap fix, head 8c6c2e15) is blocked** by town-rows "no sky", South Street east, phone: 0.011 and 0.0129 on both tries. It's the same spot CI flagged on #511 (0.013) that never reproduced locally. Real: find the gap at that pose and fix it in the drawing or layout, not the check. Then merge #518.
2. **Main 446c4775: account.spec:5 on the phone.** The crowd solo match stays in "simulating" for 3 minutes (second time today; the first was on #511, where the town was cleared). Root-cause it: the server sim, the match DO, a timer, the client.
3. **Main 446c4775: colosseum.spec:162 on the computer.** After switching to 3D pieces, drawCalls was 3 when ≥5 was expected, after 9 plies. #519 didn't touch the Colosseum match.
- **Next Opus after the red-tests helper (a7703b27):** the pipeline audit (brief-pipeline-audit.md, read-only) → I fix the quick wins myself → helper PRs for the rest.
- **Queued after the intros as data:** the SPRITE KIT. Bosses stay 2D sprites (Eric agreed, Nov 6). Shared rules: texel size per figure class, palette ramps, a 1-px outline, sprites as data (grids, palette, frames), frame templates and kit tests. One existing boss is moved as the pilot, with before/after stills for Eric. Others move only when next touched.
- **Recurring bloat sweep (Eric, Nov 6, every 3.5 days):** scheduled tasks trig_01QYRT1Nz1yWJmwpQbeReECs (Mon 05:47 UTC) and trig_01KQ78iK67ZGbG2ehHoZWC7u (Thu 17:47 UTC). Each fires into this session: run the pipeline audit with a Trend table against the last one, fix the quick wins, queue the rest, and send Eric a short summary.
- **Dash v2 (Eric, Nov 6):** brief-dash-v2.md, the next Opus after the red-tests helper, then the pipeline audit.
- **Haiku running:** claude/boss-bubbles (all boss speech in the God King's bubble design, plus the huge-text bug).
- **REAL RACE (money), the next Opus after Dash v2, xhigh:** ledger.test.ts:234 failed once in #524's check: three concurrent `openCrate` calls with the SAME request id returned 2 different answers (item or roll). It passed 8/8 locally. Possibly the free crate open's idempotency replays the roll before the first op commits, or two attempts both "win". Root-cause it in ledger.ts and openCrate: one answer per request id under any race; add a deterministic race test.

## Pipeline audit (Nov 6, notes/pipeline-audit-2026-11-06.md)
- **Running now:** quick wins Q1–Q8 as one PR (claude/pipeline-quick-wins).
- **Queued, in order (helper PRs):**
  1. timings auto-refresh from the last green main run;
  2. areas.json re-scope, so fewer PRs run everything (about 15 min per PR);
  3. the @phone-only tag for logic specs (up to 30% of e2e time; needs my sign-off on the list);
  4. the flake fixes by pattern (colosseum, town-rows, home-polish clock races, sound/autochess timing, intro 50 ms polls);
  5. check split in two (chess package tests on their own: about 5 min);
  6. lazy-load boss art and openings.json (35–40% off first load).

## Nov 6 ~20:10 UTC: Eric: "finish the audit fixes and parked settings, and sprite kit if you have everything needed from me … I want everything to be done." Quiet mode: one message when the whole queue is live.
One Opus at a time, in order:
1. Pipeline quick wins (#527, running).
2. Pipeline proposals as PRs:
   - (1) timings auto-refresh;
   - (2) areas.json re-scope;
   - (4) the flake fixes by pattern;
   - (5) check split;
   - (6) lazy-load boss art and openings;
   - (3) @phone-only: I sign off the list myself.
3. Sprite kit: the infrastructure, plus one pilot boss. The pilot's look needs Eric's OK before its merge (I promised that); the infrastructure merges on green.
4. Intros as data (architecture audit row 8).
BLOCKED on Eric: the settings redesign (he said he'd send the UI first), the claw machine on the kit (stills sent, no answer), and the move-confirm GIFs (part of the settings work).
- **Eric, Nov 6 ~20:15:**
  - The claw on the kit is APPROVED ("fine with new design … update it later"). Merge claude/kit-claw into claude/boingo-home, then finish Boingo's room (the resume list: fps, computer stills, GIFs, areas.json, docs, PR) and send Eric the room stills before live.
  - Settings: I design the mockup myself and SEND IT FIRST for his OK (Sounds and Gameplay pages, plus the move-confirm style picker), then build after his OK.
- **Sprite kit pilot = SMUDGY (Eric, Nov 6):** "use Smudgy to test because in the battle intro he's facing the wrong way when the match starts". Convert Smudgy to the sprite kit AND fix his facing at the battle intro's start (he must face the board/player as the match begins). Before/after stills and a GIF of the intro to Eric before the pilot merges.
- **Eric, Nov 6 ~22:40 (playtest; QUEUED, start only after the queue is empty): Dash's Scramble Rush.**
  - It fires with no warning. Treat it like the other ults: when he plays it at the start of his turn, the banner comes up, then
    "Next turn: Scramble Rush", and he says a line (e.g. "Hope you were watching."). The put-back starts the turn after.
  - The put-back can be spammed: a hard cap of 2 moves per piece. A third try shakes the piece, with small fading text "No more tries".
- **Nov 7 ~00:20 UTC: MISS.** Squads three boards (built Nov 5, held for Eric's look at stills) was never chased or merged; Eric
  noticed. Merged main into it (squads specs: new titles + @phone-only), stills moved out of the repo, PR #538 (full-e2e),
  CI watcher. Merge on green (Eric expects it live). Lesson: every "waiting on Eric" item goes in the one-message list each time.
- Waiting on Eric now: #538 Squads (merging on green), #537 Boingo stills, the settings mockup, Smudgy pilot stills (coming),
  the ledger backfill run (admin).
- **Eric, Nov 7 ~00:45 (QUEUED, after the current queue): town AFK.** Today the town only pauses drawing while the tab is hidden and
  resumes on return; nobody is removed. Proposal sent: hidden 10 min, or visible with no input 15 min → your pawn leaves the town for
  everyone (server presence), and on return you land on the home page with a small "You were away" note. Numbers in settings.ts.
  **Eric's call (Nov 7):** after a few min idle (3 min) a "zzz" floats over the pawn (no text box; others see it too). Boot at 10 min
  of either: no movement while visible, OR in the background. Then: pawn leaves for everyone; on return, home page + "You were away".
- Nov 7 ~02:00: Eric OK'd Boingo (#537, MERGED fae97429) and Smudgy/sprite kit (#539: main merged in, CI rerun, merge on green).
  Item ledger backfill SHELVED by Eric ("will pick that up another day"): don't list it as waiting.
- **Nov 7 ~03:00, Eric on #542 town AFK:** keep the shared town (real players see each other). zzz at 60 s idle; boot at 5 min
  idle or hidden, with a pop-up "You've been dropped from the town". NEW: guests get 30 s in the town, then a pop-up "Make an
  account to keep exploring · It's free" (sign-up). Sent to the AFK helper (same PR). Smudgy (#539) LIVE 8038b612.
- **Eric, Nov 7 ~04:20 (screenshots):**
  1. Big Boy's shirt text is mirrored (and hands look wrong) where he's drawn flipped (his room). Make him face the right way; text never mirrored.
  2. Boss-battle side figures unequal: Babur (SIDE_FEEL.keep ["tiger"], his pump) stays at the old 2 px size and the pawn + God King
     follow the boss's size, so his fight's figures are small while Big Boy's are big. Eric: one size for all, about 15% smaller than
     today's large ones; the pawn and King the same in every fight. (Root cause: the Nov 4 bigger-figures change exempted Babur.)
  3. Street town lamps stand in front of boss homes' fronts: move them (Haiku, claude/street-lamps).
  4. LATER (mental note, with the 3D/sprite work): boss homes are bunched; spread them evenly across the town.
  Plan: 3 now (Haiku); 1+2 the next Opus after intros as data.
  Eric on Babur (Nov 7): make him the new default size on the computer; his pump stands in front of him, slightly overlapping
  (him behind it by ~10 px), scooted toward him, so it no longer pushes the board smaller.
- **Nov 7 ~07:10 UTC: queue cleared.** Merged and live today: #537 Boingo, #538/#540 Squads 3 boards + turn order, #539 Smudgy on
  the sprite kit, #541 Scramble Rush warning + cap, #542 town AFK + shared town + guests, #543 walkthrough v2 (?tour=1), #544 intros
  as data, #545 lamps off boss fronts, #546 one side size + Babur pump in front + Big Boy unmirrored. Shelved by Eric: ledger
  backfill. Waiting on Eric: the settings mockup. Later (Eric's notes): spread boss homes across the town; other bosses face away from
  the board on the board screen (Babur, Moo, Sawyer, Wrangler, Chub & Chirp, Puddles, Alfil, Folio) until each moves to the kit.
- **Eric, Nov 7 ~07:30: chat + right column redesign (MOCKUP SENT, waiting on his OK):** free-typed chat (filter, report, age gate
  exist), quick chat/emoji kept behind a flag (easy flip back), chat OFF by default with an opt-in notice, custom Twitch-style emoji
  (placeholder set). Global chat hard cap ~5 msg/s server-wide with a backlog (a message may show ~10 s late). Computer right column:
  no top-right avatar, no "Playing now", chat fixed in the same place on every screen and mode (nothing shifts; the Lobby/Yours
  height jump goes away with quick chat). Town on computer: no "‹ Town…" header; a TOWN row with map / town chat / gear in the
  column's fixed top slot. Open: the 1v1 view hides global chat (check why; a match chat tab in the same box?).
  Mockup: scratchpad/chatmock/p1-p3.png.
- **Nov 7 ~08:30:** Eric APPROVED right-column mockup v5. Running: Opus "typed chat + right column" (brief-chat-column.md,
  claude/chat-column, 8996); Haiku "compact walkthrough box" (claude/walkthrough-compact, 8995; mock t1 sent); Haiku "leave Chess
  Town? confirm" (claude/leave-town-confirm, 8997).
  QUEUED after chat-column + compact box land: **town intro** (first visit, compact box): slide 1 "Welcome to Chess Town": explore
  the town; one line each on the Colosseum, the park, the boss houses; the town is still under construction; the Handbook explains
  more. Slide 2: lights the TOWN tools (map on/off, town chat on/off or fade, settings gear). "Tap anywhere to continue". Computer
  and phone (phone: its header icons).
- OPEN BUG (recurring): e2e/town-controls.spec.ts:163 "hold to run" (phone) — "right runs you 1,0" got -1,0. Seen on #545's CI
  (both tries), locally on #545's old base (even with main's lamp plan), and twice in combined runs by the leave-confirm helper; passes
  alone. Root-cause it (not a flake): next free helper slot.
- **Nov 7 ~19:45: main 83aa78f5 (#548 leave confirm) e2e RED** (all intermittent-looking, both tries failed):
  boss-challenge.spec:1135 Timber card tap (phone; also seen on #541's CI: recurring), squads-watch:167 (phone), squads-three-boards:152
  (desktop); flaky: dash.spec:241 Scramble Rush 4 of 6 (both projects), town-leave:143 (phone). #549 (hold-to-run test fix) merged
  after it (1f57f9af); waiting on its main run to see which repeat. Then root-cause each (helpers).
- **Eric, Nov 7 ~20:00: Auto chess redesign (MOCKUP SENT, waiting on OK):** computer left menu shifts on /autochess (left and right
  columns must never move: find why). New look (gold/black/white, gold frame, our real square board): both players top right;
  benches vertical beside the board (ours from our corner upward, theirs kitty-corner downward); no green timer bars; the timer is the
  whole middle HUD piece; "Round N" + big phase (PLANNING / FIGHT) top left; "Income +N" opens a breakdown (base, interest, streak,
  round). Phone version too. Assets: notes/briefs/assets/autochess-*.
- Main 1f57f9af (#549) e2e GREEN: the 83aa78f5 failures were intermittent. Root-causing anyway, in order: Timber card tap (recurring,
  Haiku now: claude/fix-timber-tap), then squads-watch:167, squads-three-boards:152, dash.spec:241 (flaky), town-leave:143 (flaky).
- Auto chess mockup v3 sent (square thin double borders, hex border, line work, players top-left with big pawns + HP/XP like today,
  gear top-right, no title/back for now). Waiting on Eric's go.
- Eric APPROVED auto chess redesign (brief-autochess-redesign.md). QUEUED as the next Opus job after typed chat + right column.
- **Eric, Nov 7 ~20:30:**
  - Haiku NOW: boss result screen (no record text, no trophy/skull, styled Victory/Defeat, your pawn beside the God King, 2+ win and
    2+ loss lines per boss) + each boss's goodbye line when you return to town (claude/result-screen, 9001).
  - Haiku NOW: Dash clock: multi-hit (~5 smacks) every 4–5 of his moves with a line each time; once per game a "pop off" beat
    (a few hits, line, 10 fast hits, "love my clock" line); 8–12 new clock lines (claude/dash-clock, 9002).
  - LATER: Dash's clock as a legendary item.
  - Opus QUEUE (before the auto chess redesign): Smudgy's ult announced "next turn" (~turn 6-7) but never fired: find what blocks it and
    guarantee it fires once a game even in an odd position. Also look into whether our own engine lets Smudgy really paint a piece
    (e.g. pawn → rook swap, the back-rank case) instead of today's workaround, and what that costs (Maia can't); report, don't build.
- **#550 typed chat + right column (computer)**: PR open, full-e2e, CI running (head b3c7cb25). Merge when green.
  Follow-up (same Opus, claude/typed-chat-2, /home/user/cr-chat2): typed chat in match + lobby chat and on phone (brief required it).
  Opus queue after that: Smudgy ult fix + engine paint report, then auto chess redesign.
- **Eric OK'd #550 to merge** (merge when CI green).
- Haiku NOW: Locker default pawn (claude/locker-default, 9003, xhigh: stored pref): no "Shop" title, preview box 2× tall, one pawn,
  W/B toggle in a thin rounded square bottom-right + gray "default"; saved per account (device for guests); applies in town, home,
  locker, profile (never in matches). Other pawn colors: Eric said stick to white and black.
- Haiku NOW: home card taps (claude/home-name-tap, 9004): icon → icon editor; name → your public profile; rest of card inert.
- Nov 8 00:45: **#552 home card taps LIVE** (d7325418). #553 Dash clock: sent back (love line never shows; move list shows his move early).
  #551 result screen: sent back (bubble off the right edge on phone; Last Stand stills). #550: fixing desktop specs (room Back bar,
  "Your profile" avatar) + merging main (#552). IDEAS: Dash's clock as a legendary item.
