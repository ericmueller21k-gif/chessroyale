# Home: chat on phones, View profile on your card, portrait on phones (Nov 11, 2026)

Eric: "We don't have a chat function on mobile … replace [the pawn] with a chat icon. On desktop we don't need that." "'View profile' in a
normal blue in the top right of that white container." "We have to have rotation disabled for this app on mobile."

- **Calls:** the chat button opens the existing `GlobalChat` as a full-screen sheet (`ChatSheet.tsx`). "View profile" opens the same screen
  the pawn did. The sideways panel (`index.html`, `#rotate-lock`) uses the brief's query: landscape, 500 px high or less. It also covers
  a computer window that short; the director may narrow it.
- **Tests:** "Your profile" lookups are now "View profile" (see the PR body). Guards: `home-layout.spec.ts`.
- **Open call:** on a phone about 660 px tall or less the card is too short for a free corner: "View profile" overlaps the name's line at 360 × 640 (measured). At 390 × 844 it sits above the name.
