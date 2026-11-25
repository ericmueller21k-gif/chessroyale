# The boss result's row gap comes from the boss's drawing (Nov 25)

Main's retry-passes after #946 (boss-result.spec.ts:132 and formats.spec.ts:174, both 14.3125 px against the 16 px rule): not #946's item
animations (the pawn's measured box never changed: no hop, no transform, 122.4 px every frame), but Smudgy's defeat at #944's 2.25x,
reaching 1.7 px past what the hand-tuned 48 px gap allowed; the tests meet a random boss, so it failed about one run in twenty, on whatever
PR came next. The same constant had gone stale for Smudgy at each scale change (Nov 9, Nov 11). Fix: the gap is max(48 px, what 16 px
needs from his drawn reach over his idle, defeat and victory frames); only Smudgy (50) and Folio (52) change. The victory test now meets
Smudgy every run. Measured every selectable boss, win and resign, phone and desktop: at least 16.3 px.
