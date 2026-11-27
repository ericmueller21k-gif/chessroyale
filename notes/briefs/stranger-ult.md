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
