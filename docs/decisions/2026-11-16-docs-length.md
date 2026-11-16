# Shorter decision notes and PR bodies (Nov 16, 2026)

Eric, Nov 16 ("Yeah, go ahead and fire those"), on the bloat sweep's T4 (notes/pipeline-audit-2026-11-16.md): the median note was 274
words, 43% of PR bodies over 40 lines, and every helper re-reads them.
- `check.yml`: a new decision note warns over 200 words (was 250); a PR body warns over 60 lines (new). Warnings, not failures.
- The four longest notes (the Hidden Boss's online and pause notes, the ban sign-in note: 1,200-2,300 words) keep about 150 words each;
  their design text moves to `docs/areas/bosses.md` and `docs/areas/fairplay.md`.
