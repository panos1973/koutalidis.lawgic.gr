import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// for query purposes
const client = postgres(process.env.POSTGRES_URL!);
const db = drizzle(client, { schema });
export default db;
