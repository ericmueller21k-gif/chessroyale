/**
 * The town square's chat log (Eric, Oct 28): one box in the map's top left corner, a continuous stream of lines ("[9:41] Name:
 * message", the name bold, colored by kind: a player's from a palette, picked at random each time they join), newest at the bottom.
 * No backing, border or shadow on any line (the text is near-black by day and white by night, following the town's own sky:
 * `data-tone`, read about once a minute, set only when it flips). The box holds every line of the last 5 minutes (`lifeMs`), at most
 * 100 (`keepLines`), and scrolls: a finger on a phone, the wheel on a computer; new lines keep it at its foot unless you've scrolled
 * up, then a "↓ new" marker says so (`Stick`).
 *
 * v4 (Eric's phone, Oct 28): **you chat by tapping the box anywhere but a player's name.** That opens typing: a slight blur behind
 * the whole box (`.tc-back`: one rounded rectangle, a faint tint and, while you type, a `backdrop-filter` blur), the typing line in the strip at the box's
 * foot (an input with no placeholder, no border and no backing; reserved by the stream, so nothing moves when it shows), focused (the
 * keyboard opens on a phone, the cursor goes in on a computer). Enter or the keyboard's Send sends and closes it; a press on the map,
 * or Escape, closes it (the words stay for the next tap); the blur goes with it, and the tint with it unless "Chat background" (Town
 * settings) is on, which keeps the tint behind the box whenever the box shows (the blur only while you type: the frame rate's corner,
 * town-chat.css). A guest, a device marked too young, a paused chat or a chat ban opens the same
 * greyed line with the reason in it.
 *
 * Three modes, set by the header's chat icon or the gear's sheet (TownChatTools.tsx), remembered on this device: always on (the box
 * always shows and never fades); new messages (the same box: the lines show when a message comes and fade `fadeAfterMs` after the
 * last; a tap while they show opens typing and is "always on" until you finish: every line, no fade, `ChatLog.talk`); off (no box:
 * the lines still arrive, so turning it on shows them). While the box shows it takes every touch on its own area (the map under it
 * gets none); faded, it takes none. The stream itself is hit-testable and scrolls (`pointer-events: auto`, `touch-action: pan-y`):
 * iPhone Safari scrolls a scroller only when it is.
 *
 * A tap is a press under `holdMs` that moves under `holdSlopPx`. On a player's name it opens its menu (Profile / Mute / Report, and
 * Remove for a moderator; `onTownChatLineTap`); anywhere else on the box it opens typing. Press and hold on the box (`holdMs`) and it
 * comes off the map to move wherever you drop it, remembered on this device; a finger that moves scrolls the stream. Plain DOM, drawn
 * only when a line comes or goes or typing opens or closes; nothing in the town's frame loop. The rules and the numbers are in
 * chat.ts; docs/areas/town-square.md, "The chat log".
 *
 * Players' messages (chat-net.ts; docs/decisions/2026-10-28-town-chat-typing.md): only a signed-in player on a device the
 * age gate didn't mark too young types and gets other players' lines (riding on the live poll); a guest's log has the
 * bosses' and kids' chatter alone. The typing line opens for everyone on a tap (nothing hidden): greyed with why for a guest ("Sign in
 * to chat with other players."), a young device, while the chat is paused (the switch) or your chat is off (a
 * moderator). It waits for the server's answer. Too soon after your last message, or refused (the server's reasons), you get a gray
 * line in the stream that only you see (`whisper`: "Sorry, you can't send another message for 12 seconds."); nothing is sent for
 * the wait. Players' lines leave the log at once when you may no longer see them (signed out, paused) or mute or block their player.
 *
 * Test hooks (e2e, with the test switches on): `window.__townSay()` makes someone from the table talk now;
 * `__townSay(name, text, kind, agoMs)` says that line (on this device only; `agoMs`: it was said that long ago, to scroll back
 * to: up to 5 minutes); `__townChatter(false)` stops the bosses' and kids' chatter (true starts it again); `window.__townTapped` lists the taps
 * on player lines.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";
import { account, onAccountChange } from "../account.ts";
import { mutes } from "../chat-mod.ts";
import { openProfile } from "../profile-nav.ts";
import { useServerStatus } from "../status.ts";
import { testSwitchesAllowed } from "../test-switches.ts";
import { CHAT, CHAT_BOX, ChatLog, Stick, chatBlurs, chatShows, clampBox, loadChatPos, onTownChatLineTap, saveChatPos, say, setTownChatLineTap, startChatter, tooSoonText, townTone, type ChatKind, type ChatLine, type Rect } from "./chat.ts";
import { cutTownText, mayTownChat, openTownFeed, removeTownLine, reportTownLine, sendTownChat, townChars, townChatOff } from "./chat-net.ts";
import { NAME_COLORS, nameColorIndex } from "./names.ts";
import { TOWN_FEEL } from "./feel.ts";
import { useChatBackground, useChatMode } from "./TownChatTools.tsx";
import "./town-chat.css";

export function TownChat() {
  const wrap = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const pinned = useRef<(() => void) | null>(null);
  const mode = useChatMode();
  const background = useChatBackground();
  // (The handlers below are set up once and read the mode as it is when a press comes.)
  const modeNow = useRef(mode);
  modeNow.current = mode;
  const [computer, setComputer] = useState(() => matchMedia(CHAT.computerQuery).matches);
  /** Whether this device chats with other players (a signed-in account, not marked too young): players' lines come in. */
  const [mayChat, setMayChat] = useState(mayTownChat);
  /** Typing is open: a tap on the box opened it; a send, a press on the map or Escape closes it. (`typingNow`: the same, for the handlers set up once.) */
  const [typing, setTyping] = useState(false);
  const typingNow = useRef(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  /** The text's tone: dark ink by day, white by night (the town's sky; read once a minute, redrawn only when it flips). */
  const [tone, setTone] = useState(townTone);
  const [, redraw] = useState(0);
  const log = useMemo(() => new ChatLog(() => redraw((n) => n + 1)), []);
  // Scrolled up from the foot: the lines that came since are counted for the "↓ new" marker.
  const stick = useMemo(() => new Stick(), []);
  const [unseen, setUnseen] = useState(0);
  const seen = useRef({ id: 0, mode });
  // (The switch, as /api/status says it: the field reads townChatOff() each time it's drawn.)
  useServerStatus();

  // Who's talking: the log opens for `say`, the bosses and kids start their chatter, and the test hooks.
  useEffect(() => {
    const close = log.open();
    let chatter = startChatter();
    const hooks = window as unknown as { __townSay?: (name?: string, text?: string, kind?: ChatKind, agoMs?: number) => void; __townChatter?: (on: boolean) => void };
    hooks.__townSay = (name, line, kind = "player", agoMs = 0) => {
      if (!testSwitchesAllowed()) return;
      if (name === undefined) chatter.now();
      else say(name, line ?? "", kind, undefined, Date.now() - agoMs);
    };
    hooks.__townChatter = (on) => {
      if (!testSwitchesAllowed()) return;
      chatter.stop();
      if (on) chatter = startChatter();
    };
    return () => {
      delete hooks.__townSay;
      delete hooks.__townChatter;
      chatter.stop();
      close();
    };
  }, [log]);

  // Other players' lines, for a signed-in player (nothing is asked for anyone else): into the log as players' lines with who
  // said them; out again when a moderator removes one or you mute or block its player, and all of them when you may no
  // longer see them (signed out, a device marked too young, the chat paused); the switch redraws the field. They keep coming
  // whatever the mode (off too: no extra requests, and turning it on shows the last minute).
  useEffect(() => {
    if (!mayChat) {
      log.drop((l) => l.uid !== undefined);
      return;
    }
    return openTownFeed({
      line: (l) => log.say(l.name, l.text, "player", Date.now(), { uid: l.from, n: l.n, color: l.color }),
      drop: (test) => log.drop((l) => l.uid !== undefined && l.n !== undefined && test({ n: l.n, from: l.uid })),
      paused: () => redraw((n) => n + 1),
    });
  }, [log, mayChat]);

  // The computer's size (a window crossing it) changes the box's size and type; the test switches can turn on late (the
  // account loads after the town opens), which is when the field appears.
  useEffect(() => {
    const mq = matchMedia(CHAT.computerQuery);
    const on = () => setComputer(mq.matches);
    mq.addEventListener("change", on);
    const off = onAccountChange(() => setMayChat(mayTownChat()));
    return () => {
      mq.removeEventListener("change", on);
      off();
    };
  }, []);

  // The sky by day or night, once a minute like the town's own (never per frame): the text's tone follows it.
  useEffect(() => {
    const t = setInterval(() => setTone(townTone()), TOWN_FEEL.skyCheckMs);
    return () => clearInterval(t);
  }, []);

  // The lines on show now. After every draw: at the foot if it was (a new line, or one gone, or the mode turned on), where it is if
  // you've scrolled up (the new ones counted); a box with nothing to scroll is at its foot by itself.
  const lines = log.visible(mode);
  useLayoutEffect(() => {
    const box = scroller.current;
    if (!box || mode === "off") {
      seen.current.mode = mode;
      return;
    }
    if (seen.current.mode !== mode) stick.toFoot();
    const fresh = lines.filter((l) => l.id > seen.current.id).length;
    seen.current = { id: Math.max(seen.current.id, lines.at(-1)?.id ?? 0), mode };
    if (box.scrollHeight - box.clientHeight <= CHAT.pinSlopPx) stick.toFoot();
    if (stick.added(fresh)) box.scrollTop = box.scrollHeight;
    box.classList.toggle("up", box.scrollTop > 2);
    if (stick.unseen !== unseen) setUnseen(stick.unseen);
  });
  const scrolled = () => {
    const box = scroller.current!;
    stick.scrolled(box);
    box.classList.toggle("up", box.scrollTop > 2);
    if (stick.unseen !== unseen) setUnseen(stick.unseen);
    log.poke();
  };
  const toFoot = () => {
    const box = scroller.current!;
    stick.toFoot();
    box.scrollTop = box.scrollHeight;
    setUnseen(0);
  };

  // Typing (Eric, Oct 28, v4: "to chat you tap the chat box anywhere that isn't someone's name"): a tap on the box opens it (the blur behind
  // the box, the typing line at its foot, focused: the keyboard on a phone, the cursor on a computer); a send, a press on the map or
  // Escape closes it (the words stay for the next tap). In "new messages" it holds the lines on show and every line shows ("high text")
  // until it closes (`ChatLog.talk`). These read refs and setters only, so the handlers set up once may call them.
  const openTyping = () => {
    // (Straight away, inside the tap's own handler: iPhone opens the keyboard only for a focus() made while a tap is being handled, and
    // the line is hidden until it's typing: its visibility is switched here, not on the next draw.)
    if (form.current) form.current.dataset.open = "1";
    if (!typingNow.current) {
      typingNow.current = true;
      setTyping(true);
      log.talk(true);
    }
    field.current?.focus({ preventScroll: true });
  };
  const closeTyping = () => {
    if (!typingNow.current) return;
    typingNow.current = false;
    setTyping(false);
    field.current?.blur();
    log.talk(false);
  };

  // Where the box is: the remembered place (else the corner, in CSS), kept inside the map and off the buttons; picked up by a
  // press and hold and put down where you let go. `CHAT_BOX` tells the edge chips (render.ts) where it is, shown or not
  // (and nowhere while the chat is off). A wheel over the log scrolls it, never the map under it. A press on the box that lets go
  // before the hold with almost no movement is a tap (opens typing, or a player's name's menu); one that moves scrolls the stream.
  useLayoutEffect(() => {
    const el = wrap.current!;
    const ov = el.parentElement as HTMLElement; // (the overlay: the map's box; not offsetParent: that's null while the chat is off)
    const area = ov.parentElement!;
    let pos = loadChatPos();
    const buttons = (): Rect | null => {
      const c = area.querySelector(".town-controls")?.getBoundingClientRect();
      const o = ov.getBoundingClientRect();
      return c ? { x: c.left - o.left, y: c.top - o.top, w: c.width, h: c.height } : null;
    };
    const size = () => ({ w: el.offsetWidth, h: el.offsetHeight });
    const map = () => ({ w: ov.clientWidth, h: ov.clientHeight });
    const put = (p: { x: number; y: number }) => {
      el.style.left = `${p.x}px`;
      el.style.top = `${p.y}px`;
    };
    const measure = () => Object.assign(CHAT_BOX, { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight });
    const fit = () => {
      if (pos && el.offsetWidth > 0) put(clampBox(pos.x, pos.y, size(), map(), buttons()));
      measure();
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(ov);
    ro.observe(el);
    /** Whether the box can be seen and pressed now (faded in "new messages", or off: a press there is the map's). */
    const seeable = () => modeNow.current !== "off" && (el.dataset.on === "1" || el.classList.contains("grab"));

    // `row`: the line the press began on (none: the box's empty part); `name`: on a name; `menu`: a line's menu was open (this tap only dismisses it).
    let hold: { id: number; x: number; y: number; row: HTMLElement | null; name: boolean; menu: boolean; timer: ReturnType<typeof setTimeout> } | null = null;
    let drag: { id: number; dx: number; dy: number; hud: Rect | null } | null = null;
    /** When the last tap on the box was (a click right after it is part of it: iPhone's own gesture for the keyboard). */
    let tappedAt = -1e9;
    // (A finger moving the held box must not also start the log's own scroll: the browser's pan is called off while it's carried.)
    const noPan = (e: TouchEvent) => e.cancelable && e.preventDefault();
    const pickUp = () => {
      const h = hold;
      if (!h) return;
      hold = null;
      const b = el.getBoundingClientRect();
      drag = { id: h.id, dx: h.x - b.left, dy: h.y - b.top, hud: buttons() };
      el.classList.add("grab");
      log.hold(true);
      area.addEventListener("touchmove", noPan, { passive: false });
    };
    const onDown = (e: PointerEvent) => {
      const target = e.target as Element;
      // A press on the map (anything on it but the box) closes typing: the line hides, the keyboard goes, the blur goes (unless the setting holds it).
      if (!el.contains(target)) {
        closeTyping();
        return;
      }
      if (!e.isPrimary || !seeable()) return;
      // The typing line, the "↓ new" marker and a line's menu are their own: a press there isn't the box's.
      if (target.closest(".tc-form, .tc-new, .tc-menu")) return;
      log.poke(); // (reading: the wait before the fade starts over)
      // (A mouse's up may come off the box: it's captured. A finger is captured by its own touch, and the browser's scroll of the stream isn't touched.)
      if (e.pointerType === "mouse") el.setPointerCapture?.(e.pointerId);
      const row = target.closest<HTMLElement>(".tc-line");
      hold = { id: e.pointerId, x: e.clientX, y: e.clientY, row: row && el.contains(row) ? row : null, name: !!target.closest(".tc-name"), menu: !!el.querySelector(".tc-menu"), timer: setTimeout(pickUp, CHAT.holdMs) };
    };
    const onMove = (e: PointerEvent) => {
      // Moving before the hold is up is a scroll of the stream's (the browser's own, for a finger).
      if (hold && e.pointerId === hold.id && Math.hypot(e.clientX - hold.x, e.clientY - hold.y) > CHAT.holdSlopPx) {
        clearTimeout(hold.timer);
        hold = null;
      }
      if (!drag || e.pointerId !== drag.id) return;
      const o = ov.getBoundingClientRect();
      pos = clampBox(e.clientX - o.left - drag.dx, e.clientY - o.top - drag.dy, size(), map(), drag.hud);
      put(pos);
      measure();
    };
    /** A tap on the box (no hold, no scroll): a player's name opens its menu (a line said by the test hook has no one behind it: the menu ignores it); anywhere else opens typing. */
    const tap = (h: NonNullable<typeof hold>) => {
      const line = h.row ? log.lines.find((l) => l.id === Number(h.row!.dataset.id)) : undefined;
      if (h.name && line?.kind === "player") {
        const r = h.row!.getBoundingClientRect();
        onTownChatLineTap(line, { x: r.left, y: r.top, w: r.width, h: r.height });
        if (testSwitchesAllowed()) ((window as unknown as { __townTapped?: string[] }).__townTapped ??= []).push(line.text);
        return;
      }
      tappedAt = performance.now();
      openTyping();
    };
    const onEnd = (e: PointerEvent) => {
      if (hold && e.pointerId === hold.id) {
        // Let go before the hold, without moving: a tap (unless it only put a menu away).
        const h = hold;
        clearTimeout(h.timer);
        hold = null;
        if (e.type === "pointerup" && !h.menu) tap(h);
      }
      if (!drag || e.pointerId !== drag.id) return;
      drag = null;
      el.classList.remove("grab");
      area.removeEventListener("touchmove", noPan);
      log.hold(false);
      if (pos) saveChatPos(pos);
    };
    // (If the browser didn't take the focus() in the pointer's own handler, the click that follows a tap does: a tap's own gesture.)
    const onClick = () => {
      if (typingNow.current && performance.now() - tappedAt < 700 && document.activeElement !== field.current) field.current?.focus({ preventScroll: true });
    };
    const onWheel = (e: WheelEvent) => {
      const box = scroller.current;
      if (!box || !seeable() || box.scrollHeight <= box.clientHeight) return;
      const r = box.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
      e.preventDefault();
      e.stopPropagation();
      box.scrollTop += e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    };
    area.addEventListener("pointerdown", onDown, true);
    area.addEventListener("pointermove", onMove);
    area.addEventListener("pointerup", onEnd);
    area.addEventListener("pointercancel", onEnd);
    area.addEventListener("click", onClick);
    area.addEventListener("wheel", onWheel, { capture: true, passive: false });
    return () => {
      area.removeEventListener("pointerdown", onDown, true);
      area.removeEventListener("pointermove", onMove);
      area.removeEventListener("pointerup", onEnd);
      area.removeEventListener("pointercancel", onEnd);
      area.removeEventListener("click", onClick);
      area.removeEventListener("wheel", onWheel, true);
      area.removeEventListener("touchmove", noPan);
      ro.disconnect();
      if (hold) clearTimeout(hold.timer);
      if (drag) log.hold(false);
      Object.assign(CHAT_BOX, { x: 0, y: 0, w: 0, h: 0 });
    };
  }, [log]);

  // Escape closes typing (a computer's way to; the map press is the phone's). A line's menu or the settings sheet that is open take their own Escape first.
  useEffect(() => {
    if (!typing) return;
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || wrap.current?.querySelector(".tc-menu") || document.querySelector(".mm-scrim")) return;
      e.stopPropagation(); // (the town's own Escape, which closes a card, isn't also pressed)
      closeTyping();
    };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [typing]);
  // The chat turned off closes typing: off stays off.
  useEffect(() => {
    if (mode === "off") closeTyping();
  }, [mode]);

  // The keyboard opening must not resize or move the town: while the field has focus, the screen keeps the height it had
  // and follows the visual viewport if the browser pans it to show the field (visualViewport).
  const pin = () => {
    if (!pinned.current) pinned.current = pinTown(wrap.current!.closest<HTMLElement>(".town-screen")!);
  };
  const unpin = () => {
    pinned.current?.();
    pinned.current = null;
  };
  useEffect(() => unpin, []);

  // Sending waits for the server's answer (the field keeps your words and the keyboard meanwhile); your line comes back into
  // the log with everyone's. Too soon (nothing is sent) or refused, you keep your words, to change them or to try again, and a
  // gray line only you see says why, at the foot of the stream.
  const sorry = (why: string) => {
    stick.toFoot();
    log.whisper(why);
  };
  const submit = async (e: Event) => {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    const r = await sendTownChat(text);
    setSending(false);
    if (r.ok) {
      // Sent: typing is finished (the keyboard goes, the blur goes unless the setting holds it).
      setText("");
      closeTyping();
    } else if (r.reason === "wait") sorry(tooSoonText(r.waitMs));
    else if (r.reason === "refused" && r.message) sorry(r.message);
  };
  const left = CHAT.maxChars - townChars(text);
  // Why the typing line can't send right now (a guest, a young device, the switch, your chat ban), shown in its place: greyed.
  const off = townChatOff();
  // Shown: always (always on), or from a message until the wait runs out (new messages; typing holds it). The blur: while it shows and you're typing, or whenever it shows with the setting on.
  const on = chatShows(mode, log.shown);
  const blur = chatBlurs(mode, log.shown, typing, background);

  return (
    <div class="town-chat" ref={wrap} hidden={mode === "off"} data-size={computer ? "computer" : "phone"} data-mode={mode} data-on={on ? "1" : "0"} data-blur={blur ? "1" : "0"} data-typing={typing ? "1" : "0"} data-tone={tone} style={`--chat-out:${CHAT.fadeMs}ms;--chat-in:${CHAT.fadeInMs}ms`}>
      {/* The slight blur behind the whole box, the stream and the typing line together: one rounded rectangle (town-chat.css). */}
      <div class="tc-back" aria-hidden="true" />
      {/* (Focusable, so a keyboard gets to the box: Enter opens typing, as a tap does.) */}
      <div class="tc-log" ref={scroller} role="log" aria-label="Town chat" tabIndex={0} onScroll={scrolled} onKeyDown={(e) => e.key === "Enter" && e.target === e.currentTarget && openTyping()}>
        {lines.map((l) => {
          // A player's name is bold in a palette color: both shades are on the name (the box's tone picks one), `data-c` is its place in the palette.
          const c = l.kind === "player" ? nameColorIndex(l) : -1;
          const shade = NAME_COLORS[c];
          return (
            <div class={`tc-line tc-${l.kind}`} key={l.id} data-id={l.id}>
              <span class="tc-time">[{l.time}]</span> {l.name && <b class="tc-name" data-c={shade ? c : undefined} style={shade ? `--nd:${shade.day};--nn:${shade.night}` : undefined}>{l.name}</b>}
              {l.name && ": "}
              {l.text}
            </div>
          );
        })}
      </div>
      {unseen > 0 && (
        <button type="button" class="tc-new" aria-label="Jump to the newest messages" onClick={toFoot}>
          ↓ new
        </button>
      )}
      {/* The typing line: in the strip at the box's foot, which the stream keeps free whether it shows or not, so nothing moves when it does.
          No placeholder (a guest's, a paused chat's and a ban's reason is the placeholder of the greyed line), no border, no backing. */}
      <form class="tc-form" ref={form} data-open={typing ? "1" : "0"} onSubmit={submit}>
        <input
          ref={field}
          type="text"
          value={text}
          placeholder={off ?? undefined}
          title={off ?? undefined}
          disabled={!!off}
          readOnly={sending}
          enterkeyhint="send"
          autocomplete="off"
          autocapitalize="sentences"
          spellcheck={false}
          aria-label="Message to the town chat"
          onInput={(e) => {
            // (The field stops at maxChars as the server counts them, an emoji as one: no maxLength, which counts UTF-16.)
            const el = e.target as HTMLInputElement;
            const cut = cutTownText(el.value);
            if (cut !== el.value) el.value = cut;
            setText(cut);
          }}
          onFocus={pin}
          onBlur={unpin}
        />
        {left <= CHAT.nearEnd && !off && <span class="tc-left">{left} left</span>}
      </form>
      <LineMenu box={wrap} log={log} />
    </div>
  );
}

