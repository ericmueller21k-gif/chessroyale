# Brief: power banners show your pawn, no boss emoji, centered town cards, names whole on banners (UI; Haiku)

Worktree `/home/user/cr-banners`, branch `claude/banners-emoji-cards`, from main (set up by the director, node_modules from npm ci).
Ports 8979, inspector 9479. Include notes/briefs/rules-common.md. Eric's screenshots (Nov 5, iPhone):
`notes/briefs/assets/nov5-4904bf87-image.png` (Wrangler's LONG PULL banner), `nov5-dabe79e7-image.jpg` (the town's challenge card),
`nov5-dc9360a7-image.jpg` (the status line "🤠 Boss plays d4").

## 1. Power banners: your pawn, never the God King (except his save)
The boss power banner (the slanted strip: the boss's portrait left, "LONG PULL! THREE SQUARES IN ONE MOVE" in the middle) shows the
**God King** on the right. Eric: "it never should show him except for when he saves you; every other banner should be your pawn
portrait". Show **your own pawn** there (as you look: your skin/hat/face items, the same drawing the game uses for you, e.g. the
profile or scoreboard portrait), on every boss's banners, phone and computer. Only the God King's own save moment keeps him.

## 2. A boss's name whole on his banner
"Wrangler" above LONG PULL is cut off by the banner's top edge. Check every boss's banner title (every power, phone 320/390/430 and
computer 1280/1440): the name and all text whole inside the strip. Fix the layout, not per boss.

## 3. No emoji standing in for a boss
The status line under the board says "🤠 Boss plays d4". Eric: "wtf is this cowboy emoji? Better not find random emojis in other
bosses, it should say Wrangler there or a small picture of him or both, not this default emoji." Make it **his name plus his small
portrait** (e.g. "[portrait] Wrangler plays d4"), for every boss; remove every emoji used as a boss's stand-in anywhere in boss
battles (status line, move list, results, toasts: grep the kits and screens for emoji). Players' own chosen chat emoji are not
affected.

## 4. Town cards' text centered, all of them
The challenge card ("Challenge Wrangler?", "You'll fight Wrangler in Boss Battle, then come back here.", Fight / Stay) is
left-aligned; the home cards ("Go in") are centered. Eric: "some in town are, some aren't". Center the text of every town card
(challenge confirm, homes, the raid-screen confirm, any other) the same way, phone and computer. Person cards (a bot's picture in a
row) stay as they are unless they look off.

## Rules (Eric, Nov 5): add to docs/rules/eric.md with guard checks
- Power banners show the player's own pawn; the God King appears on a banner only for his save.
- No emoji stands in for a boss or character in the game's own text; use the name and/or a small portrait.
- Town cards' text is centered.

## Done
Unit/e2e guards for the three rules (every boss's banner: your pawn, not the God King; the status line has the name, no emoji;
every town card's text centered) and the names whole on banners. Stills `docs/banners-emoji-cards/` (a few banners phone+computer,
the status line, the challenge card). PR body `docs/banners-emoji-cards/pr-body.md` (every player-visible change, changed checks
old → new, lane targeted). Push; no PR. Short report.
