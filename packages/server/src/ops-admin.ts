/**
 * The ops page (`/admin/ops`, server-rendered, admins only, as `/admin/fairplay`): the most frequent errors (the app's
 * and the server's, last 24 hours and 7 days, with their versions) and players' reports (bugs with their full
 * diagnostics, feedback, ideas) by id or by kind. Anyone else gets "Not found". See docs/areas/ops.md, "Errors and
 * player reports".
 */
import { OPS } from "@chessroyale/core";
import { d1Sql, ensureSchema, userFromToken } from "./accounts.ts";
import { SESSION_COOKIE, readCookie } from "./api.ts";
import { adminPage, esc, isAdmin, when, type AdminEnv } from "./admin.ts";
import { REPORT_KINDS, latestReports, reportById, serverVersion, topErrors, type ErrorRow, type ProblemsEnv, type ReportKind, type ReportRow } from "./problems.ts";

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

/**
 * GET /admin/ops[?report=ID][&q=TEXT: only errors whose message contains it][&kind=bug|feedback|idea: only reports of
 * that kind]; null for other paths.
 */
export async function handleOpsAdmin(request: Request, env: AdminEnv & ProblemsEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/admin/ops") return null;
  if (!env.DB || request.method !== "GET") return notFound();
  const sql = d1Sql(env.DB);
  await ensureSchema(sql, env.DB);
  const now = Date.now();
  const user = await userFromToken(sql, readCookie(request, SESSION_COOKIE), now);
  if (!isAdmin(env, user)) return notFound();
  const id = (url.searchParams.get("report") ?? "").trim().toUpperCase();
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
  const kind = REPORT_KINDS.find((k) => k === url.searchParams.get("kind")) ?? "";
  const found = /^[A-Z2-9]{6}$/.test(id) ? await reportById(sql, id) : null;
  const [errors, reports, version] = await Promise.all([topErrors(sql, now, 30, q), latestReports(sql, 50, kind), serverVersion(env)]);
  return adminPage("Ops", page(user!.email!, version, { id, q, kind }, found, errors, reports));
}

function reportCard(r: ReportRow): string {
  const bug = r.kind === "bug";
  return `<div class="card"><b>Report ${esc(r.id)}</b> · ${esc(r.kind)} · ${when(r.at)}${bug ? ` · version ${esc(r.version)}` : ""}${r.account ? ` · account ${esc(r.account)}` : ""}
<p>${r.note ? esc(r.note) : '<span class="muted">No note.</span>'}</p>${bug ? `<pre>${esc(pretty(r.diag))}</pre>` : ""}</div>`;
}

function page(admin: string, version: string, { id, q, kind }: { id: string; q: string; kind: ReportKind | "" }, found: ReportRow | null, errors: ErrorRow[], reports: ReportRow[]): string {
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
<p class="muted">Signed in as ${esc(admin)}. This deploy: ${esc(version)}. A device reports each kind of error once per page load, so a count is
page loads (the server's own errors: each one). Kept ${OPS.store.keepDays} days.</p>
<form class="row" method="get" action="/admin/ops"><input type="text" name="report" value="${esc(id)}" placeholder="A report's id, e.g. AB12CD" maxlength="6" autocomplete="off"><button>Find</button></form>
${id ? (found ? reportCard(found) : `<div class="card">No report ${esc(id)}.</div>`) : ""}
<h2>Errors (last 7 days, the last 24 hours' first)</h2>
<form class="row" method="get" action="/admin/ops"><input type="text" name="q" value="${esc(q)}" placeholder="Only errors whose message contains…" maxlength="100" autocomplete="off"><button>Search</button>${q ? ' <a href="/admin/ops">All</a>' : ""}</form>
<div class="card scroll"><table><tr><th>24 h</th><th>7 d</th><th>From</th><th>Error (tap for its latest diagnostics)</th><th>Versions</th><th>First seen</th><th>Last seen</th></tr>
${errorRows || '<tr><td colspan="7" class="muted">No errors.</td></tr>'}</table></div>
<h2>Player reports (latest ${reports.length}${kind ? `: ${KIND_NAMES[kind].toLowerCase()}` : ""})</h2>
<nav>${[["", "All"] as const, ...REPORT_KINDS.map((k) => [k, KIND_NAMES[k]] as const)].map(([k, name]) => (k === kind ? `<b>${name}</b>` : `<a href="/admin/ops${k ? `?kind=${k}` : ""}">${name}</a>`)).join(" · ")}</nav>
<div class="card scroll"><table><tr><th>Id</th><th>Kind</th><th>When</th><th>Note</th><th>Screen</th><th>Version</th></tr>
${reportRows || '<tr><td colspan="6" class="muted">No reports.</td></tr>'}</table></div>`;
}
