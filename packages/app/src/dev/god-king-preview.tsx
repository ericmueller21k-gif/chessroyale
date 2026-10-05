import { render } from "preact";
import "chessground/assets/chessground.base.css";
import "chessground/assets/chessground.cburnett.css";
import "../styles.css";
import { GodKingFallen, GodKingPortrait, GodKingSprite } from "../components/GodKing.tsx";
import { GodKingEpilogue, LastStandCutIn } from "../components/LastStand.tsx";
import { KING_LINES } from "../godKing.ts";

/**
 * Dev only: the God King's art, white and black, on a light and a dark ground (/god-king-preview.html on
 * `npm run dev`): standing, his armour cracking (1 to 3), fallen, his portraits (as usual and battle-worn), the
 * Last Stand's banner (`?banner=1` holds it mid-way), and the result screen's epilogue (`?epilogue=rise|down`).
 */
const q = new URLSearchParams(location.search);
const Cell = ({ label, children, w = 72 }: { label: string; children: preact.ComponentChildren; w?: number }) => (
  <div style={`display:grid;justify-items:center;gap:4px;width:${w}px;font:11px sans-serif`}>
    <div style={`width:${w}px;height:96px;display:grid;place-items:end center`}>{children}</div>
    {label}
  </div>
);
function Row({ side, dark }: { side: "w" | "b"; dark: boolean }) {
  return (
    <div style={`display:flex;gap:14px;align-items:end;flex-wrap:wrap;padding:12px;background:${dark ? "#16181d" : "#f3f1ea"};color:${dark ? "#eee" : "#222"}`}>
      {[0, 1, 2, 3].map((c) => (
        <Cell key={c} label={c ? `cracks ${c}` : side === "w" ? "White" : "Black"}>
          <div style="width:56px;height:84px">
            <GodKingSprite side={side} cracks={c} />
          </div>
        </Cell>
      ))}
      <Cell label="fallen" w={120}>
        <div style="width:120px;height:75px">
          <GodKingFallen side={side} />
        </div>
      </Cell>
      <Cell label="in the dock" w={70}>
        <div class="gk-unit fallen" style="height:62px">
          <span class="gk-unit-btn">
            <GodKingFallen side={side} />
          </span>
        </div>
      </Cell>
      <Cell label="portrait" w={128}>
        <div style="width:128px;image-rendering:pixelated">
          <GodKingPortrait side={side} />
        </div>
      </Cell>
      <Cell label="battle-worn" w={128}>
        <div style="width:128px">
          <GodKingPortrait side={side} hurt />
        </div>
      </Cell>
    </div>
  );
}
function Banner({ side }: { side: "w" | "b" }) {
  return (
    <div class="board-wrap" style="position:relative;width:min(390px,100vw);aspect-ratio:1;background:#b58863">
      <LastStandCutIn side={side} line={KING_LINES.lastStand[side === "w" ? 0 : 2]!} />
    </div>
  );
}
const epilogue = q.get("epilogue");
render(
  <div>
    {(["w", "b"] as const).flatMap((side) => [false, true].map((dark) => <Row key={`${side}${dark}`} side={side} dark={dark} />))}
    {q.has("banner") && (
      <div style="display:flex;gap:8px;flex-wrap:wrap;padding:8px;background:#222">
        <Banner side="w" />
        <Banner side="b" />
      </div>
    )}
    {epilogue && (
      <div style="display:flex;gap:30px;padding:30px 12px;background:#16181d">
        <GodKingEpilogue side="w" rises={epilogue === "rise"} />
        <GodKingEpilogue side="b" rises={epilogue === "rise"} />
      </div>
    )}
  </div>,
  document.getElementById("app")!,
);
