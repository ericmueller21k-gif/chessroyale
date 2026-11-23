# Resume's tap survives the reload a missing file makes (Nov 23, 2026)

The director's brief (resume-race): main's run 45088115360 had `xp.spec:382`'s Resume close the card, start nothing, and show the card
again (Resume focused, no error line). **Cause:** a file the resume loads failed (the solo game's code), `stale.ts` loaded the page again,
as it does for a deploy's missing file, and the new page offered the card: the tap was lost. Every other path either sets home's error
line or can't bring the card back on the same page; staged locally, it gives the same screen, `ref` for `ref`.
**Changed:** the resume notes its game in this tab (`solo-kept.ts noteResuming`, sessionStorage) while it loads; the page loaded within a
minute takes it once and resumes as the card comes, before it's drawn. A load that rejects (the openings, an engine) says "Couldn't load
the game." instead of a silent home; a second tap meanwhile is the same Resume. Call: carried in its own key, not `stale.ts`'s place (the
town's, kept by path). Left as is: `startSolo` and `startTowerFloor` await the same loads unguarded (a follow-up).
