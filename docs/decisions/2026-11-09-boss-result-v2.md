# Boss result v2: you vs. the boss, no God King (Nov 9, 2026)

Eric (Nov 9, brief `notes/briefs/brief-boss-result-v2.md`, approved): "get rid of the king in the victory and defeat screen
entirely … it always shows our pawn piece and the boss. And then if we lost, it shows him … attack animation on us." And: "remove
the 12 min, we dont want players to know they could just stall to get more XP."

What changed:
- A boss battle's result (victory, defeat, draw; alone or in a raid; after a Last Stand too) is one row (`components/ResultDuo.tsx`):
  the boss on the left (`BossCharacter`, place "results", his line in his bubble), your pawn on the right (`YourPawn`, your look),
  and under it your name, "+N XP", "Level N", the bar and its parts (`XpResult compact`). No `GodKingEpilogue` and no God King line
  there (it stays in `LastStand.tsx` for the dev preview). Other result screens keep the full XP box.
- A loss: his `kingAttack` (the attack the board plays at his mate) where he stands, from its landing to its laugh
  (`KING_ATTACK.landAt` to `leaveAt`, 1.9 s, 250 ms after the screen shows), his usual figure hidden meanwhile; your pawn jolts back
  and flashes at each lash (the king's jolt and flash at a mate, in CSS: `rd-knock`). Then his victory again. A win: his defeat as
  before. A draw: both stand.
- The XP parts never show the minutes (`xpShownParts` in core's xp.ts): only "Win +50" (or "Win (paid once today) +0"), and
  "Daily solo limit" as words alone (its number is time XP). The total still counts everything. The FAQ says "more for a longer
  game, plus a win bonus, at most N per game", with no minutes. The rules don't change.

Calls made:
- **The bar's length:** the approved mockup's (about 176 px, under the pawn), not #569's full-width box: a full-width bar can't sit
  under a pawn beside the boss on a phone.
- **The boss stands on your pawn's base line,** not at the bottom of your XP: at the bottom his attack crossed your name and XP.
- **The 16 px gap (Eric's rule, nothing touches) holds at rest** (before and after his attack, a win, a draw): every boss measured
  at 360 px with `scripts/frames-boss-result.mjs`, 20 px at worst (Smudgy), all inside the 16 px gutters (Folio, at 18 px, the
  closest). **His attack's blow lands on your pawn:** nearly every attack is built to reach its king (pies, ink, a lasso, a hose fly
  to it; Hollow's strand reaches 46 px into the pawn's box), and Eric asked for the attack "on us"; cutting the attacks 16 px short
  would show blows stopping in the air. The test checks the blow never passes your pawn. **Director: please confirm with Eric**
  that a blow landing on your pawn is fine under his rule; if not, the attack can be clipped 16 px short (`.rd-attack` clip-path).
- **His words start over him** (left-aligned, his tail over his middle), not centered on him: centered, a long line on the row's
  left would cross the left gutter.
- No "−N" numbers and no hit effects on the pawn: the board's hit effects are drawn on squares; the jolt and flash are enough
  (least code).
- At 320 px the XP column narrows to 160 px; there the widest bosses' figures (Folio) come within 16 px of the screen's edge.
