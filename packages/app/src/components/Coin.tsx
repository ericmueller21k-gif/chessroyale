import big from "../coin/coin-40.png?url";
import small from "../coin/coin-20.png?url";

/**
 * The coin (Nov 17, Eric: "drawn like the boss coins but a king chess piece 'head only' style as the center"): the game's one coin
 * icon, beside every coin count and price. Two drawings by the art runner (claude/boss-art, `scripts/boss-art/out/token-coin/` and
 * `token-coin-small/`): 20 x 20 for text sizes, 40 x 40 from 32 px up, each shown at whole pixels so it stays crisp on a phone.
 * Decorative: the count beside it, or its parent's label, says "coins".
 */
export function Coin({ size = 20 }: { size?: number }) {
  return <img class="coin-icon" src={size >= 32 ? big : small} width={size} height={size} alt="" aria-hidden="true" draggable={false} />;
}
