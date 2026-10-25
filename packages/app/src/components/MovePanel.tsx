import type { ComponentChildren } from "preact";
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { createPortal, memo } from "preact/compat";
import { bossAlone, cutLabel, roundLive, scoreDp, towerView, type BossView, type GameView } from "../game.ts";
import { battleStartPly, moveNumber, moverOf, newPlyCache, noteTurns, pieceOn, plyRows, timeShown, turnBook, turnMs, type Mover, type PieceType, type PlyCache, type PlyRow } from "../move-list.ts";
import { camoHidden, seenFen } from "../camo.ts";
import { pawnLook } from "../looks.ts";
import { bossPortraitUrl } from "./BossCharacter.tsx";
import { godKingPortraitUrl } from "./GodKing.tsx";
import { Avatar } from "./Items.tsx";
import { TowerFit } from "./MiniTower.tsx";
import { RaceTower } from "./RaceTower.tsx";
import { ChatPanel, chatOf, matchPeople, useMedia } from "./QuickChat.tsx";
import { COMPUTER_LAYOUT } from "./MatchMenu.tsx";

/**
 * The boss battle's move list and the panel it shares with the scoreboard (Eric, Oct 25; docs/decisions/2026-10-25-board-layout.md):
 *
 * - `MoveList`: one row per move of the battle, newest at the bottom, kept scrolled to the newest unless you scrolled up:
 *   who moved (the boss's portrait; the God King's when he played the crowd's move; alone, your own pawn; in a raid the
 *   crowd's pawn with how many picked the move), the move number, the piece and the square it went to, what it took, and how
 *   long it took. The moves are the match's history (move-list.ts), drawn as the crowd sees them (camo.ts).
 * - `BossPanel` (a phone): the panel under the board, left of the God King. With other players, "Players" / "Moves" (and
 *   "Chat" with chat on) switch it; alone, the moves only. A tap opens it full size over the board (`PanelSheet`), where it
 *   scrolls; its ✕, Escape or a tap outside closes it.
 * - `MoveSide` (a computer): the list in the column right of the board, above the God King.
 */

const PIECE: Record<PieceType, string> = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };
const COLOR = { w: "white", b: "black" } as const;

/** A row as the list shows it. */
interface Shown {
  row: PlyRow;
  mover: Mover;
  piece: PieceType;
  captured: PieceType | null;
  ms: number | null;
  picks: { n: number; of: number } | null;
}

const caches = new WeakMap<object, PlyCache>();

/** The battle's rows now (and the opening's count before it), noting this moment's turns first. */
function shownRows(match: GameView, boss: BossView): { rows: Shown[]; opening: number } {
  const board = boss.board;
  const book = turnBook(match);
  noteTurns(book, { phase: match.phase, board }, Date.now());
  let cache = caches.get(match);
  if (!cache) caches.set(match, (cache = newPlyCache()));
  const all = plyRows(cache, `${board.id}:${board.generation}`, board.history, board.bases);
  const start = Math.min(battleStartPly(boss.startMove), all.length);
  const hidden = camoHidden();
  const rows: Shown[] = [];
  for (let i = start; i < all.length; i++) {
    const row = all[i]!;
    let piece = row.piece;
    let captured = row.captured;
    // (Smudgy's hidden rook is a pawn wherever the crowd sees it: its moves and a capture of it read so here too.)
    if (hidden && (piece === "r" || captured === "r")) {
      const seen = seenFen(row.fenBefore);
      piece = pieceOn(seen, row.move.slice(0, 2))?.type ?? piece;
      if (captured === "r") captured = pieceOn(seen, row.to)?.type ?? captured;
    }
    const mover = moverOf(row, boss.crowdSide, start, boss.kingMoves ?? []);
    rows.push({ row, mover, piece, captured, ms: turnMs(book, row.ply), picks: mover === "crowd" || mover === "king" ? (book.picks.get(row.ply) ?? null) : null });
  }
  return { rows, opening: start };
}

/** A piece drawn with the board's own pieces. */
const Pc = ({ color, type }: { color: "w" | "b"; type: PieceType }) => (
  <span class="mv-pc hb-pieces" aria-hidden="true">
    <piece class={`${COLOR[color]} ${PIECE[type]}`} />
  </span>
);

