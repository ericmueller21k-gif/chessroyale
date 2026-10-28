/**
 * The town square's chat log (Eric, Oct 28), in the map's top left corner: one line a message ("[9:41] Name: message", the
 * name bold), newest at the bottom, each line on its own soft dark backing. The lines fade out `fadeAfterMs` after the last
 * one and come back with the next; a line is gone for good after `lifeMs`. The box takes no taps (the map under it answers
 * them) except its text field and a player's line: a tap on one, name or text, opens its menu (Profile / Mute / Report, and
 * Remove for a moderator; `onTownChatLineTap`). Press and hold on the box (`holdMs`) and it comes off the map to move
 * wherever you drop it, remembered on this device. Plain DOM, drawn only when a message comes; nothing in the town's frame
 * loop. The rules and the numbers are in chat.ts; docs/areas/town-square.md, "The chat log".
 *
 * Players' messages (chat-net.ts; docs/decisions/2026-10-28-town-chat-typing.md): only a signed-in player on a device the
 * age gate didn't mark too young types and gets other players' lines (riding on the live poll); a guest's log has the
 * bosses' and kids' chatter alone. The field is there for everyone (nothing hidden): greyed with why for a guest ("Sign in
 * to chat with other players."), a young device, while the chat is paused (the switch) or your chat is off (a
 * moderator). It waits for the server's answer; a refusal's reason shows over it for `noteMs`. Players' lines leave the
 * log at once when you may no longer see them (signed out, paused) or mute or block their player.
 *
 * Test hooks (e2e, with the test switches on): `window.__townSay()` makes someone from the table talk now;
 * `__townSay(name, text, kind)` says that line (on this device only); `__townChatter(false)` stops the bosses' and kids'
 * chatter (true starts it again); `window.__townTapped` lists the taps on player lines.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";
import { account, onAccountChange } from "../account.ts";
import { mutes } from "../chat-mod.ts";
import { openProfile } from "../profile-nav.ts";
import { useServerStatus } from "../status.ts";
import { testSwitchesAllowed } from "../test-switches.ts";
import { CHAT, CHAT_BOX, ChatLog, clampBox, loadChatPos, onTownChatLineTap, saveChatPos, say, setTownChatLineTap, startChatter, type ChatKind, type ChatLine, type Rect } from "./chat.ts";
import { cutTownText, mayTownChat, openTownFeed, removeTownLine, reportTownLine, sendTownChat, townChars, townChatOff, townSendWaitMs } from "./chat-net.ts";
import "./town-chat.css";

export function TownChat() {
  const wrap = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const pinned = useRef<(() => void) | null>(null);
  const [computer, setComputer] = useState(() => matchMedia(CHAT.computerQuery).matches);
  const [typing, setTyping] = useState(mayTownChat);
  const [text, setText] = useState("");
  const [wait, setWait] = useState(() => Math.ceil(townSendWaitMs() / 1000));
  const [sending, setSending] = useState(false);
  /** A refusal's reason, over the field for `noteMs`. */
  const [note, setNote] = useState<string | null>(null);
  const [, redraw] = useState(0);
  const log = useMemo(() => new ChatLog(computer ? CHAT.capComputer : CHAT.capPhone, () => redraw((n) => n + 1)), []);
  // (The switch, as /api/status says it: the field reads townChatOff() each time it's drawn.)
  useServerStatus();

  // Who's talking: the log opens for `say`, the bosses and kids start their chatter, and the test hooks.
  useEffect(() => {
    const close = log.open();
    let chatter = startChatter();
    const hooks = window as unknown as { __townSay?: (name?: string, text?: string, kind?: ChatKind) => void; __townChatter?: (on: boolean) => void };
    hooks.__townSay = (name, line, kind = "player") => {
      if (!testSwitchesAllowed()) return;
      if (name === undefined) chatter.now();
      else say(name, line ?? "", kind);
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
  // longer see them (signed out, a device marked too young, the chat paused); the switch redraws the field.
  useEffect(() => {
    if (!typing) {
      log.drop((l) => l.uid !== undefined);
      return;
    }
    return openTownFeed({
      line: (l) => log.say(l.name, l.text, "player", Date.now(), { uid: l.from, n: l.n }),
      drop: (test) => log.drop((l) => l.uid !== undefined && l.n !== undefined && test({ n: l.n, from: l.uid })),
      paused: () => redraw((n) => n + 1),
    });
  }, [log, typing]);

  // The computer's size (a window crossing it) changes how many lines it keeps; the test switches can turn on late (the
  // account loads after the town opens), which is when the field appears.
  useEffect(() => {
    const mq = matchMedia(CHAT.computerQuery);
    const on = () => setComputer(mq.matches);
    mq.addEventListener("change", on);
    const off = onAccountChange(() => setTyping(mayTownChat()));
    return () => {
      mq.removeEventListener("change", on);
      off();
    };
  }, []);
  useEffect(() => log.setCap(computer ? CHAT.capComputer : CHAT.capPhone), [log, computer]);

  // The wait after your message, counting down in the field.
  useEffect(() => {
    if (wait <= 0) return;
    const t = setInterval(() => setWait(Math.ceil(townSendWaitMs() / 1000)), 250);
    return () => clearInterval(t);
  }, [wait > 0]);

  // Where the box is: the remembered place (else the corner, in CSS), kept inside the map and off the buttons; picked up by a
  // press and hold and put down where you let go. `CHAT_BOX` tells the edge chips (render.ts) where it is, shown or not.
  useLayoutEffect(() => {
    const el = wrap.current!;
    const ov = el.offsetParent as HTMLElement; // (the overlay: the map's box)
    const area = ov.parentElement!;
    const cv = area.querySelector("canvas")!;
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
      if (pos) put(clampBox(pos.x, pos.y, size(), map(), buttons()));
      measure();
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(ov);
    ro.observe(el);

    // `row`: the player's line the press began on (a tap on it reports it, later); none: it began on the map.
    let hold: { id: number; x: number; y: number; row: HTMLElement | null; timer: ReturnType<typeof setTimeout> } | null = null;
    let drag: { id: number; dx: number; dy: number; hud: Rect | null } | null = null;
    const pickUp = () => {
      const h = hold;
      if (!h) return;
      hold = null;
      const b = el.getBoundingClientRect();
      drag = { id: h.id, dx: h.x - b.left, dy: h.y - b.top, hud: buttons() };
      el.classList.add("grab");
      log.hold(true);
      // The map saw the finger go down and pressed a square: that press is called off (the box's now).
      if (!h.row) cv.dispatchEvent(new PointerEvent("pointercancel", { pointerId: h.id }));
    };
    const onDown = (e: PointerEvent) => {
      // A press on the map lets the field go (the keyboard closes).
      if (e.target !== field.current && document.activeElement === field.current) field.current?.blur();
      if (!e.isPrimary) return;
      // (Faded and with no field, the box can't be seen: a press there is the map's, however long.)
      if (!log.shown && !field.current) return;
      const row = e.target === cv ? null : (e.target as Element).closest<HTMLElement>(".tc-player");
      if (e.target !== cv && !(row && el.contains(row))) return;
      const b = el.getBoundingClientRect();
      if (!row && (e.clientX < b.left || e.clientX > b.right || e.clientY < b.top || e.clientY > b.bottom)) return;
      row?.setPointerCapture?.(e.pointerId);
      hold = { id: e.pointerId, x: e.clientX, y: e.clientY, row, timer: setTimeout(pickUp, CHAT.holdMs) };
    };
    const onMove = (e: PointerEvent) => {
      // Moving before the hold is up is a drag of the map's, which goes on as it was.
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
    const onEnd = (e: PointerEvent) => {
      if (hold && e.pointerId === hold.id) {
        // Let go before the hold, without moving: a tap. On a player's line it's that line's.
        const h = hold;
        clearTimeout(h.timer);
        hold = null;
        const line = h.row && e.type === "pointerup" ? log.lines.find((l) => l.id === Number(h.row!.dataset.id)) : null;
        if (line) {
          const r = h.row!.getBoundingClientRect();
          onTownChatLineTap(line, { x: r.left, y: r.top, w: r.width, h: r.height });
          if (testSwitchesAllowed()) ((window as unknown as { __townTapped?: string[] }).__townTapped ??= []).push(line.text);
        }
      }
      if (!drag || e.pointerId !== drag.id) return;
      drag = null;
      el.classList.remove("grab");
      log.hold(false);
      if (pos) saveChatPos(pos);
    };
    area.addEventListener("pointerdown", onDown, true);
    area.addEventListener("pointermove", onMove);
    area.addEventListener("pointerup", onEnd);
    area.addEventListener("pointercancel", onEnd);
    return () => {
      area.removeEventListener("pointerdown", onDown, true);
      area.removeEventListener("pointermove", onMove);
      area.removeEventListener("pointerup", onEnd);
      area.removeEventListener("pointercancel", onEnd);
      ro.disconnect();
      if (hold) clearTimeout(hold.timer);
      if (drag) log.hold(false);
      Object.assign(CHAT_BOX, { x: 0, y: 0, w: 0, h: 0 });
    };
  }, [log]);

  // The keyboard opening must not resize or move the town: while the field has focus, the screen keeps the height it had
  // and follows the visual viewport if the browser pans it to show the field (visualViewport).
  const focus = () => {
    if (pinned.current) return;
    pinned.current = pinTown(wrap.current!.closest<HTMLElement>(".town-screen")!);
    log.hold(true);
  };
  const blur = () => {
    if (!pinned.current) return;
    pinned.current();
    pinned.current = null;
    log.hold(false);
  };
  // (The field greyed while it has focus, a guest signed out say, lets go too.)
  useEffect(() => {
    if (!typing) blur();
  }, [typing]);
  useEffect(() => blur, []);

  // A refusal's reason, for a few seconds.
  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(null), CHAT.noteMs);
    return () => clearTimeout(t);
  }, [note]);

  // Sending waits for the server's answer (the field keeps your words and the keyboard meanwhile); your line comes back into
  // the log with everyone's. A refusal keeps your words, to change them, and says why.
  const submit = async (e: Event) => {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    const r = await sendTownChat(text);
    setSending(false);
    if (r.ok) {
      setText("");
      setNote(null);
      setWait(Math.ceil(CHAT.sendEveryMs / 1000));
      field.current?.blur();
    } else if (r.reason === "wait") setWait(Math.ceil(r.waitMs / 1000));
    else if (r.reason === "refused") setNote(r.message ?? null);
  };
  const left = CHAT.maxChars - townChars(text);
  // Why the field can't send right now (a guest, a young device, the switch, your chat ban), shown in its place.
  const off = townChatOff();

  return (
    <div class="town-chat" ref={wrap} data-size={computer ? "computer" : "phone"}>
      <div class={`tc-log${log.shown ? " on" : ""}`} role="log" aria-label="Town chat" style={`--chat-out:${CHAT.fadeMs}ms;--chat-in:${CHAT.fadeInMs}ms`}>
        {log.lines.map((l) => (
          <div class={`tc-line tc-${l.kind}`} key={l.id} data-id={l.id}>
            <span class="tc-time">[{l.time}]</span> {l.name && <b class="tc-name">{l.name}</b>}
            {l.name && ": "}
            {l.text}
          </div>
        ))}
      </div>
      {note && (
        <div class="tc-note" role="status">
          {note}
        </div>
      )}
      <form class="tc-form" onSubmit={submit}>
        <input
          ref={field}
          type="text"
          value={text}
          placeholder={off ?? (wait > 0 ? `Wait ${wait} s` : "Say something…")}
          title={off ?? undefined}
          disabled={!!off || wait > 0}
          readOnly={sending}
          enterkeyhint="send"
          autocomplete="off"
          autocapitalize="sentences"
          spellcheck={false}
          aria-label="Say something in the town chat"
          onInput={(e) => {
            // (The field stops at maxChars as the server counts them, an emoji as one: no maxLength, which counts UTF-16.)
            const el = e.target as HTMLInputElement;
            const cut = cutTownText(el.value);
            if (cut !== el.value) el.value = cut;
            setText(cut);
          }}
          onFocus={focus}
          onBlur={blur}
        />
        {left <= CHAT.nearEnd && wait <= 0 && !off && <span class="tc-left">{left} left</span>}
      </form>
      <LineMenu box={wrap} />
    </div>
  );
}

/**
 * A player's line's menu, opened by a tap on the line (name or text): Profile, Mute, Report, and Remove for a moderator.
 * Your own line's Mute and Report are greyed. Report is fair play's report with "Offensive chat" and the line (the server
 * reads its words); the answer shows in the menu, which then closes. A tap anywhere else, or Escape, closes it.
 */
function LineMenu({ box }: { box: { current: HTMLDivElement | null } }) {
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
