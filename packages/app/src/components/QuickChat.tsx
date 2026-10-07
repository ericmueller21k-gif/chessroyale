import { Fragment, type ComponentChildren } from "preact";
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { QUICK_CHAT, chatButtonsOf, chatSay, type ChatSay } from "@chessroyale/core";
import type { ChatLine, MatchChat } from "../chat.ts";
import type { GameView } from "../game.ts";
import { chatBubbles, onPrefsChange, setChatBubbles, setUnderBoardMode, underBoardMode, type UnderBoardMode } from "../prefs.ts";
import { openProfile } from "../profile-nav.ts";
import { MiniTower } from "./MiniTower.tsx";
import { UserIcon } from "./PixelIcon.tsx";

/**
 * Quick chat in a match: preset lines and emoji only (see DECISIONS.md, "Quick chat in matches"). It never covers
 * the board and never takes a tap meant for it: the panels sit under the board (a phone) or beside it (a computer),
 * and the bubble lets every tap through.
 */

/** The computer's frame: the leaderboard moves to the side, and chat gets the column beside the board. */
const WIDE = "(min-width: 1100px) and (min-height: 600px)";
/** Big screens (900 px+): phrases wrap in their groups instead of scrolling in a row. */
const ROOMY = "(min-width: 900px) and (min-height: 600px)";

export function useMedia(query: string): boolean {
  const [on, setOn] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const mq = matchMedia(query);
    const fn = () => setOn(mq.matches);
    mq.addEventListener("change", fn);
    fn();
    return () => mq.removeEventListener("change", fn);
  }, [query]);
  return on;
}

/** The chat of a match, if it's on (online Crowd and boss raids, once the match has begun). */
export const chatOf = (match: GameView): MatchChat | null => (match.chat?.enabled ? match.chat : null);

/** Who said a line: their name (from the lobby, never from the message), team, account and whether it's a bot. */
function sender(match: GameView, id: string) {
  const s = match.standings().find((x) => x.id === id);
  return { name: match.nameOf(id), you: match.isYou(id), bot: !!s?.isBot, uid: s?.uid, team: s?.team ?? null };
}

const sideName = (t: "w" | "b") => (t === "w" ? "White" : "Black");

/** A sender's icon: their pixel drawing (sent with their first line), else a pawn. */
function ChatIcon({ chat, id }: { chat: MatchChat; id: string }) {
  return <UserIcon icon={chat.icons.get(id) ?? "♟"} class="qicon" />;
}

/** One line in the feed: icon, name (tap for the menu) and what they said. */
function ChatRow({ match, chat, line, teams, onName, tight }: { match: GameView; chat: MatchChat; line: ChatLine; teams: boolean; onName: (id: string) => void; tight: boolean }) {
  const say = chatSay(line.say);
  if (!say) return null;
  const who = sender(match, line.from);
  const team = line.team ?? who.team;
  return (
    <div class={`qline${who.you ? " you" : ""}${say.kind === "emoji" ? " emoji" : ""}${line.to === "all" && teams ? " all" : ""}`} data-from={line.from}>
      <ChatIcon chat={chat} id={line.from} />
      <button type="button" class="qline-name" onClick={() => onName(line.from)} aria-label={`${who.you ? "You" : who.name}: profile or mute`}>
        {teams && team && line.to === "all" && <span class={`team-chip ${team}`} aria-label={`${sideName(team)} team`} />}
        <span class="qline-who">{who.you ? "You" : who.name}</span>
      </button>
      <span class="qline-text">{say.text}</span>
      {line.to === "all" && teams && !tight && <span class="qline-to">all</span>}
    </div>
  );
}

