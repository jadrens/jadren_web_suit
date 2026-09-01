import { SQL } from "bun";

interface QueryResult<T> {
  rows: T[];
}

export interface QueryClient {
  query<T>(text: string, values?: unknown[]): Promise<QueryResult<T>>;
}

const globalForPostgres = globalThis as typeof globalThis & {
  draToolPostgres?: SQL;
};

function createSql() {
  const connectionString = process.env.DATABASE_URL;
  const tls =
    process.env.POSTGRES_SSL !== "false"
      ? { rejectUnauthorized: false }
      : false;

  return new SQL({
    ...(connectionString
      ? { url: connectionString }
      : {
          hostname: process.env.POSTGRES_HOST ?? "127.0.0.1",
          port: Number(process.env.POSTGRES_PORT ?? 5432),
          username: process.env.POSTGRES_USER,
          password: process.env.POSTGRES_PASSWORD,
          database: process.env.POSTGRES_DB,
        }),
    tls,
    max: 10,
    idleTimeout: 30,
    connectionTimeout: 5,
  });
}

const sql = globalForPostgres.draToolPostgres ?? createSql();

if (process.env.NODE_ENV !== "production") {
  globalForPostgres.draToolPostgres = sql;
}

function clientFor(executor: Pick<SQL, "unsafe">): QueryClient {
  return {
    async query<T>(text: string, values: unknown[] = []) {
      const rows = values.length
        ? await executor.unsafe(text, values)
        : await executor.unsafe(text);
      return { rows: rows as T[] };
    },
  };
}

export const db = clientFor(sql);

export async function withTransaction<T>(
  callback: (client: QueryClient) => Promise<T>
): Promise<T> {
  return sql.begin((transaction) => callback(clientFor(transaction)));
}

export async function closeDb() {
  await sql.close();
}

export function firstRow<T>(rows: T[]): T | null {
  return rows[0] ?? null;
}
