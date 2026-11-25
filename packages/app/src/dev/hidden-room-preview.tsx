/**
 * Dev only (not in the build): the Hidden Boss's room, a MOCKUP for Eric (Nov 12), drawn by the real room (town/shops/ShopRoom.tsx)
 * with its scene (town/shops/recluse-scene.ts). `npm run dev`, then /hidden-room-preview.html. No home in the town opens the room yet.
 *
 * Switches in the address: `?t=<ms>` starts the child's game that far in (a still mid-game); `?summon=<ms>` starts the summoning that
 * long after the room is ready; `?ui=0` hides the preview's buttons (for stills); `?walls=cards` draws the side walls as round 1 did (a
 * paper card a square) instead of one surface each. Test hooks: `window.__hiddenRoom()` (the summoning's
 * time, the child's half-move and step), `window.__hiddenSummon()`, `window.__hiddenSeek(ms)` (the child's loop to that time).
 */
import { render } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { HomeId } from "../town/world.ts";
import type { ShopDef } from "../town/shops/shops.ts";
import { ShopRoom, loadRoomWith, type LoadedRoom, type RoomArt, type ShopCtl } from "../town/shops/ShopRoom.tsx";
import { recluseScene } from "../town/shops/recluse-scene.ts";
import { roomLight, skyNow } from "../town/sky.ts";
import "../styles.css";
import "../town/town.css";

/** The room's def (the mockup's own; in no list a home opens): no Shopkeeper, nowhere to talk, a sunny room. */
const DEF: ShopDef = {
  // (No home yet: a key of its own, never in SHOPS.)
  home: "recluse" as HomeId,
  boss: "the Hidden Boss",
  crate: null,
  kid: "zebrakeeper",
  hideKid: true,
  at: [0, 0],
  keeper: [{ c: 0, r: 0 }],
  talkAt: [],
  prizes: [],
  roof: "lodge",
  chatTone: "day",
};
const cards = new URLSearchParams(location.search).get("walls") === "cards";
const art = (): Promise<RoomArt> =>
  import("../town/shops/recluse-art.ts").then((m) => ({
    n: m.SHOP_RECLUSE_N,
    layout: cards ? m.SHOP_RECLUSE_LAYOUT_CARDS : m.SHOP_RECLUSE_LAYOUT,
    // (`?sky=day|dawn|dusk|night` as on /town, else the device's clock: the room's light, as the town's room loads it.)
    ...m.recluseLit(roomLight(skyNow())),
    crateAt: [0, 0] as const,
    upright: ["bed"],
    standing: [...m.SHOP_RECLUSE_STANDING, ...m.SHOP_RECLUSE_SCENE.players.map(([c, r]) => ({ c: Math.round(c), r: Math.round(r) }))],
    outside: "#2a1d14",
    fixCam: m.SHOP_RECLUSE_CAM,
  }));

function Preview() {
  const q = new URLSearchParams(location.search);
  const scene = useMemo(() => recluseScene(Number(q.get("t") ?? 0), !cards), []);
  const [room, setRoom] = useState<LoadedRoom | null>(null);
  const [ended, setEnded] = useState(false);
  const ctl = useRef<ShopCtl | null>(null);
  useEffect(() => void loadRoomWith("recluse", DEF, art).then(setRoom), []);
  const summon = () => {
    setEnded(false);
    scene.summon(performance.now());
  };
  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__hiddenRoom = () => scene.state();
    w.__hiddenSummon = summon;
    w.__hiddenSeek = (ms: number) => scene.seek(ms);
    const id = setInterval(() => {
      const t = scene.state().summonT;
      if (t !== null && t > 6900) setEnded(true);
    }, 200);
    return () => clearInterval(id);
  }, []);
  const ready = () => {
    const at = q.get("summon");
    if (at !== null) setTimeout(summon, Number(at));
  };
  const ui = q.get("ui") !== "0";
  return (
    <div class="town-screen" style={{ background: "#000" }}>
      <div class="town-box town-inside">
        {room && <ShopRoom room={room} youArt={() => null} youRider={() => null} youName={() => "You"} onZoom={() => {}} onOut={() => {}} onReady={ready} ctl={ctl} fx={scene.fx} />}
        {ended && <div style={{ position: "absolute", inset: 0, zIndex: 9, display: "grid", placeItems: "center", color: "#fff", font: "600 18px Archivo, system-ui, sans-serif" }}>The match starts here (the child, form 1)</div>}
        {ui && (
          <div style={{ position: "absolute", left: 12, bottom: 12, zIndex: 10, display: "flex", gap: 8 }}>
            <button type="button" class="town-btn primary" onClick={summon}>
              Summon
            </button>
            <button type="button" class="town-btn" onClick={() => (setEnded(false), scene.reset())}>
              Reset
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

render(<Preview />, document.getElementById("app")!);
