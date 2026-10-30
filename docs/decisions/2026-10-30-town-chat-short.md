# The town's chat box on a computer: a third as tall (Oct 30)

- Eric (Oct 30, a screenshot at about 1885 px): "the chat is massive on desktop … it's so easy to click on it when running around, it should be 33% of what it is now, about 4-5 lines of text."
- Computer in the frame only (`.town-screen.in-frame`): the box is 500 × 120 (it was 500 × 340): the 30 px typing strip kept, about 4 single lines (17 px + 2) above it. 120 is 35% of 340, the nearest that shows 4 whole lines.
- Phones, tablets and a mouse window under 1024 px (no frame) keep their sizes. This replaces "closer to a dozen" (Eric, Oct 28) for the computer.
- Checks: town-chat.spec's computer box height 300+ -> 110 to 130, its lines before scrolling 12+ -> 4 to 5. Light lane; no drawing change, so no frame-rate pass.
