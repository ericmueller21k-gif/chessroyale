import { TOWN_TABLES, type ItemLook, type PawnColor } from "@chessroyale/core";

/**
 * Ranked at the park's tables (Eric, Nov 27: "if people were in the town, they would also see 1v1s going on, and then they could
 * actually click and spectate those games"), as pure logic; the live hub keeps one (live-hub.ts) beside who's in the town
 * (town-here.ts). A player taps a table's Ranked: their device sits them there (its beats say which table and stool) and searches.
 * When the queue pairs them it tells the hub (matchmaker.ts `seatDuel`, only for a search begun at a table), and the hub seats the
 * match at one table: the first's (the one who searched longer), if the town still has them sitting there and no other match holds it;
 * else the other's, the same way; else none. From then on every device in that town sees both players seated there (the opponent
 * whether or not they're in the town) and not walking anywhere else, until the game says it's over (duel-do.ts `tellTown`), or
 * TOWN_TABLES.matchMaxMinutes pass. Nothing a device sends seats a match: only the queue's own pairing does, for its own two players.
 */

/** A player at a table's match, as the town draws them: their name over their pawn, what they wear, their pawn's color. */
export interface TableSeat {
  uid: string;
  name: string;
  look: ItemLook | null;
  pawn: PawnColor;
}

/** A ranked 1 v 1 at one of a town's park tables, as a device in that town is told it. */
export interface TableMatch {
  /** The game's code (its spectator view). */
  code: string;
  /** The table (its number in the town's park). */
  table: number;
  /** Who sits on stool 0 (west) and stool 1 (east): always two (an array, as it crosses between objects). */
  seats: TableSeat[];
}

/** Where a device says its player sits (a beat's `seat`): a table and its stool. */
export interface HereSeat {
  table: number;
  stool: 0 | 1;
}

/** A match held at a table, with its town and since when (kept in the hub's storage so a restart keeps it). */
export interface TableClaim extends TableMatch {
  room: string;
  since: number;
}

/** Where a player sits in the town now (null: not in it, or not sitting at a table). */
export type SeatOf = (uid: string) => (HereSeat & { room: string }) | null;

export class TownTables {
  private claims = new Map<string, TableClaim>();

  get size(): number {
    return this.claims.size;
  }

  /** Every match held now (the hub's storage keeps the same). */
  all(): TableClaim[] {
    return [...this.claims.values()];
  }

  /** A match kept in storage, back after a restart (one past its time is let go at the next sweep). */
  restore(c: TableClaim): void {
    if (c && typeof c.code === "string" && Array.isArray(c.seats) && c.seats.length === 2) this.claims.set(c.code, c);
  }

  /** Whether a match holds this table in this town. */
  heldAt(room: string, table: number): boolean {
    for (const c of this.claims.values()) if (c.room === room && c.table === table) return true;
    return false;
  }

  /** Whether this account is playing at a table in this town now (their pawn walks nowhere else there). */
  playing(uid: string, room: string): boolean {
    for (const c of this.claims.values()) if (c.room === room && c.seats.some((s) => s.uid === uid)) return true;
    return false;
  }

  /**
   * A pair found from the town (the queue's word, `order`: the one who searched longer first): seated at the first's table if the town
   * has them sitting there (`seatOf`) and no other match holds it, else at the other's, else nowhere. The one whose table it is keeps
   * their stool; the other takes the one across. Answers the match held (null: none). A code already held is left as it is.
   */
  found(code: string, order: readonly [TableSeat, TableSeat], seatOf: SeatOf, now: number): TableClaim | null {
    if (this.claims.has(code) || order[0].uid === order[1].uid) return null;
    for (const k of [0, 1] as const) {
      const at = seatOf(order[k].uid);
      if (!at || !Number.isInteger(at.table) || at.table < 0 || at.table > TOWN_TABLES.tableMax || this.heldAt(at.room, at.table)) continue;
      const mine = order[k];
      const theirs = order[1 - k]!;
      const seats = at.stool === 0 ? [mine, theirs] : [theirs, mine];
      const c: TableClaim = { code, table: at.table, seats, room: at.room, since: now };
      this.claims.set(code, c);
      return c;
    }
    return null;
  }

  /** The game is over (or gone): its table is free. Answers the match let go (null: none held). */
  over(code: string): TableClaim | null {
    const c = this.claims.get(code) ?? null;
    if (c) this.claims.delete(code);
    return c;
  }

  /** Lets go every match held longer than TOWN_TABLES.matchMaxMinutes; answers their codes. */
  sweep(now: number, maxMs: number = TOWN_TABLES.matchMaxMinutes * 60_000): string[] {
    const gone: string[] = [];
    for (const c of this.claims.values()) if (now - c.since >= maxMs) gone.push(c.code);
    for (const code of gone) this.claims.delete(code);
    return gone;
  }

  /**
   * The matches in this town as a device there is told them: not one it plays in itself (`except`: back from it, it sits there on its
   * own). `names` false (a guest watching): no names.
   */
  view(room: string, except: string | null, names = true): TableMatch[] {
    const out: TableMatch[] = [];
    for (const c of this.claims.values()) {
      if (c.room !== room || (except && c.seats.some((s) => s.uid === except))) continue;
      const seat = (s: TableSeat): TableSeat => (names ? s : { ...s, name: "" });
      out.push({ code: c.code, table: c.table, seats: c.seats.map(seat) });
    }
    return out;
  }
}
