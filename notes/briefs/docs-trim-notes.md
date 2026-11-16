# Move four long decision notes' design text onto the area pages. Haiku. Docs only

Branch `claude/docs-length` (already pushed: the CI change and `docs/decisions/2026-11-16-docs-length.md`). Pull it, work on it, push it.
Read CLAUDE.md (American English; never images under docs/).

Steps, one note at a time:
1. Open the note. The notes and where their design text goes:
   - `docs/decisions/2026-11-13-recluse-server-only.md` → `docs/areas/bosses.md` (the Hidden Boss's section)
   - `docs/decisions/2026-11-13-recluse-online-phase2.md` → `docs/areas/bosses.md` (the Hidden Boss's section)
   - `docs/decisions/2026-11-13-recluse-phase1-pause.md` → `docs/areas/bosses.md` (the Hidden Boss's section)
   - `docs/decisions/2026-11-13-ban-blocks-sign-in.md` → `docs/areas/fairplay.md`
2. Find what the area page already says on that subject. Add only what it doesn't already say: how it works, settings, file names.
   Keep the page's style (short bullets). Don't repeat a fact the page has.
3. Cut the note to about 150 words: the date, Eric's words (quoted exactly), what changed in one or two lines, the calls made in
   one line each, and one line "Details: docs/areas/<page>.md, <section>". Keep the note's file name.
4. Change no code, no test, no other note. Don't remove a fact that isn't on the area page after your edit.
5. Check: `wc -w` each note (about 150, at most 200). `git diff --stat` shows only these 4 notes and the 2 area pages.
6. Commit (message ending with the `Claude-Session:` line only, no model names) and push. Then write `.done` on the branch, push, and
   end your turn. No PR.
