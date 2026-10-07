import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import {
  CHAT_GROUPS,
  CHAT_PACKS,
  QUICK_CHAT,
  canSayToAll,
  chatPickCap,
  chatPicks,
  chatSays,
  defaultChatPicks,
  ownedChatPacks,
  toggleChatPick,
  type ChatPack,
  type ChatPickKind,
  type ChatPicks,
  type ChatSay,
} from "@chessroyale/core";
import { account, onAccountChange, saveChatPicks } from "../account.ts";
import { play } from "../sound.ts";

/**
 * Your profile's "Quick chat and emoji" (the social lane's section of the profile; DECISIONS.md, "Quick chat in
 * matches"): the lines and emoji you see in your games, in your order. Each kind has a clean dropdown of the whole
 * list, grouped by pack, with a search box: picked ones have a check, there's an n/10 count, and lines from packs
 * you don't own show locked with their pack's name (a tap takes you to the shop). Each change is saved to your
 * account at once, so it follows you like the rest of your profile.
 */
export function QuickChatPicks({ onShop, focus }: { onShop?: () => void; focus?: boolean }) {
  const [, rerender] = useState(0);
  useEffect(() => onAccountChange(() => rerender((n) => n + 1)), []);
  const shop = account().profile?.shop;
  // While a change is being saved: what the player chose (the account's picks once the server has answered).
  const [local, setLocal] = useState<ChatPicks | null>(null);
  const [open, setOpen] = useState<ChatPickKind | null>(null);
  const [note, setNote] = useState<{ kind: ChatPickKind; text: string } | null>(null);
  const queue = useRef<{ busy: boolean; next: Partial<ChatPicks> | null }>({ busy: false, next: null });
  const box = useRef<HTMLElement>(null);
  // (From the shop's "Pick these in your profile": straight to this section.)
  useLayoutEffect(() => {
    if (focus) box.current?.scrollIntoView({ block: "start" });
  }, [focus, !!shop]);
  if (!shop) return null;
  const packs = ownedChatPacks(shop.owned);
  const picks = local ?? shop.chat ?? chatPicks(null, shop.owned);

  /** Saves one kind's list (changes made while one save is out go in the next, latest first). */
  const save = async (kind: ChatPickKind, list: string[] | null) => {
    const q = queue.current;
    q.next = { ...q.next, [kind]: list };
    if (q.busy) return;
    q.busy = true;
    try {
      while (q.next) {
        const send = q.next;
        q.next = null;
        await saveChatPicks(send);
      }
      setLocal(null);
    } catch (e) {
      q.next = null;
      setLocal(null);
      setNote({ kind, text: e instanceof Error ? e.message : "Couldn't save that. Try again." });
    } finally {
      q.busy = false;
    }
  };

  const toggle = (kind: ChatPickKind, id: string) => {
    const r = toggleChatPick(picks, id, packs);
    if (!r.ok) {
      const cap = chatPickCap(kind);
      setNote({ kind, text: r.reason === "full" ? `${cap}/${cap} picked. Take one out to add another.` : "That one's in a pack you don't have yet." });
      return;
    }
    setNote(null);
    play("menuSelect");
    setLocal(r.picks);
    void save(kind, r.picks[kind]);
  };

  const reset = (kind: ChatPickKind) => {
    setNote(null);
    setLocal({ ...picks, [kind]: defaultChatPicks()[kind] });
    void save(kind, null);
  };

  return (
    <section class="fd-section qp" aria-labelledby="qp-label" ref={box}>
      <h2 class="fd-label" id="qp-label">
        QUICK CHAT AND EMOJI
      </h2>
      <p class="fd-note">
        The lines and emoji you see in your online matches, in your order. Up to {QUICK_CHAT.maxLines} lines and {QUICK_CHAT.maxEmoji} emoji.
      </p>
      {(["lines", "emoji"] as const).map((kind) => (
        <PickBlock
          key={kind}
          kind={kind}
          picked={picks[kind]}
          packs={packs}
          open={open === kind}
          note={note?.kind === kind ? note.text : null}
          onOpen={(on) => {
            setOpen(on ? kind : null);
            setNote(null);
          }}
          onToggle={(id) => toggle(kind, id)}
          onReset={() => reset(kind)}
          onShop={onShop}
        />
      ))}
    </section>
  );
}

const KIND = {
  lines: { title: "Lines", one: "line", search: "Search lines or packs" },
  emoji: { title: "Emoji", one: "emoji", search: "Search emoji or packs" },
} as const;

/**
 * Lines and emoji are found by their words, their group, their name (emoji) and their pack's name (without the
 * words "pack" and "emoji", which every pack has).
 */
const fold = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N} ]+/gu, "").replace(/\s+/g, " ").trim();
const groupName = (s: ChatSay) => CHAT_GROUPS.find((g) => g.id === s.group)?.name ?? "";
function matches(s: ChatSay, pack: ChatPack, q: string): boolean {
  if (!q) return true;
  return fold([s.text, s.name ?? "", groupName(s), pack.name.replace(/\b(pack|emoji)\b/gi, "")].join(" ")).includes(q);
}

