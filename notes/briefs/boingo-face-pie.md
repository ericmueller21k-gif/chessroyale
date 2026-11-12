# Boingo's pie, new: thrown in the face of one of your pieces, splitting onto the two squares diagonally behind it (Nov 12)
You are the god-king delegate for HunChess (repo ericmueller21k-gif/chessroyale; read .claude/agents/god-king.md and follow it). Effort:
xhigh (a boss power's rules, server, protocol and its moments). Boss lane: targeted + the boss kit + one quick review pass by a fresh helper
(the director runs it). Read CLAUDE.md, .claude/LESSONS.md, docs/rules/eric.md, docs/areas/bosses.md (Boingo, the pie; how freezes work:
Ginger's freeze, Folio's fold), packages/chess/src/bosses/boingo.ts, the pie settings (BOSS_POWERS.pie*, packages/core/src/settings.ts),
the app's pie art and moment (characters/clown.ts, characters/effects/, components for Boingo).

## Eric's words (Nov 12), with his sketch
Sketch: branch claude/director-notes, notes/mockups/2026-11-12-eric-boingo-pie-sketch.png (your white pawn; an arrow from his side into its
face; the pie on the square straight behind it; X on the squares diagonally behind it, left and right).
"Right now, when he just throws the pie, this has kind of gotten dated... I want him to now throw the pie... when one of your pieces is
hung like this, where there's nothing behind [it on] the two [squares] kitty corner to it, he throws the pie at the face of your piece.
And it kind of splashes on it... and then two pie pieces would like split off and hit those two that I marked X. And so he should be doing
that a good amount during the game... When he finds opportunities... they linger there for just I would say just one turn... I really just
want to get it built and we can fine tune it. It'll also make him a bit stronger since he was one of the weaker bosses."
His answers to the director's questions:
- The piece hit: "it's marked as splatted once, 2 splats on the same piece make it frozen for a turn, the way to mark it should be subtle."
- Which squares get pie (nobody may move onto them): "Only the two X's" (the two squares diagonally behind the piece, from your side:
  toward your own back rank).
- It **replaces** his old pie (an empty square near the center every pieEvery turns).

## What to build
- **Target:** one of the crowd's pieces whose two diagonal-behind squares are both on the board and both empty. Choose it to be a real
  nuisance (e.g. those squares are the piece's retreat or a defender's route), from the seed, never the same piece every time; say your rule.
  Kings: decide (a king can be splatted, but a freeze must never leave the crowd with no legal move or freeze a king in check; follow
  Ginger's freeze's guards). No target: no throw that turn.
- **The throw:** at the end of his turn (or where today's pie comes; keep the timing the screen already uses), as often as today's pie or a
  bit more ("a good amount"): start from `pieEvery` and say what you set. The two diagonal-behind squares are pied: nobody, either side, may
  move onto them, for `pieTurns` crowd turns: set 1 (Eric: "just one turn"). Never pie a square in a way that leaves either side no legal
  move; keep pieMax (pies on the board at once) in mind: now each throw makes two squares.
- **Splats:** the piece hit gets one splat mark (it follows the piece if it moves; captured, gone). A second splat on a piece already marked
  freezes it for 1 crowd turn (Ginger's freeze's rules and its guards), then its marks reset. The mark is subtle (a small cream smear on the
  piece, drawn with the piece; not a big icon).
- **On screen:** the pie flies from Boingo to the piece's face, splashes on it, and two pieces of pie split off and land on the two X
  squares (reuse today's pie art and splat sound where they fit: Simple beats flashy). The pied squares look like today's pie. The freeze
  looks like today's freeze. Banner and lines: keep today's pie banner/lines where they still read right; say what you changed. FAQ: his
  pie's text (packages/app/src/faq/content.ts) must match the new rule exactly.
- **Everywhere he plays:** solo, raids, online, the Crowd's boss final: the rule lives in the shared rules; the protocol's optional fields
  for pies and splats (don't change the protocol's core).
- Remove the old center pie (its chooser, settings no longer used, tests of it), keeping what the new one reuses.

## Tests and checks
Unit (packages/chess/test): the target rule (both diagonal-behind squares empty and on board; edge files; none: no throw), the two squares
pied and blocked for both sides for 1 crowd turn, a second splat freezing for 1 turn, the guards (no side left without a move; never a king
in check frozen), the mark following the piece. The boss kit (packages/chess/test/boss-kit.test.ts) green. e2e: update Boingo's spec
(find it in e2e/areas.json) for the new pie with the test switch `?power=pie`; list changed checks old -> new. One bot sim run at one
setting to see his strength before -> after (the boss sims in packages/sim; say which you used); no tuning marathons. Watch the throw frame by
frame with real taps (`npm run frames:boss`). If Playwright looks for chromium_headless_shell-1194, run:
`mkdir -p /opt/pw-browsers/chromium_headless_shell-1194 && ln -sfn /opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64 /opt/pw-browsers/chromium_headless_shell-1194/chrome-linux && ln -sfn chrome-headless-shell /opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/headless_shell`.
Stills (one set at the end) on branch stills/boingo-face-pie (never images under docs/: check.yml fails the PR): phone 428 x 746 first: the
throw mid-flight, the splash, the two pied squares, a splat mark, a freeze; then a computer. Aim for about two hours.

Branch claude/boingo-face-pie from origin/main; push at each real step. Decision note docs/decisions/2026-11-12-boingo-face-pie.md (Eric's
words, the rule, every call you made and why); update docs/areas/bosses.md. When done: push .pr-body.md (what changed, player-visible,
changed checks old -> new, tests and the sim's before -> after), then .done last. Don't open a PR or wait on CI. American English. Never
include model names in commits.
