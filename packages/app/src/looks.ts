import { botLook, equippedLook, type ItemLook } from "@chessroyale/core";
import { account } from "./account.ts";
import type { Standing } from "./game.ts";

/**
 * How a player looks as a pawn (the vote board, the cut screen): you as your account dresses you (shop hat and crate
 * items), other people in the crate items they sent, bots in a simple outfit seeded by their name (`botLook`: the
 * same bot always looks the same; the odds are BOT_LOOKS in settings.ts). Nothing on: a plain pawn.
 */
export function pawnLook(p: Pick<Standing, "id" | "isYou" | "isBot" | "look"> & { name?: string }): { look?: ItemLook; hat: string } {
  if (p.isYou) return { look: account().profile?.locker?.look, hat: equippedLook(account().profile?.shop, "hat").hat ?? "none" };
  if (p.isBot) return botLook(p.name || p.id);
  return { look: p.look, hat: "none" };
}
