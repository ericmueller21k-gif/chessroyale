/**
 * MOCKUP ONLY (town-shop-mockup): the Pawn Shop's room, drawn by the real room (town/shops/ShopRoom.tsx) from market-art.ts, with a
 * scene of its own: the side walls, the keeper (a pawn in a top hat and a suit), two shoppers, and the game's own ItemArt on the tables'
 * blocks. Every picture is made once as the room loads; a frame only draws them.
 */
import { h, render, type ComponentChildren } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import type { ItemLook } from "@chessroyale/core";
import type { HomeId } from "../town/world.ts";
import type { ShopDef } from "../town/shops/shops.ts";
import { ShopRoom, loadRoomWith, type FxDraw, type LoadedRoom, type RoomArt, type RoomFx, type ShopCtl } from "../town/shops/ShopRoom.tsx";
import { sideWalls } from "../town/shops/side-walls.ts";
import { proj, newPt } from "../town/camera.ts";
import { PAWN_FOOT, pawnImage, type YouArt } from "../town/render.ts";
import { dressedPawn } from "../town/you-look.ts";
import { ItemArt } from "../components/Items.tsx";
import * as M from "../town/shops/market-art.ts";

const q = new URLSearchParams(location.search);

const DEF: ShopDef = {
  home: "market" as HomeId,
  boss: "the Pawn Shop",
  name: "Board keeper",
  crate: null,
  kid: "towerclerk",
  hideKid: true,
  at: M.SHOP_MARKET_KEEPER_AT,
  keeper: M.SHOP_MARKET_KEEPER,
  talkAt: [{ c: 4, r: 4 }, { c: 5, r: 4 }],
  prizes: [],
  roof: "store",
  chatTone: "day",
};
const art = (): Promise<RoomArt> =>
  Promise.resolve({
    n: M.SHOP_MARKET_N,
    layout: M.SHOP_MARKET_LAYOUT,
    pieces: M.SHOP_MARKET_PIECES,
    crateAt: [0, 0] as const,
    lights: M.SHOP_MARKET_LIGHTS,
    pools: M.SHOP_MARKET_POOLS,
    outside: "#d9dcdf",
    fixCam: M.SHOP_MARKET_CAM,
    seeThru: ["entrance", "hem", "plant"],
    sign: { piece: "counter", face: M.SHOP_MARKET_COUNTER_SIGN, lines: ["BOARDS"], ink: "#143026" },
  });

const fin = (def: string, color: string, color2 = "pearl") => ({ def, color, color2, blemish: 10, seed: 7 });
/** The items on the tables' blocks (real ItemArt): hats and things from the crates. */
const ITEMS = [fin("pirate-hat", "red"), fin("little-crown", "yellow"), fin("wizard-hat", "cobalt"), fin("santa-hat", "red"), fin("dark-shades", "midnight"), fin("party-hat", "emerald", "yellow")];
const KEEPER: ItemLook = { head: fin("top-hat", "midnight"), skin: fin("suit-and-tie", "midnight", "yellow") };
const SHOPPERS: { look: ItemLook; side: "w" | "b"; at: readonly [number, number] }[] = [
  { look: { head: fin("beanie", "cobalt"), face: fin("scarf", "red") }, side: "w", at: [1.15, 7.2] },
  { look: { head: fin("party-hat", "yellow", "red") }, side: "w", at: [7.2, 4.3] },
];

