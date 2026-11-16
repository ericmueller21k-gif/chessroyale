/**
 * Boingo's Funhouse colors on their own (Nov 9 audit, F8): the claw cabinet (a town model, loaded with the town) needs only these,
 * so importing them from boingo-art.ts pulled the whole Funhouse drawing into the town's chunk, past ShopRoom's dynamic import.
 */
import { CLOWN_PALETTE } from "../../characters/clown.ts";

/** CLOWN_PALETTE plus the arcade's own keys. */
export const FUN_PALETTE: Record<string, string> = {
  ...CLOWN_PALETTE,
  // carpet: a deep night blue with confetti specks
  c: "#1c1640",
  C: "#2a2160",
  d: "#141030",
  // the battle mat: a bright carnival rug
  h: "#ff5aa8",
  H: "#c43a7f",
  i: "#36c6c0",
  I: "#22827e",
  // chrome, glass and the dark cabinets
  j: "#cfd6e4",
  J: "#8790a6",
  l: "#9fe3ff80",
  L: "#e8faff",
  v: "#2c2238",
  V: "#3e3150",
  // bulbs, lit and dim
  a: "#fff3b0",
  A: "#ffd04a",
  f: "#ff8fe0",
  F: "#7affc6",
  // nets and pads
  N: "#f2f2f2",
  G: "#2fa84f",
  x: "#ff9a3c",
  // the walls
  Z: "#3a1d4f",
  M: "#55286f",
  // spotlight wash (see-through)
  "-": "#fff6c840",
  "+": "#fff6c822",
};
