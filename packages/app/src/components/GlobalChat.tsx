import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { GLOBAL_CHAT, chatSay, defaultChatPicks, homeChatButtons, type ChatSay } from "@chessroyale/core";
import { account, mustSignInToPlayOnline, onAccountChange } from "../account.ts";
import { globalChat, type GlobalLine } from "../global-chat.ts";
import { openProfile } from "../profile-nav.ts";

/**
 * The home page's global chat: a computer's right column, under Playing now. Preset lines only (no typing), each
 * with its time, the sender's icon, name and rating, and a "bot" tag on bots' lines. One message every 30 s (the
 * server's limit, mirrored here). Signed-in players post; guests read. See DECISIONS.md, "Global chat on the home
 * page".
 */

type Tab = "lobby" | "lines" | "emoji";
const TABS: { id: Tab; label: string }[] = [
  { id: "lobby", label: "Lobby" },
  { id: "lines", label: "Yours" },
  { id: "emoji", label: "Emoji" },
];

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** "2:41 PM" today; "Oct 8" before. */
function stamp(at: number): string {
  const d = new Date(at);
  return sameDay(d, new Date()) ? d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function LineIcon({ line }: { line: GlobalLine }) {
  if (line.iconKey) return <img class="user-icon pixel gicon" src={`/api/chat/icon/${line.iconKey}`} alt="" width={48} height={48} loading="lazy" draggable={false} />;
  return <span class="user-icon gicon">{line.icon || "♟"}</span>;
}

function Row({ line, you, onName }: { line: GlobalLine; you: boolean; onName: (l: GlobalLine) => void }) {
  const say = chatSay(line.say);
  if (!say) return null;
  return (
    <div class={`gline${you ? " you" : ""}${line.bot ? " bot" : ""}${say.kind === "emoji" ? " emoji" : ""}`} data-n={line.n}>
      <LineIcon line={line} />
      <div class="gline-body">
        <div class="gline-head">
          <button type="button" class="gline-name" onClick={() => onName(line)} aria-label={`${you ? "You" : line.name}: profile or mute`}>
            {you ? "You" : line.name}
          </button>
          {line.bot && <span class="gline-bot">bot</span>}
          {line.rating !== null && (
            <span class="gline-rating" title="Rating">
              {line.rating}
            </span>
          )}
          <time class="gline-time" dateTime={new Date(line.at).toISOString()}>
            {stamp(line.at)}
          </time>
        </div>
        <div class="gline-text">{say.text}</div>
      </div>
    </div>
  );
}

export function GlobalChat({ onSignIn }: { onSignIn?: () => void }) {
  const [, redraw] = useState(0);
  const [tab, setTab] = useState<Tab>("lobby");
  const [menu, setMenu] = useState<GlobalLine | null>(null);
  const feed = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  useEffect(() => {
    const close = globalChat.open();
    const off = globalChat.on(() => redraw((n) => n + 1));
    const offAccount = onAccountChange(() => redraw((n) => n + 1));
    return () => {
      close();
      off();
      offAccount();
    };
  }, []);
  const p = account().profile;
  const you = p?.user.id;
  const lines = globalChat.lines();
  const newest = lines.at(-1)?.n ?? 0;
  // Stay at the newest line unless you've scrolled up to read (before the paint, so it never shows a jump).
  useLayoutEffect(() => {
    const el = feed.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [newest]);
  const now = Date.now();
  const readyAt = globalChat.readyAt(you);
  const waitS = Math.max(0, Math.ceil((readyAt - now) / 1000));
  // The countdown: one redraw a second, only while you're waiting.
  useEffect(() => {
    if (waitS <= 0) return;
    const t = setTimeout(() => redraw((n) => n + 1), Math.min(1000, readyAt - Date.now() + 20));
    return () => clearTimeout(t);
  }, [waitS, readyAt]);
  const guest = mustSignInToPlayOnline();
  const buttons = homeChatButtons(p?.shop?.chat ?? defaultChatPicks());
  const chips: ChatSay[] = buttons[tab];
  const busy = waitS > 0 || globalChat.sending;
  const muted = globalChat.mutedCount();
  const status = globalChat.error && waitS === 0 ? globalChat.error : waitS > 0 ? `Next message in ${waitS} s` : `One message every ${GLOBAL_CHAT.gapMs / 1000} s`;
  return (
    <section class="gchat" aria-label="Global chat">
      <div class="gchat-title">
        <h2 class="fd-label">GLOBAL CHAT</h2>
        {muted > 0 && (
          <button type="button" class="gchat-unmute" onClick={() => globalChat.unmuteAll()} title="Unmute everyone">
            🔇 {muted} muted · unmute
          </button>
        )}
      </div>
      <div class="gchat-box">
        <div
          class="gchat-feed"
          ref={feed}
          role="log"
          aria-label="Global chat messages"
          onScroll={(e) => {
            const el = e.currentTarget as HTMLDivElement;
            stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
          }}
        >
          {lines.length === 0 && <p class="gchat-empty">{globalChat.loaded ? "Quiet right now. Say hello!" : "Loading the chat…"}</p>}
          {lines.map((l) => (
            <Row key={l.n} line={l} you={!!you && l.from === you && !l.bot} onName={setMenu} />
          ))}
        </div>
        {menu ? (
          <div class="gchat-menu" role="group" aria-label={menu.name}>
            <strong>{menu.from === you ? "You" : menu.name}</strong>
            <button
              type="button"
              class="gchip"
              onClick={() => {
                setMenu(null);
                openProfile(menu.bot ? { name: menu.name, bot: true } : { uid: menu.from, name: menu.name, you: menu.from === you });
              }}
            >
              Profile
            </button>
            {menu.from !== you && (
              <button
                type="button"
                class="gchip"
                onClick={() => {
                  globalChat.mute(menu.from, !globalChat.isMuted(menu.from));
                  setMenu(null);
                }}
              >
                {globalChat.isMuted(menu.from) ? "Unmute" : "Mute"}
              </button>
            )}
            <button type="button" class="gchip quiet" aria-label="Close" onClick={() => setMenu(null)}>
              ✕
            </button>
          </div>
        ) : guest ? (
          <div class="gchat-guest">
            <span>Sign in to chat. Guests can read.</span>
            {onSignIn && (
              <button type="button" class="gchip gold" onClick={onSignIn}>
                Sign in
              </button>
            )}
          </div>
        ) : (
          <div class="gchat-say">
            <div class="gchat-tabs" role="tablist" aria-label="Lines">
              {TABS.map((t) => (
                <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} class={tab === t.id ? "on" : ""} onClick={() => setTab(t.id)}>
                  {t.label}
                </button>
              ))}
            </div>
            <div class={`gchat-chips${tab === "emoji" ? " emoji" : ""}`} role="tabpanel">
              {chips.length === 0 && <span class="gchat-none">Nothing here yet. Pick lines and emoji in your profile, under Quick chat and emoji.</span>}
              {chips.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  class={`gchip${s.kind === "emoji" ? " emoji" : ""}`}
                  disabled={busy}
                  aria-label={s.kind === "emoji" ? `Send ${s.text}${s.name ? ` (${s.name})` : ""}` : undefined}
                  onClick={() => {
                    stick.current = true;
                    void globalChat.say(s.id);
                  }}
                >
                  {s.text}
                </button>
              ))}
            </div>
            <p class={`gchat-status${globalChat.error && waitS === 0 ? " error" : ""}`} aria-live="polite">
              {status}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
