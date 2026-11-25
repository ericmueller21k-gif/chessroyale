# One size for every boss-battle figure on a computer; Big Boy faces front (Nov 7, 2026)

**Eric:** "how are the king and the pawn so different sized … it should be probably slightly smaller than the larger one, so then the king fits … shrink the ones that are currently larger … about a 15% shrink." On Big Boy in his room ("OIB YOB"): "just make him face the right way."

**The call.** Every boss is drawn at one size at a window size (`characters/side-size.ts`): the board over 200 (was 170), at most 3.4 (was 4), and no more than the widest (87 sprite px) and tallest (135) boss fit in the room, so Smudgy and Big Boy match. Big Boy at 1440 × 900: 4 → 3.25 (the widest boss's room); 1920 × 1080: 4 → 3.4. Your pawn and the God King: half that, at most 1.7, filling 85% of their room: 1.45 → 1.2 and 1.9 → 1.6, the same in every fight. Babur is the same size, in everyone's column and board: his pump stands in front of him, 10 px over his edge, more only where the side menu is in the way (42 px at 1440, 50 at 1920; at most 0.4 of its width).

**Why.** One rule from the shared size, not the boss, can't drift again; a number test (`e2e/side-same-size.spec.ts`, 1100 to 1920 px, five bosses) checks it.

**Big Boy.** He's drawn facing front, so the sprite kit never mirrors him (town, room, board): his shirt reads and his lollipop stays in his right hand. His attack on a king to his right must point the other way: it's drawn `turned`, its "BIG BOY" (`reads`) unmirrored. No other boss has writing that mirroring turns round (the Hidden Boss's "Ш" reads the same; Dash's clock has faces).
