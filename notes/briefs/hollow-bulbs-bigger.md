# Hollow's two strands of bulbs in his boss card: bigger, and the small one six bulbs counting every move (Nov 12)
You are a helper for HunChess (repo ericmueller21k-gif/chessroyale), the characters lane. Effort: high (pixel art, its animation, and
the strip's count). Read CLAUDE.md, .claude/LESSONS.md, docs/rules/eric.md (Hollow's section: its guard tests are about the rules of the
ten bulbs; don't edit a guard test without saying so: stop and report if one must change), docs/areas/bosses.md (Hollow),
docs/decisions/2026-11-05-hollow-bulbs.md. Code: packages/app/src/components/Hollow.tsx (`lifeStrip` = your ten bulbs, BossUi.barProp;
`bulbStrip` = his small strand, BossUi.bar), the effects `lifeStrand` and `bulbStrand` (their drawings: find them under
packages/app/src/characters/), the boss card's CSS in styles.css; settings `darkEvery` 3, `darkBulbs` 10 (packages/core/src/settings.ts).

Eric approved mockups (branch claude/director-notes, notes/mockups/2026-11-12-bulbs-v2-computer-1536.png and
2026-11-12-bulbs-v2-phone-428.png; the first round, too big: 2026-11-12-bulbs-*.png). His words, Nov 12: "The 10 hollow bulbs need to
be way bigger"; on v2: "I like the size on [the phone v2]... and the size on [the computer v2]... put them on the desktop, shove it to
the right again, and just keep it that same size... mobile seems fine too... make it six bulbs. And then put them underneath the bar,
and then make it our moves count as well. So then each one of those goes out every turn... easier to see those bulbs going out."

## 1. Your ten bulbs (Boss alone), bigger
- Computer: about 1.8x today's size (the strand about 200 px long at 1536 x 864, today 110), right-aligned where it is today (under
  "Move N / N moves left"), same height place. Phone: about 1.2x (about 111 px at 428 x 746, today 95), where it is today.
- Redraw it crisp at the new size (not a blurry stretch): the wire continuous between bulbs, each bulb's fizz going out as today.
  Size it from the card's room (container) so it never overlaps the name, level, "moves left" or the edge, at 360 to 430 px phones and
  1280 to 2560 px computers.

## 2. His small strand: six bulbs, one out per move (yours and his), the full width of his bar
- Today: 3 bulbs under his level bar, one out per HIS move; at the last he covers a square and they relight (darkEvery 3: he covers
  after his 1st move, then his 4th, 7th, 10th...). Make it 6 bulbs, one going out on every move, yours and his: between two covers
  there are 3 of his moves and 3 of yours, so the cadence and the rule stay exactly the same (darkEvery stays 3; no rule change, no sim).
  Work out the start (before his first cover) so the count is always true; say what you chose.
- Its width: the full width of his bar above it (his level / rage bar under "LVL"), on phone and computer; bulbs as big as that allows.
- Online and in raids the same strand shows as it does today (it's the 10-bulb strand that's Boss-alone only); check the crowd's turns
  count as "your" move there too.

## Tests (targeted lane, boss presentation)
Unit: the strip's count per move (6 lit at a cover; one out per move; relit as the cover lands), at least the cases today's tests cover.
e2e: update e2e/hollow.spec.ts's strip checks to six (list old -> new); one focused check that the ten-bulb strand is at least 1.6x
today's width on a computer and right-aligned in the card, and the six-strand as wide as the bar (within 2 px). Run hollow.spec.ts both
projects and the boss kit (packages/chess/test/boss-kit.test.ts); typecheck. Watch it frame by frame with real taps (`npm run
frames:boss`, LESSONS.md): a bulb going out on your move and on his, the relight. If Playwright looks for
chromium_headless_shell-1194: `mkdir -p /opt/pw-browsers/chromium_headless_shell-1194 && ln -sfn /opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64 /opt/pw-browsers/chromium_headless_shell-1194/chrome-linux && ln -sfn chrome-headless-shell /opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/headless_shell`.
Stills (one set, at the end) on branch stills/hollow-bulbs (never commit images under docs/: check.yml fails the PR): phone 428 x 746
first, then 360 x 640, computer 1536 x 864 and 1920 x 1080, each the boss card in Boss alone mid-battle with a few bulbs out.
Aim for about an hour and a half.

Branch claude/hollow-bulbs-big from origin/main; push at each real step. A ~5-line decision note docs/decisions/2026-11-12-hollow-bulbs-big.md;
update docs/areas/bosses.md. When done: push .pr-body.md (what changed, player-visible, changed checks old -> new, tests run), then .done
last. Don't open a PR or wait on CI. American English. Never include model names in commits.
