import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The service worker's caches across a deploy (sw-template.js, Nov 15): a tab left open on an older version keeps that version's files
 * until it loads again, and a version no open tab runs goes. The real template, run against a pretend browser.
 */
const ORIGIN = "https://hunchess.com";
const pathOf = (req: string | { url: string }) => new URL(typeof req === "string" ? req : req.url, ORIGIN).pathname;

class FakeCache {
  readonly files = new Map<string, Response>();
  async match(req: string | { url: string }) {
    return this.files.get(pathOf(req))?.clone();
  }
  async put(req: string | { url: string }, res: Response) {
    this.files.set(pathOf(req), res);
  }
  async keys() {
    return [...this.files.keys()].map((p) => ({ url: ORIGIN + p }));
  }
  async delete(req: string | { url: string }) {
    return this.files.delete(pathOf(req));
  }
}
class FakeCaches {
  readonly named = new Map<string, FakeCache>();
  async open(name: string) {
    if (!this.named.has(name)) this.named.set(name, new FakeCache());
    return this.named.get(name)!;
  }
  async keys() {
    return [...this.named.keys()];
  }
  async delete(name: string) {
    return this.named.delete(name);
  }
  async match(req: string | { url: string }) {
    for (const c of this.named.values()) {
      const r = await c.match(req);
      if (r) return r;
    }
    return undefined;
  }
}

const V = (c: string) => `brc-${c.repeat(12)}`;
/** A tab: the entry script it says it runs, or `null`, one that never answers (asleep, or from before tabs were asked). */
const tab = (entry: string | null) => ({
  postMessage: (msg: { type: string }, ports: MessagePort[]) => {
    if (msg.type === "brc-entry?" && entry !== null) ports[0]!.postMessage(entry);
  },
});

/**
 * The worker of version `current`, with `caches` as the device has them and `tabs` open; the network has nothing (`net`, else 404; an
 * Error: no answer at all, the fetch fails as it does offline).
 */
function worker(current: string, store: FakeCaches, tabs: ReturnType<typeof tab>[], net: (path: string) => Response | Error | null = () => null) {
  const code = readFileSync(new URL("../sw-template.js", import.meta.url), "utf8")
    .replace("__VERSION__", current)
    .replace("__FILES__", "[]")
    .replace("__HASHES__", "{}")
    .replace("__MUSIC_HASHES__", JSON.stringify({ "/music/kept.mp3": "aaaaaaaaaaaa" }))
    .replace("__MAIA__", "brc-maia-new")
    .replace("__KEEP_VERSIONS__", "3")
    // (A tab that doesn't answer is given up on in 20 ms here, not 1.5 s.)
    .replace("const ASK_MS = 1500;", "const ASK_MS = 20;");
  const on = new Map<string, (e: unknown) => void>();
  const self = {
    addEventListener: (type: string, fn: (e: unknown) => void) => on.set(type, fn),
    skipWaiting: () => Promise.resolve(),
    clients: { matchAll: async () => tabs, claim: async () => {} },
  };
  const fetched: string[] = [];
  const fetch = async (req: string | { url: string }) => {
    const p = pathOf(req);
    fetched.push(p);
    const answer = net(p);
    if (answer instanceof Error) throw answer;
    return answer ?? new Response("", { status: 404 });
  };
  new Function("self", "caches", "location", "fetch", code)(self, store, { origin: ORIGIN }, fetch);
  /** Runs an event to its end (its waitUntil), returning what it answered (respondWith), if anything. */
  const fire = async (type: string, fields: object) => {
    let wait: Promise<unknown> = Promise.resolve();
    let answer: Promise<Response> | null = null;
    on.get(type)!({ ...fields, waitUntil: (p: Promise<unknown>) => void (wait = p), respondWith: (p: Promise<Response>) => void (answer = p) });
    await wait;
    return answer ? await answer : null;
  };
  return {
    fetched,
    activate: () => fire("activate", {}),
    loaded: () => fire("message", { data: { type: "brc-loaded" } }),
    get: (path: string) => fire("fetch", { request: { method: "GET", mode: "no-cors", url: ORIGIN + path } }),
    /** A page opened (a navigation: a link, a reload, the installed app's start). */
    open: (path: string) => fire("fetch", { request: { method: "GET", mode: "navigate", url: ORIGIN + path } }),
  };
}

/** The device after some deploys: each version's cache with its entry script and a room's chunk (only its own), and one engine file (one name). */
async function device(versions: string[]) {
  const store = new FakeCaches();
  for (const v of versions) {
    const c = await store.open(v);
    await c.put(`/assets/index-${v}.js`, new Response(`entry ${v}`));
    await c.put(`/assets/ShopRoom-${v}.js`, new Response(`room ${v}`));
    await c.put("/engine/stockfish.js", new Response(`engine ${v}`));
  }
  const music = await store.open("brc-music");
  await music.put("/music/kept.mp3", new Response("kept", { headers: { "x-brc-hash": "aaaaaaaaaaaa" } }));
  await music.put("/music/gone.mp3", new Response("gone", { headers: { "x-brc-hash": "bbbbbbbbbbbb" } }));
  await store.open("brc-maia-old");
  await store.open("brc-maia-new");
  return store;
}
const entry = (v: string) => `/assets/index-${v}.js`;

afterEach(() => vi.restoreAllMocks());

