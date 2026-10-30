import type { FunctionComponent } from "preact";
import { useEffect, useState } from "preact/hooks";

type Screen = FunctionComponent<{ onExit: () => void }>;

/**
 * Inside the Colosseum (/colosseum; the first look, Oct 30: docs/areas/colosseum.md), loaded when it opens: its code, art
 * and styles are their own chunk, never in the main bundle or the town's first load. Until it arrives (a moment) the page
 * is its plain background.
 */
export function ColosseumPage({ onExit }: { onExit: () => void }) {
  const [Screen, setScreen] = useState<Screen | null>(null);
  useEffect(() => {
    let live = true;
    // (No module when its chunk was gone after a deploy: the page is loading again, stale.ts.)
    void import("./Colosseum.tsx").then((m) => live && m && setScreen(() => m.ColosseumScreen));
    return () => void (live = false);
  }, []);
  return Screen ? <Screen onExit={onExit} /> : <div class="screen col-screen" />;
}
