/**
 * Fair play on the server (the `fairplay` delegate): reports, cases, and what a case's status does. See DECISIONS.md,
 * "Fair play".
 *
 * A case is one player's fair-play file. Its status:
 *   - watch: recorded only (their matches' evidence is kept, see FAIRPLAY.evidenceDays);
 *   - review: a person or the automated reviewer decides; meanwhile their online results are held off ranking
 *     (results.held: the rating, its chart, "Top N%", later leaderboards and ranked) and eligibleForRanked says no;
 *   - banned: no sign-in at all (Eric, Nov 13; docs/decisions/2026-11-13-ban-blocks-sign-in.md): every request with their session, or
 *     from a browser marked banned, gets the ban answer (ban-gate.ts), and signing in to them is refused (signInBan); appeals come by
 *     email and a person decides; their sign-in identities are kept (hashed) so a new account made with them is banned too, and a
 *     device it played from puts new accounts in review;
 *   - pool: the engine pool (FAIRPLAY.pool; docs/decisions/2026-11-10-engine-pool.md): every queue seats them only with other pooled
 *     accounts or bots, and nothing on their screen differs (their results count on their own profile, not held); kept off public
 *     leaderboards (NOT_POOLED), their evidence kept while pooled. Detection puts them there; only a person takes them out (Release);
 *   - cleared: decided in their favor; held results count again;
 *   - closed: a watch that saw nothing new for FAIRPLAY.evidenceDays.
 * Every change goes in fairplay_log with who made it and why.
 *
 * Evidence: every online match's judged picks are stored for each signed-in player (fairplay_matches.moves) for
 * FAIRPLAY.evidenceDaysUnflagged days, so a report made after a match still finds its games; for FAIRPLAY.evidenceDays
 * when the player was flagged or reported, and never deleted while their case is open (see purgeEvidence).
 */
import { BANNED_LINE, FAIRPLAY, matchSignals, newAccountPool, playerLevel, referenceStrength, type FairLevel, type FairMove, type FairSummary, type LevelInput, type LevelVerdict } from "@chessroyale/core";
import { getUser, identityHashes, markAgeOk, refreshRating, signInWithIdentity, type Sql, type User } from "./accounts.ts";
import { forgetBanChecks } from "./ban-cache.ts";

/** A case's status; "closed": a watch with nothing new for FAIRPLAY.evidenceDays (not a decision on the merits). */
export type CaseStatus = "watch" | "review" | "pool" | "banned" | "cleared" | "closed";
/** Open cases: their evidence is never deleted. */
const OPEN: readonly CaseStatus[] = ["watch", "review", "pool"];
export type ReportReason = (typeof FAIRPLAY.reports.reasons)[number];
export const REPORT_THANKS = "Thanks, we'll look into it.";

const DAY = 86_400_000;
const signedIn = (u: Pick<User, "email" | "google_sub">) => !!(u.email || u.google_sub);

export interface Case {
  user_id: string;
  status: CaseStatus;
  reason: string | null;
  opened_at: number;
  updated_at: number;
  decided_at: number | null;
  decided_by: string | null;
}

export const caseOf = (sql: Sql, userId: string) =>
  sql.first<Case>("SELECT user_id, status, reason, opened_at, updated_at, decided_at, decided_by FROM fairplay_cases WHERE user_id = ?", userId);

/**
 * Whether a player's results may count for ranked play and leaderboards: not while they're in review or banned.
 * The hook for the `ranked` delegate. (A pooled player's count, so their own profile looks as ever; public leaderboards leave the
 * pool out with NOT_POOLED.)
 */
export async function eligibleForRanked(sql: Sql, userId: string): Promise<boolean> {
  const c = await caseOf(sql, userId);
  return !c || (c.status !== "review" && c.status !== "banned");
}

export { NOT_POOLED } from "./fairplay-schema.ts";

/** Whether any of these accounts is in the engine pool (a Squads party queues in the pool when one of its members is). */
export async function anyPooled(sql: Sql, userIds: readonly string[]): Promise<boolean> {
  const ids = [...new Set(userIds)].slice(0, 16);
  if (!ids.length) return false;
  return !!(await sql.first(`SELECT 1 FROM fairplay_cases WHERE status = 'pool' AND user_id IN (${ids.map(() => "?").join(", ")}) LIMIT 1`, ...ids));
}

/** A line in the case's log. */
export async function logCase(sql: Sql, userId: string, action: string, by: string, reason: string | null, now: number): Promise<void> {
  await sql.run("INSERT INTO fairplay_log (user_id, at, action, by, reason) VALUES (?, ?, ?, ?, ?)", userId, now, action, by, reason);
}

/**
 * Sets a case's status (opening it if there's none), logs it, and holds or releases the player's results: entering
 * review or a ban holds their online results from the last FAIRPLAY.holdBackDays (the matches that put them there);
 * clearing releases everything held. `by`: "detection", "reports", "admin:<email>", "reviewer".
 */
