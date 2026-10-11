import { render } from "preact";
import "chessground/assets/chessground.base.css";
import "chessground/assets/chessground.cburnett.css";
import "../styles.css";
import { ITEM_DEFS, SLOT_NAMES, itemColor, itemDef, tierInfo, type ItemLook } from "@chessroyale/core";
import { Avatar, ItemArt } from "../components/Items.tsx";

/**
 * Dev only: the item fitting sheet (`npm run preview:items`, or /items-preview.html on `npm run dev`). Every item
 * (or `?items=a,b`) is worn on a plain pawn and on every skin, white and black, then shown as cards: plain,
 * at a spread of purities (shiny to 0%). `?color=red&color2=emerald` sets the colours, `?purities=100,50,0` the cards,
 * and `?with=beanie` wears other items too (to see two together, e.g. goggles over a hat).
 *
 * `?sheet=1` is the short sheet for showing a batch (Eric): each item as a card and worn on a white and a black pawn,
 * with its tier, the colours taken in turn from `?colors=` (and `?purity=`), then any whole outfits in
 * `?outfits=dark-shades+suit-and-tie+tommy-gun;eyepatch`, each on both pawns.
 */
const q = new URLSearchParams(location.search);
const only = q.get("items")?.split(",");
const color = q.get("color") ?? "red";
const color2 = q.get("color2") ?? "emerald";
const purities = (q.get("purities") ?? "95,70,50,30,5,0").split(",").map(Number);
const also = (q.get("with")?.split(",") ?? []).flatMap((id) => ITEM_DEFS.filter((d) => d.id === id));
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

const sheet = q.get("sheet") === "1";
const palette = (q.get("colors") ?? "yellow,red,cobalt,emerald,midnight,sage,opal,oceanic,pearl").split(",");
const sheetBlemish = 100 - Number(q.get("purity") ?? 72);
// ("+" arrives as a space in a query string.)
const outfits = (q.get("outfits") ?? "").split(";").filter(Boolean).map((o) => o.split(/[+ ]/));
/** The sheet keeps the order asked for. */
const sheetDefs = only ? only.flatMap((id) => ITEM_DEFS.filter((d) => d.id === id)) : defs;

const SheetCard = ({ def, i }: { def: string; i: number }) => {
  const d = itemDef(def)!;
  const t = tierInfo(d.tier);
  const f = { color: palette[i % palette.length]!, color2: palette[(i + 3) % palette.length]!, blemish: sheetBlemish, seed: 5 + i };
  const look: ItemLook = { [d.slot]: { def, ...f } };
  return (
    <div style={`width:300px;background:#3a3f48;border-radius:10px;padding:8px;color:#fff;font:12px sans-serif;border-left:6px solid ${t.color}`}>
      <div style="display:flex;gap:4px;align-items:center">
        <div style="width:96px;height:96px">
          <ItemArt def={def} finish={f} />
        </div>
        {(["w", "b"] as const).map((side) => (
          <div style="width:96px;height:96px;position:relative">
            <Avatar look={look} side={side} />
          </div>
        ))}
      </div>
      <div style="margin-top:4px">
        <b style="font-size:14px">{d.name}</b> <span style={`color:${t.color};font-weight:800`}>{t.name}</span> · {SLOT_NAMES[d.slot]}
      </div>
      <div style="opacity:0.75">
        {itemColor(f.color).name}
        {d.colors === 2 ? ` & ${itemColor(f.color2).name}` : ""} · {100 - sheetBlemish}% pure
      </div>
    </div>
  );
};

render(
  sheet ? (
    <div style="padding:12px;display:flex;flex-wrap:wrap;gap:10px;width:960px">
      {sheetDefs.map((d, i) => (
        <SheetCard def={d.id} i={i} />
      ))}
      {outfits.map((o, n) => {
        const look: ItemLook = {};
        o.forEach((id, k) => {
          const d = itemDef(id);
          if (d) look[d.slot] = { def: id, color: palette[(n * 3 + k) % palette.length]!, color2: palette[(n * 3 + k + 4) % palette.length]!, blemish: sheetBlemish, seed: 9 + k };
        });
        return (
          <div style="width:300px;background:#3a3f48;border-radius:10px;padding:8px;color:#fff;font:12px sans-serif">
            <div style="display:flex;gap:4px;justify-content:center">
              {(["w", "b"] as const).map((side) => (
                <div style="width:130px;height:130px;position:relative">
                  <Avatar look={look} side={side} />
                </div>
              ))}
            </div>
            <div style="margin-top:4px">
              <b>Together:</b> {o.map((id) => itemDef(id)?.name).join(" + ")}
            </div>
          </div>
        );
      })}
    </div>
  ) : (
  <div style="padding:10px;display:grid;gap:14px">
    {defs.map((d) => (
      <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:flex-start">
        {(["w", "b"] as const).flatMap((side) =>
          (d.slot === "skin" ? [undefined] : skins).map((skin) => {
            const look: ItemLook = {};
            for (const a of also) look[a.slot] = finish(a.id);
            look[d.slot] = finish(d.id);
            if (skin) look.skin = finish(skin);
            return <Cell look={look} side={side} label={`${d.id}${skin ? ` on ${skin}` : ""} (${side})`} />;
          }),
        )}
        {purities.map((purity) => (
          <div style="width:104px;text-align:center;background:#3a3f48;border-radius:6px;color:#fff;font:11px sans-serif">
            <div style="width:104px;height:104px">
              <ItemArt def={d.id} finish={{ color, color2, blemish: 100 - purity, seed: 5 }} />
            </div>
            {purity}%
          </div>
        ))}
      </div>
    ))}
  </div>
  ),
  document.getElementById("app")!,
);
