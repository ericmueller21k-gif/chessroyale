# Director status: the current state only (keep under ~40 lines; old entries go to CHANGELOG.md). Rules: RULES.md.

## Live on main (green, 6de72a2, Nov 2 10:14 UTC)
Nov 1 work plus Nov 2: #456 auto chess reveal, #457 brush ink, #458 shops r1 (Babur, Puddles; buy = Coming soon), #459 Timber
sounds, #460 ride into shops + Timber 2 Gnaws + 🐟 Stockfish + no King praise moves 1-10, #461 boss picker 2 rows on computer, #462 boss tokens + keys + boss crate buying.

## Running
- PR #458 shop interiors r1 (CI watcher). Next: round 2 at xhigh (tokens + purchase).
- PR #463 Colosseum new GBA set as Pixel + Colosseum's own Animations (off): CI watcher.
- PR #464 50 v 50 bot spread + top-3 draw (full-e2e; CI watcher).
- One Opus (high): Nov 2 bug fixes batch B (cr-fixb, claude/nov2-fixes-b, brief notes/briefs/brief-nov2-bugfixes-b.md).
- #463 Colosseum pieces merged but NOT live: hunchess.com serves the 10:14 build from Cloudflare's cache (HIT, query ignored) though CF deployed 4fac91ad at 16:15. Asked Eric to purge / check cache rules.
- API art: Colosseum GBA pixel pieces (session_01JuCWRvpifUHBYDWXqYcDtk; asks Eric once, ~$3-6, cap $8).
- One Opus: test-value changes (worktree /home/user/cr-testvalue, branch claude/test-value, brief
  notes/briefs/testvalue-changes.md): flakes first, then speed, formats→crowd-hidden merge, CI selection.
- API art sessions (outside the one-Opus rule, Eric): circus interior (session_01JuCWRrhykEFvvmv5JKWgRX, ~$4-7, cap $10);
  boss tokens for the other 14 (session_01JuCWRuuJUf92wTLxwR6d8N,
  branch claude/boss-art; asks Eric once, ~$4-6, cap $8).

## Queue (one Opus at a time)
0b. Later (after Alfil art): boss challenge from town (code).
- Art session (session_01JuCWRrhykEFvvmv5JKWgRX) = expert for all boss homes + battle intros (API only): Alfil's home now,
  then Alfil's intro (sand pyramid, table, sandstorm).
- Gemini Part D (challenge lines) prompt: scratchpad lines/hunchess-boss-challenge-lines-for-gemini.txt, sent to Eric.
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
