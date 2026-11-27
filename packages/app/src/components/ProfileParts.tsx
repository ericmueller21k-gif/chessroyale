import { Fragment } from "preact";
import { useLayoutEffect, useRef, useState } from "preact/hooks";
import { FAIRPLAY, HIDDEN_ROOM, RECLUSE_FORMS, bossDef, bossInfo, itemDef, itemName, shownLook, tierInfo, type ItemLook, type RecluseForm } from "@chessroyale/core";
import { wornDetails } from "../item-details.ts";
import { FdButton, WORN_ORDER } from "./FrontDoor.tsx";
import { ItemArt } from "./Items.tsx";
import { BossPortrait } from "./BossPortrait.tsx";
import { FINAL_FORM } from "../characters/portraits.ts";
import { reportPlayer, type PublicProfile } from "../account.ts";
import { nth, recluseFormsShown } from "../public-profile.ts";

/**
 * Pieces of a profile that today's profile (screens/PlayerProfile.tsx, yours) and the public one (screens/PublicProfile.tsx,
 * anyone's) both show: what they wear, their recent matches and the report sheet. Moved here unchanged, Oct 28, 2026.
 */

/** "today", "yesterday", "3 days ago", else the date. */
export function when(at: number, now = Date.now()): string {
  const day = (t: number) => Math.floor((t - new Date(t).getTimezoneOffset() * 60_000) / 86_400_000);
  const d = day(now) - day(at);
  if (d <= 0) return "today";
  if (d === 1) return "yesterday";
  if (d < 7) return `${d} days ago`;
  return new Date(at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** The items they wear, in the order they're listed (slot, item, its definition). */
function wornRows(look: ItemLook) {
  const shown = shownLook(look);
  return WORN_ORDER.flatMap((slot) => {
    const it = shown[slot];
    const d = it && itemDef(it.def);
    return it && d ? [{ slot, it, d }] : [];
  });
}

/** One row per item: the item itself (as it looks on them), slot, color, purity and tier. */
export function WearingRows({ look }: { look: ItemLook }) {
  return (
    <>
      {wornRows(look).map(({ slot, it, d }) => {
        const tier = tierInfo(d.tier);
        return (
          <div key={slot} class="fd-item">
            <span class="fd-thumb" aria-hidden="true">
              <ItemArt def={it.def} finish={it} live />
            </span>
            <span class="fd-item-text">
              <strong>{itemName(it)}</strong>
              <span>
                {/* Each detail stays whole; a narrow row breaks between them. */}
                {/* (A HunChess ride: no purity or shine, and "Not tradeable": item-details.ts.) */}
                {wornDetails(slot, it).map((t, i) => (
                  <Fragment key={i}>
                    {i > 0 && " · "}
                    <span class="fd-nowrap">{t}</span>
                  </Fragment>
                ))}
              </span>
            </span>
            <span class="fd-tier" style={{ background: tier.color }}>
              {tier.name}
            </span>
          </div>
        );
      })}
    </>
  );
}

/** What they wear, one row per item: the item itself (as it looks on them), slot, color, purity and tier. */
export function Wearing({ look, own }: { look: ItemLook; own: boolean }) {
  return (
    <section class="fd-section" aria-labelledby="wearing-label">
      <h2 class="fd-label" id="wearing-label">
        WEARING
      </h2>
      {!wornRows(look).length && <p class="fd-note">{own ? "Nothing yet. Open a crate in the shop, then wear it from your locker." : "Nothing yet."}</p>}
      <WearingRows look={look} />
    </section>
  );
}

/** Each of the Hidden Boss's forms' faces (characters/portraits.ts, on the first load): the child, the man, his final form (the four boards). */
const FORM_FACE: Record<RecluseForm, { name: string; form?: "child" }> = {
  child: { name: bossDef(HIDDEN_ROOM.boss)!.name, form: "child" },
  adult: { name: bossDef(HIDDEN_ROOM.boss)!.name },
  four: { name: FINAL_FORM },
};

/**
 * The Hidden Boss's three forms in a match-history row (Eric, Nov 13: "show like all three of his forms... gray out the ones you
 * beat"): his faces in the order his fight meets them (RECLUSE_FORMS), the first `beaten` grayed and dimmed. Always all three, so the
 * strip takes the same room whatever the count.
 */
export function RecluseForms({ beaten, class: cls = "" }: { beaten: number; class?: string }) {
  return (
    <span class={`rf-forms ${cls}`} role="img" aria-label={`${beaten} of ${RECLUSE_FORMS.length} forms beaten`}>
      {RECLUSE_FORMS.map((f, i) => (
        <span key={f} class={`rf-face${i < beaten ? " beaten" : ""}`} data-form={f}>
          <BossPortrait boss={{ ...FORM_FACE[f], icon: "" }} label="" />
        </span>
      ))}
    </span>
  );
}

/** `mark`: one match to point out (when it was played), scrolled to: "See your result" for a lobby that has closed. */
export function Recent({ p, mark, bare }: { p: PublicProfile; mark?: number; /** In a sheet that has its own title: no heading of its own. */ bare?: boolean }) {
  const marked = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => marked.current?.scrollIntoView({ block: "center" }), [p, mark]);
  return (
    <section class="fd-section">
      {!bare && <h2 class="fd-label">RECENT MATCHES</h2>}
      {!p.recent.length && <p class="fd-note">No matches yet.</p>}
      {p.recent.map((r, i) => {
        const boss = r.mode === "boss";
        const place = boss ? (r.won === true ? "Won" : r.won === false ? "Lost" : r.survived === false ? "Out" : r.survived === true ? "Draw" : nth(r.placement)) : nth(r.placement);
        const gold = boss ? r.won === true : r.placement === 1;
        const forms = recluseFormsShown(r);
        // (A Crowd match with no team: everyone moves, a choice until Oct 15, 2026. Older records keep saying so. His fight: his name
        // alone, as the card has it, and no "unranked" (his fights never are), so the line stays one beside his forms on a 360 phone.)
        const mode =
          r.mode === "crowd"
            ? `Crowd · ${r.team ? "50 v 50" : "everyone moves"}`
            : forms !== null
              ? bossInfo(r.bossElo ?? 0, r.bossId).name
              : boss
                ? `Boss Battle · ${r.bossElo ? `${bossInfo(r.bossElo, r.bossId).name} ${r.bossElo}` : "a boss"}`
                : `Classic · ${r.players} players`;
        return (
          <div
            key={`${r.playedAt}-${i}`}
            class={`fd-match${mark !== undefined && r.playedAt === mark ? " marked" : ""}`}
            ref={mark !== undefined && r.playedAt === mark ? marked : undefined}
            aria-current={mark !== undefined && r.playedAt === mark ? "true" : undefined}
          >
            <span class={`fd-place${gold ? " gold" : ""}`}>{place}</span>
            <span class="fd-match-text">
              <strong>
                {mode}
                {r.online ? (r.ranked === false && forms === null ? " · unranked" : "") : " · solo"}
              </strong>
              <span>{[r.bestMove ? `Best move ${r.bestMove}` : null, when(r.playedAt)].filter(Boolean).join(" · ")}</span>
            </span>
            {forms !== null && <RecluseForms beaten={forms} />}
          </div>
        );
      })}
    </section>
  );
}

/** The report sheet: a reason, then the server's answer. `match`: the lobby's code when it's opened during a match. */
export function ReportSheet({ p, match, onClose }: { p: Pick<PublicProfile, "id" | "name">; match?: string; onClose: () => void }) {
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div class="fd-sheet-scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="fd-sheet" role="dialog" aria-modal="true" aria-labelledby="report-title">
        <div class="fd-sheet-head">
          <h2 id="report-title">Report {p.name}</h2>
          <button type="button" class="fd-icon-btn" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>
        {sent ? (
          <p class="fd-sub">{sent}</p>
        ) : (
          <>
            <p class="fd-sub">What's wrong? Reports are read by a person; nobody else sees them.</p>
            {FAIRPLAY.reports.reasons.map((r) => (
              <FdButton
                key={r}
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  void reportPlayer(p.id, r, match)
                    .then((m) => setSent(m))
                    .catch((e: Error) => setSent(e.message))
                    .finally(() => setBusy(false));
                }}
              >
                {r}
              </FdButton>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
