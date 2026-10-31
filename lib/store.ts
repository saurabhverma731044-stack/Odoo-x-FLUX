import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Minimal JSON-file persistence for account data. A production deployment
 * would swap this for a real database with a unique index on the normalised
 * email; this keeps the project dependency-free while behaving like one.
 */
const DATA_DIR = process.env.BRIGHTLOOP_DATA_DIR
  ? path.resolve(process.env.BRIGHTLOOP_DATA_DIR)
  : path.join(process.cwd(), "data");

let tail: Promise<unknown> = Promise.resolve();

/**
 * Serialises read-modify-write cycles inside this server process so two
 * concurrent signups cannot both pass the "email is free" check.
 */
export function withStoreLock<T>(operation: () => Promise<T>): Promise<T> {
  const result = tail.then(operation, operation);
  tail = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

export async function readStoreFile<T>(name: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, name), "utf8");
    return JSON.parse(raw) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw error;
  }
}

export async function writeStoreFile(
  name: string,
  value: unknown,
): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const target = path.join(DATA_DIR, name);
  const temp = `${target}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await fs.rename(temp, target);
}
