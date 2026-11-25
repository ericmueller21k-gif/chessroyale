# First-time walkthrough (2026-11-06)

**What:** a walkthrough over the home screen for new players. Nine slides: the seven home spots (PLAY, Chess Town, Boss Battle,
Play with friends, Shop & crates, Profile, Settings), the HunChess Handbook, and the two Welcome Crates (5 games and 25).

**Decisions**

- **"Don't show this tutorial again" starts unticked.** Finishing all nine slides saves it, so the walkthrough stops. Skip saves
  it only when ticked; a player who taps through without finishing or ticking sees it again next visit.
- **Replay from Settings.** "Show the walkthrough again" clears the saved flag and starts the walkthrough from the first slide.
- **The Handbook name.** The player-facing FAQ is now "HunChess Handbook" (Settings row and screen heading). The code ids
  (`faq/`, `FaqScreen`, `/faq`) are unchanged, so links and tests keep working.
- **Last slide shows both Welcome Crates** (goals from `WELCOME_GIFT.milestones`, 5 and 25), each with its picture (the shop's
  `HunchessCrateArt`), its bar and "0 of 5" / "0 of 25". "Go to your inventory" closes the walkthrough and opens the shop's
  Crates tab (`/shop?crates`, the shop's own route to it). The shop is lit up on that slide.
- **Spots on a computer** are the side menu's items. Where a spot appears twice (the top bar and the side menu), the spotlight
  takes the first one on screen.
- **Reduced motion** turns off the spotlight and bar transitions.
- **No storage, no walkthrough.** If storage is blocked, the walkthrough still shows and nothing breaks.

**Not in this change:** a Settings "replay" on a computer has been checked only through the e2e spec (desktop project), not by
eye. Stills are in `docs/first-tutorial/`.