export async function setCase(sql: Sql, userId: string, status: CaseStatus, by: string, reason: string, now: number): Promise<void> {
  const before = await caseOf(sql, userId);
  const decided = by !== "detection" && by !== "reports" && status !== "watch";
  if (before) {
    await sql.run(
      `UPDATE fairplay_cases SET status = ?, reason = ?, updated_at = ?${decided ? ", decided_at = ?, decided_by = ?" : ""} WHERE user_id = ?`,
      status,
      reason,
      now,
      ...(decided ? [now, by] : []),
      userId,
    );
  } else {
    await sql.run(
      "INSERT INTO fairplay_cases (user_id, status, reason, opened_at, updated_at, decided_at, decided_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
      userId,
      status,
      reason,
      now,
      now,
      decided ? now : null,
      decided ? by : null,
    );
  }
  await logCase(sql, userId, status, by, reason, now);
  // (Banned or lifted here: this instance's ban gate reads the case again on the account's next request, ban-cache.ts.)
  if (status === "banned" || before?.status === "banned") forgetBanChecks(userId);
  // Flagged or reported: their recent matches' evidence is kept the full time, and waits for the deep re-check.
  if (status === "watch" || status === "review" || status === "pool" || status === "banned") {
    await sql.run(
      "UPDATE fairplay_matches SET keep_until = MAX(COALESCE(keep_until, 0), ?) WHERE user_id = ? AND moves IS NOT NULL",
      now + FAIRPLAY.evidenceDays * DAY,
      userId,
    );
    await queueDeep(sql, userId);
  }
  const held = (s: CaseStatus | undefined) => s === "review" || s === "banned";
  if (held(status) && !held(before?.status)) {
    await sql.run("UPDATE results SET held = 1 WHERE user_id = ? AND online = 1 AND played_at >= ?", userId, now - FAIRPLAY.holdBackDays * DAY);
    await refreshRating(sql, userId);
  } else if (!held(status) && held(before?.status)) {
    await sql.run("UPDATE results SET held = 0 WHERE user_id = ? AND held = 1", userId);
    await refreshRating(sql, userId);
  }
  if (status === "banned") {
    // Banned: every online result is held, and no rating (out of ranking, percentiles and later leaderboards); their
    // sign-in identities are kept so a new account made with them is banned too.
    await sql.run("UPDATE results SET held = 1 WHERE user_id = ? AND online = 1", userId);
    await sql.run("UPDATE users SET rating = NULL WHERE id = ?", userId);
    const u = await getUser(sql, userId);
    for (const [kind, hash] of u ? await identityHashes(u) : []) {
      await sql.run("INSERT OR REPLACE INTO fairplay_identities (kind, hash, user_id, at) VALUES (?, ?, ?, ?)", kind, hash, userId, now);
    }
  } else if (before?.status === "banned" || ((before?.status === "review" || before?.status === "pool") && status !== before.status)) {
    // (A ban lifted, or a review or a pool decided: an account deleted while in review or pooled kept its identities, account-data.ts.)
    await sql.run("DELETE FROM fairplay_identities WHERE user_id = ?", userId);
  }
}

// ---------------- Bans: identities, devices, the check ----------------

/** Every answer to a banned account (Eric, Nov 13): core's BANNED_LINE. */
export const BANNED_MESSAGE = BANNED_LINE;

/**
 * Which account owns this identity in fair play's kept identities (banned accounts', and those of accounts deleted while banned, in
 * review or pooled: account-data.ts), as `userId` should weigh it: an account cleared by a person or the reviewer leaves out the rows
 * that clearing weighed (written by then) and later evasion bans, which only repeat bans already weighed (so a cousin cleared of an
 * evasion ban stays cleared through a report, a watch or its closing, while a later real ban of an account with its identity catches
 * it: docs/decisions/2026-10-16-integrity-followups.md). Each owner has its own row; a banned one counts first. `userId` "" (an identity
 * with no account yet): every row counts. banCheck's and signInBan's one query.
 */
async function identityOwner(sql: Sql, kind: string, hash: string, userId: string): Promise<{ user_id: string; status: string | null } | null> {
  // The account's last clearing by a person or the reviewer (a closing on its own, or an evasion review, isn't one).
  const cleared = `(SELECT MAX(at) FROM fairplay_log WHERE user_id = ?3 AND action = 'cleared' AND (by LIKE 'admin:%' OR by = 'reviewer'))`;
  return sql.first<{ user_id: string; status: string | null }>(
    `SELECT i.user_id, c.status FROM fairplay_identities i LEFT JOIN fairplay_cases c ON c.user_id = i.user_id
     WHERE i.kind = ?1 AND i.hash = ?2 AND i.user_id != ?3
       AND (${cleared} IS NULL OR (i.at > ${cleared} AND (c.status IS NOT 'banned' OR c.decided_by IS NOT 'evasion')))
     ORDER BY COALESCE(c.status, 'banned') = 'banned' DESC LIMIT 1`,
    kind,
    hash,
    userId,
  );
}
/** An owner banned, or gone with no case left (counted as banned, as ever). */
const bannedOwner = (o: { status: string | null } | null) => !!o && (o.status === "banned" || o.status === null);
const identityWord = (kind: string) => (kind === "email" ? "email address" : "Google account");

/**
 * signInBan's answer: refuse now (`banned`: the account signing in, banned, or banned by evasion just now), or `evades`: an identity new
 * to us that's a banned account's, whose own account evasionAccount makes, banned, once the sign-in can finish (the age question).
 */
export type SignInBan = { banned: string } | { evades: string; reason: string };

