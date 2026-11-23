# Dash's challenge intro (round 3)

Date: Nov 5, 2026. Lane: the boss lane.

**Eric (Nov 5):** "I just played Dash and he didn't even do the dash stuff, it was the default thing. He's supposed to run and grab
the board etc." His design (Nov 3): "u both walk up to the spots, then he suddenly bolts away leaving a train of dust and then comes
back very fast drops the board, then again runs off, comes back and suddenly the pieces are there, then again flies across and drops
off both chairs, then it starts." The table is "a stack of shoeboxes", and the screen cover is "numbers, clock/time themed".

**What's in:** the art of `claude/boss-art` at 90b3bd56 (Nov 3), copied as drawn: his moves (`characters/dash-intro.ts`, the
`BOSS_BLITZ_INTRO` section of `boss-blitz.ts`; the rig it shares is exported from `boss-blitz.ts`, which is otherwise unchanged) and the
props (`town/shops/blitz-intro-art.ts`, without the review sheet). Wired as Ginger's and Jefferson's are (`BOSS_INTROS.dash` `custom:
true`, `CHALLENGE_FEEL.blitz`, `blitzAnims` / `blitzTimes` / `blitzAt` / `blitzCues`, ShopRoom's `drawBlitzBoss` and `drawBlitzCenter`).

**Calls made:**
- **Where you stand.** You both walk on straight to where you stand through it all (`seated`, as Hollow and Wrangler): Dash at 2.08
  squares west of the table (`BossIntro.clear`), the art's `BLITZ_INTRO_DROP_AT` (72 of his pixels at his town size, 104 px for 3
  squares), so each toss is drawn from where the thing lands; you at the usual clear place (2.2). His try-on mats stay where they are
  (he stands just behind his). So nobody hops or steps after the stools land. His body near the floor is about 0.37 squares clear of his
  shoe-box stool (the unit check's gap is 0.1).
- **The timing, about 10 s from his line to the cover, not the art's 9.0.** His line 1.8 s (`blitz.lineMs`, as Hollow's short one;
  the art's mockup gave it 0.9); each dash is his bolt (420 ms), 200 ms out of sight (`awayMs`; the art's 330), his arrive (730) and
  80 ms standing (`holdMs`; the art's 120): 1.43 s, the art's 1.6 tightened; his brag (1030); then the attack's beat every boss has
  (1.4 s; the art's mockup had 0.7 of standing). 10.25 s from the marks to the cover starting. Every number is in `CHALLENGE_FEEL.blitz`.
- **No God King attack.** None was drawn for him (Nov 1, the art notes). He stands through its beat in his idle, as he did with the
  default intro. If one is drawn, his kit's `kingAttack` plays there with no other change.
- **The board falls on** from his second toss, the way Big Boy's does (`boardDropMs` 220 ms from `dropFrom` 2.5 squares), with a thud
  as it lands. The pieces show from the pop's own frame (the art's call). The slab is drawn only from the board's toss: before it, the
  top shoe box's own teal lid shows.
- **The dust trail** is drawn at his pixels, its foot at his spot, from the bolt's whoosh frame, under him. Its own whoosh cue is the
  bolt's (the same frame), so it plays once.
- **Sounds.** His own where they fit: `dashWhoosh` (bolt, arrive), `dashSqueak` (skid), `dashZip` (the toss), `dashDing` (the glint),
  `dashTick` (the rush's tick), `dashWhirr` (the rush coming in); the app's `pop` for the pieces. Two new synthesized ones: `dashThud`
  (a cardboard thump: the table, the board on it, the stools together) and `dashBrush` (his jacket dusted off), each about 4 dB under
  a move, finite at every rate (`boss-sounds-finite.test.ts`).
- **dashBy isn't used.** The bolt and the arrive carry the run off and back in their own frames, so the code never slides him.
- Known look: the bolt's last running frame (`dx` -100) runs past his 150 px frame's left edge, so its afterimage is cut straight for
  60 ms mid-run (the art's frame, unchanged).
