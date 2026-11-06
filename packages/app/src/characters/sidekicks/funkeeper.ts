/**
 * The Shopkeeper of Boingo's Funhouse (Nov 6): a friendly clown attendant behind the prize counter, in the prize store's teal
 * uniform. No name ("Shopkeeper") and not a town bot: Squirt stays Boingo's kid. Drawn with the clown kid's rig
 * (sidekicks/boingo.ts) and its moves, recolored: a teal suit and cap where Squirt's are purple, mint trim, the gold kept.
 * The sheet's key is `funkeeper` (no hyphen).
 */
import type { Character } from "../sprite.ts";
import { SIDEKICK_PALETTE, sidekickBoingo } from "./boingo.ts";

export const FUNKEEPER_PALETTE = {
  ...SIDEKICK_PALETTE,
  p: "#1f9e9a", // the uniform: teal
  P: "#136663",
  v: "#5fd3c9",
} as const;

export const sidekickFunKeeper: Character = {
  ...sidekickBoingo,
  id: "sidekick-funkeeper",
  name: "Shopkeeper",
  palette: FUNKEEPER_PALETTE,
};
