# The Stranger's ultimate: Storm of Two Worlds (Eric, Nov 27 ~05:30-05:50 UTC)

Read `notes/briefs/rules-common.md` first. Starts after #1000 (rules) and the swords round merge. Branch `claude/stranger-ult` from main.
Lane: god-king (boss powers: rules, server, protocol) + the effect. Effort xhigh (rules, engine checks, online sync). Opus. Boss lane,
plus the engine piece. It replaces the `strangerult` placeholder; then take him out of `BOSS_ADMIN_FIRST` (he goes live) and remove
boss-smoke.spec's skip for him (9e59c8c3), so he gets the smoke as every boss.

Eric's words: "he shrouds around the board... as much of the screen that belongs to the game becomes like this fire and ice storm around
the board, and it even can kind of move onto the board a little bit. It's like a circle kind of formation... every turn it toggles between
scattering spots on the board where anything that's left there will freeze or burn... use the same freeze and burn properties we've
already built... it'll only target... it won't ever put 2 burn spots on 2 pieces with heavy material... it kind of forces you to find a
good move that does exist... before each turn... the engine should calculate... so you always have a good move, but you only have 1 or 2."
Then (~05:50): "He can use it up to 2 times a game... if you play it correctly, you lose like a pawn at most of value each time. But
really, if you just play it well... you lose nothing... It should come out to about 2 times a game, like 70% of the time. And sometimes he
starts with fire, sometimes he starts with ice."

The design (the director's, Eric: "I'll just trust you to kind of build it"); every number in settings.ts:
- **Up to 2 a game.** His meter tuned so about 70% of games see both (one sim run at one setting to check; report the share).
- **3 of your turns**, alternating, starting with Fire or Ice at random (the seed: solo and online the same).
- **Ice turn:** before your move the engine finds your best moves; all your pieces but 2 are frozen for that turn (Frostfire's freeze,
  the king never frozen, never no legal move). One of the 2 free pieces always holds the engine's best move.
- **Fire turn:** 3-4 marked squares; after your move, whatever stands on one burns, his pieces too (Frostfire's burn and its guards).
  At most one mark on a piece of yours worth more than a pawn; the rest on pawns or empty squares.
- **The fairness promise:** before freezes/marks are placed, the engine checks the choice: your best reply loses nothing against the
  position without the storm (within a small margin), and a decent move (2nd/3rd best) loses at most about a pawn. If not, pick again
  (bounded tries, then a milder pick: fewer marks / a third free piece). Engine work follows the computing priorities (devices first,
  the server when needed; the same answer solo and online, as Frostfire's pick).
- **The look:** a ring of fire and ice swirling round the board (the game area around it), creeping a little onto the edge squares;
  his line and banner; the freezes reuse Ginger's ice, the marks and burns Grex's fire tile. Simple beats flashy: least code, no lag on a
  phone (frames:boss with real taps).
- Judge and fair play: the storm's turns are power turns (no fair-play signal, no Last Stand), as Frostfire's.
Tests: the boss kit, unit tests for the picks and the fairness check, his e2e (an ult with both kinds of turn), boss-smoke with him.
Stills on `stills/stranger-ult`. `.pr-body.md` at most 40 lines, then `.done`.

**Also in this PR (#1000's delta re-review leftovers: `REVIEW-2.md` on `claude/stranger-rules-review`):**
- SF1: pin the party plan pool (`squads-do.ts` `towerPoolNow`): in `tower-party-do.test.ts`, without TEST_SWITCHES a party regrouping on
  a copy dealt `["stranger"]` on floor 10 is re-dealt without him; with it, he stays. (Moot once he's live, but keep the test honest:
  write it for whatever admins-first boss the roster has, or for the live rule.)
- SF2: pin the burn's `handed` guard (`chess/src/bosses/stranger.ts` ~:124): `frostfireOutcome("4k3/8/8/8/8/8/3p4/K2N4 b - - 0 1", "d1")`
  is `spared: true`.
- N-a/N-b: remove boss-smoke.spec's `powersOf` helper and his skip (he gets the smoke); update `chess/test/stranger.test.ts`'s
  "a placeholder that never fires". N-c: trim `docs/decisions/2026-11-27-stranger-unlock-win.md` to about 120 words.

**The ult's opening scene (Eric, Nov 27 ~05:55 UTC; animation only, the rules above are unchanged):** "he jumps onto the center of the
board, takes both of his swords out, and slams them both into the chessboard, giving almost like a cracking animation... when he jumps
in the middle of the board, any pieces that are there get, like, pushed a little bit out of the way, and then when he takes both of his
swords out, and then one at a time just... crushes them down into the board... digs them into the board, and then they start pulsating
out, like, their respective color in like a ripple effect. And as that's happening, like, a swirl is beginning around the board and
starts to gather, and then he grabs both of the swords and... grips them, and then... he has like a red and blue aura around him now,
and then it starts charging... more crazy, the animation, everything, and then until the full swirl starts, and it's, like, chaotic
basically, and then he pulls them out, and then the board's still cracked at this point, and then when he jumps back, we can, like,
restore the board and kind of return to the actual way the game looked, and the pieces move back to where they were."
- The director's reading: (1) leap to the board's middle, pieces there nudged aside (drawn only; the position never changes);
  (2) fire sword then ice sword driven in one at a time, the board cracking round each; (3) each pulses its color outward in ripples
  while the storm begins to gather round the board; (4) he grips both hilts, a red-and-blue aura, the charge builds faster and wilder
  until the full, chaotic swirl; (5) he pulls them out (board still cracked), leaps back to his place; the cracks heal, the nudged
  pieces slide back to their squares, the board looks as it did; the storm ring keeps circling for its 3 turns, then clears.
- **10-12 s from the moment he jumps down** (Eric, ~06:00: "10 to 12 seconds is actually a pretty good time for these kind of things. It
  ends up being way too quick if it's shorter than that."), the same timing solo and online (a moment the runner holds, as other bosses' ults), phone frame rate checked with
  real taps, every frame whole on screen. Reuse: his `draw`/`strike`/`castFull` poses and aura, the board-crack/ripple as one
  overlay effect; simple beats flashy.