/** An ItemArt as a picture: drawn once off screen, its SVGs made into one canvas `px` square. */
async function itemPicture(f: ReturnType<typeof fin>, px: number): Promise<HTMLCanvasElement> {
  const host = document.createElement("div");
  host.style.cssText = `position:fixed;left:-10000px;top:0;width:${px}px;height:${px}px`;
  document.body.append(host);
  render(h(ItemArt, { def: f.def, finish: f }), host);
  await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
  const c = document.createElement("canvas");
  c.width = c.height = px;
  const g = c.getContext("2d")!;
  const box = host.getBoundingClientRect();
  for (const svg of Array.from(host.querySelectorAll("svg"))) {
    const r = svg.getBoundingClientRect();
    const copy = svg.cloneNode(true) as SVGSVGElement;
    copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    copy.setAttribute("width", String(r.width));
    copy.setAttribute("height", String(r.height));
    const img = new Image();
    await new Promise<void>((ok) => {
      img.onload = () => ok();
      img.onerror = () => ok();
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(copy))}`;
    });
    if (img.naturalWidth) g.drawImage(img, r.left - box.left, r.top - box.top, r.width, r.height);
  }
  render(null, host);
  host.remove();
  return c;
}

const YOU_SQ = 1.45;
const pt = newPt();
/** A dressed pawn standing at (c, r), as the room draws you. */
function pawnAt(d: FxDraw, a: YouArt | HTMLCanvasElement, c: number, r: number, sq = YOU_SQ) {
  if (!proj(d.v, c - d.camX, d.camY - r, 0, pt)) return;
  const img = a instanceof HTMLCanvasElement ? a : a.img;
  const pad = a instanceof HTMLCanvasElement ? 0 : a.pad;
  const kk = 1 + 2 * pad;
  const hh = sq * kk * pt.k;
  const g = d.g;
  g.save();
  g.fillStyle = "rgba(20,18,16,0.28)";
  g.beginPath();
  g.ellipse(pt.x, pt.y, 0.3 * sq * pt.k, 0.09 * sq * pt.k, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();
  g.imageSmoothingEnabled = true;
  g.drawImage(img, pt.x - hh / 2, pt.y - ((pad + PAWN_FOOT) / kk) * hh, hh, hh);
}

async function makeFx(): Promise<RoomFx> {
  const walls = { z: 0.01, draw: sideWalls(M.SHOP_MARKET_SIDE_WALL_GRID, M.SHOP_MARKET_N, M.SHOP_MARKET_WALL_H) };
  const PX = 160;
  const keeper = (await dressedPawn(KEEPER, pawnImage("light", null), PX, "w")) ?? pawnImage("light", null);
  const shoppers = await Promise.all(SHOPPERS.map(async (s) => ({ ...s, art: (await dressedPawn(s.look, pawnImage(s.side === "w" ? "light" : "dark", null), PX, s.side)) ?? pawnImage(s.side === "w" ? "light" : "dark", null) })));
  const items = await Promise.all(ITEMS.map((f) => itemPicture(f, 96)));
  const ITEM_PX = 24; // an item's box on its block, in room pixels
  const figs: { z: number; draw: (d: FxDraw) => void }[] = [walls];
  if (q.get("keeper") !== "0") figs.push({ z: M.SHOP_MARKET_KEEPER_AT[1], draw: (d) => pawnAt(d, keeper, M.SHOP_MARKET_KEEPER_AT[0], M.SHOP_MARKET_KEEPER_AT[1]) });
  M.SHOP_MARKET_ITEM_SPOTS.forEach((sp, i) =>
    figs.push({
      z: sp.r + 0.02,
      draw: (d) => {
        if (!proj(d.v, sp.c - d.camX, d.camY - sp.r, 0, pt)) return;
        const s = pt.k / 37;
        d.g.imageSmoothingEnabled = true;
        d.g.drawImage(items[i % items.length]!, pt.x - (ITEM_PX * s) / 2, pt.y - (M.SHOP_MARKET_ITEM_LIFT + ITEM_PX - 2) * s, ITEM_PX * s, ITEM_PX * s);
      },
    }),
  );
  const featured = await Promise.all([fin("fire-ice-crown", "oceanic"), fin("parrot", "red", "yellow")].map((f) => itemPicture(f, 120)));
  M.SHOP_MARKET_PLINTHS.forEach((sp, i) =>
    figs.push({
      z: sp.r + 0.02,
      draw: (d) => {
        if (!proj(d.v, sp.c - d.camX, d.camY - sp.r, 0, pt)) return;
        const s = pt.k / 37;
        const px = 30;
        d.g.imageSmoothingEnabled = true;
        d.g.drawImage(featured[i]!, pt.x - (px * s) / 2, pt.y - (M.SHOP_MARKET_PLINTH_LIFT + px - 3) * s, px * s, px * s);
      },
    }),
  );
  if (q.get("shoppers") !== "0") for (const s of shoppers) figs.push({ z: s.at[1], draw: (d) => pawnAt(d, s.art, s.at[0], s.at[1]) });
  return { figures: () => figs };
}

export function ShopMock({ talkCard, atKeeper }: { talkCard: ComponentChildren; atKeeper: boolean }) {
  const [room, setRoom] = useState<{ room: LoadedRoom; fx: RoomFx } | null>(null);
  const ctl = useRef<ShopCtl | null>(null);
  useEffect(() => void Promise.all([loadRoomWith("market", DEF, art), makeFx()]).then(([room, fx]) => setRoom({ room, fx })), []);
  const at = q.get("at")?.split(",").map(Number);
  if (!room) return null;
  return (
    <ShopRoom
      room={room.room}
      youArt={() => null}
      youRider={() => null}
      youName={() => "Player"}
      onZoom={() => {}}
      onOut={() => {}}
      onReady={() => {
        if (q.get("zoom") === "in") (ctl.current as unknown as { zoom?: (n: number) => void })?.zoom?.(1);
        setTimeout(() => document.documentElement.setAttribute("data-room", "1"), 1200);
      }}
      ctl={ctl}
      fx={room.fx}
      talkCard={talkCard ?? undefined}
      atKeeper={atKeeper}
      at={at && at.length === 2 ? { c: at[0]!, r: at[1]! } : null}
    />
  );
}
