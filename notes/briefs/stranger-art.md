# The Stranger (working name; Eric will name him "___ Stranger"): his art (Eric, Nov 27, ~01:35 UTC)

Eric's words (dictated): "this one's going to be a human, think like Sephiroth style with that sort of like look... he's sort of
like the anti-king... a more anime, like, you know, traditional kind of boss, like think like Fire Emblem look... no IP stealing here...
it's just your generic looking [style]... He has a aura... give him the fire and ice crown... he wears one, but it won't look like the
one that your guy wears. This will be like a better drawn one... give him a fire sword and then an ice sword... when he stands there
during the game... some sword, like a double slash with both of them. He puts his swords behind him in like an X formation, like on his
back, and then pulls them out, and then he like keeps them put away most of the time though, and then he'll like pull them out
sometimes before he uses a move... that long kind of draped down, like to his sides, like white hair, the swords. And then I would say
he has like that trench coat style jacket, like almost like the one that we had originally used for the hidden boss. We may even be
able to just reuse that... he wears the crown." One of his moves: "he puts both of the tips of his swords like together, and he does
like a dual fire and ice move... it hits a square, freezes your piece... that tile... burns". "No API drawer for this one": drawn in
code, the way our pixel bosses are, no image-generation service.

Generic, never a copy: an original anime/JRPG swordsman. Long white hair draped to his sides; a long trench coat (reuse or adapt the
Hidden Boss's earliest coat drawing if it fits: find it in git history / his kit); NOT a known character's exact outfit (no black
leather coat with silver pauldrons, no single long katana). Two swords, one fire (warm reds, orange, ember glow), one ice (pale cyan,
white, frost); a better-drawn Fire & Ice crown (the player's item is `fire-ice-crown` in packages/core/src/crates.ts: his is his own,
grander drawing in the same idea); a soft two-tone aura (fire one side, ice the other), cheap to draw.

Code id: `stranger` (rename later is one string). Deliver, in the characters lane's usual form (look at how a recent boss is built:
Chandy or Birdie):
- His figure for the boss bar / beside the board, the size and frame of the other bosses, with animations: idle (swords crossed in an
  X on his back, hair and coat moving a little, the aura), draw (pulls both swords from his back), sheathe, a double slash (his move),
  the twin-tip cast (both sword tips together, fire and ice meeting: the move's wind-up), hit, rattled, defeat, win. Swords away most
  of the time; drawn before a cast.
- His portrait (picker card, banners) and his locked look (the picker shows him before he's unlocked: a silhouette or darkened card,
  whatever the app's locked style is; the rules helper wires the lock).
- The move's board effect art: a square struck by fire and ice (an ice block over the piece, then a burning tile). Drawn, not wired.
- His theme colors and a short placeholder line set (lines file) and sounds pack, as the other bosses have.
Not in this job: his rules, powers, unlock, tower placement (another helper). Wire only to generic boss events.