/** Who moved: a small picture. */
function Who({ mover, boss, alone }: { mover: Mover; boss: BossView; alone: boolean }) {
  if (mover === "boss") {
    const url = bossPortraitUrl(boss.name);
    return <span class="mv-who">{url ? <img src={url} alt="" /> : boss.icon}</span>;
  }
  if (mover === "king") {
    const url = godKingPortraitUrl(boss.crowdSide);
    return <span class="mv-who">{url ? <img src={url} alt="" /> : "👑"}</span>;
  }
  if (mover === "crowd" && alone) {
    return (
      <span class="mv-who mv-you">
        <Avatar look={pawnLook({ id: "", isYou: true, isBot: false }).look} side={boss.crowdSide} />
      </span>
    );
  }
  return (
    <span class="mv-who">
      <Pc color={boss.crowdSide} type="p" />
    </span>
  );
}

const WHO_WORD: Record<Mover, string> = { boss: "Boss", crowd: "Crowd", king: "God King", opening: "Opening" };

type RowProps = { s: Shown; boss: BossView; alone: boolean; hush: boolean };
/** (Drawn again only when what it shows changes: its PlyRow is the cache's, the same object from draw to draw.) */
const sameRow = (a: RowProps, b: RowProps) =>
  a.s.row === b.s.row &&
  a.s.mover === b.s.mover &&
  a.s.piece === b.s.piece &&
  a.s.captured === b.s.captured &&
  a.s.ms === b.s.ms &&
  a.s.picks?.n === b.s.picks?.n &&
  a.s.picks?.of === b.s.picks?.of &&
  a.hush === b.hush &&
  a.alone === b.alone &&
  a.boss.name === b.boss.name &&
  a.boss.crowdSide === b.boss.crowdSide;

const MoveRow = memo(function MoveRow({ s, boss, alone, hush }: RowProps) {
  const { row } = s;
  const other = row.color === "w" ? "b" : "w";
  const who = s.mover === "crowd" && alone ? "You" : WHO_WORD[s.mover];
  const words = hush
    ? `${moveNumber(row.ply)} ${who}`
    : `${moveNumber(row.ply)} ${who}: ${row.castle ?? `${PIECE[s.piece]} to ${row.to}`}${s.captured ? `, takes ${PIECE[s.captured]}` : ""}${s.ms !== null ? `, ${timeShown(s.ms)}` : ""}`;
  return (
    <li class={`mv-row mv-${s.mover}`} aria-label={words}>
      <Who mover={s.mover} boss={boss} alone={alone} />
      <span class="mv-no">{moveNumber(row.ply)}</span>
      {hush ? (
        <span class="mv-sq">…</span>
      ) : (
        <>
          <Pc color={row.color} type={s.piece} />
          <span class="mv-sq">{row.castle ?? row.to}</span>
          {row.promo && <Pc color={row.color} type={row.promo} />}
          {s.captured && (
            <span class="mv-x">
              ×<Pc color={other} type={s.captured} />
            </span>
          )}
        </>
      )}
      <span class="mv-gap" />
      {s.picks && s.picks.of > 1 && <span class="mv-picks">{`${s.picks.n}/${s.picks.of}`}</span>}
      <span class="mv-time">{s.ms !== null ? timeShown(s.ms) : ""}</span>
    </li>
  );
}, sameRow);

/**
 * The list itself, in a box that scrolls (`scroll`: the computer's column and the sheet; a phone's small panel shows the
 * newest rows that fit and never scrolls). `hushLast`: the newest move isn't named yet (Smudgy's reveal under the paint).
 */
