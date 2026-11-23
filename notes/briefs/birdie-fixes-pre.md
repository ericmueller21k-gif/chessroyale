# Items for Birdie's fix round (#896), collected by the director before the review lands
1. CI, PR #896 at 3f79d78, `[phone] e2e/town-street.spec.ts:489` "the town's first frame doesn't wait for the music … each piece,
   once": the expected list has `/music/birdie-loop.mp3` twice (it's both `birdie`'s loop and `birdie-ult`'s loop: the first theme
   file shared by two entries), while the app fetched it once (right). The expected list must dedupe files. Also in that run the app
   fetched `/music/town-solo-a.mp3` twice: find out whether that's a real double fetch (on main too? a race in `preloadMusic` /
   `townMusic`) and fix it at the cause if so. Run 45122090682, job 137518290983.
2. The crossing warning is drawn OVER the marked piece (stills/birdie-build `birdie/phone-warning.png`: the knight on a3 half hidden
   by the crossbuck). The brief asked for it under the piece: the crossing belongs on the board layer under pieces (as Big Boy's tower
   marks and Grex's fire tiles), never over them.
