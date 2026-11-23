import { CHAT_TYPED, GLOBAL_CHAT } from "@chessroyale/core";
import { chatRefusal } from "./text-filter.ts";
import { charCount, tidyMessage, TOWN_INPUT_MAX } from "./town-chat.ts";

/**
 * Typed chat's checks, shared by the global chat (global-chat.ts) and a match's and its lobby's chat (lobby.ts, duel-room.ts):
 * the town square's tidy, the filter on every message, GLOBAL_CHAT.maxChars, one typed message per player every GLOBAL_CHAT.gapMs,
 * and who may type (signed in, chat on, not a device the age gate marked too young) and who reads typed lines (chat on, not too
 * young). docs/decisions/2026-11-07-typed-chat-column.md, 2026-11-07-typed-chat-everywhere.md.
 */

/** A device the age gate marked too young (signed in there all the same): the quick chips only. */
export const TYPED_AGE = "Typing in chat is for players 13 and older. You can still send the quick chat lines.";
export const TYPED_EMPTY = "Type a message first.";
export const TYPED_OFF = "Turn on chat to type.";
export const typedTooLong = (max: number) => `Messages are at most ${max} characters.`;
export const typedWait = (gapMs: number) => `One message every ${Math.round(gapMs / 1000)} s.`;

/** A typed message as it's shown (tidied, through the filter, at most `max` characters), or why it can't go. */
export function typedText(text: unknown, max: number = GLOBAL_CHAT.maxChars): { ok: true; text: string } | { ok: false; message: string } {
  const said = tidyMessage(typeof text === "string" ? text.slice(0, TOWN_INPUT_MAX) : text);
  if (!said) return { ok: false, message: TYPED_EMPTY };
  if (charCount(said) > max || [...said].length > 3 * max) return { ok: false, message: typedTooLong(max) };
  const refused = chatRefusal(said);
  return refused ? { ok: false, message: refused } : { ok: true, text: said };
}

/** Who types and who reads typed lines in one match's chat (kept in its record), by seat. */
export interface TypedSeats {
  /** May type: signed in, chat on (the account's, as the server read it), not too young. */
  may?: Record<string, true>;
  /** Gets players' typed lines: chat on (this device says so), not too young. */
  reads?: Record<string, true>;
  /** A device the age gate marked too young: never reads or types. */
  young?: Record<string, true>;
  /** When each (by its limit's key) last typed. */
  at?: Record<string, number>;
}

/** A seat as the server found it joining (or turning chat on): may it type, is it too young. */
export function typedSeat(st: TypedSeats, who: string, o: { may: boolean; young: boolean }) {
  if (o.young) st.young = { ...st.young, [who]: true };
  else if (st.young?.[who]) delete st.young[who];
  if (o.may && !o.young) st.may = { ...st.may, [who]: true };
  else if (st.may?.[who]) delete st.may[who];
  if (o.young && st.reads?.[who]) delete st.reads[who];
}

/** This device turned typed lines on or off (its opt-in). Whether it newly reads them (send it the log again). */
export function typedReads(st: TypedSeats, who: string, on: boolean): boolean {
  const had = !!st.reads?.[who];
  if (on && !st.young?.[who]) st.reads = { ...st.reads, [who]: true };
  else if (st.reads?.[who]) delete st.reads[who];
  return !had && !!st.reads?.[who];
}

/** Whether `who` is sent this line: anything but a typed line, their own, or a typed line when they read them. */
export const hearsTyped = (st: TypedSeats, who: string, line: { from: string; text?: string }) => line.text === undefined || line.from === who || !!st.reads?.[who];

/**
 * A typed message from `who` (its limit counted by `key`, an account's when there is one): CHAT_TYPED, may they type, the text, and
 * the one-message-every-gapMs limit. A refusal never starts the wait.
 */
export function typedSay(
  st: TypedSeats,
  who: string,
  key: string,
  text: unknown,
  now: number,
  gapMs: number = GLOBAL_CHAT.gapMs,
): { ok: true; text: string } | { ok: false; reason: "typed" | "text" | "gap"; message: string; retryAt: number } {
  if (!CHAT_TYPED) return { ok: false, reason: "typed", message: "Only the preset lines can go in the chat.", retryAt: now };
  if (!st.may?.[who]) return { ok: false, reason: "typed", message: st.young?.[who] ? TYPED_AGE : TYPED_OFF, retryAt: now };
  const t = typedText(text);
  if (!t.ok) return { ok: false, reason: "text", message: t.message, retryAt: now };
  const last = st.at?.[key] ?? -Infinity;
  if (now - last < gapMs) return { ok: false, reason: "gap", message: typedWait(gapMs), retryAt: last + gapMs };
  st.at = { ...Object.fromEntries(Object.entries(st.at ?? {}).filter(([, at]) => now - at < gapMs)), [key]: now };
  return { ok: true, text: t.text };
}
