/**
 * The chat review page, `/admin/chat` (server-rendered, like fair play's `/admin/fairplay` and `/admin/ops`): players
 * with chat reports waiting, the lines reported with the lines around them, and the decisions (chat-mod.ts). Who may
 * look: an admin (signed in with an email in ADMIN_EMAILS); anyone else gets "Not found". No test switch opens it (the
 * e2e makes its page's account an admin, as ops' does).
 */
import { CHAT_MOD } from "@chessroyale/core";
import type { ChatBlock } from "@chessroyale/chess";
import { d1Sql, ensureSchema, userFromToken } from "./accounts.ts";
import { SESSION_COOKIE, readCookie } from "./api.ts";
import { adminPage, esc, isAdmin, when } from "./admin.ts";
import { chatDecisions, chatPaused, chatPlayer, chatQueue, decideChat, pruneChatMod, type ChatLogRow, type ChatPlayerDetail, type ChatQueueRow, type ChatReportView } from "./chat-mod.ts";
import { lobbyCodes, lobbyOf, type ChatModEnv } from "./chat-mod-api.ts";

const notFound = () => new Response("Not found", { status: 404, headers: { "content-type": "text/plain", "cache-control": "no-store" } });
const PLAYER = /^\/admin\/chat\/player\/([A-Za-z0-9_-]{1,64})$/;

/** The page and its decisions (a form post from the page itself); null for other paths. */
export async function handleChatAdmin(request: Request, env: ChatModEnv, waitUntil?: (p: Promise<unknown>) => void): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/admin/chat" && !url.pathname.startsWith("/admin/chat/")) return null;
  if (!env.DB) return notFound();
  const sql = d1Sql(env.DB);
  await ensureSchema(sql, env.DB);
  const now = Date.now();
  const user = await userFromToken(sql, readCookie(request, SESSION_COOKIE), now);
  if (!isAdmin(env, user)) return notFound();
  const by = `admin:${user!.email!.toLowerCase()}`;
  waitUntil?.(pruneChatMod(sql, now).catch(() => undefined));

  if (request.method === "POST") {
    // From this page only (the session cookie is SameSite=Lax; the origin is checked too).
    if (request.headers.get("origin") !== url.origin) return new Response("Bad origin", { status: 403 });
    const m = url.pathname.match(PLAYER);
    if (!m) return notFound();
    const userId = m[1]!;
    const form = await request.formData();
    const [action, days] = String(form.get("action") ?? "").split(":");
    // The lobbies this player was reported in lately: a change to their pause applies there at once.
    const recent = await sql.all<{ channel: string }>("SELECT DISTINCT channel FROM chat_reports WHERE target = ? AND at > ?", userId, now - CHAT_MOD.dedupeMs);
    const r = await decideChat(sql, userId, { action, days, reason: form.get("reason"), note: form.get("note") }, by, now);
    if (r.ok) for (const code of lobbyCodes(recent.map((c) => c.channel))) await lobbyOf(env, code).chatStandingChanged(userId, r.block).catch(() => undefined);
    const note = r.ok ? "Done." : r.message;
    return Response.redirect(`${url.origin}/admin/chat/player/${userId}?note=${encodeURIComponent(note)}`, 303);
  }
  const pm = url.pathname.match(PLAYER);
  if (pm) {
    const d = await chatPlayer(sql, pm[1]!, now);
    return d ? adminPage("Chat reports", playerPage(d, url.searchParams.get("note"))) : notFound();
  }
  if (url.pathname === "/admin/chat") {
    return adminPage("Chat reports", listPage(await chatQueue(sql, now), await chatPaused(sql, now), await chatDecisions(sql), by));
  }
  return notFound();
}

// ---------------- HTML ----------------

const where = (channel: string) => (channel === "global" ? "Global chat" : channel.startsWith("lobby:") ? `Lobby ${channel.slice(6)}` : channel);
const pause = (b: ChatBlock | null) =>
  !b ? '<span class="cleared">open</span>' : b.auto ? `<b class="review">paused by reports</b> until ${when(b.until)} at the latest` : `<b class="banned">chat ban</b> ${b.until ? `until ${when(b.until)}` : "with no end"}`;
const ACTIONS: Record<string, string> = { auto: "paused by reports", warn: "warning", ban: "chat ban", lift: "pause lifted", dismiss: "reports dismissed", reset: "name and icon reset" };
const decision = (l: ChatLogRow) =>
  `${esc(ACTIONS[l.action] ?? l.action)}${l.action === "ban" ? (l.until ? ` until ${when(l.until)}` : " (no end)") : ""}${l.ended_at && (l.action === "ban" || l.action === "auto") ? ` <span class="muted">(ended ${when(l.ended_at)})</span>` : ""}`;
const player = (id: string, name: string | null | undefined) => `<a href="/admin/chat/player/${esc(id)}">${esc(name ?? id)}</a>`;