export function MoveList({ match, hushLast = false, scroll = true, onOpen }: { match: GameView; hushLast?: boolean; scroll?: boolean; onOpen?: () => void }) {
  const boss = match.boss;
  const box = useRef<HTMLDivElement>(null);
  const stuck = useRef(true);
  const data = boss ? shownRows(match, boss) : null;
  const n = data?.rows.length ?? 0;
  // Kept at the newest row, unless the reader scrolled up.
  useLayoutEffect(() => {
    const el = box.current;
    if (el && stuck.current) el.scrollTop = el.scrollHeight;
  }, [n]);
  if (!boss || !data) return null;
  const alone = bossAlone(match);
  // (Hollow's Lights out: the board's pieces are to be remembered, so the list waits until it's over.)
  const lights = match.phase.kind === "boss" && !!match.phase.lights;
  return (
    <div
      class={`mv-box${scroll ? " mv-scroll" : ""}`}
      ref={box}
      onScroll={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        stuck.current = el.scrollTop + el.clientHeight >= el.scrollHeight - 4;
      }}
      onClick={onOpen}
    >
      {lights ? (
        <p class="mv-empty">Lights out: the moves come back after.</p>
      ) : (
        <ol class="mv-list" aria-label="Moves">
          {data.opening > 0 && (
            <li class="mv-row mv-opening">
              <span class="mv-open-words">
                {boss.openingName ? `${boss.openingName} · ` : "Opening · "}
                {data.opening} {data.opening === 1 ? "move" : "moves"}
              </span>
            </li>
          )}
          {data.rows.map((s, i) => (
            <MoveRow key={s.row.ply} s={s} boss={boss} alone={alone} hush={hushLast && i === data.rows.length - 1 && s.mover === "boss"} />
          ))}
          {!data.rows.length && <li class="mv-empty">No moves yet.</li>}
        </ol>
      )}
    </div>
  );
}

/**
 * Where the panel sits under the board, left of the God King: a phone upright, its locked screen (styles.css, "Phones:
 * one locked screen"). A computer has the moves beside the board; a phone on its side or a short window keeps the old dock
 * and the scoreboard under it.
 */
export const STRIP_LAYOUT = "(max-width: 899px) and (min-height: 520px)";

/** The phone panel's tabs. */
export type PanelTab = "players" | "moves" | "chat";

/** The panel's state, kept across the battle's screens (each turn mounts them anew): the tab shown, and the sheet. */
const panel = { tab: "players" as PanelTab, sheet: null as object | null, subs: new Set<() => void>() };
const panelSet = (next: Partial<Pick<typeof panel, "tab" | "sheet">>) => {
  Object.assign(panel, next);
  for (const f of panel.subs) f();
};
function usePanel() {
  const [, redraw] = useState(0);
  useEffect(() => {
    const f = () => redraw((n) => n + 1);
    panel.subs.add(f);
    return () => void panel.subs.delete(f);
  }, []);
  return panel;
}

const TAB_WORD: Record<PanelTab, string> = { players: "Players", moves: "Moves", chat: "Chat" };


/**
 * A phone: the panel left of the God King under the board (BossDock's `panel`). With other players, a small switch picks
 * "Players" (the scoreboard) or "Moves" (and "Chat" when the match has chat on); alone, the moves only. The same box
 * either way; a tap on the scoreboard or the moves opens them full size over the board.
 */
export function BossPanel({ match, hushLast = false }: { match: GameView; hushLast?: boolean }) {
  const p = usePanel();
  const alone = bossAlone(match);
  const chat = chatOf(match);
  const tabs: PanelTab[] = alone ? ["moves"] : chat && !chat.off ? ["players", "moves", "chat"] : ["players", "moves"];
  const tab = tabs.includes(p.tab) ? p.tab : tabs[0]!;
  const open = () => panelSet({ sheet: match });
  const unread = tab !== "chat" && chat ? chat.unread() : 0;
  return (
    <section class={`bp${alone ? " bp-alone" : ""}`} aria-label={alone ? "Moves" : "Players and moves"}>
      {tabs.length > 1 && (
        <div class="bp-tabs" role="tablist">
          {tabs.map((t) => (
            <button key={t} type="button" role="tab" class={`bp-tab${t === tab ? " on" : ""}`} aria-selected={t === tab} onClick={() => panelSet({ tab: t })}>
              {TAB_WORD[t]}
              {t === "chat" && unread > 0 && <span class="bp-unread"> {unread}</span>}
            </button>
          ))}
        </div>
      )}
      <div class="bp-body">
        {tab === "players" ? (
          <TowerFit match={match} floats={chat?.floats()} onOpen={open} />
        ) : tab === "moves" ? (
          <MoveList match={match} hushLast={hushLast} scroll={false} onOpen={open} />
        ) : (
          <ChatPanel people={matchPeople(match)} chat={chat!} variant="full" />
        )}
      </div>
      {p.sheet === match && tab !== "chat" && typeof document !== "undefined" && createPortal(<PanelSheet match={match} tab={tab} tabs={tabs.filter((t) => t !== "chat")} hushLast={hushLast} />, document.body)}
    </section>
  );
}

