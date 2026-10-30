import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { BOSS_PARTY } from "@chessroyale/core";
import { FdButton } from "./FrontDoor.tsx";
import type { PartyClient } from "../squads.ts";

/**
 * Boss Battle's invite (Eric, Oct 29: "invite only from the circles above those two platforms"): a tap on a circle opens
 * this sheet: the party's code and link to copy or share, the members so far, and leaving it. Admins (and tests) can add
 * a bot member to fill a seat (never shown to players). docs/decisions/2026-10-30-boss-party.md.
 */
export function BossInviteSheet({ client, test, onClose, onLeave }: { client: PartyClient; test: boolean; onClose: () => void; onLeave: () => void }) {
  const [copied, setCopied] = useState(false);
  const [, redraw] = useState(0);
  useEffect(() => client.subscribe(() => redraw((n) => n + 1)), [client]);
  const close = useRef(onClose);
  close.current = onClose;
  useLayoutEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && close.current();
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, []);
  const p = client.party;
  const copy = async () => {
    try {
      if (navigator.share && matchMedia("(pointer: coarse)").matches) await navigator.share({ title: "HunChess Boss Battle", text: "Fight a boss with me", url: client.link });
      else await navigator.clipboard.writeText(client.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Canceled, or no clipboard: the link is on screen to copy by hand.
    }
  };
  const bots = p?.members.filter((m) => m.bot).length ?? 0;
  return (
    <div class="fd-sheet-scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="fd-sheet bp-invite" role="dialog" aria-modal="true" aria-labelledby="bp-invite-title">
        <div class="fd-sheet-head">
          <h2 id="bp-invite-title">Invite friends</h2>
          <button type="button" class="fd-icon-btn" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>
        <p class="fd-sub">Up to {BOSS_PARTY.max - 1} friends fight the boss with you, everyone picking every move. Share the link.</p>
        <div class="sq-invite">
          <span class="sq-invite-code" aria-label="Party code">
            {client.code}
          </span>
          <span class="sq-invite-link">{client.link.replace(/^https?:\/\//, "")}</span>
          <FdButton class="small" onClick={() => void copy()}>
            {copied ? "Copied" : "Copy link"}
          </FdButton>
        </div>
        <ul class="sq-party-members" aria-label="Members">
          {p?.members.map((m) => (
            <li key={m.id} class={`${m.connected ? "" : "away"}${m.id === client.memberId ? " you" : ""}`}>
              <span class={`fd-dot${m.connected ? "" : " off"}`} aria-hidden="true" />
              <span class="sq-party-name">{m.id === client.memberId ? `${m.name} (you)` : m.name}</span>
              {m.id === p.leaderId && <span class="sq-party-lead">leader</span>}
            </li>
          ))}
        </ul>
        {/* (Admins and tests: a bot member in a free seat; the server refuses it for anyone else.) */}
        {test && client.isLeader && (
          <div class="bp-bots">
            <FdButton class="small" disabled={(p?.members.length ?? 0) >= BOSS_PARTY.max} onClick={() => client.bot(true)}>
              Add a bot
            </FdButton>
            <FdButton class="small" disabled={!bots} onClick={() => client.bot(false)}>
              Remove a bot
            </FdButton>
          </div>
        )}
        {client.error && <p class="fd-error">{client.error}</p>}
        <FdButton danger onClick={onLeave}>
          Leave the party
        </FdButton>
      </div>
    </div>
  );
}
