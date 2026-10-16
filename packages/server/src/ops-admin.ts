/**
 * The ops page (`/admin/ops`, server-rendered, admins only, as `/admin/fairplay`): the health view on top, then the most
 * frequent errors (the app's and the server's, last 24 hours and 7 days, with their versions) and players' reports
 * (bugs with their full diagnostics, feedback, ideas) by id or by kind. The health view as JSON for scripts
 * (`/api/admin/health`: `npm run ops:report`): admins, or a request that came through Cloudflare Access for its
 * application (access.ts). Anyone else gets "Not found". See docs/areas/ops.md, "Errors and player reports", "Health".
 */
import { OPS } from "@chessroyale/core";
import { d1Sql, ensureSchema, userFromToken } from "./accounts.ts";
import { SESSION_COOKIE, readCookie } from "./api.ts";
import { adminPage, esc, isAdmin, when, type AdminEnv } from "./admin.ts";
import { REPORT_KINDS, latestReports, reportById, topErrors, type ErrorRow, type ProblemsEnv, type ReportKind, type ReportRow } from "./problems.ts";
import { viaAccess, type AccessEnv } from "./access.ts";
import { health, type Health } from "./health.ts";
import type { EngineEnv } from "./engine.ts";
import type { Env } from "./index.ts";

/** The kinds as the page names them. */
const KIND_NAMES: Record<ReportKind, string> = { bug: "Bugs", feedback: "Feedback", idea: "Ideas" };

const notFound = () => new Response("Not found", { status: 404, headers: { "content-type": "text/plain", "cache-control": "no-store" } });

/** Diagnostics as stored (JSON), pretty-printed for reading. */
const pretty = (s: string) => {
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return s;
  }
};

type OpsEnv = AdminEnv & ProblemsEnv & AccessEnv & EngineEnv & Pick<Env, "LIVE">;

/**
 * GET /admin/ops[?report=ID][&q=TEXT: only errors whose message contains it][&kind=bug|feedback|idea: only reports of
 * that kind], and GET /api/admin/health (the health view as JSON); null for other paths.
 */
export async function handleOpsAdmin(request: Request, env: OpsEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const api = url.pathname === "/api/admin/health";
  if (url.pathname !== "/admin/ops" && !api) return null;
  if (!env.DB || request.method !== "GET") return notFound();
  const sql = d1Sql(env.DB);
  const now = Date.now();
  if (api) {
    // A script through Access needs no session (nor D1 to answer that it may look); an admin's browser, its session.
    const access = await viaAccess(request, env, now);
    if (!access) {
      await ensureSchema(sql, env.DB);
      if (!isAdmin(env, await userFromToken(sql, readCookie(request, SESSION_COOKIE), now))) return notFound();
    }
    await ensureSchema(sql, env.DB).catch(() => undefined);
    return new Response(JSON.stringify(await health(env, sql, now)), { headers: { "content-type": "application/json", "cache-control": "no-store" } });
  }
  await ensureSchema(sql, env.DB);
  const user = await userFromToken(sql, readCookie(request, SESSION_COOKIE), now);
  if (!isAdmin(env, user)) return notFound();
  const id = (url.searchParams.get("report") ?? "").trim().toUpperCase();
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
  const kind = REPORT_KINDS.find((k) => k === url.searchParams.get("kind")) ?? "";
  const found = /^[A-Z2-9]{6}$/.test(id) ? await reportById(sql, id) : null;
  const [errors, reports, h] = await Promise.all([topErrors(sql, now, 30, q), latestReports(sql, 50, kind), health(env, sql, now)]);
  return adminPage("Ops", page(user!.email!, h, { id, q, kind }, found, errors, reports));
}

function reportCard(r: ReportRow): string {
  const bug = r.kind === "bug";
  return `<div class="card"><b>Report ${esc(r.id)}</b> · ${esc(r.kind)} · ${when(r.at)}${bug ? ` · version ${esc(r.version)}` : ""}${r.account ? ` · account ${esc(r.account)}` : ""}
<p>${r.note ? esc(r.note) : '<span class="muted">No note.</span>'}</p>${bug ? `<pre>${esc(pretty(r.diag))}</pre>` : ""}</div>`;
}

const ago = (t: number | null, now: number) => (t ? `${when(t)} (${Math.round((now - t) / 60_000)} min ago)` : "never");