/** The panel full size, over the board (a phone): it scrolls; ✕, Escape or a tap outside closes it. */
function PanelSheet({ match, tab, tabs, hushLast }: { match: GameView; tab: PanelTab; tabs: PanelTab[]; hushLast: boolean }) {
  const close = () => panelSet({ sheet: null });
  const sheet = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && close();
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, []);
  // Its top at the board's: it covers the board and what's under it, never the title line or the boss's bar.
  useLayoutEffect(() => {
    const board = document.querySelector(".screen.game .board-area .board-row > .board-wrap")?.getBoundingClientRect();
    if (board && sheet.current) sheet.current.style.top = `${Math.max(8, Math.round(board.top))}px`;
  }, []);
  const view = tab === "players" ? towerView(match) : null;
  return (
    <div class="bp-sheet-back" onClick={close}>
      <div class="bp-sheet" ref={sheet} role="dialog" aria-modal="true" aria-label={tab === "players" ? "Leaderboard" : "Moves"} onClick={(e) => e.stopPropagation()}>
        <div class="bp-sheet-head">
          {tabs.length > 1 ? (
            <div class="bp-tabs" role="tablist">
              {tabs.map((t) => (
                <button key={t} type="button" role="tab" class={`bp-tab${t === tab ? " on" : ""}`} aria-selected={t === tab} onClick={() => panelSet({ tab: t })}>
                  {TAB_WORD[t]}
                </button>
              ))}
            </div>
          ) : (
            <strong class="bp-sheet-title">{TAB_WORD[tab]}</strong>
          )}
          <button type="button" class="bp-x" aria-label="Close" onClick={close}>
            ✕
          </button>
        </div>
        <div class="bp-sheet-body">
          {view ? (
            <RaceTower standings={view.standings} cutoff={view.cutoff} done={roundLive(match) ? match.done : undefined} cutLabel={cutLabel(match)} dp={scoreDp(match.settings)} />
          ) : (
            <MoveList match={match} hushLast={hushLast} />
          )}
        </div>
      </div>
    </div>
  );
}

/** A computer: the moves in the column right of the board, above the God King (styles.css, .mv-side). */
export function MoveSide({ match, hushLast = false }: { match: GameView; hushLast?: boolean }) {
  return (
    <section class="mv-side" aria-label="Moves">
      <div class="mv-side-head">Moves</div>
      <MoveList match={match} hushLast={hushLast} />
    </section>
  );
}

/** Which of the boss screens' layouts this window has (MovePanel's strip, a computer's column, or neither). */
export function useBossLayout(): { strip: boolean; computer: boolean } {
  return { strip: useMedia(STRIP_LAYOUT), computer: useMedia(COMPUTER_LAYOUT) };
}

/**
 * What a boss screen draws after its dock (`under`: the screen's scoreboard and chat, UnderBoard). A phone upright: nothing,
 * the dock's strip has the panel. A computer: the moves in the column right of the board, then `under`, which keeps the
 * scoreboard where it was (Boss alone has none: Eric, Oct 25, "no scoreboard at all" when you're alone). Otherwise (a
 * phone on its side, a short window): `under` as before, or the moves alone in Boss alone.
 */
export function besideBoard(match: GameView, layout: { strip: boolean; computer: boolean }, under: ComponentChildren, hushLast = false): ComponentChildren {
  if (layout.strip) return null;
  const alone = bossAlone(match);
  if (layout.computer)
    return (
      <>
        <MoveSide match={match} hushLast={hushLast} />
        {!alone && under}
      </>
    );
  return alone ? <MoveSide match={match} hushLast={hushLast} /> : under;
}
