/**
 * MOCKUP ONLY (Nov 28, the town shop: not in the build, not for merge). `npm run dev`, then /town-shop-mockup.html.
 *
 *   ?view=sheet                      every board skin, a full board each, with the marks strip under it
 *   ?view=room                       the shop's room, drawn by the real room (town/shops/ShopRoom.tsx) from market-art.ts
 *   ?view=room&card=list             ... with the board keeper's list open
 *   ?view=room&card=preview          ... with a board's preview open (&skin=<id>, &ply=<n>)
 *   ?view=room&card=loading          ... with the preview still loading
 *   &at=c,r                          where you stand; &zoom=in the room's close camera
 */
import { render, type ComponentChildren } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import "../board/pieces.css";
import "../styles.css";
import "../town/town.css";
import { OwnBoard } from "../board/OwnBoard.tsx";
import { RankEmblem } from "../components/RankEmblem.tsx";
import { Coin } from "../components/Coin.tsx";
import { SKINS, skinCss, skinOf, skinVars, type Skin } from "./town-shop-skins.ts";

const q = new URLSearchParams(location.search);
const view = q.get("view") ?? "room";

// ---- A board in a skin (the game's own board, its colors from the skin's variables, a rank board's frame over its edge).

function SkinBoard({ skin, px, fen, lastMove, marks, coords = true }: { skin: Skin; px: number; fen: string; lastMove?: string; marks?: Record<string, string>; coords?: boolean }) {
  const fw = Math.max(3, Math.round(px * 0.0135));
  return (
    <div class={`skin-${skin.id}${skin.frame ? " skin-framed" : ""}${coords ? "" : " skin-nocoords"}`} style={{ width: `${px}px`, height: `${px}px`, "--fw": `${fw}px`, ...skinVars(skin) }}>
      <OwnBoard fen={fen} orientation="white" lastMove={lastMove ?? null} marks={marks} animate={false} silent small={!coords} />
    </div>
  );
}

/** The sheet's position: 1. e4 d5 2. exd5 Qxd5 3. Nc3 Qe5+, the c3 knight picked up (it can block on e2 or e4). */
const SHEET_FEN = "rnb1kbnr/ppp1pppp/8/4q3/8/2N5/PPPP1PPP/R1BQKBNR w KQkq - 2 4";
const SHEET_LAST = "d5e5";
const SHEET_MARKS = { e1: "check", c3: "selected", e2: "move-dest", e4: "move-dest" };

/** The marks strip: each mark on a light and on a dark square, with the pieces it has to stay clear under. */
function MarksStrip({ skin, px }: { skin: Skin; px: number }) {
  const sq = px / 8;
  const cells: { cls?: string; piece?: string }[] = [
    { cls: "bcol-last", piece: "white knight" },
    { cls: "bcol-last", piece: "black knight" },
    { cls: "bcol-dot" },
    { cls: "bcol-dot" },
    { cls: "bcol-ring", piece: "black pawn" },
    { cls: "bcol-ring", piece: "white pawn" },
    { cls: "ms-check", piece: "white king" },
    { cls: "ms-check", piece: "black king" },
  ];
  return (
    <div class="ms-strip hb-pieces" style={{ width: `${px}px`, height: `${sq}px`, ...skinVars(skin) }}>
      {cells.map((c, i) => (
        <span class="ms-cell" style={{ left: `${i * sq}px`, width: `${sq}px`, height: `${sq}px`, background: i % 2 ? skin.dark : skin.light }}>
          {c.cls && <i class={`ms-mark ${c.cls}`} />}
          {c.piece && <piece class={c.piece} style={{ width: "100%", height: "100%" }} />}
        </span>
      ))}
    </div>
  );
}