function listPage(queue: ChatQueueRow[], paused: ChatLogRow[], log: ChatLogRow[], by: string): string {
  return `<h1>Chat reports</h1>
<p class="muted">Signed in as ${esc(by.replace("admin:", ""))}. Chat is preset lines only: reports are about how someone uses them, their name or their icon. ${CHAT_MOD.autoMuteReporters} players reporting someone pauses their chat until you decide. <a href="/admin/fairplay">Fair play</a></p>
<h2>Waiting (${queue.length})</h2>
<div class="card scroll"><table><tr><th>Player</th><th>Reports</th><th>From players</th><th>Latest</th><th>Chat</th></tr>
${queue.length ? queue.map((q) => `<tr><td>${player(q.userId, q.name)}</td><td>${q.open}</td><td>${q.reporters}</td><td>${when(q.latest)}</td><td>${pause(q.block)}</td></tr>`).join("") : '<tr><td colspan="5" class="muted">Nothing waiting.</td></tr>'}</table></div>
<h2>Paused now (${paused.length})</h2>
${paused.length ? `<div class="card scroll"><table><tr><th>Player</th><th>Pause</th><th>Since</th><th>By</th><th>Reason</th></tr>${paused
    .map((l) => `<tr><td>${player(l.user_id, l.name)}</td><td>${pause({ until: l.until, ...(l.action === "auto" ? { auto: true as const } : {}) })}</td><td>${when(l.at)}</td><td>${esc(l.by)}</td><td class="wrap">${esc(l.reason)}</td></tr>`)
    .join("")}</table></div>` : '<p class="muted">Nobody.</p>'}
<h2>Recent decisions</h2>
${log.length ? `<div class="card scroll"><table><tr><th>When</th><th>Player</th><th>Decision</th><th>By</th><th>Reason</th></tr>${log
    .map((l) => `<tr><td>${when(l.at)}</td><td>${player(l.user_id, l.name)}</td><td>${decision(l)}</td><td>${esc(l.by)}</td><td class="wrap">${esc(l.reason)}</td></tr>`)
    .join("")}</table></div>` : '<p class="muted">None yet.</p>'}`;
}

/** A report: when and where, who reported it, and the lines around it (the one reported in bold). */
function reportCard(r: ChatReportView): string {
  const rows = (r.context.length ? r.context : [{ at: r.saidAt, name: r.name, text: r.text, mark: "this" as const }])
    .map(
      (c) =>
        `<tr class="${c.mark === "this" ? "hard" : c.mark === "sender" ? "" : "skip"}"><td>${when(c.at).slice(11)}</td><td>${esc(c.name)}${c.mark === "reporter" ? ' <span class="pill">reporter</span>' : c.mark === "bot" ? ' <span class="pill">bot</span>' : ""}</td><td class="wrap">${esc(c.text)}${c.mark === "this" ? ' <span class="pill">reported</span>' : ""}</td></tr>`,
    )
    .join("");
  return `<div class="card">${when(r.at)} · ${esc(where(r.channel))} · reported by ${player(r.reporter.id, r.reporter.name)}
<div class="scroll"><table>${rows}</table></div></div>`;
}

function playerPage(d: ChatPlayerDetail, note: string | null): string {
  const p = d.player;
  const icon = p.icon.startsWith("data:image/png")
    ? `<img src="${esc(p.icon)}" width="48" height="48" alt="" style="image-rendering:pixelated;vertical-align:middle;border-radius:8px">`
    : `<span style="font-size:32px;vertical-align:middle">${esc(p.icon)}</span>`;
  const bans = CHAT_MOD.banDays.map((n) => `<button class="ban" name="action" value="ban:${n}">Chat ban ${n} ${n === 1 ? "day" : "days"}</button>`).join("");
  return `<p><a href="/admin/chat">← Chat reports</a></p>
<h1>${icon} ${esc(p.name)}</h1>
${note ? `<div class="card">${esc(note)}</div>` : ""}
<p class="muted">${esc(p.id)} · ${p.signedIn ? "signed in" : "guest"} · joined ${when(p.joinedAt)} · <a href="/admin/fairplay/case/${esc(p.id)}">fair play</a></p>
<div class="card">Chat: ${pause(d.block)}</div>
<h2>Decide</h2>
<form class="row" method="post">
<input type="text" name="reason" placeholder="Reason (for the log; required except to dismiss)" maxlength="500">
<input type="text" name="note" placeholder="Note to the player (optional; shown with a warning or a chat ban)" maxlength="500">
<button class="clear" name="action" value="dismiss">Dismiss the reports</button><button name="action" value="warn">Warn</button>
${bans}<button class="ban" name="action" value="ban:forever">Chat ban, no end</button>
<button name="action" value="lift">Lift the pause</button><button name="action" value="reset">Reset name and icon</button></form>
<p class="muted">Dismiss, warn, ban and reset close the open reports. A chat ban only stops sending: they still read chat and play. A warning or a ban shows the player your note once.</p>
<h2>Open reports (${d.open.length})</h2>${d.open.map(reportCard).join("") || '<p class="muted">None.</p>'}
<h2>Decisions</h2>${d.log.length ? `<div class="card scroll"><table><tr><th>When</th><th>Decision</th><th>By</th><th>Reason</th><th>Note to the player</th></tr>${d.log
    .map((l) => `<tr><td>${when(l.at)}</td><td>${decision(l)}</td><td>${esc(l.by)}</td><td class="wrap">${esc(l.reason)}</td><td class="wrap">${esc(l.note)}</td></tr>`)
    .join("")}</table></div>` : '<p class="muted">None.</p>'}
<h2>Resolved lately (${d.resolved.length})</h2>${d.resolved.length ? `<div class="card scroll"><table><tr><th>Reported</th><th>Where</th><th>Line</th><th>By</th><th>Outcome</th></tr>${d.resolved
    .map((r) => `<tr><td>${when(r.at)}</td><td>${esc(where(r.channel))}</td><td class="wrap">${esc(r.text)}</td><td>${player(r.reporter.id, r.reporter.name)}</td><td>${esc(r.status)} ${when(r.resolvedAt)}</td></tr>`)
    .join("")}</table></div><p class="muted">Kept ${CHAT_MOD.keepResolvedDays} days after they're resolved.</p>` : '<p class="muted">None.</p>'}`;
}
