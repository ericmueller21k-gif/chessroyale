import { render } from "preact";
import "chessground/assets/chessground.base.css";
import "chessground/assets/chessground.cburnett.css";
import "../styles.css";
import { ITEM_DEFS, type ItemLook, type ItemSlot } from "@chessroyale/core";
import { Avatar, ItemArt } from "../components/Items.tsx";

/**
 * Dev only: the item fitting sheet (`npm run preview:items`, or /items-preview.html on `npm run dev`). Every item
 * (or `?items=a,b`) is worn on a plain pawn and on every skin, white and black, then shown as cards: plain,
 * blemished and shiny. `?color=red&color2=emerald` sets the colours.
 */
const q = new URLSearchParams(location.search);
const only = q.get("items")?.split(",");
const color = q.get("color") ?? "red";
const color2 = q.get("color2") ?? "emerald";
const defs = ITEM_DEFS.filter((d) => !only || only.includes(d.id));
const skins = [undefined, ...ITEM_DEFS.filter((d) => d.slot === "skin").map((d) => d.id)];
const finish = (def: string, blemish = 20) => ({ def, color, color2, blemish, seed: 5 });

const Cell = ({ look, side, label }: { look: ItemLook; side: "w" | "b"; label: string }) => (
  <div style="width:112px;text-align:center;background:#3a3f48;border-radius:6px;padding:4px;color:#fff;font:11px sans-serif">
    <div style="width:104px;height:104px;position:relative;margin:auto">
      <Avatar look={look} side={side} />
    </div>
    {label}
  </div>
);

render(
  <div style="padding:10px;display:grid;gap:14px">
    {defs.map((d) => (
      <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:flex-start">
        {(["w", "b"] as const).flatMap((side) =>
          (d.slot === "skin" ? [undefined] : skins).map((skin) => {
            const look: ItemLook = { [d.slot as ItemSlot]: finish(d.id) };
            if (skin) look.skin = finish(skin);
            return <Cell look={look} side={side} label={`${d.id}${skin ? ` on ${skin}` : ""} (${side})`} />;
          }),
        )}
        {[20, 45, 3].map((blemish) => (
          <div style="width:104px;height:104px;background:#3a3f48;border-radius:6px">
            <ItemArt def={d.id} finish={{ color, color2, blemish, seed: 5 }} />
          </div>
        ))}
      </div>
    ))}
  </div>,
  document.getElementById("app")!,
);
