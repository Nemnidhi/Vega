/**
 * Backs up (and restores) a MongoDB database using the driver already in
 * this project, because `mongodump` is not installed on every machine that
 * needs to run the migration.
 *
 * Documents are written as newline-delimited Extended JSON, so ObjectIds,
 * Dates and Buffers (the audit-report PDFs) survive a round trip intact -
 * plain JSON.stringify would quietly destroy all three.
 *
 * This is a safety net for the migration, NOT a replacement for Atlas
 * snapshots: it does not capture indexes, users, or validation rules. Take
 * an Atlas snapshot as well and note its timestamp.
 *
 *   npm run backup:db                          # back up the current target
 *   npm run backup:db -- --out ./backups/pre-migration
 *   npm run backup:db -- --restore ./backups/pre-migration --apply
 *
 * Restore refuses to write into a collection that already has documents
 * unless --force is given, so it cannot silently double-insert.
 */
import fs from "node:fs";
import path from "node:path";
import { MongoClient, type Document } from "mongodb";
import { EJSON } from "bson";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const FORCE = args.includes("--force");

function argValue(flag: string) {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : undefined;
}

const RESTORE_FROM = argValue("--restore");
const OUT_DIR =
  argValue("--out") ??
  path.join("backups", `${process.env.MONGODB_DB_NAME ?? "db"}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "")}`);

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function humanBytes(n: number) {
  return n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${(n / 1024).toFixed(0)} KB`;
}

async function backup(client: MongoClient, dbName: string) {
  const db = client.db(dbName);
  const collections = (await db.listCollections().toArray()).filter((c) => c.type !== "view");

  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`backing up "${dbName}" -> ${path.resolve(OUT_DIR)}\n`);

  const manifest: Record<string, number> = {};
  let totalBytes = 0;

  for (const info of collections) {
    const name = info.name;
    const docs = await db.collection(name).find({}).toArray();
    const file = path.join(OUT_DIR, `${name}.ndjson`);
    const stream = fs.createWriteStream(file, { encoding: "utf8" });
    for (const doc of docs) stream.write(`${EJSON.stringify(doc, { relaxed: false })}\n`);
    await new Promise((resolve) => stream.end(resolve));

    const bytes = fs.statSync(file).size;
    totalBytes += bytes;
    manifest[name] = docs.length;
    console.log(`  ${String(docs.length).padStart(6)} docs  ${humanBytes(bytes).padStart(9)}  ${name}`);
  }

  fs.writeFileSync(
    path.join(OUT_DIR, "_manifest.json"),
    JSON.stringify(
      { database: dbName, takenAt: new Date().toISOString(), counts: manifest },
      null,
      2,
    ),
  );

  console.log(`\ntotal: ${Object.values(manifest).reduce((a, b) => a + b, 0)} documents, ${humanBytes(totalBytes)}`);
  console.log(`manifest: ${path.join(OUT_DIR, "_manifest.json")}`);
  console.log("\nNOTE: indexes, users and validation rules are NOT captured.");
  console.log("Take an Atlas snapshot as well before any destructive step.");
}

async function restore(client: MongoClient, dbName: string, from: string) {
  const manifestPath = path.join(from, "_manifest.json");
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`No _manifest.json in ${from} - is that a backup directory?`);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  console.log(`restoring into "${dbName}" from ${path.resolve(from)}`);
  console.log(`backup was taken from "${manifest.database}" at ${manifest.takenAt}`);
  if (manifest.database !== dbName) {
    console.log(`  WARNING: backup came from a different database ("${manifest.database}")`);
  }
  console.log(APPLY ? "\nMODE: APPLY (will write)\n" : "\nMODE: DRY RUN (no writes)\n");

  const db = client.db(dbName);
  for (const file of fs.readdirSync(from).filter((f) => f.endsWith(".ndjson"))) {
    const name = path.basename(file, ".ndjson");
    const lines = fs
      .readFileSync(path.join(from, file), "utf8")
      .split("\n")
      .filter((l) => l.trim().length > 0);
    const existing = await db.collection(name).countDocuments();

    if (existing > 0 && !FORCE) {
      console.log(`  SKIP  ${name}: already has ${existing} document(s) - pass --force to overwrite`);
      continue;
    }

    console.log(`  ${APPLY ? "restore" : "would restore"}  ${lines.length} doc(s) -> ${name}${existing ? ` (replacing ${existing})` : ""}`);
    if (!APPLY) continue;

    const docs = lines.map((line) => EJSON.parse(line, { relaxed: false }) as Document);
    if (existing > 0) await db.collection(name).deleteMany({});
    if (docs.length) await db.collection(name).insertMany(docs, { ordered: false });
  }

  console.log(APPLY ? "\nRestore complete." : "\nDry run complete - nothing written.");
}

async function main() {
  const uri = required("MONGODB_URI");
  const dbName = required("MONGODB_DB_NAME");
  const client = new MongoClient(uri);
  await client.connect();

  try {
    if (RESTORE_FROM) await restore(client, dbName, RESTORE_FROM);
    else await backup(client, dbName);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error("Backup/restore failed:", error);
  process.exit(1);
});