/**
 * A ban means you can't sign in (Eric, Nov 13: "If you try to sign in, it would say your account has been banned"): checked when a
 * sign-in's identity is proven (the emailed code right, or Google's answer), before any account is made, joined or switched to. Null to
 * go ahead; else:
 * - the identity's account is banned: `banned`;
 * - its account's own identities, or Google's verified `email` it doesn't have yet (it would take it), are a banned account's
 *   (banCheck's evasion rule, the same query): that account is banned by evasion now, as its next PLAY would have been: `banned`;
 * - an identity new to us that's a banned account's: `evades` (evasionAccount).
 * Every refusal names the account the person tried to sign in to, so a person can clear it (an email to support) and the browser's
 * mark is that account's own id (ban-gate.ts). A pooled account signs in as any (the engine pool is never a ban).
 */
export async function signInBan(sql: Sql, kind: "google" | "email", value: string, email: string | null, now: number): Promise<SignInBan | null> {
  const col = kind === "google" ? "google_sub" : "email";
  const found = await sql.first<User>(`SELECT id, name, icon, email, google_sub, created_at FROM users WHERE ${col} = ?`, value);
  if (found && (await caseOf(sql, found.id))?.status === "banned") return { banned: found.id };
  if (found) {
    const brought = kind === "google" && !found.email && email ? await identityHashes({ email, google_sub: null }) : [];
    for (const [k, hash] of [...(await identityHashes(found)), ...brought]) {
      const owner = await identityOwner(sql, k, hash, found.id);
      if (bannedOwner(owner)) {
        await setCase(sql, found.id, "banned", "evasion", `signed in with the ${identityWord(k)} of banned account ${owner!.user_id}`, now);
        return { banned: found.id };
      }
    }
    return null;
  }
  for (const [k, hash] of await identityHashes(kind === "google" ? { email, google_sub: value } : { email: value, google_sub: null })) {
    const owner = await identityOwner(sql, k, hash, "");
    if (bannedOwner(owner)) return { evades: owner!.user_id, reason: `signed in with the ${identityWord(k)} of banned account ${owner!.user_id}` };
  }
  return null;
}

/**
 * An identity new to us that's a banned account's (signInBan's `evades`), once the sign-in can finish: its own new account (never
 * joined to the one signed in on this browser, a guest's or another person's), banned by evasion at once, so a person can clear it, as
 * PLAY's evasion check let them (docs/decisions/2026-10-16-integrity-followups.md: a cousin sharing a mailbox). `answered`: this device
 * just said its holder is old enough (kept, as a sign-in keeps it). Answers the account's id.
 */
export async function evasionAccount(
  sql: Sql,
  kind: "google" | "email",
  value: string,
  extra: { email?: string | null },
  evades: { reason: string },
  answered: boolean,
  now: number,
): Promise<string> {
  const made = await signInWithIdentity(sql, null, kind, value, extra, now);
  if (answered) await markAgeOk(sql, made.id, now);
  await setCase(sql, made.id, "banned", "evasion", evades.reason, now);
  return made.id;
}

/**
 * Whether an account may play online, checked when it asks to (PLAY, a new lobby, joining one). Banned: no (and a banned account
 * meets the ban gate first: ban-gate.ts). Also
 * catches evasion: an account signed in with a banned account's identity (the same normalized email or Google
 * account) is banned too; one seen on a device a banned account played from goes to review (families share devices).
 * `device`: the device marker cookie, recorded against the account.
 */
export async function banCheck(sql: Sql, user: User | null, device: string | null, now: number): Promise<{ banned: boolean; pooled?: boolean }> {
  if (!user) return { banned: false };
  const c = await caseOf(sql, user.id);
  if (c?.status === "banned") return { banned: true };
  let pooled = c?.status === "pool";
  if (device && /^[A-Za-z0-9_-]{16,64}$/.test(device)) {
    await sql.run(
      `INSERT INTO fairplay_devices (device, user_id, first_seen, last_seen) VALUES (?, ?, ?, ?)
       ON CONFLICT (device, user_id) DO UPDATE SET last_seen = excluded.last_seen WHERE fairplay_devices.last_seen < excluded.last_seen - 3600000`,
      device,
      user.id,
      now,
      now,
    );
  }
  for (const [kind, hash] of await identityHashes(user)) {
    // (A banned account's identities, or those of an account deleted while banned or in review, as this account weighs them:
    // identityOwner.)
    const owner = await identityOwner(sql, kind, hash, user.id);
    const what = identityWord(kind);
    if (owner && bannedOwner(owner)) {
      await setCase(sql, user.id, "banned", "evasion", `signed in with the ${what} of banned account ${owner.user_id}`, now);
      return { banned: true };
    }
    if (owner?.status === "review" && c?.status !== "review" && c?.status !== "cleared") {
      await raiseCase(sql, user.id, "review", "evasion", `signed in with the ${what} of account ${owner.user_id}, deleted while in review`, now);
    }
    // (An account deleted while in the engine pool: a new one with its identity goes back in, as quietly.)
    if (owner?.status === "pool" && !pooled && c?.status !== "cleared") {
      await setCase(sql, user.id, "pool", "evasion", `signed in with the ${what} of account ${owner.user_id}, deleted while in the engine pool`, now);
      pooled = true;
    }
  }
  if (device && c?.status !== "review" && c?.status !== "cleared") {
    const shared = await sql.first<{ user_id: string }>(
      `SELECT d.user_id FROM fairplay_devices d JOIN fairplay_cases c ON c.user_id = d.user_id
       WHERE d.device = ? AND d.user_id != ? AND c.status = 'banned' LIMIT 1`,
      device,
      user.id,
    );
    if (shared) await raiseCase(sql, user.id, "review", "evasion", `plays from a device banned account ${shared.user_id} played from`, now);
  }
  return { banned: false, ...(pooled ? { pooled } : {}) };
}

