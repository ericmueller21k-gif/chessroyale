/**
 * The town square's header tools (Eric, Oct 28), at the right end of the bar on the "Town square" title's line, a phone's and a
 * computer's alike: a chat icon (two speech bubbles, both green for always on, one for new messages only, none for off; a tap goes
 * to the next of the chat's three modes: always on, new messages only, off) and a gear opening "Town settings" over the town, where the chat's mode is one of three choices,
 * and under it "Chat background" (Eric, Oct 28: a switch for the slight blur behind the chat, always on while the chat shows; off by default).
 * The mode and the background (and their memory on this device) are chat.ts'; the box that shows them is TownChat.tsx.
 * docs/areas/town-square.md, "The chat log".
 */
import { useEffect, useLayoutEffect, useState } from "preact/hooks";
import { GearIcon } from "../components/MatchMenu.tsx";
import { CHAT_BACKGROUND_LABEL, CHAT_BACKGROUND_NOTE, CHAT_MODES, CHAT_MODE_CHOICE, CHAT_MODE_LABEL, chatBackground, chatMode, nextChatMode, onChatBackground, onChatMode, setChatBackground, setChatMode, type ChatMode } from "./chat.ts";
import "./town-chat.css";

/** The chat's mode now, redrawing when it changes (the icon, the sheet and the box all read it here). */
export function useChatMode(): ChatMode {
  const [m, set] = useState(chatMode);
  useEffect(() => {
    set(chatMode());
    return onChatMode(() => set(chatMode()));
  }, []);
  return m;
}

/** "Chat background" now, redrawing when it changes (the settings sheet and the box both read it here). */
export function useChatBackground(): boolean {
  const [on, set] = useState(chatBackground);
  useEffect(() => {
    set(chatBackground());
    return onChatBackground(() => set(chatBackground()));
  }, []);
  return on;
}

/**
 * Two speech bubbles, drawn small and plain (CSS colors them): both green when the chat is always on, just the top one green (the
 * bottom gray) for new messages only, both gray when it's off (Eric, Oct 28: "make both icons green for the always on chat option,
 * then just one for the middle option"). Eric's picture is the idea; the drawing is ours.
 */
function ChatIcon({ mode }: { mode: ChatMode }) {
  return (
    <svg class="tc-icon" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
      <path class={`tc-bub ${mode !== "off" ? "lit" : ""}`} d="M3.5 3h10a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H8.2L5 14.6V12h-1.5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
      <path class={`tc-bub ${mode === "always" ? "lit" : ""}`} d="M10.5 10.5h10a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H19v2.6L15.8 19.5H10.5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2z" />
      <g class="tc-dots">
        <circle cx="5.7" cy="7.5" r="1" />
        <circle cx="8.5" cy="7.5" r="1" />
        <circle cx="11.3" cy="7.5" r="1" />
        <circle cx="12.7" cy="15" r="0.9" />
        <circle cx="15.5" cy="15" r="0.9" />
        <circle cx="18.3" cy="15" r="0.9" />
      </g>
    </svg>
  );
}

export function TownChatTools() {
  const mode = useChatMode();
  const [open, setOpen] = useState(false);
  return (
    <div class="town-tools">
      <button type="button" class="town-tool tc-mode" data-mode={mode} aria-label={CHAT_MODE_LABEL[mode]} title={CHAT_MODE_LABEL[mode]} onClick={() => setChatMode(nextChatMode(mode))}>
        <ChatIcon mode={mode} />
      </button>
      <button type="button" class="town-tool" aria-label="Town settings" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
        <GearIcon size={22} />
      </button>
      {open && <Settings mode={mode} onClose={() => setOpen(false)} />}
    </div>
  );
}

/** "Town settings": a small sheet over the town (the match options' look): the chat's mode as three choices and "Chat background", a switch. A tap outside it, its X or Escape closes it. */
function Settings({ mode, onClose }: { mode: ChatMode; onClose: () => void }) {
  const background = useChatBackground();
  // (A layout effect: an Escape pressed straight after the open is heard.)
  useLayoutEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, []);
  return (
    <div class="mm-scrim" onClick={onClose}>
      <div class="mm-panel" role="dialog" aria-label="Town settings" onClick={(e) => e.stopPropagation()}>
        <div class="mm-head">
          <h2 class="mm-title">Town settings</h2>
          <button type="button" class="mm-x" aria-label="Close" onClick={onClose}>
            <span aria-hidden="true">✕</span>
          </button>
        </div>
        <div class="mm-list" role="radiogroup" aria-label="Chat">
          <p class="town-set-head" aria-hidden="true">
            Chat
          </p>
          {CHAT_MODES.map((m) => (
            <button key={m} type="button" class="mm-item town-set-row" role="radio" aria-checked={m === mode} onClick={() => setChatMode(m)}>
              <span class="mm-item-label">{CHAT_MODE_CHOICE[m]}</span>
            </button>
          ))}
        </div>
        {/* The blur's switch (the same On / Off switch as the match options'), and its line, under the chat's modes. */}
        <div class="mm-list">
          <button type="button" class="mm-item" role="switch" aria-checked={background} aria-describedby="town-bg-note" onClick={() => setChatBackground(!background)}>
            <span class="mm-item-label">{CHAT_BACKGROUND_LABEL}</span>
            <span class={`mm-switch${background ? " on" : ""}`} aria-hidden="true">
              {background ? "On" : "Off"}
            </span>
          </button>
          <p class="town-set-note" id="town-bg-note">
            {CHAT_BACKGROUND_NOTE}
          </p>
        </div>
      </div>
    </div>
  );
}