/** The feed, newest at the bottom. In a phone's split it shows the newest few that fit; elsewhere it scrolls. */
function ChatFeed({ match, chat, scroll, teams, onName, hint }: { match: GameView; chat: MatchChat; scroll: boolean; teams: boolean; onName: (id: string) => void; hint: ComponentChildren }) {
  const lines = chat.lines();
  const muted = chat.mutedIds();
  const box = useRef<HTMLDivElement>(null);
  const newest = lines.at(-1)?.n ?? 0;
  // Stay at the newest line (before the paint, so it never shows scrolled up for a frame).
  useLayoutEffect(() => {
    const el = box.current;
    if (el && scroll) el.scrollTop = el.scrollHeight;
  }, [newest, scroll, !!hint, muted.length]);
  const rows = lines.map((l) => <ChatRow key={l.n} match={match} chat={chat} line={l} teams={teams} onName={onName} tight={!scroll} />);
  const notes = [
    lines.length === 0 && (
      <p key="empty" class="qfeed-empty">
        {teams ? "Tap a line to send it to your team." : "Tap a line to send it."}
      </p>
    ),
    muted.length > 0 && (
      <p key="muted" class="qfeed-empty">
        🔇 Muted this match: {muted.map((id) => match.nameOf(id)).join(", ")}
      </p>
    ),
    hint && (
      <p key="hint" class="qfeed-hint">
        {hint}
      </p>
    ),
  ].filter(Boolean);
  // A phone's split shows only whole lines, newest at the bottom: they're laid out bottom-up and any that don't fit
  // wrap out of sight (no half-cut line at the top).
  if (!scroll) {
    return (
      <div class="qfeed fit" ref={box} role="log" aria-label="Chat messages">
        {[...notes].reverse()}
        {rows.reverse()}
      </div>
    );
  }
  return (
    <div class="qfeed scroll" ref={box} role="log" aria-label="Chat messages">
      {rows}
      {notes}
    </div>
  );
}

/** One phrase or emoji button. Greyed while the limits (or the Team / All switch) don't allow it. */
function SayButton({ chat, say, now }: { chat: MatchChat; say: ChatSay; now: number }) {
  const ok = chat.canSay(say.id, now);
  return (
    <button
      type="button"
      class={`qchip${say.kind === "emoji" ? " emoji" : ""}`}
      disabled={!ok}
      aria-label={say.kind === "emoji" ? `Send ${say.text}` : undefined}
      onClick={(e) => {
        e.stopPropagation();
        chat.say(say.id);
      }}
    >
      {say.text}
    </button>
  );
}

/**
 * The buttons. "rows": a phone's two rows that scroll sideways (phrases by group, then emoji); "groups": each
 * group under its name, wrapping (a computer).
 */
