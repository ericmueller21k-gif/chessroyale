# Flaky batch 4 (Nov 10, 2026)

From main run 42760919996 (7bfd6e5), as #590. Both were app bugs a player could hit.
**dash:241**: a Scramble Rush drag counted as a drag only once one pointer move was more than 8 px from the move before it, so a
slow drag (a finger's) never counted and its drop was lost. It now counts from where the piece was picked up, like Vote's. The e2e
drags slowly (moves of 4 px at most), which fails every time without the fix.
**town-leave:87**: "Leave Chess Town?" focused Stay and listened for Escape a frame after it showed, so an Escape in that frame
was lost. Now set as the sheet is drawn; the e2e presses Escape right after Back.
