# The Hidden Boss's hearts: the review's fixes (Nov 16, 2026)

The review of PR #744 found engine lag cutting the bots' hearts, so a slow host could make his fight unwinnable.

- A bot's board is judged by the think it rolled, never by when its move arrives: only people are in the automatic cut; a slow roll
  (5%) costs its heart as that think ends, its move in or not. Online and solo the same.
- A fight stored before the hearts (a deploy mid-fight) loads with 8 each, nothing cut.
- The director's call: "+N" stays above the game screen but hides while a modal or the options menu is open. Eric's "above
  everything" was about the status box clipping it.
