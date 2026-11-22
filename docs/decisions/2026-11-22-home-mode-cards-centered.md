# Home: Boss Battle and Auto chess cards centered (Nov 22)

**Eric, Nov 22:** "let's just center the whole thing a bit more … the text should also … be center aligned … bring everything more to the right."

**What changed:** on home's two "Other modes" half cards, the picture and the words now sit centered as one block (`justify-content: center`), and the title and the line under it are center-aligned (`text-align: center`). Phone and computer alike. Size and place of the cards are unchanged; no other home element moved.

**Call made:** the text-align rule is scoped to `.fd-root .rd-pair .rd-card.rd-half`, the same selector the card's size rules use, so no other card is affected.

**Checks:** `e2e/home-layout.spec.ts` passes on phone and desktop (15 and 14 tests); no check changed.