// ---------------- Appeals ----------------

export interface Appeal {
  id: number;
  user_id: string;
  at: number;
  text: string;
  status: "open" | "upheld" | "overturned";
  decided_at: number | null;
  decided_by: string | null;
  reply: string | null;
}

export const latestAppeal = (sql: Sql, userId: string) =>
  sql.first<Appeal>("SELECT id, user_id, at, text, status, decided_at, decided_by, reply FROM fairplay_appeals WHERE user_id = ? ORDER BY at DESC, id DESC LIMIT 1", userId);

/** A banned player's appeal (one open at a time, up to 2,000 characters), for a person to decide. */
export async function appeal(sql: Sql, userId: string, text: unknown, now: number): Promise<{ ok: true } | { ok: false; message: string }> {
  if ((await caseOf(sql, userId))?.status !== "banned") return { ok: false, message: "Your account isn't banned." };
  const t = typeof text === "string" ? text.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").trim().slice(0, 2000) : "";
  if (t.length < 10) return { ok: false, message: "Tell us a little more (at least a sentence)." };
  if ((await latestAppeal(sql, userId))?.status === "open") return { ok: false, message: "Your appeal is already with us. A person will read it." };
  await sql.run("INSERT INTO fairplay_appeals (user_id, at, text, status) VALUES (?, ?, ?, 'open')", userId, now, t);
  await logCase(sql, userId, "appeal", "player", null, now);
  return { ok: true };
}

/** What a player sees about their own fair-play standing: banned or not, and their latest appeal. */
export async function fairStatus(sql: Sql, userId: string): Promise<{ banned: boolean; appeal: { status: Appeal["status"]; at: number; reply: string | null } | null }> {
  const c = await caseOf(sql, userId);
  const a = await latestAppeal(sql, userId);
  return { banned: c?.status === "banned", appeal: a ? { status: a.status, at: a.at, reply: a.reply } : null };
}

// ---------------- Decisions (an admin, the automated reviewer) ----------------

export type Decision = "ban" | "clear" | "watch" | "review" | "release";
/** (Release: out of the engine pool, back to the usual queues: a clearing, so the level counts only matches from then on.) */
const DECIDES: Record<Decision, CaseStatus> = { ban: "banned", clear: "cleared", watch: "watch", review: "review", release: "cleared" };

/** Sends a player an email about their case (a ban, a clearing after a review, an appeal turned down); set up by the Worker. */
/** Fair play's emails (fairplay-mail.ts): "lifted" is a ban cleared (its sessions were ended: sign in again), "cleared" a review cleared. */
export type CaseMailer = (user: User, kind: "banned" | "cleared" | "lifted" | "upheld", notice: string | null) => Promise<void>;

/**
 * A decision on a case by `by` ("admin:<email>" or "reviewer"), with a written reason for the log, and optionally a
 * note for the player (`notice`, in the email). A ban, or clearing someone who was in review or banned, emails them.
 * The automated reviewer never bans and never decides appeals: it reviews, watches and clears, and can't change a banned case, a pooled
 * one or one with an open appeal. Release (a person's): a pooled player back to the usual queues, cleared, with no email (they were never
 * told); the reason may be left out.
 */