describe("a deploy while a tab is open: the new worker takes over", () => {
  it("keeps the version an open tab runs, and lets go of one no tab runs (all tabs answered: no extra kept)", async () => {
    const [a, b, c] = [V("a"), V("b"), V("c")];
    const store = await device([a, b, c]);
    await worker(c, store, [tab(entry(b)), tab(entry(c))]).activate();
    expect(await store.keys()).toEqual([b, c, "brc-music", "brc-maia-new"]);
    // (The music this version doesn't have goes, as before.)
    expect([...store.named.get("brc-music")!.files.keys()]).toEqual(["/music/kept.mp3"]);
  });

  it("the old tab's room opens from its own version's files (gone from the server), without the network", async () => {
    const [b, c] = [V("b"), V("c")];
    const store = await device([b, c]);
    const sw = worker(c, store, [tab(entry(b))]);
    await sw.activate();
    expect(await (await sw.get(`/assets/ShopRoom-${b}.js`))!.text()).toBe(`room ${b}`);
    expect(sw.fetched).toEqual([]);
  });

  it("a file with one name in every version (not under /assets/) comes from this version, never an older copy", async () => {
    const [b, c] = [V("b"), V("c")];
    const store = await device([b, c]);
    const sw = worker(c, store, [tab(entry(b))]);
    await sw.activate();
    expect(await (await sw.get("/engine/stockfish.js"))!.text()).toBe(`engine ${c}`);
  });

  it("a tab that doesn't answer (asleep in the background, or from before tabs were asked): the newest 3 versions stay", async () => {
    const [a, b, c, d] = [V("a"), V("b"), V("c"), V("d")];
    const store = await device([a, b, c, d]);
    await worker(d, store, [tab(null), tab(entry(d))]).activate();
    expect(await store.keys()).toEqual([b, c, d, "brc-music", "brc-maia-new"]);
  });

  it("a tab on a version older than the newest 3 keeps it while it answers", async () => {
    const [a, b, c, d] = [V("a"), V("b"), V("c"), V("d")];
    const store = await device([a, b, c, d]);
    await worker(d, store, [tab(entry(a)), tab(null)]).activate();
    expect(await store.keys()).toEqual([a, b, c, d, "brc-music", "brc-maia-new"]);
  });

  it("once the old tab loads again (a page's brc-loaded, the old tab gone), its version goes", async () => {
    const [b, c] = [V("b"), V("c")];
    const store = await device([b, c]);
    const tabs = [tab(entry(b))];
    const sw = worker(c, store, tabs);
    await sw.activate();
    expect(await store.keys()).toContain(b);
    tabs.splice(0, 1, tab(entry(c)));
    await sw.loaded();
    expect(await store.keys()).toEqual([c, "brc-music", "brc-maia-new"]);
  });

  it("a file the server no longer has and answers with the app's page: passed on, never kept as that file", async () => {
    const c = V("c");
    const store = await device([c]);
    const page = () => new Response("<!doctype html>", { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
    const sw = worker(c, store, [], (p) => (p.startsWith("/assets/") ? page() : null));
    expect((await sw.get("/assets/Gone-x.js"))!.headers.get("content-type")).toContain("text/html");
    await new Promise((ok) => setTimeout(ok, 0));
    expect(await store.match("/assets/Gone-x.js")).toBeUndefined();
  });
});

describe("a page opened: the network's answer, or the saved app only offline (Nov 20)", () => {
  /** What a page's fetch gets for a redirect: the browser follows it (status 0, no body). Not constructible, so a stand-in. */
  const gateRedirect = () => ({ type: "opaqueredirect", status: 0, ok: false }) as unknown as Response;
  async function deviceWithApp(v: string) {
    const store = await device([v]);
    await (await store.open(v)).put("/", new Response("saved app", { headers: { "content-type": "text/html" } }));
    return store;
  }

  it("the site's gate answers with a redirect to its login: passed on for the browser to follow, never the saved app", async () => {
    const c = V("c");
    const sw = worker(c, await deviceWithApp(c), [], (p) => (p === "/" || p === "/profile" ? gateRedirect() : null));
    expect((await sw.open("/profile"))!.type).toBe("opaqueredirect");
    expect((await sw.open("/"))!.type).toBe("opaqueredirect");
  });

  it("an error page the network answered is passed on too", async () => {
    const c = V("c");
    const sw = worker(c, await deviceWithApp(c), [], () => new Response("down", { status: 503 }));
    expect((await sw.open("/"))!.status).toBe(503);
  });

  it("no answer at all (offline): the saved app, so solo play still opens", async () => {
    const c = V("c");
    const sw = worker(c, await deviceWithApp(c), [], () => new TypeError("Failed to fetch"));
    expect(await (await sw.open("/lobby/ABCD"))!.text()).toBe("saved app");
  });
});

describe("the page's side: it says which version it runs", () => {
  it("answers the worker's ask with its entry script's path, on the ask's port (and starts the worker's messages)", async () => {
    vi.stubGlobal("location", { href: `${ORIGIN}/town` });
    const { answerWorker, entryScript } = await import("../src/install.ts");
    const doc = { querySelector: (sel: string) => (sel.includes("/assets/") ? { src: `${ORIGIN}/assets/index-abc.js` } : null) } as unknown as Document;
    expect(entryScript(doc)).toBe("/assets/index-abc.js");
    let listener: ((e: unknown) => void) | null = null;
    let started = 0;
    answerWorker({ addEventListener: (_: string, fn: (e: unknown) => void) => void (listener = fn), startMessages: () => void started++ } as never, () => entryScript(doc));
    expect(started).toBe(1);
    const replies: unknown[] = [];
    listener!({ data: { type: "brc-entry?" }, ports: [{ postMessage: (v: unknown) => replies.push(v) }] });
    listener!({ data: { type: "something else" }, ports: [{ postMessage: (v: unknown) => replies.push(v) }] });
    expect(replies).toEqual(["/assets/index-abc.js"]);
    vi.unstubAllGlobals();
  });
});
