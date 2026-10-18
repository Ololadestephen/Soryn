import { DatabaseSync, backup } from "node:sqlite";
import { access, chmod } from "node:fs/promises";
import { resolve } from "node:path";

const [source, destination] = process.argv.slice(2);
if (!source || !destination || resolve(source) === resolve(destination))
  throw new Error(
    "Usage: node scripts/release/backup.mjs <existing-db> <new-backup>",
  );
process.umask(0o077);
await access(source);
try {
  await access(destination);
  throw new Error("Backup destination already exists.");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const db = new DatabaseSync(source, { readOnly: true });
try {
  await backup(db, destination);
  await chmod(destination, 0o600);
  const check = new DatabaseSync(destination, { readOnly: true });
  try {
    if (check.prepare("PRAGMA integrity_check").get().integrity_check !== "ok")
      throw new Error("Backup integrity check failed.");
  } finally {
    check.close();
  }
  process.stdout.write("Backup verified.\n");
} finally {
  db.close();
}
