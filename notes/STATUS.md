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
