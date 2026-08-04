// One Postgres client, reused across invocations of a warm function.
//
// Serverless and connection pools are a classic mismatch: every cold start opens a new
// connection, and a direct Postgres runs out long before the traffic does. DATABASE_URL
// must therefore point at Supabase's transaction pooler (port 6543), not the direct
// endpoint. `max: 1` is deliberate on top of that: the pooler is doing the pooling, and
// a second connection per function instance buys nothing.
import postgres from "postgres";

let sql;

export function db() {
  if (!sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    sql = postgres(url, {
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
      // The transaction pooler cannot support prepared statements across a pool, and
      // silently misbehaves if you try.
      prepare: false,
    });
  }
  return sql;
}
