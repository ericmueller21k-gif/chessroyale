# Timber's challenge intro (Nov 3, 2026)

Eric's design (the art branch's `scripts/boss-art/out/intro-timber-nov3.md`): "When he walks in, to the left there's a giant thick
wooden log. He picks it up and walks it over… sets it in the middle where the chessboard goes. Then he starts gnawing at it… a big
storm of wood shavings and sawdust comes up like a fog, then it falls and dissipates, and you see he's chewed it into a board (the
table with the board). The seats are little wooden stumps." Boss on the left, you on the right, about 12 s, his own sounds. He approved
the art's mockup (`house-intro-timber/view-intro-sequence.gif`). Built as Alfil's and Big Boy's: `BOSS_INTROS.timber` is `custom`,
its art a chunk of its own, every beat a number in `CHALLENGE_FEEL` (`log`) or the art's frames. Area page: `docs/areas/town-square.md`,
"Challenging a boss".

## The calls

- **Where his moves live.** The art's `BOSS_BEAVER_INTRO` is built from Timber's rig (timber.ts's parts, poses and specks). Appending it
  to `characters/timber.ts` would build its 37 frames in every town and battle that loads him. It is in `characters/timber-intro.ts`
  instead (the art's added lines as drawn; timber.ts exports the rig's pieces it uses, and gained the art's cheek `puff` lines, which
  change nothing when it's 0), re-exported by `shops/timber-intro-art.ts`, so it loads only when you challenge him.
- **The fog's load time.** As copied, the props chunk took about 2 s on a computer and over 8 s at a phone's speed (4x CPU throttling)
  to build, almost all of it the shavings' fog (each pixel worked out its frame's dome again and measured every billow). The app's copy
  works the dome out once a frame and looks at a billow's box before its distance: the very same pixels (a unit test keeps a hash of
  every fog frame), and the chunk now loads as fast as Alfil's (about 1 s, 3 s throttled). Eric's "less lag over all else".
- **The timeline** (about 12.1 s from the marks to the sweep, 12.7 s to covered: the notes' suggested 12.6 s). His line is said on his
  mark, alone for `lineLeadMs` (0.8 s, the notes' "about 0.8"), then he sets off for the log while the bubble stays its usual 2.5 s
  over his head (a line stays as long as it takes to read: LESSONS). Walks and the carry go by distance (`walkMs`, `carryMs` a square:
  close to the mockup's pace, the carry slower and strained). The fog holds `holdMs` (0.96 s, its loop twice: the notes' "about 1.0").
  No table beat on its own before the attack: he's walking away from the table to his place, which shows it.
- **The log's place.** `log.at`, 3.3 squares west of the table's middle (1.8 past his mark): far enough that it reads as "to the left"
  and not under his feet as you walk in, still on his circle and in view on a phone. It lies on his row (he walks straight to it); his
  art lifts it from under his feet (`TIMBER_INTRO_LIFT_AT`), so he stops on its middle.
- **Scale.** His moves and the log are drawn at his town size (the log in his paws is part of his frames, so the log on the floor and
  on the table's place must match it); the fog, his table and the stumps at the room's (the park table's) size, as the art made them
  around `PARK_TABLE`'s geometry.
- **The stumps pop after the fog settles**, not under its hold. The notes put the swap and the pop under the hold, but a pop under a
  solid fog can't be seen, and Eric's "(they pop up)" is something to see. The table swaps in under the hold (never seen before it);
  the stumps come up out of the floor once it has settled (`pop`, a knock), and you hop back clear of yours as they do (as for every
  boss's stools). Then he dusts off his paws (`done`) and walks to his place.
- **His place to swing**: `log.clear`, 2.7 squares west of the table's middle (the others' `clear.boss` is 2.6). His stump's roots
  spread wider than a stool, and at 2.6 his attack's feet came within the gap the "clear of the stools" test keeps (Eric, Nov 2:
  "make sure they're not standing where the chair blocks are"). Every other boss's place is unchanged (`marksFeel`).
- **Draw order.** The fog is drawn over him and the table's place (it hides the swap); you're drawn in front of it (a hair nearer
  than the table's row in a challenge: you're the player, and its edge reaches your mark). The log he sets down is drawn
  behind him (the notes), the ring of shavings at the floor under everyone.
- **Sounds.** Every cue on his frames and the props' maps to one of his own sounds (`characters/timber-sounds.ts`): hup, thump, gnaw,
  chomp, clatter, saw, slide, knock, pat, chitter, and his swoosh for the sweep. While he gnaws, his teeth's cues sound (one a bite),
  not the log's own gnaw/chomp cues as well (that would be two sounds a bite, out of step).
- **Admins first.** Timber is in the game for admins first, so only an admin's town has his lodge to challenge him in; nothing changes
  for players, and onlookers see what they see for every boss's challenge (you both go inside).
