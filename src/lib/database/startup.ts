import { Database } from "bun:sqlite";
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, open, rename, stat, unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const ASSET_BASE_URL = "https://assets.jadren.dev/database";
const LOCK_STALE_AFTER_MS = 10 * 60 * 1000;
const LOCK_WAIT_TIMEOUT_MS = 15 * 60 * 1000;

interface DatabaseAsset {
  name: string;
  path: string;
  objectName: string;
  size: number;
  sha256: string;
  requiredTables: string[];
  sanityQuery: string;
  minimumRows: number;
}

function databaseAssets(): DatabaseAsset[] {
  return [
    {
      name: "Oxford dictionary",
      path: process.env.OXFORD_DICTIONARY_DB?.trim() || "database/oxford-10-en2cn.sqlite3",
      objectName: "oxford-10-en2cn.sqlite3",
      size: 124_293_120,
      sha256: "f2b27e3f940ab09b390d758c496ec13cedfb9c6e6725703ca17856492a3b2acc",
      requiredTables: ["entries", "aliases", "senses", "phrases", "metadata"],
      sanityQuery: "SELECT COUNT(*) AS count FROM entries",
      minimumRows: 50_000,
    },
    {
      name: "NCEE vocabulary",
      path: process.env.NCEE_DATABASE_DB?.trim() || "database/NCEE.db",
      objectName: "NCEE.db",
      size: 7_516_160,
      sha256: "a543167cd9dbc209541d515ee8623ab5f1b164e61952027a3402a161ccb36f65",
      requiredTables: ["words", "metadata"],
      sanityQuery: "SELECT COUNT(*) AS count FROM words",
      minimumRows: 3_000,
    },
  ];
}

function sleep(milliseconds: number) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

async function fileExists(path: string) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

async function acquireDownloadLock(lockPath: string) {
  const startedAt = Date.now();
  while (true) {
    try {
      const handle = await open(lockPath, "wx");
      await handle.writeFile(`${process.pid}\n${new Date().toISOString()}\n`);
      return handle;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;

      const lockStat = await stat(lockPath).catch(() => null);
      if (lockStat && Date.now() - lockStat.mtimeMs > LOCK_STALE_AFTER_MS) {
        await unlink(lockPath).catch(() => undefined);
        continue;
      }
      if (Date.now() - startedAt > LOCK_WAIT_TIMEOUT_MS) {
        throw new Error(`Timed out waiting for database download lock: ${lockPath}`);
      }
      await sleep(500);
    }
  }
}

async function downloadMissingDatabase(asset: DatabaseAsset, targetPath: string) {
  if (await fileExists(targetPath)) return;

  await mkdir(dirname(targetPath), { recursive: true });
  const lockPath = `${targetPath}.download.lock`;
  const lockHandle = await acquireDownloadLock(lockPath);
  const temporaryPath = `${targetPath}.download-${process.pid}`;

  try {
    if (await fileExists(targetPath)) return;

    const baseUrl = (process.env.DATABASE_ASSET_BASE_URL?.trim() || ASSET_BASE_URL).replace(/\/$/, "");
    const url = `${baseUrl}/${asset.objectName}`;
    console.log(`[startup] downloading missing ${asset.name} database from ${url}`);
    const response = await fetch(url);
    if (!response.ok || !response.body) {
      throw new Error(`Database download failed (${response.status} ${response.statusText}): ${url}`);
    }

    await pipeline(
      Readable.fromWeb(response.body as unknown as import("node:stream/web").ReadableStream),
      createWriteStream(temporaryPath, { flags: "wx" }),
    );
    await verifyFile(asset, temporaryPath);
    await rename(temporaryPath, targetPath);
    console.log(`[startup] installed ${asset.name} database at ${targetPath}`);
  } finally {
    await unlink(temporaryPath).catch(() => undefined);
    await lockHandle.close().catch(() => undefined);
    await unlink(lockPath).catch(() => undefined);
  }
}

async function sha256(path: string) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

async function verifyFile(asset: DatabaseAsset, path: string) {
  const fileStat = await stat(path);
  if (fileStat.size !== asset.size) {
    throw new Error(`${asset.name} database has size ${fileStat.size}; expected ${asset.size}`);
  }
  const digest = await sha256(path);
  if (digest !== asset.sha256) {
    throw new Error(`${asset.name} database SHA-256 mismatch: ${digest}`);
  }
}

function verifySqlite(asset: DatabaseAsset, path: string) {
  const database = new Database(path, { readonly: true, strict: true });
  try {
    const quickCheck = database.query<{ quick_check: string }, []>("PRAGMA quick_check").get();
    if (quickCheck?.quick_check !== "ok") {
      throw new Error(`${asset.name} SQLite quick_check failed: ${quickCheck?.quick_check ?? "no result"}`);
    }

    const tables = database.query<{ name: string }, []>(
      "SELECT name FROM sqlite_master WHERE type = 'table'",
    ).all();
    const tableNames = new Set(tables.map(({ name }) => name));
    for (const requiredTable of asset.requiredTables) {
      if (!tableNames.has(requiredTable)) {
        throw new Error(`${asset.name} database is missing table: ${requiredTable}`);
      }
    }

    const row = database.query<{ count: number }, []>(asset.sanityQuery).get();
    if (!row || row.count < asset.minimumRows) {
      throw new Error(`${asset.name} database has too few records: ${row?.count ?? 0}`);
    }
  } finally {
    database.close();
  }
}

export async function prepareDatabases() {
  for (const asset of databaseAssets()) {
    const path = resolve(process.cwd(), asset.path);
    console.log(`[startup] checking ${asset.name} database: ${path}`);
    await downloadMissingDatabase(asset, path);
    await verifyFile(asset, path);
    verifySqlite(asset, path);
    console.log(`[startup] ${asset.name} database OK`);
  }
}
