# Power banners show your pawn; boss name + portrait for emoji; town cards centered

Branch `claude/banners-emoji-cards`. Lane: targeted (UI, layout and copy; no rules or numbers changed).

## Player-visible changes
- A power's banner (LONG PULL!, FREEZE!, FUNHOUSE!, LIGHTS OUT! and the rest) shows your own pawn on the right, not the God King. The God King keeps his banner for his save only. Phone and computer.
- The boss's name on a banner stays whole on one line (made smaller for a long name); the strip is taller (44%) so the name, the word and its line stack inside it.
- The status line says "[portrait] Wrangler plays d4" (was "🤠 Boss plays d4"). The strike, "You start a pawn down", "plays your move", result and move-list pictures use the same name plus portrait, not an emoji.
- Every town card's text is centered: the challenge card, the homes, the raid confirm and the shop's cards. A person's row keeps its layout.

## Changed checks (old → new)
- `e2e/smudgy.spec.ts`: the status-line checks `Boss plays <name>` / `Boss plays d6|d5|R` → `Smudgy plays …` (same checks, the boss's name in the line now).
- `e2e/boss-powers.spec.ts` (Freeze test): `banner(...).locator(".gk-portrait")` visible → `.kc-target.pc-pawn .avatar` visible and `.gk-portrait` count 0; added: the name's top inside the strip, the stack inside the strip, the name on one line.
- Added: `packages/app/test/banners.test.ts`: "Eric, Nov 5: a power's banner shows your pawn, never the God King" (3 checks: pawn not God King; LastStand keeps him, only PowerParts draws power banners; name fitted, strip 44%, nowrap) and "no emoji stands in for a boss in the boss screen's lines" (1 check).
- Added: `packages/app/test/town-card.test.ts`: "Eric, Nov 5: every town card's text centered" (2 checks).
- No check that guards a rule in `docs/rules/eric.md` was changed or removed; three rules were added there with these guards.

## Verified
- Typecheck; `banners.test.ts`, `town-card.test.ts` (unit).
- Local e2e (under the shared lock): Freeze test (boss-powers, phone), two Smudgy status tests (phone). Full suite not run here (CI).
- Stills: `docs/banners-emoji-cards/` (banner and status line, phone and computer; the challenge card, phone and computer).

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01EKH5j59nMnRVnekEcuZbim
