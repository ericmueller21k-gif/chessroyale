# Brief: Big Boy's home + custom intro, and Timber's God King attack

Worktree `/home/user/cr-bigboy`, branch `claude/bigboy-home`, from `claude/boss-challenge` (PR #466, not merged yet: merge main in
when it lands, never rebase). Opus high. Push as you go.

Art on `origin/claude/boss-art` (read with git show; copy into the app as the other shops did):
- **Big Boy's shop:** `scripts/boss-art/out/shop-bigboy-nov2.md` (+ its house-shop-bigboy folder). Notes: its circle's start marks
  are drawn N/S (drawn before Eric's left/right note); turn them to W/E in the layout as round 2 did for Alfil and Puddles. The pit
  squares are solid (you walk on the walkway, platform and circle). The airplane is a deep but UPRIGHT piece (`d: 3`): don't lay it
  flat. Make it a shop like the others (Go in, Shopkeeper = his kid's sprite, "Big Boy's Boss Crate" with his ride first, chat tone).
- **Big Boy's custom intro:** `scripts/boss-art/out/intro-bigboy-nov2.md`: same structure as Alfil's (blocks build / plop / chairs,
  TABLE_PALETTE, SWIRL + SWIRL_FRONT played like the sandstorm). Wire it as a custom intro in `BOSS_INTROS` (layout "across"), with
  the God King attack swing before the cover as for Alfil. Placeholder line until Gemini's: one in his voice (a baby; list it).
- **Timber's God King attack:** `scripts/boss-art/out/timber-king-attack-nov2.md`, `BOSS_BEAVER_ATTACK` in
  `scripts/boss-art/out/boss-beaver/boss-beaver.ts` (only lines added). Kit: `perSquare 40`, `stand 1.15`, `facesLeft true`; the cue
  → his timber-sounds map and the suggested wood-chip hit item are in the notes. Add "timber" to `KING_ATTACKERS` (boss-timing.ts).
  Check it plays in a boss battle (his strike on the God King) and in nothing that breaks his 2-Gnaw cap.

Rules: phone first; lazy-loaded art; the town's frame loop unchanged; list every player-visible text; changed checks old → new.
Done: unit tests (Big Boy's room walkable squares, his intro timeline, Timber's kit has a kingAttack with sounds for every cue);
e2e: extend `e2e/boss-challenge.spec.ts` with Big Boy's challenge, and the boss-dock/king-attack spec that covers attackers with
Timber. Stills: Big Boy's room at the counter and at the table; a GIF of his intro; a GIF of Timber's attack in a battle. PR-body
file `docs/bigboy-home/pr-body.md`. Push; no PR.
