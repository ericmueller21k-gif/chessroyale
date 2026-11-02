import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { tokenGotLine } from "@chessroyale/core";
import { battleToken, tokenSeen, type TokenMatch } from "../boss-tokens.ts";
import { play } from "../sound.ts";
import { TokenArt } from "./TokenArt.tsx";

/**
 * The result screen's boss token box (Eric, Nov 2: "You got a [Boss] token!" and OK, victory or defeat): when the server says this
 * boss battle dropped you a token (boss-tokens.ts), a square box in the gambling warning's look (GamblingWarning.tsx: the
 * locker's dialog, `role="dialog"`) over the result screen, the token turning in it. OK (also Escape, or a tap outside) closes it,
 * and it doesn't come back for that battle; the token is in your inventory (the Crates tab) already.
 */
export function TokenBox({ match }: { match: TokenMatch & object }) {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void battleToken(match).then((t) => live && !tokenSeen.has(match) && setToken(t));
    return () => void (live = false);
  }, [match]);
  const ok = useRef<HTMLButtonElement>(null);
  const close = () => {
    play("menuClose");
    tokenSeen.add(match);
    setToken(null);
  };
  // (A layout effect, as the gambling warning's: an Escape the moment it shows closes it.)
  useLayoutEffect(() => {
    if (!token) return;
    ok.current?.focus();
    const key = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [token]);
  if (!token) return null;
  const line = tokenGotLine(token);
  return (
    <div class="locker-dialog-back" onClick={close}>
      <div class="ff-window locker-dialog gamble-dialog token-box" role="dialog" aria-modal="true" aria-label={line} onClick={(e) => e.stopPropagation()}>
        <span class="token-box-art">
          <TokenArt boss={token} animate />
        </span>
        <p>{line}</p>
        <div class="locker-dialog-actions">
          <button type="button" class="ff-button small" ref={ok} onClick={close}>
            ▶ OK
          </button>
        </div>
      </div>
    </div>
  );
}