/**
 * A player's line's menu, opened by a tap on the name (or, with the chat always on, the text): Profile, Mute, Report, and Remove for a moderator.
 * Your own line's Mute and Report are greyed. Report is fair play's report with "Offensive chat" and the line (the server
 * reads its words); the answer shows in the menu, which then closes. A tap anywhere else, or Escape, closes it.
 */
function LineMenu({ box, log }: { box: { current: HTMLDivElement | null }; log: ChatLog }) {
  /** The line, and where its menu goes in the box's pixels (`above`: the line's top, should the menu not fit below it). */
  const [open, setOpen] = useState<{ line: ChatLine; at: { x: number; y: number }; above: number } | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(
    () =>
      setTownChatLineTap((line, anchor) => {
        // (A line said on this device by the test hook has no one behind it: nothing to open.)
        const el = box.current;
        if (!line.uid || !el) return;
        const b = el.getBoundingClientRect();
        const map = (el.offsetParent as HTMLElement | null)?.getBoundingClientRect();
        const width = 180;
        const x = Math.max(0, Math.min(anchor.x - b.left, (map ? map.right - b.left : b.width) - width - 8));
        setSaid(null);
        setOpen({ line, at: { x, y: anchor.y - b.top + anchor.h + 4 }, above: anchor.y - b.top });
      }),
    [],
  );
  // The box stays on show (it doesn't fade under the menu) while the menu is open.
  useEffect(() => {
    if (!open) return;
    log.hold(true);
    return () => log.hold(false);
  }, [!!open]);
  // A tap anywhere else, or Escape, closes it; so does a report's answer, after a moment.
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!menu.current?.contains(e.target as Node)) setOpen(null);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    document.addEventListener("pointerdown", away, true);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away, true);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  // Below the line, or above it when it wouldn't fit on the map there.
  useLayoutEffect(() => {
    const el = menu.current;
    const map = (box.current?.offsetParent as HTMLElement | null)?.getBoundingClientRect();
    if (!el || !map || !open) return;
    const r = el.getBoundingClientRect();
    if (r.bottom > map.bottom - 4) el.style.top = `${Math.max(open.above - r.height - 4, map.top - box.current!.getBoundingClientRect().top + 4)}px`;
  }, [open]);
  useEffect(() => {
    if (!said) return;
    const t = setTimeout(() => setOpen(null), 2500);
    return () => clearTimeout(t);
  }, [said]);
  if (!open) return null;

  const { line } = open;
  const uid = line.uid!;
  const me = account().profile;
  const you = me?.user.id === uid;
  const act = async (what: () => Promise<string>) => setSaid(await what());
  return (
    <div class="tc-menu" ref={menu} role="group" aria-label={`${line.name}'s message`} style={{ left: `${open.at.x}px`, top: `${open.at.y}px` }}>
      <strong>{you ? "You" : line.name}</strong>
      {said ? (
        <p class="tc-menu-said" role="status">
          {said}
        </p>
      ) : (
        <>
          <button
            type="button"
            class="town-btn"
            onClick={() => {
              setOpen(null);
              openProfile({ uid, name: line.name, you });
            }}
          >
            Profile
          </button>
          <button
            type="button"
            class="town-btn"
            disabled={you}
            onClick={() => {
              mutes.set(uid, true);
              setOpen(null);
            }}
          >
            Mute
          </button>
          <button type="button" class="town-btn" disabled={you} onClick={() => void act(() => reportTownLine({ from: uid, n: line.n! }).catch((e: Error) => e.message))}>
            Report
          </button>
          {me?.admin && (
            <button type="button" class="town-btn" onClick={() => void act(() => removeTownLine(line.n!))}>
              Remove
            </button>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Holds the town's screen steady while the keyboard is up: it keeps the height it has now (a browser that shrinks the page for
 * the keyboard would shrink it too) and slides with the visual viewport when the browser pans that to show the field. Returns
 * the release.
 */
function pinTown(screen: HTMLElement): () => void {
  const vv = window.visualViewport;
  const follow = () => {
    screen.style.transform = vv && (Math.abs(vv.offsetTop) > 0.5 || Math.abs(vv.offsetLeft) > 0.5) ? `translate3d(${vv.offsetLeft}px, ${vv.offsetTop}px, 0)` : "";
  };
  screen.style.height = `${screen.offsetHeight}px`;
  screen.style.bottom = "auto";
  vv?.addEventListener("resize", follow);
  vv?.addEventListener("scroll", follow);
  follow();
  return () => {
    vv?.removeEventListener("resize", follow);
    vv?.removeEventListener("scroll", follow);
    screen.style.height = screen.style.bottom = screen.style.transform = "";
  };
}