export async function decide(
  sql: Sql,
  userId: string,
  decision: unknown,
  by: string,
  reason: unknown,
  now: number,
  opts: { notice?: unknown; mail?: CaseMailer } = {},
): Promise<{ ok: true; status: CaseStatus } | { ok: false; status: number; message: string }> {
  const status = Object.hasOwn(DECIDES, String(decision)) ? DECIDES[decision as Decision] : undefined;
  if (!status) return { ok: false, status: 400, message: "decision must be ban, clear, watch, review or release" };
  const release = decision === "release";
  const typed = typeof reason === "string" ? reason.trim().slice(0, 2000) : "";
  const why = release ? `released from the engine pool${typed ? `: ${typed}` : ""}` : typed;
  if (why.length < 5) return { ok: false, status: 400, message: "a written reason is required" };
  // (A deleted account's ban outlives it: its case can still be decided, a ban lifted, with no one to email.)
  const user = await getUser(sql, userId);
  const before = await caseOf(sql, userId);
  if (!user && !before) return { ok: false, status: 404, message: "no such player" };
  if (release && before?.status !== "pool") return { ok: false, status: 409, message: "this player isn't in the engine pool" };
  if (by === "reviewer") {
    // (A ban is a person's, always: the ban bar's evidence still comes from the judges' numbers, which devices send, so a leaked token
    // or a steered reviewer could ban an honest player at it. The outside review of Nov 10, finding 6, and its review's M1.)
    if (status === "banned") return { ok: false, status: 409, message: "a ban is for a person: choose review or watch, or leave it for one" };
    if (before?.status === "banned") return { ok: false, status: 409, message: "banned cases and their appeals are for a person" };
    // (The pool is for a person to judge, from how the player does in it: docs/decisions/2026-11-10-engine-pool.md.)
    if (before?.status === "pool" || release) return { ok: false, status: 409, message: "engine pool cases are for a person" };
    // (A deleted account's kept case has no evidence left to weigh: account-data.ts.)
    if (!user) return { ok: false, status: 409, message: "the account was deleted; its case is for a person" };
    if ((await latestAppeal(sql, userId))?.status === "open") return { ok: false, status: 409, message: "this player has an open appeal: a person decides" };
    // (A reported town chat line is for a moderator to read: the reviewer never clears a case with one newer than a
    // person's last decision on it; its own decisions, a "review" say, don't count.)
    if (status === "cleared") {
      const person = (await sql.first<{ at: number | null }>("SELECT MAX(at) AS at FROM fairplay_log WHERE user_id = ? AND by LIKE 'admin:%'", userId))?.at ?? 0;
      if (await sql.first("SELECT id FROM reports WHERE target = ? AND reason = ? AND at > ?", userId, FAIRPLAY.reports.chatReason, person))
        return { ok: false, status: 409, message: "a reported chat line is for a person to read" };
    }
  }
  await setCase(sql, userId, status, by, why, now);
  const notice = typeof opts.notice === "string" && opts.notice.trim() ? opts.notice.trim().slice(0, 1000) : null;
  if (user && opts.mail && (status === "banned" || (status === "cleared" && (before?.status === "review" || before?.status === "banned")))) {
    await opts.mail(user, status === "banned" ? "banned" : before?.status === "banned" ? "lifted" : "cleared", notice).catch((e: unknown) => console.log(`fair play email to ${userId}: ${String(e)}`));
  }
  return { ok: true, status };
}

/** An admin's decision on an appeal: upheld (the ban stands) or overturned (cleared), with a reply the player sees. */
export async function decideAppeal(
  sql: Sql,
  id: number,
  outcome: unknown,
  by: string,
  reply: unknown,
  now: number,
  mail?: CaseMailer,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const a = await sql.first<Appeal>("SELECT id, user_id, at, text, status, decided_at, decided_by, reply FROM fairplay_appeals WHERE id = ?", id);
  if (!a || a.status !== "open") return { ok: false, message: "no open appeal with that id" };
  if (outcome !== "upheld" && outcome !== "overturned") return { ok: false, message: "outcome must be upheld or overturned" };
  const text = typeof reply === "string" ? reply.trim().slice(0, 2000) : "";
  if (text.length < 5) return { ok: false, message: "a reply to the player is required" };
  await sql.run("UPDATE fairplay_appeals SET status = ?, decided_at = ?, decided_by = ?, reply = ? WHERE id = ?", outcome, now, by, text, id);
  await logCase(sql, a.user_id, `appeal ${outcome}`, by, text, now);
  const u = await getUser(sql, a.user_id);
  if (outcome === "overturned") await setCase(sql, a.user_id, "cleared", by, `appeal overturned: ${text}`, now);
  if (u && mail) await mail(u, outcome === "overturned" ? "lifted" : "upheld", text).catch(() => undefined);
  return { ok: true };
}

/**
 * Raises a case to at least `status` (watch < review): never lowers it and never touches a ban. A pooled case stays pooled (only a
 * person's Release takes it out): the new evidence goes in its log. A cleared case can be raised again; callers count only evidence
 * from after the clearing (see reviewIfReported).
 */
export async function raiseCase(sql: Sql, userId: string, status: "watch" | "review", by: string, reason: string, now: number): Promise<boolean> {
  const c = await caseOf(sql, userId);
  if (c?.status === "banned") return false;
  if (c && (c.status === status || (c.status === "review" && status === "watch") || c.status === "pool")) {
    // Already there: the new evidence goes in the log, and the case stays open.
    await sql.run("UPDATE fairplay_cases SET updated_at = MAX(updated_at, ?) WHERE user_id = ?", now, userId);
    await logCase(sql, userId, "note", by, reason, now);
    return false;
  }
  await setCase(sql, userId, status, by, reason, now);
  return true;
}

export type ReportOutcome = { ok: true; already?: boolean } | { ok: false; message: string };

/** A line of the town square's chat a report carries: what was said and when, as the server's room held it. */
export interface ReportedLine {
  text: string;
  at: number;
}

/** A report of a line that has left the town's chat (each lasts 5 minutes), or isn't the reported player's. */
export const LINE_GONE = "That message has gone from the chat. You can still report the player from their profile.";

/**
 * A report about a player (a profile's Report button, or a name tapped in a match), for fair play to weigh and a
 * person to read. One per reporter, player and match (`match`: the lobby code when made in a match); outside a match
 * one per player a day; FAIRPLAY.reports.perDay a day per reporter. A report of a line in the town's chat (`line`, read
 * from the room by the caller: the reporter never supplies the words) is one per line, and keeps the line's text and
 * time with the report for the moderator, as long as the report is kept.
 *
 * Reports never ban anyone. Every report opens a watch case (the player's matches are then kept as evidence), and
 * cheating reports from enough different signed-in accounts within a week put the player in review (fewer for a new
 * account). A guest's report is stored and read, but doesn't count toward a review.
 */
