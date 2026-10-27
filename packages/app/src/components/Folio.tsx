import type { BossUi, MomentUi } from "./PowerParts.tsx";

/**
 * Folio's powers on screen: a place held for its art (the wiring lane: its sprite and 11 animations, the ink, the fold,
 * the crease, on branch claude/boss-art). Its rules are built (packages/chess/src/bosses/folio.ts;
 * docs/decisions/2026-10-27-folio-rules.md): until the art comes its moments show nothing and only hold their time, so
 * the server's timing is already its own. What the wiring lane draws, and where each comes from:
 * - **draft** (as your turn after its move begins; `square`, the marked piece; `squares`, the attack's line, its piece
 *   first): an ink mark under the piece and the line faintly, from the view's `draft` (`square`, `attacker`, `line`,
 *   `until`) for as long as the mark stands (gone as soon as the attack ends). Banner DRAFT; its line "I'll be honest:
 *   that piece is next." (kit `power`).
 * - **fold** (at the start of its turn, while it thinks; `square`): the piece folded, then drawn folded while the view's
 *   `folded` holds its square (a tap on it: "That piece is folded."). Banner FOLDED; "Folded. It'll keep."
 * - **creaseWarn** (with the RAGE warning, `warn`; `line`): the crease's line shown faintly from the view's `creaseNext`
 *   until it lands; "Mind the crease." said once, with the warning (not twice).
 * - **crease** (as the next turn begins; `line`): the board folded along the line (`crease.line`: "d|e" between the d and
 *   e files, "4|5" between ranks 4 and 5), drawn while the view's `crease` holds; banner CREASE!. **creaseEnd** (`line`):
 *   it unfolds. Nothing moves the board or the dock (Eric's rule: nothing shifts).
 * - **revision** (at the start of its turn, while it thinks; `moves`: its move, then yours): both crossed out, the board
 *   back to the position before them (already the board's: draw the old one until the moment ends), then its move in
 *   their place plays as its ordinary move (the view's `revision.move` and `san` name it). Banner REVISION; "Let me write
 *   that again."
 */

const nothing = () => null;

const MOMENTS: Record<"draft" | "fold" | "creaseWarn" | "crease" | "creaseEnd" | "revision", MomentUi> = {
  draft: { order: 0, kit: "power", view: nothing },
  fold: { order: 0, kit: "powerHit", view: nothing },
  creaseWarn: { order: 1, kit: "ultimateWarn", view: nothing },
  crease: { order: 2, kit: "ultimate", view: nothing },
  creaseEnd: { order: 2, kit: "ultimateHit", view: nothing },
  revision: { order: 0, kit: "power", view: nothing },
};

export const FOLIO_UI = {
  id: "folio",
  ultimate: { name: "Crease" },
  moments: MOMENTS,
} satisfies BossUi;
