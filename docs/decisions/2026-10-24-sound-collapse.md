# Sound lists collapsed by default in Settings (Oct 24, 2026)

**Eric, Oct 24, his words:** "collapse all the options for each category into a dropdown, you tap move sounds, the drop down… keep the play buttons since they are already there, just make these lists collapsed by default and when you exit the screen, do this for all sound fx and future sound fx options."

## What changed

- **One block for every sound choice.** Move sound, Capture sound and Reveal sound all use one component, `SoundPicker` in `packages/app/src/screens/Settings.tsx`. A future sound list gets the same by using it.
- **Collapsed (the default).** The title row is one button (`aria-expanded`, 48 px tall): the title, the current pick's name after it, and a chevron ▾ at the right, which turns when the list is open. The description line under it stays as it was.
- **Tapped.** The list opens below the description, exactly as before: every option with its ▶. A tap on the title row closes it. Picking an option keeps the list open and plays it, as before.
- **Each block on its own.** More than one may be open at once.
- **Collapsed again on every visit.** The open state is not stored: the picker's state lives only while Settings is on screen.
- The Sound on/off switch is unchanged.

## Judgment calls and why

- **A collapsed list is not in the page at all** (no hidden radios or ▶ buttons). Fewer elements to draw on a phone, and a screen reader hears only the title row until it's opened.
- **The description stays outside the title button.** The title row is the tap target; the description is text under it, as Eric's screenshot shows it, so tapping the explanation does nothing.
- **The title row's name is the pick as it stands.** It updates on a pick, so the row always shows what will play.
- **No text changed.** The only new player-visible text is the pick's name in the collapsed row. The descriptions still say "Tap ▶ to hear one" (the ▶ is one tap away, inside the list).
