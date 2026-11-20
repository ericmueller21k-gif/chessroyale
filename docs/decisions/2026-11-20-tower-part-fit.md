# Tower bar: a part's words stay inside its outline (Nov 20, 2026)

- Eric's rule: everything in a card is centered, and nothing spills past its box. On a split floor, Puddles' row ("LVL 30", level bar, "Seeds 5", seed bar) crossed his part's yellow outline.
- Change (CSS only, `packages/app/src/tower.css`): a part's words are a centered column no wider than the part; the meters row centers and wraps, so a row too long for its part (Puddles') goes to a second centered line. A row that fits stays on one line, as before.
- Puddles' part is two lines tall on every floor it's on, fixed for the floor, so nothing shifts mid-game. Other bosses' rows fit one line and look as before, but their names and levels are now centered in their part.
- Test: "a shared floor of Puddles and Babur" in `e2e/battle-tower.spec.ts` checks every part's words sit inside its outline, within 1 px.
