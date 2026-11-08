/**
 * The town square's header tools (Eric, Oct 28), at the right end of the bar on the "Town square" title's line, a phone's and a
 * computer's alike: a chat icon (two speech bubbles, both green for always on, one for new messages only, none for off; a tap goes
 * to the next of the chat's three modes: always on, new messages only, off) and a gear opening "Town settings" over the town, where the chat's mode is one of three choices,
 * and under it "Chat background" (Eric, Oct 28: a switch for the slight blur behind the chat, always on while the chat shows; off by default).
 * The mode and the background (and their memory on this device) are chat.ts'; the box that shows them is TownChat.tsx.
 * Under them, "Names" (Eric, Oct 28): two choices for who shows a name tag, "Near you" (the default) and "Everyone" (tags.ts; the town's
 * drawing reads it). docs/areas/town-square.md, "The chat log" and "Name tags".
 */
import { useEffect, useLayoutEffect, useState } from "preact/hooks";
import { createPortal } from "preact/compat";
import { GearIcon } from "../components/MatchMenu.tsx";
import { CHAT_BACKGROUND_LABEL, CHAT_BACKGROUND_NOTE, CHAT_MODES, CHAT_MODE_CHOICE, CHAT_MODE_LABEL, chatBackground, chatMode, nextChatMode, onChatBackground, onChatMode, setChatBackground, setChatMode, type ChatMode } from "./chat.ts";
import { NAMES_CHOICE, NAMES_LABEL, NAMES_MODES, namesMode, namesNote, onNamesMode, setNamesMode, type NamesMode } from "./tags.ts";
import { mapOn, onMapOn, setMapOn } from "./minimap.ts";
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

/** The names setting now, redrawing when it changes (the settings sheet reads it here; the town's drawing reads `namesMode()` as it draws). */
export function useNamesMode(): NamesMode {
  const [m, set] = useState(namesMode);
  useEffect(() => {
    set(namesMode());
    return onNamesMode(() => set(namesMode()));
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

/**
 * The map button (the street town, Nov 5; Eric: "Another icon [with our other icons] … click it, it turns it off"): a folded map, lit (green)
 * while the minimap shows, gray while it's off; a tap turns it. Remembered per device (minimap.ts), on by default. Grayed inside a building
 * (the map is the town's), never hidden.
 */
function MapIcon({ on }: { on: boolean }) {
  return (
    <svg class={`tm-btn-icon${on ? " lit" : ""}`} viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <path class="tm-btn-sheet" d="M3 6.2 8.6 4l6.8 2.4L21 4.3v13.5l-5.6 2.2-6.8-2.4L3 19.7z" />
      <path class="tm-btn-fold" d="M8.6 4v13.6M15.4 6.4V20" />
      <circle class="tm-btn-dot" cx="12" cy="11.6" r="1.9" />
    </svg>
  );
}

export function TownChatTools({ map = false, mapDisabled = false }: { map?: boolean; mapDisabled?: boolean }) {
  const mode = useChatMode();
  const [open, setOpen] = useState(false);
  const [mapShown, setMapShown] = useState(mapOn);
  useEffect(() => onMapOn(() => setMapShown(mapOn())), []);
  return (
    <div class="town-tools">
      {map && (
        <button type="button" class="town-tool tm-toggle" aria-label="Map" aria-pressed={mapShown} title={mapShown ? "Hide the map" : "Show the map"} disabled={mapDisabled} onClick={() => setMapOn(!mapShown)}>
          <MapIcon on={mapShown} />
        </button>
      )}
      <button type="button" class="town-tool tc-mode" data-mode={mode} aria-label={CHAT_MODE_LABEL[mode]} title={CHAT_MODE_LABEL[mode]} onClick={() => setChatMode(nextChatMode(mode))}>
        <ChatIcon mode={mode} />
      </button>
      <button type="button" class="town-tool" aria-label="Town settings" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
        <GearIcon size={22} />
      </button>
      {/* (Over everything: on a computer the tools sit in the right column's slot, so the sheet goes to the page's top.) */}
      {open && createPortal(<Settings mode={mode} onClose={() => setOpen(false)} />, document.body)}
    </div>
  );
}

/** "Town settings": a small sheet over the town (the match options' look): the chat's mode as three choices, "Chat background", a switch, and "Names", two choices. A tap outside it, its X or Escape closes it. */
function Settings({ mode, onClose }: { mode: ChatMode; onClose: () => void }) {
  const background = useChatBackground();
  const names = useNamesMode();
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
        {/* Names (Oct 28): who shows a name tag, under Chat. */}
        <div class="mm-list" role="radiogroup" aria-label={NAMES_LABEL} aria-describedby="town-names-note">
          <p class="town-set-head" aria-hidden="true">
            {NAMES_LABEL}
          </p>
          {NAMES_MODES.map((m) => (
            <button key={m} type="button" class="mm-item town-set-row" role="radio" aria-checked={m === names} onClick={() => setNamesMode(m)}>
              <span class="mm-item-label">{NAMES_CHOICE[m]}</span>
            </button>
          ))}
          <p class="town-set-note" id="town-names-note">
            {namesNote()}
          </p>
        </div>
      </div>
    </div>
  );
}