function PickBlock({
  kind,
  picked,
  packs,
  open,
  note,
  onOpen,
  onToggle,
  onReset,
  onShop,
}: {
  kind: ChatPickKind;
  picked: readonly string[];
  packs: readonly string[];
  open: boolean;
  note: string | null;
  onOpen: (on: boolean) => void;
  onToggle: (id: string) => void;
  onReset: () => void;
  onShop?: () => void;
}) {
  const k = KIND[kind];
  const cap = chatPickCap(kind);
  const says = chatSays(picked);
  const isDefault = picked.join() === defaultChatPicks()[kind].join();
  const menuId = `qp-menu-${kind}`;
  return (
    <div class={`fd-panel qp-block qp-${kind}`}>
      <div class="qp-head">
        <h3>{k.title}</h3>
        <span class={`qp-count${picked.length >= cap ? " full" : ""}`} aria-label={`${picked.length} of ${cap} picked`}>
          {picked.length}/{cap}
        </span>
        <span class="qp-gap" />
        {!isDefault && (
          <button type="button" class="qp-reset" onClick={onReset}>
            Back to the defaults
          </button>
        )}
      </div>
      {says.length ? (
        <ol class={`qp-picked${kind === "emoji" ? " emoji" : ""}`} aria-label={`Your ${k.title.toLowerCase()}, in order`} style={kind === "emoji" ? { "--n": cap } : undefined}>
          {says.map((s) => (
            <li key={s.id}>
              <button type="button" class="qp-chip" aria-label={`Take out ${s.text}${s.name ? ` (${s.name})` : ""}`} onClick={() => onToggle(s.id)}>
                <span class="qp-chip-text">{s.text}</span>
                <span class="qp-x" aria-hidden="true">
                  ✕
                </span>
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <p class="fd-note">None picked: you'll have no {kind === "lines" ? "lines" : "emoji"} to send in your games.</p>
      )}
      <button
        type="button"
        class={`qp-drop${open ? " open" : ""}`}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => onOpen(!open)}
      >
        <span>{open ? "Done" : `Choose ${k.title.toLowerCase()}`}</span>
        <span class="qp-drop-count">
          {picked.length}/{cap}
        </span>
        <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
          <path d="M5 7.5l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
      {note && (
        <p class="qp-note" role="status">
          {note}
        </p>
      )}
      {open && <PickMenu id={menuId} kind={kind} picked={picked} packs={packs} onToggle={onToggle} onShop={onShop} onDone={() => onOpen(false)} />}
    </div>
  );
}

/** The whole list, by pack, with a search box at the top. */
function PickMenu({
  id,
  kind,
  picked,
  packs,
  onToggle,
  onShop,
  onDone,
}: {
  id: string;
  kind: ChatPickKind;
  picked: readonly string[];
  packs: readonly string[];
  onToggle: (id: string) => void;
  onShop?: () => void;
  onDone: () => void;
}) {
  const [query, setQuery] = useState("");
  const k = KIND[kind];
  const cap = chatPickCap(kind);
  const full = picked.length >= cap;
  const q = fold(query);
  const sections = CHAT_PACKS.filter((p) => (p.kind === "emoji") === (kind === "emoji"))
    .map((pack) => ({ pack, own: packs.includes(pack.id), says: chatSays(pack.lines.map((l) => l.id)).filter((s) => matches(s, pack, q)) }))
    .filter((x) => x.says.length > 0)
    // Yours first (the free ones, then packs you got), then the ones in the shop.
    .sort((a, b) => Number(b.own) - Number(a.own));
  return (
    <div class="qp-menu" id={id}>
      <label class="qp-search">
        <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
          <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" stroke-width="2" />
          <path d="M12.6 12.6L17 17" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />
        </svg>
        <input
          type="search"
          value={query}
          placeholder={k.search}
          aria-label={k.search}
          autocomplete="off"
          autocapitalize="off"
          spellcheck={false}
          enterKeyHint="search"
          onInput={(e) => setQuery(e.currentTarget.value)}
        />
        {query && (
          <button type="button" class="qp-clear" aria-label="Clear the search" onClick={() => setQuery("")}>
            ✕
          </button>
        )}
      </label>
      {full && (
        <p class="qp-menu-note">
          {cap}/{cap} picked. Take one out to add another.
        </p>
      )}
      <div class="qp-list">
        {sections.map(({ pack, own, says }) => (
          <div key={pack.id} class={`qp-pack${own ? "" : " locked"}`} role="group" aria-label={pack.name}>
            <div class="qp-pack-head">
              <strong>{pack.name}</strong>
              <span>{pack.free ? "Free" : own ? "Yours" : "🔒 In the shop"}</span>
            </div>
            <div class={kind === "emoji" ? "qp-opts emoji" : "qp-opts"}>
              {says.map((s) => {
                const on = picked.includes(s.id);
                if (!own) {
                  return (
                    <button
                      key={s.id}
                      type="button"
                      class="qp-opt locked"
                      disabled={!onShop}
                      aria-label={`${s.text}${s.name ? ` (${s.name})` : ""}: locked, in the ${pack.name}${onShop ? ". Open the shop" : ""}`}
                      onClick={() => onShop?.()}
                    >
                      <span class="qp-mark" aria-hidden="true">
                        🔒
                      </span>
                      <span class="qp-opt-text">{s.text}</span>
                      {kind === "lines" && <span class="qp-opt-pack">{pack.name} ›</span>}
                    </button>
                  );
                }
                return (
                  <button
                    key={s.id}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    aria-label={s.name ? `${s.text} ${s.name}` : s.text}
                    class={`qp-opt${on ? " on" : ""}`}
                    disabled={!on && full}
                    onClick={() => onToggle(s.id)}
                  >
                    <span class="qp-mark" aria-hidden="true">
                      {on ? "✓" : ""}
                    </span>
                    <span class="qp-opt-text">{s.text}</span>
                    {kind === "lines" && (
                      <span class="qp-opt-tag">
                        {groupName(s)}
                        {canSayToAll(s.id) ? " · all" : ""}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {!sections.length && <p class="qp-none">No {kind === "lines" ? "lines" : "emoji"} match “{query.trim()}”.</p>}
      </div>
      <div class="qp-menu-foot">
        <span>
          {picked.length}/{cap} picked
        </span>
        <button type="button" class="fd-btn small" onClick={onDone}>
          Done
        </button>
      </div>
    </div>
  );
}
