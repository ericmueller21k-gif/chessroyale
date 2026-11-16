import { useLayoutEffect, useRef } from "preact/hooks";

/**
 * "Leave Chess Town?" (Eric: "a little pop-up that just says you are about to leave Chess Town, click yes and no … you should
 * always have a confirm if you're going back out to a different menu or you're trying to exit"). The app's sheet (`fd-sheet`,
 * as AwayNote's and the town's gate), over the town wherever you are in it. Stay (focused, so Enter or a stray tap never
 * leaves; Escape and a tap outside too) changes nothing; Leave goes where you asked (App.tsx, askTownLeave).
 * What asks, on the street and inside any building (Eric, Nov 13): the computer's side menu, the town's back button, the phone's back
 * gesture, a guest's chat sign-up, an invite's Join, a profile's Challenge. Not what happens inside the town: going in and out of its
 * rooms, a boss's challenge, the claw machine, its settings, map and chat.
 */

export const LEAVE_TOWN_TITLE = "Leave Chess Town?";
export const leaveTownText = (dest: string) => `You'll head back to ${dest}.`;

/**
 * Leaving the Hidden Boss's room with your game request in (Eric, Nov 12: "leaving asks 'Cancel your game request?' (yes = leave and
 * cancel)"): the stairs, back, the side menu, closing the town. The same sheet, its words these. (Town.tsx says whether a request is in:
 * `setRequestWaiting`; the town's own code stays out of the main bundle.)
 */
export const CANCEL_REQUEST_TITLE = "Cancel your game request?";
export const CANCEL_REQUEST_TEXT = "Leaving his room gives up your place.";
export const CANCEL_REQUEST_LEAVE = "Leave and cancel";
let waiting: () => boolean = () => false;
/** The town's: whether your game request is in now (null: the town is gone). */
export const setRequestWaiting = (f: (() => boolean) | null) => void (waiting = f ?? (() => false));
export const requestWaiting = () => waiting();
/** Where the town's back button and the phone's back gesture go: the front door. */
export const TOWN_BACK_TO = "Play";

export function LeaveTownConfirm({ dest, onStay, onLeave, request = false }: { dest: string; onStay: () => void; onLeave: () => void; /** Your Hidden Boss's request is in: "Cancel your game request?" */ request?: boolean }) {
  const stay = useRef<HTMLButtonElement>(null);
  const stayRef = useRef(onStay);
  stayRef.current = onStay;
  // (Layout effects: focus and the keys are in place as the sheet is drawn. A plain effect waits for a frame, and an Escape or
  // Enter in that frame, under load, went to the town or nowhere: main run 42760919996's sheet that stayed.)
  useLayoutEffect(() => stay.current?.focus(), []);
  useLayoutEffect(() => {
    // (No key reaches the town under the sheet: the arrow keys would walk you on. Escape is Stay.)
    const keys = (e: KeyboardEvent) => {
      if (e.key === "Escape") stayRef.current();
      if (!(e.target instanceof Element && e.target.closest(".town-leave"))) e.stopImmediatePropagation();
    };
    addEventListener("keydown", keys, true);
    return () => removeEventListener("keydown", keys, true);
  }, []);
  return (
    <div class="fd-sheet-scrim town-leave-scrim" onClick={(e) => e.target === e.currentTarget && onStay()}>
      <div class="fd-sheet town-leave" role="alertdialog" aria-modal="true" aria-labelledby="town-leave-title" aria-describedby="town-leave-text">
        <div class="fd-sheet-head">
          <h2 id="town-leave-title">{request ? CANCEL_REQUEST_TITLE : LEAVE_TOWN_TITLE}</h2>
        </div>
        <p class="fd-sub" id="town-leave-text">
          {request ? CANCEL_REQUEST_TEXT : leaveTownText(dest)}
        </p>
        <button type="button" class="fd-btn primary" ref={stay} onClick={onStay}>
          Stay
        </button>
        <button type="button" class="fd-btn" onClick={onLeave}>
          {request ? CANCEL_REQUEST_LEAVE : "Leave"}
        </button>
      </div>
    </div>
  );
}
