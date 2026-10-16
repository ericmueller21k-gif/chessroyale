import { useEffect, useState } from "preact/hooks";
import { account, chatNoticeSeen, onAccountChange } from "../account.ts";
import { FdButton } from "./FrontDoor.tsx";

/**
 * A moderator's warning or chat ban, shown once on the home screen (never over a match): what it is, the moderator's
 * note if any, and "Got it": it goes from your profile at once (so it doesn't come back as you move around) and on the
 * server (so it doesn't come back next time). The notice comes with your profile (server/src/chat-mod.ts).
 */
export function ChatNotice() {
  const [, redraw] = useState(0);
  useEffect(() => onAccountChange(() => redraw((n) => n + 1)), []);
  const notice = account().profile?.chatMod?.notice;
  if (!notice) return null;
  const close = () => void chatNoticeSeen();
  const until = notice.until ? new Date(notice.until).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : null;
  const ban = notice.kind === "ban";
  return (
    <div class="fd-sheet-scrim" onClick={(e) => e.target === e.currentTarget && close()}>
      <div class="fd-sheet" role="dialog" aria-modal="true" aria-labelledby="chat-notice-title">
        <div class="fd-sheet-head">
          <h2 id="chat-notice-title">{ban ? "Your chat is off" : "A note about your chat"}</h2>
          <button type="button" class="fd-icon-btn" aria-label="Close" onClick={close}>
            ✕
          </button>
        </div>
        <p class="fd-sub">
          {ban
            ? `A moderator turned your chat off ${until ? `until ${until}` : "for good"}. You can still read chat and play.`
            : "A moderator looked at your chat. Please keep it friendly: next time it may be turned off."}
        </p>
        {notice.note && <p class="fd-sub chat-notice-note">“{notice.note}”</p>}
        <FdButton primary onClick={close}>
          Got it
        </FdButton>
      </div>
    </div>
  );
}
