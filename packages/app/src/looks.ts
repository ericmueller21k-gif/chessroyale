import { equippedLook, idHash, type ItemLook } from "@chessroyale/core";
import { account } from "./account.ts";
import type { Standing } from "./game.ts";

/** Bots wear a shop hat now and then (seeded by their id, so always the same one), so a crowd of bots isn't all plain pawns. */
const BOT_HATS = ["none", "none", "none", "party", "crown", "wizard", "top", "viking"];

/**
 * How a player looks as a pawn (the vote board, the cut screen): you as your account dresses you (shop hat and crate
 * items), other people in the crate items they sent, bots in a seeded hat. Nothing on: a plain pawn.
 */
export function pawnLook(p: Pick<Standing, "id" | "isYou" | "isBot" | "look">): { look?: ItemLook; hat: string } {
  if (p.isYou) return { look: account().profile?.locker?.look, hat: equippedLook(account().profile?.shop, "hat").hat ?? "none" };
  return { look: p.look, hat: p.isBot ? BOT_HATS[idHash(p.id) % BOT_HATS.length]! : "none" };
}