export async function reportPlayer(sql: Sql, reporter: User, target: unknown, reason: unknown, match: unknown, now: number, line?: ReportedLine | null): Promise<ReportOutcome> {
  if (typeof target !== "string" || target === reporter.id || !(await sql.first("SELECT id FROM users WHERE id = ?", target))) return { ok: false, message: "No such player." };
  // A line of the town's chat goes with its own reason (FAIRPLAY.reports.chatReason), and that reason needs the line.
  const chat = reason === FAIRPLAY.reports.chatReason;
  const why = chat ? FAIRPLAY.reports.chatReason : FAIRPLAY.reports.reasons.find((r) => r === reason);
  if (!why) return { ok: false, message: "Pick a reason." };
  if (chat && !line) return { ok: false, message: LINE_GONE };
  const code = !chat && typeof match === "string" && /^[A-Z2-9]{5}$/.test(match) ? match : null;
  // (One report per line; otherwise one per player and match, or per player a day outside a match.)
  const dup = chat
    ? await sql.first("SELECT id FROM reports WHERE reporter = ? AND target = ? AND line_at = ?", reporter.id, target, line!.at)
    : code
      ? await sql.first("SELECT id FROM reports WHERE reporter = ? AND target = ? AND match = ?", reporter.id, target, code)
      : await sql.first("SELECT id FROM reports WHERE reporter = ? AND target = ? AND match IS NULL AND line_at IS NULL AND at > ?", reporter.id, target, now - DAY);
  if (dup) return { ok: true, already: true };
  const n = (await sql.first<{ n: number }>("SELECT COUNT(*) AS n FROM reports WHERE reporter = ? AND at > ?", reporter.id, now - DAY))?.n ?? 0;
  if (n >= FAIRPLAY.reports.perDay) return { ok: false, message: "That's a lot of reports today. Try again tomorrow." };
  await sql.run(
    "INSERT INTO reports (reporter, target, reason, at, match, line, line_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    reporter.id,
    target,
    why,
    now,
    code,
    chat ? line!.text : null,
    chat ? line!.at : null,
  );
  await raiseCase(sql, target, "watch", "reports", `reported: ${why}`, now);
  if (why === "Cheating") await reviewIfReported(sql, target, now);
  return { ok: true };
}

/**
 * Puts a player in review when enough different signed-in accounts reported them for cheating this week. Test accounts
 * (test-accounts.ts) never count: an admin's script can't put a real player in review (the PR #622 review, finding 2).
 */
async function reviewIfReported(sql: Sql, target: string, now: number): Promise<void> {
  const r = FAIRPLAY.reports;
  // (Reports from before a decision on the case, a clearing say, were weighed then.)
  const c = await caseOf(sql, target);
  const since = Math.max(now - r.reviewDays * DAY, c?.decided_at ?? 0);
  const reporters = (
    await sql.all<{ email: string | null; google_sub: string | null }>(
      `SELECT DISTINCT u.id, u.email, u.google_sub FROM reports p JOIN users u ON u.id = p.reporter
       WHERE p.target = ? AND p.reason = 'Cheating' AND p.at > ? AND u.test IS NOT 1`,
      target,
      since,
    )
  ).filter(signedIn).length;
  const matches = (await sql.first<{ n: number }>("SELECT COUNT(*) AS n FROM results WHERE user_id = ? AND online = 1", target))?.n ?? 0;
  const needed = matches < r.newAccountMatches ? r.newAccountReporters : r.reviewReporters;
  if (reporters >= needed) await raiseCase(sql, target, "review", "reports", `${reporters} players reported cheating within ${r.reviewDays} days`, now);
}

// ---------------- Signals and detection ----------------

/** What one match's fair-play record came to. */
export interface FairRecord {
  summary: FairSummary;
  verdict: LevelVerdict;
  /** What was done about it (the enforcement setting may hold detection to recording only; "pool": into the engine pool). */
  acted: Acted;
}

/** What detection did: a level's action, or the engine pool. */
export type Acted = FairLevel | "pool";

/**
 * A finished online match's fair play for one signed-in player, from the lobby's record of their judged picks: the
 * match's signals and score (core/fairplay.ts), measured against their own history; their level over recent matches;
 * and what FAIRPLAY.enforcement lets detection do about it. Stored as their history, with the picks as evidence.
 */
