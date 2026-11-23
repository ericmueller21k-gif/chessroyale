# Battle Tower specs: phone only, except the computer layout (2026-11-23)

- **Eric's words:** the sweep's N4: the Battle Tower spec is the slowest in the suite, and its desktop run repeats the phone's flows.
- **Change:** the tower's logic and flow tests now carry `@phone-only` (8 in `battle-tower.spec.ts`, 1 in `tower-party.spec.ts`), so they run on the phone alone, as `@phone-only` tests do elsewhere.
- **Still on desktop (5):** the tests that check the computer layout: a shared floor of Babur and Wrangler (471), Puddles and Babur (568), a shared floor's moments and no scrolling at computer sizes (625), the split bar as an accordion with the floor title over the right column (723), and Moo & Moon's Full Moon in the split bar beside the board (959).
- **Call made:** a test that reads `project.name` to assert a computer-only position stays on both projects. The moment-by-moment flows that merely read the desktop name for a still's file name were tagged.
