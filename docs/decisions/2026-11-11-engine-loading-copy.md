# The engine's loading card says what it's doing, not how big it is (Nov 11, 2026)

**Eric (Nov 11, playing Babur: the loading card said a 40 MB download, the first time only):** "I'd rather not say that and
instead just do a normal load bar that says like 'loading the HunChess engine'."

**What changed** (`BrainLoading.tsx`, `BrainLoadingCard`)
- While the engine downloads, the note under the bar reads **"Loading the HunChess engine…"**. It used to read "12 of 40 MB"
  when the sizes were known and "Downloading…" when they weren't; both are gone.
- The line "First time only: about 40 MB, then it's saved on this device." is removed. Nothing on the card mentions MB.
- The bar still fills with the real download progress, as before.
- The card's layout is the same in both states (icon, title, bar, note, Leave): it had one extra line only while downloading,
  and that line is gone, so nothing moves between "Loading the HunChess engine…" and "Starting…".
- `BOSS_BRAIN.downloadMb` stays in `settings.ts`: the FAQ, the tests and the admins' numbers still read it. The card just doesn't show it.
- The `.boss-loading-first` style is removed with its line.

**Calls made**
- The note keeps the same line and place, with the same wording for a download of known or unknown size (Eric's words, one
  text for both).
- The e2e check that waited for the "First time only" line (`e2e/maia.spec.ts`, the saved-files battle) now waits for the note's
  new text while downloading, and still expects no download the second time.
- The FAQ's "Why Maia, and its download" answer still says "about 40 MB". It's a separate answer to a question, not the card, so
  it's left as is; Eric can say if he wants it changed too.
