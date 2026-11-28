import type { ComponentType } from "preact";
import { useEffect, useReducer } from "preact/hooks";

/**
 * A group of screens that are their own chunk, off the first load (Nov 10, phone load: home starts fast), as the town
 * square's is. `preload()` fetches it (play is near: the queue, the boss menu, a match starting); `screen(name)` is that
 * screen, drawn at once once the chunk is here, else the plain screen background until it arrives (a moment). No module
 * (a chunk that won't load: stale.ts took it over, and loads the page again only for a deploy) or a failed load: asked again next time.
 */
export function lazyGroup<M>(load: () => Promise<M>) {
  let mod: M | null = null;
  let loading: Promise<M | null> | null = null;
  const preload = (): Promise<M | null> =>
    (loading ??= load().then(
      (m) => (m ? (mod = m) : ((loading = null), null)),
      () => ((loading = null), null),
    ));
  /** `fallback`: what shows until the chunk is here (the plain screen background; null for a piece inside a screen, its box kept by its own). */
  const screen = <K extends keyof M>(name: K, fallback: preact.JSX.Element | null = <div class="screen" />): M[K] => {
    function Lazy(props: object) {
      const [, loaded] = useReducer((n: number) => n + 1, 0);
      const Screen = mod?.[name] as ComponentType<object> | undefined;
      // (Drawn without it: drawn again once it's here, even if it came between that drawing and this effect, which runs after the paint.
      // Asking whether it's here yet only now left the fallback up for good: the ranked game found from a town table while the chunk was
      // still loading, an empty screen, #1027, Nov 27.)
      const drawnWithout = !Screen;
      useEffect(() => {
        let live = true;
        if (drawnWithout) void preload().then(() => live && loaded(0));
        return () => void (live = false);
      }, []);
      return Screen ? <Screen {...props} /> : fallback;
    }
    return Lazy as M[K];
  };
  return { preload, screen, loaded: () => mod };
}