export async function recordFairPlay(
  sql: Sql,
  userId: string,
  match: { lobby: string | null; mode: string; moves: readonly FairMove[]; since?: number },
  now: number,
  mail?: CaseMailer,
): Promise<FairRecord> {
  const lv = FAIRPLAY.levels;
  const account = await sql.first<{ rating: number | null }>("SELECT rating FROM users WHERE id = ?", userId);
  // An account deleted mid-match (account-data.ts): nothing recorded.
  if (!account) return { summary: matchSignals(match.moves, referenceStrength([], null)), verdict: { level: "none", reasons: [] }, acted: "none" };
  // (`since`: once per lobby, as recordResult's: a lobby writing its end again (a retry, a restart) records nothing more, and weighs the
  // match as its first try did, its own row left out.)
  const once = match.since !== undefined && match.lobby !== null;
  const history = await sql.all<HistoryRow>(
    `SELECT id, perf, score, counted, played_at, summary FROM fairplay_matches WHERE user_id = ? ${once ? "AND NOT (lobby IS ? AND played_at >= ?)" : ""}
     ORDER BY played_at DESC, id DESC LIMIT 20`,
    userId,
    ...(once ? [match.lobby, match.since] : []),
  );
  const rating = account.rating ?? null;
  const summary = matchSignals(match.moves, referenceStrength(history.slice(0, 10).map((h) => h.perf), rating));
  const c = await caseOf(sql, userId);
  const inputs = [...levelInputs(history, c), { ...summary, at: now }];
  let verdict = playerLevel(inputs, now, lv);
  const flagged = summary.score >= lv.watch || verdict.level !== "none" || (!!c && OPEN.includes(c.status));
  const added = await sql.first<{ id: number }>(
    `INSERT INTO fairplay_matches (user_id, lobby, mode, played_at, counted, perf, score, level, summary, moves, keep_until)
     SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
     ${once ? "WHERE NOT EXISTS (SELECT 1 FROM fairplay_matches WHERE user_id = ? AND lobby = ? AND played_at >= ?)" : ""} RETURNING id`,
    userId,
    match.lobby,
    match.mode,
    now,
    summary.counted,
    summary.perf,
    summary.score,
    verdict.level,
    JSON.stringify(summary),
    JSON.stringify(match.moves),
    now + (flagged ? FAIRPLAY.evidenceDays : FAIRPLAY.evidenceDaysUnflagged) * DAY,
    ...(once ? [userId, match.lobby, match.since] : []),
  );
  // (A retry whose row went in on an earlier try, which stopped before the steps below: the level from what's stored, as relevel's, so a
  // person's decision since counts; then the same steps, both safe to repeat. The review of #610, m1.)
  if (!added) verdict = await levelNow(sql, userId, c, now);
  // The deep re-check: a flagged match queues every match of theirs still kept (earlier ones can clear them).
  if (summary.score >= FAIRPLAY.deep.queueScore || verdict.level !== "none") await queueDeep(sql, userId);
  // (A retry acts only when the case is still below what the verdict asks: it finishes what an earlier try missed, and writes no
  // second note when nothing was missed. The delta review of #610, m1-a.)
  const aim = aimOf(verdict);
  const acted = !added && aim && caseRank(c?.status) >= caseRank(aim) ? ACTED[aim] : await actOn(sql, userId, verdict, now, mail);
  const pooled = await poolNewAccount(sql, userId, now);
  await purgeEvidence(sql, now);
  return { summary, verdict, acted: pooled ? "pool" : acted };
}

/** Queues every match of a player's still kept and not yet deep-checked for the deep re-check (fairplay-deep.ts). */
export async function queueDeep(sql: Sql, userId: string): Promise<void> {
  await sql.run("UPDATE fairplay_matches SET deep_queued = 1 WHERE user_id = ? AND moves IS NOT NULL AND (deep_done IS NULL OR deep_done = 0)", userId);
}

interface HistoryRow {
  id: number;
  perf: number | null;
  score: number;
  counted: number;
  played_at: number;
  summary: string;
}

/** A player's stored matches as playerLevel reads them. Matches from before a decision on the case (a clearing, say) were weighed then. */
function levelInputs(history: readonly HistoryRow[], c: Case | null): LevelInput[] {
  const since = c?.decided_at ?? 0;
  return history
    .filter((h) => h.played_at > since)
    .map((h) => {
      let deep: Partial<FairSummary> = {};
      try {
        deep = JSON.parse(h.summary) as Partial<FairSummary>;
      } catch {
        // An unreadable summary: unchecked.
      }
      return { score: h.score, perf: h.perf, counted: h.counted, deepChecked: deep.deepChecked ?? 0, deepMatch: deep.deepMatch ?? 0, evidence: deep.evidence ?? 0, at: h.played_at };
    });
}

/**
 * A player's level again after their stored matches changed (the deep re-check added to one), and what detection
 * does about it. The deep re-check's entry point (fairplay-deep.ts).
 */
export async function relevel(sql: Sql, userId: string, now: number, mail?: CaseMailer): Promise<{ verdict: LevelVerdict; acted: Acted }> {
  const verdict = await levelNow(sql, userId, await caseOf(sql, userId), now);
  const acted = await actOn(sql, userId, verdict, now, mail);
  return { verdict, acted: (await poolNewAccount(sql, userId, now)) ? "pool" : acted };
}

/**
 * The engine pool's new-account rule (core's newAccountPool; FAIRPLAY.pool): an account with `newHits` of its first `newGames`
 * fair-play matches at the one-match ban bar goes to the pool straight away, with no review, when `enforcement` is "pool". Only
 * matches since the case's last decision count (a Release weighed the rest). Whether it put them there now.
 */
async function poolNewAccount(sql: Sql, userId: string, now: number): Promise<boolean> {
  if (FAIRPLAY.enforcement !== "pool") return false;
  const c = await caseOf(sql, userId);
  if (c?.status === "pool" || c?.status === "banned") return false;
  const first = await sql.all<HistoryRow>(
    "SELECT id, perf, score, counted, played_at, summary FROM fairplay_matches WHERE user_id = ? ORDER BY played_at, id LIMIT ?",
    userId,
    FAIRPLAY.pool.newGames,
  );
  const since = c?.decided_at ?? 0;
  const why = newAccountPool(levelInputs(first, null).map((m) => ({ ...m, counts: m.at > since })));
  if (!why) return false;
  await setCase(sql, userId, "pool", "detection", why, now);
  return true;
}

