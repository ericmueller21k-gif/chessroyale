import coin from "../coin/coin.png?url";

/**
 * The coin (Nov 17, Eric: "drawn like the boss coins but a king chess piece 'head only' style as the center"): the game's one coin
 * icon, beside every coin count and price. A 40 x 40 drawing by the art runner (claude/boss-art, `scripts/boss-art/out/token-coin/`),
 * the boss tokens' rim on a gold middle with the board's king. Below 40 px it's scaled smoothly (a hand-pixeled 20 x 20 read worse,
 * docs/decisions/2026-11-17-coin-icon.md); from 40 px up, pixel-sharp. Decorative: the count beside it, or its parent's label,
 * says "coins".
 */
export function Coin({ size = 20 }: { size?: number }) {
  return <img class={`coin-icon${size >= 40 ? " sharp" : ""}`} src={coin} width={size} height={size} alt="" aria-hidden="true" draggable={false} />;
}
