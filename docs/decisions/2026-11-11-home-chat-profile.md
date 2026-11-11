# Home: chat on phones, View profile on your card, portrait on phones (Nov 11, 2026)

Eric: "We don't have a chat function on mobile … replace [the pawn] with a chat icon. On desktop we don't need that." "'View profile' in a
normal blue in the top right of that white container." "We have to have rotation disabled for this app on mobile."

- **Calls:** the chat button opens the existing `GlobalChat` as a full-screen sheet (`ChatSheet.tsx`). "View profile" opens the same screen
  the pawn did. The sideways panel (`index.html`, `#rotate-lock`) uses the brief's query: landscape, 500 px high or less. It also covers
  a computer window that short; the director may narrow it.
- **Tests:** "Your profile" lookups are now "View profile" (see the PR body). Guards: `home-layout.spec.ts`.
- **Layout (Eric and the director, Nov 11):** View profile is in the card's bottom-right corner (on the computer too), not the top.
  On cards under 110 px (360 × 640): the pawn and name row starts at the left, the pawn is clamped to the card, the link's box sits
  at the card's bottom edge with 13 px words; its words never touch the name's words, its box may overlap the name's box by up to 14 px.
  Other sizes: the box touches no part of the name, icon or level. 390 × 844: the link's box overlaps the pawn's box, but no drawn pawn
  pixel is under it (checked by pixels). Nothing moves on the computer (checked: boxes the same with and without the link).
