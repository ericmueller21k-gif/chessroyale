# Walkthrough v2 (2026-11-07)

**Eric's asks:** a computer shows each destination twice (side menu and home button): light both. Add the three modes
(50 v 50, 1 v 1, Squads) right after PLAY. Add a "Play anywhere" slide. The last slide alone has OK and "Don't show me this
again"; taps never finish it. `?tour=1` opens it from the first slide.

**Decisions**

- **Every visible element with the id lights.** A computer's hidden home header (Shop, Friends, Settings) is skipped (zero size), so
  only the side menu lights for those; PLAY, Chess Town, Boss Battle and Profile (the right column's pawn) light twice.
- **Slide titles are the buttons' labels:** "50 v 50", "1 v 1", "Squads"; bodies are Eric's lines (the rules: 50 v 50 votes; 1 v 1 is ranked; Squads are 4-player teams).
- **Play anywhere** says "You can also add it to your home screen": the install card exists, so it's not a contradiction.
- **Skip stays on the earlier slides** and closes for now (it never saves: the box is only on the last slide).
- **OK and Inventory save only when ticked;** Escape too. The stored flag is never set by `?tour=1` alone.