function Sheet() {
  const px = 320;
  return (
    <div class="sheet">
      <h1>The Pawn Shop: board skins</h1>
      <p class="sheet-sub">
        The same position on every board: Black has just played …Qe5+ (the last move, d5 to e5), White's king is in check, the c3 knight is picked up (dots on e2 and e4). Under each board: the last
        move, a move dot, a capture ring and check, on a light square and on a dark one. The marks are the board's own.
      </p>
      <div class="sheet-grid">
        {SKINS.map((s) => (
          <div class="sheet-cell">
            <div class="sheet-name">
              {s.emblem && <RankEmblem id={s.emblem} />}
              <span>
                <strong>{s.name}</strong>
                <em>{s.tier ? `Rank board: reach ${s.tier}` : "Basic color"}</em>
              </span>
            </div>
            <SkinBoard skin={s} px={px} fen={SHEET_FEN} lastMove={SHEET_LAST} marks={SHEET_MARKS} />
            <MarksStrip skin={s} px={px} />
            <div class="sheet-hex">
              light {s.light} · dark {s.dark}
              <br />
              {s.frame ? `frame ${s.frame.deep} · ${s.frame.metal} (${s.frame.motif})` : "no frame"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- The board keeper's list (the Crates tab's rows: `ff-window crate-row`), in the room's talk card.

/** The mockup's player: Paragon III, 520 coins; owns Walnut and the Gold Board, the Gold Board on. */
const YOU = { coins: 520, tierIndex: 1, owned: new Set(["walnut", "gold"]), on: "gold" };
const TIER_ORDER = ["Gold", "Paragon", "Illustrious", "Sublime", "Radiant", "Pearlescent", "Transcendent"];
const reached = (s: Skin) => !s.tier || TIER_ORDER.indexOf(s.tier) <= YOU.tierIndex;

function Swatch({ skin, px = 56 }: { skin: Skin; px?: number }) {
  // A little board: 4 x 4 of its squares, its frame round it.
  const fw = skin.frame ? 3 : 0;
  return (
    <span class="bk-swatch" style={{ width: `${px}px`, height: `${px}px`, background: skin.frame ? skin.frame.deep : "transparent", boxShadow: skin.frame ? `inset 0 0 0 1px ${skin.frame.metal}` : "none", padding: `${fw}px` }}>
      <span style={{ display: "block", width: "100%", height: "100%", background: `conic-gradient(${skin.light} 25%, ${skin.dark} 0 50%, ${skin.light} 0 75%, ${skin.dark} 0) 0 0 / 50% 50%` }} />
    </span>
  );
}

function BoardRow({ skin }: { skin: Skin }) {
  const owned = YOU.owned.has(skin.id);
  const on = YOU.on === skin.id;
  const open = reached(skin);
  const afford = YOU.coins >= skin.price;
  return (
    <div class={`ff-window crate-row bk-row${open ? "" : " bk-locked"}`} role="button" aria-label={`Preview ${skin.name}`}>
      <span class="crate-row-art bk-art">
        <Swatch skin={skin} />
        <span class="bk-peek" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="M15.5 15.5 21 21" />
          </svg>
        </span>
      </span>
      <span class="crate-row-text">
        <span class="bk-name">
          {skin.emblem && (
            <span class="bk-emblem">
              <RankEmblem id={skin.emblem} />
            </span>
          )}
          <strong>{skin.name}</strong>
        </span>
        <span class="crate-row-held">{on ? "On your board" : owned ? "Owned" : open ? (afford ? (skin.tier ? `${skin.tier}'s colors, framed` : "Two colors, no frame") : `You need ${skin.price - YOU.coins} more coins`) : `Reach ${skin.tier} to buy`}</span>
      </span>
      {owned ? (
        <button type="button" class="ff-button small bk-buy" disabled={on}>
          {on ? "✓ On" : "Put on"}
        </button>
      ) : (
        <button type="button" class="ff-button small bk-buy" disabled={!open || !afford}>
          <Coin size={14} /> {skin.price}
        </button>
      )}
    </div>
  );
}

function BoardList() {
  return (
    <div class="bk-panel">
      <div class="bk-head">
        <span class="ff-title">BOARDS</span>
        <span class="bk-coins">
          <Coin size={16} /> {YOU.coins}
        </span>
      </div>
      <div class="bk-list">
        {SKINS.map((s) => (
          <BoardRow skin={s} />
        ))}
      </div>
      <button type="button" class="town-btn bk-close">
        Close
      </button>
    </div>
  );
}

// ---- A board's preview (the locker's magnifier: `ff-window locker-dialog item-preview`), an opening playing on it.

/** The Italian, five moves: its position after each half-move. */
const ITALIAN: readonly { san: string; uci: string; fen: string }[] = [
  { san: "e4", uci: "e2e4", fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1" },
  { san: "e5", uci: "e7e5", fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2" },
  { san: "Nf3", uci: "g1f3", fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2" },
  { san: "Nc6", uci: "b8c6", fen: "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3" },
  { san: "Bc4", uci: "f1c4", fen: "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3" },
  { san: "Bc5", uci: "f8c5", fen: "r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4" },
  { san: "c3", uci: "c2c3", fen: "r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/2P2N2/PP1P1PPP/RNBQK2R b KQkq - 0 4" },
  { san: "Nf6", uci: "g8f6", fen: "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2P2N2/PP1P1PPP/RNBQK2R w KQkq - 1 5" },
  { san: "d3", uci: "d2d3", fen: "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2PP1N2/PP3PPP/RNBQK2R b KQkq - 0 5" },
  { san: "d6", uci: "d7d6", fen: "r1bqk2r/ppp2ppp/2np1n2/2b1p3/2B1P3/2PP1N2/PP3PPP/RNBQK2R w KQkq - 0 6" },
];

function BoardPreview({ skin, ply, loading, wide }: { skin: Skin; ply: number; loading: boolean; wide: boolean }) {
  const px = wide ? 400 : 304;
  const at = ITALIAN[ply - 1]!;
  const owned = YOU.owned.has(skin.id);
  const open = reached(skin);
  const afford = YOU.coins >= skin.price;
  return (
    <div class="locker-dialog-back bk-back">
      <div class="ff-window locker-dialog item-preview bk-preview" role="dialog" aria-modal="true" style={{ width: `${px + 36}px` }}>
        <span class="bk-stage" style={{ width: `${px}px`, height: `${px}px` }}>
          {loading ? <span class="bk-loading">Loading preview…</span> : <SkinBoard skin={skin} px={px} fen={at.fen} lastMove={at.uci} />}
        </span>
        <div class="bk-moves" aria-label="The Italian Game">
          {ITALIAN.map((m, i) => (
            <span class={loading || i >= ply ? "bk-move bk-next" : i === ply - 1 ? "bk-move bk-now" : "bk-move"}>
              {i % 2 === 0 ? `${i / 2 + 1}. ` : ""}
              {m.san}
            </span>
          ))}
        </div>
        <strong class="bk-title">
          {skin.emblem && <RankEmblem id={skin.emblem} />}
          {skin.name}
        </strong>
        <span class="small item-preview-tier">{skin.tier ? `Rank board · ${skin.tier}` : "Basic board"}</span>
        <span class="small">{owned ? "Owned" : open ? "The Italian Game, playing on a loop" : `Reach ${skin.tier} in 1 v 1 to buy`}</span>
        <div class="locker-dialog-actions bk-actions">
          {owned ? (
            <button type="button" class="ff-button small" disabled={YOU.on === skin.id}>
              {YOU.on === skin.id ? "✓ On your board" : "Put on"}
            </button>
          ) : (
            <button type="button" class="ff-button small" disabled={!open || !afford}>
              Buy · <Coin size={13} /> {skin.price}
            </button>
          )}
          <button type="button" class="ff-button small">
            ▶ Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- The room.

function Room() {
  const card = q.get("card") ?? "none";
  const [mod, setMod] = useState<typeof import("./town-shop-room.tsx") | null>(null);
  useEffect(() => void import("./town-shop-room.tsx").then(setMod), []);
  const wide = innerWidth >= 700;
  const list = card === "list" || card === "preview" || card === "loading";
  return (
    <div class="town-screen" style={{ background: "#000" }}>
      <div class="town-box town-inside">
        {mod && <mod.ShopMock talkCard={list ? <BoardList /> : null} atKeeper={list} />}
        {(card === "preview" || card === "loading") && <BoardPreview skin={skinOf(q.get("skin") ?? "paragon")} ply={Number(q.get("ply") ?? 5)} loading={card === "loading"} wide={wide} />}
      </div>
    </div>
  );
}

const CSS = `
${skinCss()}
.skin-nocoords .hb-coords { display: none; }
body { margin: 0; }
.sheet { padding: 22px 26px 30px; background: #f3f1ec; color: #20232a; font-family: Archivo, system-ui, sans-serif; width: max-content; }
.sheet h1 { margin: 0 0 4px; font-size: 24px; }
.sheet h2 { margin: 22px 0 10px; font-size: 15px; }
.sheet-sub { margin: 0; max-width: 1330px; font-size: 13px; line-height: 1.45; color: #4a5163; }
.sheet-grid { display: grid; grid-template-columns: repeat(4, 320px); gap: 20px 20px; margin-top: 14px; }
.sheet-name span { display: grid; }
.sheet-name em { font-style: normal; font-size: 12px; color: #4a5163; }
.sheet-cell { display: grid; gap: 6px; }
.sheet-name { display: flex; align-items: center; gap: 6px; height: 48px; font-size: 15px; }
.sheet-hex { font: 11px ui-monospace, monospace; color: #4a5163; }
.ms-strip { position: relative; }
.ms-cell { position: absolute; top: 0; }
.ms-cell piece { position: absolute; inset: 0; }
.ms-mark { position: absolute; inset: 0; }
.ms-check { background: radial-gradient(ellipse at center, rgba(255, 0, 0, 1) 0%, rgba(231, 0, 0, 1) 25%, rgba(169, 0, 0, 0) 89%, rgba(158, 0, 0, 0) 100%); }

.town-card.town-mid:has(.bk-panel) { width: min(372px, calc(100% - 16px)); max-width: none; padding: 10px; box-sizing: border-box; }
.town-card.town-mid:has(.bk-panel) > h2 { display: none; }
.town-card.town-mid:has(.bk-panel)::after, .town-card.town-mid:has(.bk-panel)::before { display: none; }
.bk-panel { display: grid; gap: 8px; }
.bk-head { display: flex; align-items: center; justify-content: space-between; padding: 2px 4px 0; color: #fff; }
.bk-coins { display: inline-flex; align-items: center; gap: 5px; font-weight: 800; font-size: 15px; }
.bk-list { display: grid; gap: 8px; align-content: start; height: min(376px, 50vh); overflow-y: auto; padding: 3px 5px 3px 3px; scrollbar-width: thin; }
.bk-row { grid-template-columns: 56px 1fr auto; gap: 10px; padding: 8px 10px; cursor: pointer; height: 74px; box-sizing: border-box; }
.bk-row .crate-row-text { gap: 5px; min-width: 0; }
.bk-row .crate-row-text strong { font-size: 9px; line-height: 1.45; }
.bk-row .crate-row-held { font-size: 12px; line-height: 1.25; }
.bk-name { display: flex; align-items: center; gap: 6px; min-height: 26px; }
.bk-art { width: 56px; height: 56px; }
.bk-swatch { display: block; box-sizing: border-box; border-radius: 3px; overflow: hidden; }
.bk-emblem { flex: none; width: 26px; height: 26px; }
.bk-emblem .re-box { transform: scale(0.5417); transform-origin: 0 0; }
.bk-locked .crate-row-held { color: #ffd877; }
.bk-peek { position: absolute; right: -5px; bottom: -5px; display: grid; place-items: center; width: 22px; height: 22px; color: #0b0b1a; background: #f4f4f4; border: 2px solid #0b0b1a; border-radius: 50%; }
.bk-buy { display: inline-flex; align-items: center; justify-content: center; gap: 4px; min-width: 78px; min-height: 40px; padding: 8px 6px; }
.bk-close { justify-self: center; min-width: 120px; }
.bk-back { position: absolute; z-index: 60; }
.bk-preview { gap: 7px; }
.bk-stage { display: grid; place-items: center; background: #0a1150; border: 3px solid #f4f4f4; border-radius: 6px; box-sizing: content-box; }
.bk-loading { font: 12px "Press Start 2P", ui-monospace, monospace; color: #fff; opacity: 0.9; }
.bk-moves { display: flex; flex-wrap: wrap; justify-content: center; gap: 2px 5px; font-size: 12px; font-weight: 700; min-height: 36px; align-content: center; }
.bk-move.bk-next { opacity: 0.38; }
.bk-move.bk-now { color: #ffd877; }
.bk-title { display: inline-flex; align-items: center; gap: 4px; font-family: "Press Start 2P", ui-monospace, monospace; font-size: 12px; text-shadow: 2px 2px 0 #0b0b1a; min-height: 48px; }
.bk-actions { grid-template-columns: 1fr 1fr; }
.bk-actions .ff-button { display: inline-flex; align-items: center; justify-content: center; gap: 4px; min-height: 40px; }
`;

function App({ children }: { children: ComponentChildren }) {
  return (
    <>
      <style>{CSS}</style>
      {children}
    </>
  );
}

void useMemo;
void useRef;
render(<App>{view === "sheet" ? <Sheet /> : <Room />}</App>, document.getElementById("app")!);
// (For the stills: the fonts in before a shot.)
void document.fonts.ready.then(() => document.documentElement.setAttribute("data-fonts", "1"));