/** A player's level from their stored matches now (since the case's last decision), acting on nothing. */
async function levelNow(sql: Sql, userId: string, c: Case | null, now: number): Promise<LevelVerdict> {
  const history = await sql.all<HistoryRow>(
    "SELECT id, perf, score, counted, played_at, summary FROM fairplay_matches WHERE user_id = ? ORDER BY played_at DESC, id DESC LIMIT 20",
    userId,
  );
  return playerLevel(levelInputs(history, c), now, FAIRPLAY.levels);
}

type Enforcement = "watch" | "review" | "pool" | "ban";

/** The case status actOn moves a verdict to (as its branches below), for a retry's check. */
function aimOf(verdict: LevelVerdict): CaseStatus | undefined {
  if (verdict.level === "none") return undefined;
  const mode = FAIRPLAY.enforcement as Enforcement;
  if (verdict.level === "watch" || mode === "watch") return "watch";
  if (verdict.level === "ban" && mode === "pool") return "pool";
  return verdict.level === "ban" && mode === "ban" && verdict.path !== "strength" ? "banned" : "review";
}
const ACTED = { watch: "watch", review: "review", pool: "pool", banned: "ban" } as Record<CaseStatus, Acted>;
const caseRank = (s: CaseStatus | undefined): number => (s === "banned" ? 4 : s === "pool" ? 3 : s === "review" ? 2 : s === "watch" ? 1 : 0);

/**
 * What detection does with a level, as far as FAIRPLAY.enforcement allows: "watch" only records (a watch case, its
 * log saying what the level would have done), "review" also opens reviews, "pool" sends a ban-level player to the engine pool
 * (quietly: no email), on one deep-checked match past every one-match bar or on the two-match path (Eric, Nov 11: "It's better we
 * put people in this queue than under"; docs/decisions/2026-11-11-near-best.md), "ban" bans them, except on sustained strength
 * (`path` "strength": the judges' numbers alone, no deep re-check), which opens a review instead (the review of #629, m1). Returns what
 * it did.
 */
async function actOn(sql: Sql, userId: string, verdict: LevelVerdict, now: number, mail?: CaseMailer): Promise<Acted> {
  if (verdict.level === "none") return "none";
  const mode = FAIRPLAY.enforcement as Enforcement;
  const why = verdict.reasons.join("; ");
  if (verdict.level === "watch" || mode === "watch") {
    await raiseCase(sql, userId, "watch", "detection", verdict.level === "watch" ? why : `level ${verdict.level}, not acted on (watch only): ${why}`, now);
    return "watch";
  }
  if (verdict.level === "ban" && mode === "pool") {
    // (Already pooled: the new evidence goes in its log, raiseCase's note. Banned by a person: nothing more.)
    const c = await caseOf(sql, userId);
    if (c?.status === "pool" || c?.status === "banned") await raiseCase(sql, userId, "review", "detection", `level ban: ${why}`, now);
    else await setCase(sql, userId, "pool", "detection", `level ban: ${why}`, now);
    return "pool";
  }
  if (verdict.level === "ban" && mode === "ban" && verdict.path !== "strength") {
    const c = await caseOf(sql, userId);
    if (c?.status !== "banned") {
      await setCase(sql, userId, "banned", "detection", why, now);
      const u = await getUser(sql, userId);
      if (u && mail) await mail(u, "banned", null).catch(() => undefined);
    }
    return "ban";
  }
  const instead = verdict.path === "strength" ? "level ban (sustained strength), reviewed instead" : "level ban, reviewed instead (enforcement: review)";
  await raiseCase(sql, userId, "review", "detection", verdict.level === "ban" ? `${instead}: ${why}` : why, now);
  return "review";
}

let purgedAt = 0;
/**
 * Deletes old evidence (at most every 10 minutes per instance): picks past their keep date, unless the player's case
 * is open (a pooled player's evidence stays while they're pooled). A watch case that has seen nothing new for FAIRPLAY.evidenceDays
 * closes first.
 */
export async function purgeEvidence(sql: Sql, now: number, force = false): Promise<void> {
  if (!force && now - purgedAt < 10 * 60_000) return;
  purgedAt = now;
  const stale = await sql.all<{ user_id: string }>("SELECT user_id FROM fairplay_cases WHERE status = 'watch' AND updated_at < ? LIMIT 100", now - FAIRPLAY.evidenceDays * DAY);
  for (const { user_id } of stale) await setCase(sql, user_id, "closed", "auto", `nothing new in ${FAIRPLAY.evidenceDays} days`, now);
  // (Open: watch, review or the pool, or a ban with an appeal still waiting.)
  await sql.run(
    `UPDATE fairplay_matches SET moves = NULL, keep_until = NULL, deep_queued = 0
     WHERE keep_until < ? AND user_id NOT IN (SELECT user_id FROM fairplay_cases WHERE status IN ('watch', 'review', 'pool'))
       AND user_id NOT IN (SELECT user_id FROM fairplay_appeals WHERE status = 'open')`,
    now,
  );
}
