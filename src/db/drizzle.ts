import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Connection pool: reuse connections and cap the total to avoid
// exhausting PostgreSQL's connection limit under concurrent load.
//   max  – at most 10 connections per serverless instance
//   idle_timeout – close idle connections after 20 seconds
//   connect_timeout – fail fast if the DB is unreachable
const client = postgres(process.env.POSTGRES_URL!, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

const db = drizzle(client, { schema });
export default db;
