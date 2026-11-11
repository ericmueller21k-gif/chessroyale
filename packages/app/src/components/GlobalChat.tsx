import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { CHAT_TYPED, chatSay, defaultChatPicks, homeChatButtons, type ChatSay } from "@chessroyale/core";
import { account, onAccountChange, refreshChatStanding, tooYoung } from "../account.ts";
import { chatBlockNow, chatBlockText } from "../chat-mod.ts";
import { chatOn, onChatOn, setChatOn } from "../chat-on.ts";
import { ChatText, EmojiPicker } from "../chat-emoji.tsx";
import { globalChat, lineText, type GlobalLine } from "../global-chat.ts";
import { openProfile } from "../profile-nav.ts";
import { useTurnChatOn } from "./ChatOptIn.tsx";
import { GearIcon } from "./MatchMenu.tsx";

/**
 * The global chat, in the computer's right column on every front-door page (home, the queue, the town and its rooms, the pages):
 * Eric's approved mockup (Nov 7, notes/briefs/assets/chat-column-*.png). "GLOBAL CHAT" with its gear (chat on or off, unmute), the
 * lines (a name in its color, the time, the words with our pixel emoji), and the band at the foot: "Send a message" and the emoji
 * button. Typed chat (CHAT_TYPED): signed-in players type; guests read; a device the age gate marked too young keeps the quick
 * chips (and gets no typed lines); chat is off until you turn it on (the one-time notice). One message every 5 s, and the server's
 * cap: "Chat is busy, try again." docs/decisions/2026-11-07-typed-chat-column.md.
 */

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** "2:41 PM" today; "Oct 8" before. */
function stamp(at: number): string {
  const d = new Date(at);
  return sameDay(d, new Date()) ? d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** A name's color (one of six), the same for a player everywhere: from their id. */
export function nameHue(from: string): number {
  let h = 0;
  for (let i = 0; i < from.length; i++) h = (Math.imul(h, 31) + from.charCodeAt(i)) | 0;
  return Math.abs(h) % 6;
}

function Row({ line, you, onName }: { line: GlobalLine; you: boolean; onName: (l: GlobalLine) => void }) {
  const text = lineText(line);
  if (text === null) return null;
  const emoji = !line.text && chatSay(line.say)?.kind === "emoji";
  return (
    <div class={`gline${you ? " you" : ""}${line.bot ? " bot" : ""}${emoji ? " emoji" : ""}`} data-n={line.n}>
      <div class="gline-head">
        <button type="button" class={`gline-name${line.bot ? "" : ` c${nameHue(line.from)}`}`} onClick={() => onName(line)} aria-label={`${line.name}: profile or mute`}>
          {line.name}
        </button>
        {line.bot && <span class="gline-bot">BOT</span>}
        <time class="gline-time" dateTime={new Date(line.at).toISOString()}>
          {stamp(line.at)}
        </time>
      </div>
      <div class="gline-text">{line.text ? <ChatText text={line.text} /> : text}</div>
    </div>
  );
}

/** The quick chips (a device the age gate marked too young, or CHAT_TYPED off): the Lobby / Yours / Emoji tabs of before Nov 7. */
type Tab = "lobby" | "lines" | "emoji";
const TABS: { id: Tab; label: string }[] = [
  { id: "lobby", label: "Lobby" },
  { id: "lines", label: "Yours" },
  { id: "emoji", label: "Emoji" },
];
function QuickChips({ busy, onSay }: { busy: boolean; onSay: (id: string) => void }) {
  const [tab, setTab] = useState<Tab>("lobby");
  const buttons = homeChatButtons(account().profile?.shop?.chat ?? defaultChatPicks());
  const chips: ChatSay[] = buttons[tab];
  return (
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
          <button key={s.id} type="button" class={`gchip${s.kind === "emoji" ? " emoji" : ""}`} disabled={busy} aria-label={s.kind === "emoji" ? `Send ${s.text}${s.name ? ` (${s.name})` : ""}` : undefined} onClick={() => onSay(s.id)}>
            {s.text}
          </button>
        ))}
      </div>
    </div>
  );
}

const QuickIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M4 5.5h16v10H10l-4.5 3.5v-3.5H4z" />
    <path d="M8 9.5h8M8 12.5h5" />
  </svg>
);

const EmojiIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M8.2 14.2c1 1.4 2.3 2.1 3.8 2.1s2.8-.7 3.8-2.1" />
    <circle cx="9" cy="9.8" r="0.7" fill="currentColor" />
    <circle cx="15" cy="9.8" r="0.7" fill="currentColor" />
  </svg>
);

export function GlobalChat({ onSignIn }: { onSignIn?: () => void }) {
  const [, redraw] = useState(0);
  const [menu, setMenu] = useState<GlobalLine | null>(null);
  const [gear, setGear] = useState(false);
  const [picker, setPicker] = useState(false);
  // The quick chat button (Nov 8, Eric): the player's quick lines and emoji, tapped to send, under the same limits as the chips.
  const [quick, setQuick] = useState(false);
  const [draft, setDraft] = useState("");
  const feed = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const stick = useRef(true);
  const turnOn = useTurnChatOn();
  const on = chatOn();
  useEffect(() => {
    const offStore = globalChat.on(() => redraw((n) => n + 1));
    const offOn = onChatOn(() => redraw((n) => n + 1));
    return () => {
      offStore();
      offOn();
    };
  }, []);
  // Chat off (its opt-in): nothing is fetched or shown.
  useEffect(() => (on ? globalChat.open() : undefined), [on]);
  const p = account().profile;
  const you = p?.user.id;
  const lines = on ? globalChat.lines() : [];
  const newest = lines.at(-1)?.n ?? 0;
  // Stay at the newest line unless you've scrolled up to read (before the paint, so it never shows a jump).
  useLayoutEffect(() => {
    const el = feed.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [newest, on]);
  const now = Date.now();
  const readyAt = globalChat.readyAt(you);
  const waitS = Math.max(0, Math.ceil((readyAt - now) / 1000));
  // The countdown: one redraw a second, only while you're waiting.
  useEffect(() => {
    if (waitS <= 0) return;
    const t = setTimeout(() => redraw((n) => n + 1), Math.min(1000, readyAt - Date.now() + 20));
    return () => clearTimeout(t);
  }, [waitS, readyAt]);
  // A refusal, or "it shows in a moment", goes after a few seconds.
  const note = globalChat.error ?? (globalChat.late ? "Chat is busy: your message shows in a few seconds." : null);
  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => globalChat.clearError(), 4000);
    return () => clearTimeout(t);
  }, [note]);
  // (Escape or a press elsewhere closes the gear's menu. A layout effect, as every pop-up's: an effect waits for a paint, and an
  // Escape pressed as it opened was lost: LESSONS.md, Nov 11.)
  useLayoutEffect(() => {
    if (!gear) return;
    const close = (e: Event) => (e instanceof KeyboardEvent ? e.key === "Escape" : !(e.target as Element | null)?.closest?.(".gchat-head")) && setGear(false);
    addEventListener("keydown", close);
    addEventListener("pointerdown", close);
    return () => {
      removeEventListener("keydown", close);
      removeEventListener("pointerdown", close);
    };
  }, [gear]);
  const guest = !p?.user.signedIn;
  const young = tooYoung();
  const banned = guest ? null : chatBlockNow(now);
  useEffect(() => void (banned && refreshChatStanding()), [!!banned]);
  const busy = waitS > 0 || globalChat.sending;
  const muted = globalChat.mutedCount();
  const typing = CHAT_TYPED && !young;
  const send = async () => {
    const text = draft.trim();
    if (!text || busy) return;
    stick.current = true;
    setPicker(false);
    if (await globalChat.type(text)) setDraft("");
    field.current?.focus();
  };
  // Why the field can't send, in its place (the band keeps its place and size whatever the state).
  const why = !on ? "Chat is off" : guest ? "Sign in to chat. Guests can read." : banned ? chatBlockText(banned) : null;

  return (
    <section class="gchat" aria-label="Global chat">
      <div class="gchat-head">
        <h2 class="rc-h">GLOBAL CHAT</h2>
        <button type="button" class="gchat-gear" aria-label="Chat settings" aria-haspopup="dialog" aria-expanded={gear} onClick={() => setGear(!gear)}>
          <GearIcon size={21} />
        </button>
        {gear && (
          <div class="gchat-pop" role="dialog" aria-label="Chat settings">
            <button
              type="button"
              class="gchat-pop-row"
              role="switch"
              aria-checked={on}
              onClick={() => {
                setGear(false);
                if (on) void setChatOn(false);
                else turnOn.ask();
              }}
            >
              <span>Chat</span>
              <span class={`mm-switch${on ? " on" : ""}`} aria-hidden="true">
                {on ? "On" : "Off"}
              </span>
            </button>
            <button type="button" class="gchat-pop-row" disabled={muted === 0} onClick={() => globalChat.unmuteAll()}>
              <span>{muted > 0 ? `${muted} muted · unmute all` : "Nobody muted"}</span>
            </button>
          </div>
        )}
      </div>
      <div class="rc-sep" />
      <div class="gchat-body">
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
          {!on ? (
            <div class="gchat-off">
              <p>Chat is off.</p>
              <button type="button" class="gchat-turn-on" onClick={turnOn.ask}>
                Turn on chat
              </button>
            </div>
          ) : (
            <>
              {lines.length === 0 && <p class="gchat-empty">{globalChat.loaded ? "Quiet right now. Say hello!" : "Loading the chat…"}</p>}
              {lines.map((l) => (
                <Row key={l.n} line={l} you={!!you && l.from === you && !l.bot} onName={setMenu} />
              ))}
            </>
          )}
        </div>
        {menu && (
          <div class="gchat-menu" role="group" aria-label={menu.name}>
            <strong>{menu.name}</strong>
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
        )}
        {note && !menu && (
          <p class={`gchat-note${globalChat.error ? " error" : ""}`} role="status">
            {note}
          </p>
        )}
        {quick && !why && (
          <QuickChips
            busy={busy}
            onSay={(id) => {
              stick.current = true;
              setQuick(false);
              void globalChat.say(id);
            }}
          />
        )}
        {picker && !why && (
          <EmojiPicker
            onPick={(code) => {
              const at = field.current?.selectionStart ?? draft.length;
              const before = draft.slice(0, at);
              setDraft(`${before}${before && !before.endsWith(" ") ? " " : ""}${code} ${draft.slice(at)}`.slice(0, 200));
              setPicker(false);
              field.current?.focus();
            }}
          />
        )}
      </div>
      <div class="rc-sep" />
      {on && !why && !typing ? (
        <QuickChips
          busy={busy}
          onSay={(id) => {
            stick.current = true;
            void globalChat.say(id);
          }}
        />
      ) : (
        <form
          class="gchat-band"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          {guest && on && onSignIn ? (
            <button type="button" class="gchat-field gchat-signin" onClick={onSignIn}>
              Sign in to chat. Guests can read.
            </button>
          ) : (
            <input
              ref={field}
              class="gchat-field"
              type="text"
              enterKeyHint="send"
              autoComplete="off"
              maxLength={200}
              aria-label="Send a message"
              placeholder={why ?? (waitS > 0 ? `Next message in ${waitS} s` : "Send a message")}
              disabled={!!why}
              value={why ? "" : draft}
              onInput={(e) => {
                setDraft(e.currentTarget.value);
                if (globalChat.error) globalChat.clearError();
              }}
              onKeyDown={(e) => e.key === "Escape" && setPicker(false)}
            />
          )}
          <button
            type="button"
            class="gchat-quick-btn"
            aria-label="Quick chat: your lines"
            aria-expanded={quick}
            disabled={!!why}
            onClick={() => {
              setPicker(false);
              setQuick(!quick);
            }}
          >
            <QuickIcon />
          </button>
          <button
            type="button"
            class="gchat-emo-btn"
            aria-label="Emoji"
            aria-expanded={picker}
            disabled={!!why}
            onClick={() => {
              setQuick(false);
              setPicker(!picker);
            }}
          >
            <EmojiIcon />
          </button>
        </form>
      )}
      <div class="rc-sep" />
      {turnOn.notice}
    </section>
  );
}
