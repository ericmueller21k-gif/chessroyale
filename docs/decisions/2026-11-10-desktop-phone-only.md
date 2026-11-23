# Desktop stops repeating long logic flows (Nov 10)

Audit F4 (notes/pipeline-audit-2026-11-09.md, branch claude/director-notes): the desktop project repeated long flows the phone
already proves. The director signed off a per-test list: 67 tests in boss-challenge, shop, town, town-chat, dash and autochess
went `@phone-only` (about 1,260 desktop test-seconds). Kept on both: layout, desktop input (mouse drags, the wheel, arrow keys)
and every `docs/rules/eric.md` guard. boss-side's double desktop time is two computer-only layout tests, not a slowness.
autochess.spec.ts and crowd.spec.ts are split in two (autochess-board, crowd-play), no test changed, so no file runs over
about 6 minutes a project.
