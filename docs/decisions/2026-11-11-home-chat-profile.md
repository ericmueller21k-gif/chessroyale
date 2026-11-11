# Home: chat on phones, View profile on your card, portrait on phones (Nov 11, 2026)

Eric: "We don't have a chat function on mobile … replace [the pawn] with a chat icon. On desktop we don't need that." "'View profile' in a
normal blue in the top right of that white container." "We have to have rotation disabled for this app on mobile."

- **Calls:** the chat button opens the existing `GlobalChat` as a full-screen sheet (`ChatSheet.tsx`). "View profile" opens the same screen
  the pawn did. The sideways panel (`index.html`, `#rotate-lock`) uses the brief's query: landscape, 500 px high or less. It also covers
  a computer window that short; the director may narrow it.
- **Tests:** "Your profile" lookups are now "View profile" (see the PR body). Guards: `home-layout.spec.ts`.
- **Layout (director, Nov 11):** the link is its own row above the name (not the corner), so it never sits on the name at any phone height. Its taps are 44 px; its row takes 24 px, and at 360 × 640 the pawn's base sits 5-7 px below the card.