function ChatButtons({ chat, layout, now }: { chat: MatchChat; layout: "rows" | "groups"; now: number }) {
  const { groups, emoji } = chatButtonsOf(chat.packs);
  if (layout === "groups") {
    return (
      <div class="qbuttons groups">
        {groups.map((g) => (
          <div key={g.group.id} class="qgroup" role="group" aria-label={g.group.name}>
            <span class="qgroup-name">{g.group.name}</span>
            <div class="qgroup-lines">
              {g.lines.map((s) => (
                <SayButton key={s.id} chat={chat} say={s} now={now} />
              ))}
            </div>
          </div>
        ))}
        <div class="qgroup" role="group" aria-label="Emoji">
          <div class="qgroup-lines emoji">
            {emoji.map((s) => (
              <SayButton key={s.id} chat={chat} say={s} now={now} />
            ))}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div class="qbuttons rows">
      <div class="qrow" role="group" aria-label="Phrases">
        {groups.map((g) => (
          <Fragment key={g.group.id}>
            <span class="qrow-group">{g.group.name}</span>
            {g.lines.map((s) => (
              <SayButton key={s.id} chat={chat} say={s} now={now} />
            ))}
          </Fragment>
        ))}
      </div>
      <div class="qrow emoji" role="group" aria-label="Emoji">
        {emoji.map((s) => (
          <SayButton key={s.id} chat={chat} say={s} now={now} />
        ))}
      </div>
    </div>
  );
}

/** Expand to full width, or back to side by side. */
function SplitButton({ full, what, onClick }: { full: boolean; what: string; onClick: () => void }) {
  return (
    <button
      type="button"
      class="qhead-btn"
      aria-label={full ? "Side by side" : `${what} full width`}
      title={full ? "Side by side" : `${what} full width`}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {full ? (
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <rect x="2.5" y="4" width="6" height="12" rx="1.5" />
          <rect x="11.5" y="4" width="6" height="12" rx="1.5" />
        </svg>
      ) : (
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M11 3h6v6M17 3l-6 6M9 17H3v-6M3 17l6-6" />
        </svg>
      )}
    </button>
  );
}

/** Minimise the space under the board (both panels to their headers), or open it again. */
function FoldButton({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      class="qhead-btn fold"
      aria-expanded={open}
      aria-label={open ? "Minimise the leaderboard and chat" : "Show the leaderboard and chat"}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
    >
      {open ? "▾" : "▴"}
    </button>
  );
}

/** Team / All: who your Hello and Sporting lines go to (plans, reactions and emoji always stay in your team). */
function ToSwitch({ chat }: { chat: MatchChat }) {
  return (
    <div class="qto" role="group" aria-label="Send to">
      {(["team", "all"] as const).map((to) => (
        <button
          key={to}
          type="button"
          aria-pressed={chat.to === to}
          class={chat.to === to ? "on" : ""}
          onClick={(e) => {
            e.stopPropagation();
            chat.setTo(to);
          }}
        >
          {to === "team" ? "Team" : "All"}
        </button>
      ))}
    </div>
  );
}

export type ChatVariant = "split" | "full" | "side" | "page";

/**
 * The chat panel: header (title, Team / All, the split buttons), the feed, and the buttons. `split` is a phone's
 * half of the space under the board; `full` the whole of it; `side` the computer's column beside the board; `page`
 * a section of a page (results, watching after you're out).
 */
export function ChatPanel({ match, chat, variant, head, fold }: { match: GameView; chat: MatchChat; variant: ChatVariant; head?: ComponentChildren; fold?: ComponentChildren }) {
  const roomy = useMedia(ROOMY);
  const [menu, setMenu] = useState<string | null>(null);
  const [options, setOptions] = useState(false);
  const self = useRef({});
  const feed = useRef<HTMLDivElement>(null);
  const teams = chat.hasTeams();
  const now = Date.now();
  // On screen while its feed has room to show something (a minimised panel is only its header).
  useLayoutEffect(() => {
    const el = feed.current;
    if (!el || chat.off) {
      chat.shown(self.current, false);
      return;
    }
    const check = () => chat.shown(self.current, el.clientHeight >= 18);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => {
      ro.disconnect();
      chat.shown(self.current, false);
    };
  }, [chat, chat.off, options]);
  const layout = variant === "side" || (variant === "page" && roomy) ? "groups" : "rows";
  const ready = chat.readyAt();
  const waitS = Math.ceil((ready - now) / 1000);
  const hint =
    waitS > 3
      ? `Easy: one message every ${QUICK_CHAT.minGapMs / 1000} s, ${QUICK_CHAT.burstMax} in ${QUICK_CHAT.burstWindowMs / 1000} s. Next in ${waitS} s.`
      : teams && chat.to === "all"
        ? "All: Hello and Sporting lines go to both teams. Plans, reactions and emoji stay in your team."
        : null;
  const target = menu ? sender(match, menu) : null;
  return (
    <section
      class={`qchat qchat-${variant}${chat.off ? " off" : ""}`}
      aria-label="Quick chat"
      onClick={(e) => e.stopPropagation()}
    >
      <div class="qhead">
        {/* (A phone's split is narrow: with teams, the Team / All switch takes the title's place.) */}
        {!(variant === "split" && teams && !chat.off) && <span class="qhead-title">Chat</span>}
        {teams && !chat.off && <ToSwitch chat={chat} />}
        <span class="qhead-gap" />
        {variant !== "split" && (
          <button
            type="button"
            class={`qhead-btn${options ? " on" : ""}`}
            aria-label="Chat options"
            aria-expanded={options}
            onClick={(e) => {
              e.stopPropagation();
              setOptions(!options);
            }}
          >
            ⋯
          </button>
        )}
        {head}
        {fold}
      </div>
      {chat.off ? (
        <div class="qoff" ref={feed}>
          <p>Chat is off: no messages show, and you can't send any.</p>
          <button type="button" class="btn btn-small" onClick={() => chat.setOff(false)}>
            Turn chat on
          </button>
        </div>
      ) : options ? (
        <div class="qoptions" ref={feed}>
          <ChatOptions match={match} chat={chat} bubbles={variant === "split" || variant === "full"} onDone={() => setOptions(false)} />
        </div>
      ) : (
        <>
          <div class="qfeed-wrap" ref={feed}>
            <ChatFeed match={match} chat={chat} scroll={variant !== "split"} teams={teams} onName={(id) => setMenu(id)} hint={hint} />
          </div>
          {target && menu ? (
            <div class="qmenu" role="group" aria-label={`${target.you ? "You" : target.name}`}>
              <strong class="qmenu-name">{target.you ? "You" : target.name}</strong>
              <button
                type="button"
                class="qchip"
                onClick={() => {
                  setMenu(null);
                  openProfile({ uid: target.uid, name: target.name, you: target.you, bot: target.bot });
                }}
              >
                Profile
              </button>
              {!target.you && (
                <button
                  type="button"
                  class="qchip"
                  onClick={() => {
                    chat.mute(menu, !chat.isMuted(menu));
                    setMenu(null);
                  }}
                >
                  {chat.isMuted(menu) ? "Unmute" : "Mute for this match"}
                </button>
              )}
              <button type="button" class="qchip quiet" aria-label="Close" onClick={() => setMenu(null)}>
                ✕
              </button>
            </div>
          ) : (
            <ChatButtons chat={chat} layout={layout} now={now} />
          )}
        </>
      )}
    </section>
  );
}

/** Chat's switches: the bubble (phones), chat off, and the players muted this match. */
function ChatOptions({ match, chat, bubbles, onDone }: { match: GameView; chat: MatchChat; bubbles: boolean; onDone: () => void }) {
  const [, redraw] = useState(0);
  useEffect(() => onPrefsChange(() => redraw((n) => n + 1)), []);
  const muted = chat.mutedIds();
  return (
    <>
      {bubbles && (
        <label class="qopt">
          <input type="checkbox" checked={chatBubbles()} onChange={(e) => setChatBubbles((e.target as HTMLInputElement).checked)} />
          <span>Show new messages as a bubble while chat is hidden</span>
        </label>
      )}
      <label class="qopt">
        <input type="checkbox" checked={chat.off} onChange={(e) => chat.setOff((e.target as HTMLInputElement).checked)} />
        <span>Chat off (no messages, on this device)</span>
      </label>
      <div class="qopt-muted">
        <span class="muted small">{muted.length ? "Muted this match:" : "Tap a name in the chat to mute that player for this match."}</span>
        {muted.map((id) => (
          <button key={id} type="button" class="qchip" onClick={() => chat.mute(id, false)} aria-label={`Unmute ${match.nameOf(id)}`}>
            {match.nameOf(id)} ✕
          </button>
        ))}
      </div>
      <button type="button" class="qchip quiet" onClick={onDone}>
        Done
      </button>
    </>
  );
}

/**
 * The space under the board. With chat on (online Crowd and raids), a phone splits it: the scoreboard on the left,
 * chat on the right. Either can go full width (its header's expand button), and back (split). The choice, and
 * minimising both, are remembered on the device. A computer shows chat in the column beside the board instead (the
 * leaderboard has the side of the screen). Without chat it's just the scoreboard.
 */
export function UnderBoard({ match }: { match: GameView }) {
  const chat = chatOf(match);
  const wide = useMedia(WIDE);
  const [mode, setMode] = useState<UnderBoardMode>(underBoardMode);
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem("brc.miniTower") !== "0";
    } catch {
      return true;
    }
  });
  useEffect(() => onPrefsChange(() => setMode(underBoardMode())), []);
  if (!chat) return <MiniTower match={match} />;
  if (wide) {
    return (
      <div class="under-board side">
        <ChatPanel match={match} chat={chat} variant="side" />
      </div>
    );
  }
  const pick = (m: UnderBoardMode) => {
    setMode(m);
    setUnderBoardMode(m);
  };
  const toggle = () => {
    setOpen(!open);
    try {
      localStorage.setItem("brc.miniTower", open ? "0" : "1");
    } catch {
      // Not important.
    }
  };
  const fold = <FoldButton open={open} onToggle={toggle} />;
  const unread = chat.unread();
  return (
    <div class={`under-board ${mode}${open ? "" : " closed"}`}>
      {mode !== "chat" && (
        <MiniTower
          match={match}
          narrow={mode === "split"}
          open={open}
          floats={chat.floats()}
          head={
            <>
              {!chat.visible && unread > 0 && !chat.off && (
                <button
                  type="button"
                  class="qunread"
                  aria-label={`${unread} new in chat: show chat`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (mode === "board") pick("split");
                    if (!open) toggle();
                  }}
                >
                  💬 {unread}
                </button>
              )}
              <SplitButton full={mode === "board"} what="Leaderboard" onClick={() => pick(mode === "board" ? "split" : "board")} />
              {mode === "board" && fold}
            </>
          }
        />
      )}
      {mode !== "board" && (
        <ChatPanel match={match} chat={chat} variant={mode === "chat" ? "full" : "split"} head={<SplitButton full={mode === "chat"} what="Chat" onClick={() => pick(mode === "chat" ? "split" : "chat")} />} fold={fold} />
      )}
    </div>
  );
}

