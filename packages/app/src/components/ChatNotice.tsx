import { useEffect, useState } from "preact/hooks";
import { account, onAccountChange } from "../account.ts";
import { chatNoticeSeen } from "../chat-mod.ts";
import { FdButton } from "./FrontDoor.tsx";

/**
 * A moderator's warning or chat ban, shown once on the home screen (never over a match): what it is, the moderator's
 * note if any, and "Got it" (then it doesn't show again). The notice comes with your profile (chat-mod.ts).
 */
export function ChatNotice() {
  const [, redraw] = useState(0);
  const [closed, setClosed] = useState<number | null>(null);
  useEffect(() => onAccountChange(() => redraw((n) => n + 1)), []);
  const notice = account().profile?.chatMod?.notice;
  if (!notice || closed === notice.id) return null;
  const close = () => {
    setClosed(notice.id);
    void chatNoticeSeen();
  };
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
