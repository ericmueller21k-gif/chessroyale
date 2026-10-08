import { useEffect, useState } from "preact/hooks";
import { fairStatus, sendAppeal, type FairStatus } from "../account.ts";
import { FdButton } from "./FrontDoor.tsx";

/**
 * Fair play's notice for a banned account: shown when it tries to play online (PLAY, a new lobby, joining one).
 * A plain message, that solo games stay open, and an appeal form (a person reads every appeal).
 */
let open = false;
const listeners = new Set<() => void>();

export function showBanNotice() {
  open = true;
  listeners.forEach((l) => l());
}

function close() {
  open = false;
  listeners.forEach((l) => l());
}

export function BanNotice() {
  const [, rerender] = useState(0);
  useEffect(() => {
    const fn = () => rerender((n) => n + 1);
    listeners.add(fn);
    return () => void listeners.delete(fn);
  }, []);
  if (!open) return null;
  return <BanSheet />;
}

function BanSheet() {
  const [status, setStatus] = useState<FairStatus | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    fairStatus()
      .then(setStatus)
      .catch(() => setStatus({ banned: true, appeal: null }));
  }, []);
  const appeal = status?.appeal;
  return (
    <div class="fd-sheet-scrim" onClick={(e) => e.target === e.currentTarget && close()}>
      <div class="fd-sheet fp-ban" role="dialog" aria-modal="true" aria-labelledby="ban-title">
        <div class="fd-sheet-head">
          <h2 id="ban-title">Your account can't play online</h2>
          <button type="button" class="fd-icon-btn" aria-label="Close" onClick={close}>
            ✕
          </button>
        </div>
        <p class="fd-sub">
          It was banned for fair play: the moves in its online matches matched a chess engine's far more closely than a person's would.
          Solo games against bots are still open.
        </p>
        {appeal?.status === "open" ? (
          <p class="fd-sub">Your appeal is with us. A person will read it, and you'll get an email when it's decided.</p>
        ) : appeal?.status === "upheld" ? (
          <p class="fd-sub">Your appeal was read and the ban stands{appeal.reply ? `: ${appeal.reply}` : "."}</p>
        ) : msg ? (
          <p class="fd-sub">{msg}</p>
        ) : (
          <>
            <label class="fd-label" for="appeal-text">
              THINK IT'S A MISTAKE? APPEAL
            </label>
            <textarea
              id="appeal-text"
              class="fp-appeal"
              rows={4}
              maxLength={2000}
              placeholder="Tell us what happened. A person reads every appeal."
              value={text}
              onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
            />
            <FdButton
              primary
              disabled={busy || text.trim().length < 10}
              onClick={() => {
                setBusy(true);
                sendAppeal(text)
                  .then((s) => {
                    setStatus(s);
                    setMsg("Thanks. A person will read your appeal, and you'll get an email when it's decided.");
                  })
                  .catch((e: Error) => setMsg(e.message))
                  .finally(() => setBusy(false));
              }}
            >
              Send appeal
            </FdButton>
          </>
        )}
      </div>
    </div>
  );
}