/** A page's chat (the results, or watching after you're out). */
export function ChatSection({ match }: { match: GameView }) {
  const chat = chatOf(match);
  if (!chat) return null;
  return <ChatPanel match={match} chat={chat} variant="page" />;
}

/**
 * The newest message for a moment, as one line under the top bar while no chat is on screen. It sits between the
 * top bar and the board, never over the board, and lets every tap through.
 */
export function ChatBubble({ match }: { match: GameView }) {
  const chat = chatOf(match);
  const line = chat?.bubble() ?? null;
  const box = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const screen = document.querySelector(".screen");
    const bar = document.querySelector(".screen .hud-row")?.getBoundingClientRect();
    const board = document.querySelector(".screen cg-container, .screen .board-wrap")?.getBoundingClientRect();
    const area = screen?.getBoundingClientRect();
    const h = el.offsetHeight;
    let top = bar ? bar.bottom + 2 : Math.max(4, (area?.top ?? 0) + 4);
    // Never over the board: if there's no room between the bar and the board, it rides up over the bar instead.
    if (board && board.top > 0 && top + h > board.top - 2) top = Math.max(2, board.top - h - 2);
    el.style.top = `${Math.round(top)}px`;
    if (area) {
      el.style.left = `${Math.round(area.left + area.width / 2)}px`;
      el.style.maxWidth = `${Math.round(area.width - 24)}px`;
    }
  }, [line?.n]);
  if (!chat || !line) return null;
  const say = chatSay(line.say);
  if (!say) return null;
  const who = sender(match, line.from);
  return (
    <div class="qbubble" ref={box} role="status" aria-live="polite" key={line.n}>
      <ChatIcon chat={chat} id={line.from} />
      <strong>{who.name}</strong>
      <span class={say.kind === "emoji" ? "emoji" : ""}>{say.text}</span>
      {line.to === "all" && chat.hasTeams() && <span class="qline-to">all</span>}
    </div>
  );
}
