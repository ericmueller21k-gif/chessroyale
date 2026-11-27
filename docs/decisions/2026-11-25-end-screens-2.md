# End screens, round 2: every mode tighter; ranked 1 v 1's end page is its game screen (Nov 25, 2026)

**Eric (Nov 25, phone and computer screenshots):** "there's so much space between all of this ... the character models are small here too ... when there's no quest, we don't need 800 feet of empty space. It can just say QUESTS in bold, and then next to it 'No quests this game' ... I need a magnifying glass to read XP EARNED +0"; "do you think this chat box makes any sense?"; "the chat box on the end game screen should not now suddenly be to the left of the board when it's to the right during the game". **Eric (Nov 25):** "Make things spaced evenly and tight, and then we can always just center the whole thing".

- **One gap** (`--es-gap`, 12 px) between containers. No boxes holding blank lines. A short stack is centered.
- **Buttons stacked**, Play again on top, at the column's width.
- **Quests** show their rows only. None is one line: "QUESTS  No quests this game."
- **XP EARNED** is a size bigger: 12 px label, 42 px number.
- **Ranked 1 v 1 on a computer** keeps the game's screen: the board stays put, and the right column holds the result, rewards, buttons and a small chat. On a phone, one tight column with a 240 px chat.
- **The "+0" bug** came from a tap before the XP. The element is now keyed and a test guards it.
- **A phone keeps the computer's boss placement**, since moving his words beside his head broke the Nov 9 design (reverted by the director).

Full design and measurements: PR #944.
