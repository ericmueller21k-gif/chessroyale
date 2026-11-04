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