/** The health view, as the page's first section. */
function healthSection(h: Health): string {
  const modes = h.live
    ? Object.entries(h.live.modes)
        .map(([m, c]) => `${m} ${c.playing} playing, ${c.waiting} waiting (${c.humans} people)`)
        .join(" · ")
    : "no answer from the live hub";
  const e = h.engine;
  return `<h2>Health</h2><div class="card">
<p><b>Deployed:</b> ${esc(h.deploy.version)}${h.deploy.commit ? ` (commit ${esc(h.deploy.commit.slice(0, 12))})` : ""}${h.deploy.built ? `, built ${esc(h.deploy.built.slice(0, 16).replace("T", " "))}` : ""}</p>
<p><b>Live:</b> ${h.live ? `${h.live.online} online, ${h.live.players} in lobbies · ${esc(modes)}` : esc(modes)}</p>
<p><b>Errors:</b> ${h.errors.thisHour} this hour, ${h.errors.lastHour} the hour before, ${h.errors.day} in 24 hours (${h.errors.kinds} kinds) ·
<b>Durable Objects:</b> ${h.durableObjects.day ? esc(Object.entries(h.durableObjects.byEntry).map(([k, n]) => `${k} ${n}`).join(", ")) : "none"} in 24 hours</p>
<p><b>Reports (24 hours):</b> ${REPORT_KINDS.map((k) => `${h.reports.day[k] ?? 0} ${KIND_NAMES[k].toLowerCase()}`).join(", ")}</p>
<p><b>Engine server:</b> ${e.on ? "on" : "off"} · ${e.searches} of ${e.cap} searches today · last answer ${ago(e.lastOk, h.at)} · last failure ${e.lastFail ? `${ago(e.lastFail.at, h.at)}: ${esc(e.lastFail.why)}` : "never"}</p>
<p><b>Fair play's deep re-checks:</b> ${h.fairplay.searches} of ${h.fairplay.cap} searches today · <b>D1:</b> ${h.d1.ok ? `ok (${h.d1.ms} ms)` : `failing: ${esc(h.d1.error ?? "")}`}</p>
<p class="muted">As JSON for scripts: <a href="/api/admin/health">/api/admin/health</a> (<code>npm run ops:report</code>).</p></div>`;
}

function page(admin: string, h: Health, { id, q, kind }: { id: string; q: string; kind: ReportKind | "" }, found: ReportRow | null, errors: ErrorRow[], reports: ReportRow[]): string {
  const errorRows = errors
    .map(
      (e) => `<tr><td>${e.day}</td><td>${e.week}</td><td>${esc(e.source)}<br><span class="muted">${esc(e.kind)}</span></td>
<td class="wrap"><details><summary>${esc(e.message)}</summary><pre>${esc(pretty(e.sample))}</pre></details></td>
<td>${esc(e.versions.split(",").slice(-3).join(", "))}</td><td>${when(e.firstSeen)}</td><td>${when(e.lastSeen)}</td></tr>`,
    )
    .join("");
  const reportRows = reports
    .map((r) => {
      const where = (() => {
        try {
          return (JSON.parse(r.diag) as { where?: { screen?: string } }).where?.screen ?? "";
        } catch {
          return "";
        }
      })();
      return `<tr><td><a href="/admin/ops?report=${esc(r.id)}">${esc(r.id)}</a></td><td>${esc(r.kind)}</td><td>${when(r.at)}</td><td class="wrap">${esc(r.note)}</td><td>${esc(where)}</td><td>${esc(r.version)}</td></tr>`;
    })
    .join("");
  return `<h1>Ops</h1>
<p class="muted">Signed in as ${esc(admin)}. A device reports each kind of error once per page load, so a count is
page loads (the server's own errors: each one). Kept ${OPS.store.keepDays} days.</p>
<form class="row" method="get" action="/admin/ops"><input type="text" name="report" value="${esc(id)}" placeholder="A report's id, e.g. AB12CD" maxlength="6" autocomplete="off"><button>Find</button></form>
${id ? (found ? reportCard(found) : `<div class="card">No report ${esc(id)}.</div>`) : ""}
${healthSection(h)}
<h2>Errors (last 7 days, the last 24 hours' first)</h2>
<form class="row" method="get" action="/admin/ops"><input type="text" name="q" value="${esc(q)}" placeholder="Only errors whose message contains…" maxlength="100" autocomplete="off"><button>Search</button>${q ? ' <a href="/admin/ops">All</a>' : ""}</form>
<div class="card scroll"><table><tr><th>24 h</th><th>7 d</th><th>From</th><th>Error (tap for its latest diagnostics)</th><th>Versions</th><th>First seen</th><th>Last seen</th></tr>
${errorRows || '<tr><td colspan="7" class="muted">No errors.</td></tr>'}</table></div>
<h2>Player reports (latest ${reports.length}${kind ? `: ${KIND_NAMES[kind].toLowerCase()}` : ""})</h2>
<nav>${[["", "All"] as const, ...REPORT_KINDS.map((k) => [k, KIND_NAMES[k]] as const)].map(([k, name]) => (k === kind ? `<b>${name}</b>` : `<a href="/admin/ops${k ? `?kind=${k}` : ""}">${name}</a>`)).join(" · ")}</nav>
<div class="card scroll"><table><tr><th>Id</th><th>Kind</th><th>When</th><th>Note</th><th>Screen</th><th>Version</th></tr>
${reportRows || '<tr><td colspan="6" class="muted">No reports.</td></tr>'}</table></div>`;
}
