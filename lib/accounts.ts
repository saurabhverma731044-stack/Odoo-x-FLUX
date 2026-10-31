import { randomUUID } from "node:crypto";
import { createResetToken, hashPassword, hashResetToken } from "@/lib/security";
import { isRole, type Role } from "@/lib/rbac";
import { readStoreFile, withStoreLock, writeStoreFile } from "@/lib/store";
import { normalizeEmail } from "@/lib/validation";

/**
 * Account, role and password-reset persistence for Brightloop Software.
 *
 * Invariants that live here:
 *   1. One account per email address (compared case-insensitively).
 *   2. Every account has exactly one role; legacy records without one read as
 *      "customer", the least privileged role.
 *   3. A reset token is single-use, expires after an hour, and invalidates any
 *      earlier unused token for the same account.
 *
 * Role checks are NOT enforced here — the API routes do that via lib/rbac so
 * the permission decision and the HTTP response stay in one place.
 */

export type Account = {
  id: string;
  email: string;
  /** Normalised (trimmed, lowercased) email used for the uniqueness check. */
  emailKey: string;
  passwordHash: string;
  role: Role;
  createdAt: string;
};

export type PublicAccount = Pick<Account, "id" | "email" | "role" | "createdAt">;

type StoredAccount = Omit<Account, "role"> & { role?: string };

export type PasswordReset = {
  id: string;
  accountId: string;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
};

/** A message captured by the mock mailer instead of being sent. */
export type MockEmail = {
  id: string;
  to: string;
  subject: string;
  sentAt: string;
  resetUrl: string;
};

const ACCOUNTS_FILE = "accounts.json";
const RESETS_FILE = "password-resets.json";
const OUTBOX_FILE = "outbox.json";

export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

/**
 * Bootstrap address for the first administrator. A signup with this address
 * becomes admin only while no admin exists yet; afterwards it is an ordinary
 * customer signup. Real deployments replace this with an invite flow or SSO.
 */
const ADMIN_BOOTSTRAP_EMAIL = (
  process.env.BRIGHTLOOP_ADMIN_EMAIL ?? "admin@brightloop.test"
)
  .trim()
  .toLowerCase();

function toAccount(stored: StoredAccount): Account {
  return {
    ...stored,
    role: isRole(stored.role) ? stored.role : "customer",
  };
}

function toPublicAccount(account: Account): PublicAccount {
  return {
    id: account.id,
    email: account.email,
    role: account.role,
    createdAt: account.createdAt,
  };
}

export function buildResetUrl(origin: string, token: string): string {
  const url = new URL("/customers/reset-password", origin);
  url.searchParams.set("token", token);
  return url.toString();
}

export type CreateAccountResult =
  | { status: "created"; account: PublicAccount }
  | { status: "email_taken" };

/**
 * Self-service signup. Always creates a customer-portal account, except for the
 * single bootstrap admin address described above.
 */
export async function createAccount(
  email: string,
  password: string,
): Promise<CreateAccountResult> {
  return insertAccount(email, password, (emailKey, accounts) => {
    const hasAdmin = accounts.some((account) => account.role === "admin");
    return !hasAdmin && emailKey === ADMIN_BOOTSTRAP_EMAIL ? "admin" : "customer";
  });
}

/**
 * Creates a staff or admin account directly with a chosen role. Only called by
 * the admin-guarded staff route; the role is decided by that route, never by
 * the request body alone.
 */
export async function createTeamMember(
  email: string,
  password: string,
  role: Role,
): Promise<CreateAccountResult> {
  return insertAccount(email, password, () => role);
}

async function insertAccount(
  email: string,
  password: string,
  resolveRole: (emailKey: string, accounts: Account[]) => Role,
): Promise<CreateAccountResult> {
  const emailKey = normalizeEmail(email);
  // Deliberately slow hashing happens outside the lock so it does not block
  // other store operations.
  const passwordHash = await hashPassword(password);

  return withStoreLock(async () => {
    const stored = await readStoreFile<StoredAccount[]>(ACCOUNTS_FILE, []);
    const accounts = stored.map(toAccount);
    if (accounts.some((account) => account.emailKey === emailKey)) {
      return { status: "email_taken" };
    }

    const account: Account = {
      id: randomUUID(),
      email: email.trim(),
      emailKey,
      passwordHash,
      role: resolveRole(emailKey, accounts),
      createdAt: new Date().toISOString(),
    };
    await writeStoreFile(ACCOUNTS_FILE, [...accounts, account]);

    return { status: "created", account: toPublicAccount(account) };
  });
}

export async function listAccounts(): Promise<PublicAccount[]> {
  const stored = await readStoreFile<StoredAccount[]>(ACCOUNTS_FILE, []);
  return stored
    .map(toAccount)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(toPublicAccount);
}

export async function findAccountById(id: string): Promise<Account | null> {
  const stored = await readStoreFile<StoredAccount[]>(ACCOUNTS_FILE, []);
  const found = stored.find((account) => account.id === id);
  return found ? toAccount(found) : null;
}

/** Used by the sign-in route only; callers must not leak the hash. */
export async function findAccountByEmail(
  email: string,
): Promise<Account | null> {
  const emailKey = normalizeEmail(email);
  const stored = await readStoreFile<StoredAccount[]>(ACCOUNTS_FILE, []);
  const found = stored.find((account) => account.emailKey === emailKey);
  return found ? toAccount(found) : null;
}

export type UpdateRoleResult =
  | { status: "updated"; account: PublicAccount }
  | { status: "not_found" };

export async function updateAccountRole(
  id: string,
  role: Role,
): Promise<UpdateRoleResult> {
  return withStoreLock(async () => {
    const stored = await readStoreFile<StoredAccount[]>(ACCOUNTS_FILE, []);
    const index = stored.findIndex((account) => account.id === id);
    if (index === -1) return { status: "not_found" };

    const updated: Account = { ...toAccount(stored[index]), role };
    stored[index] = updated;
    await writeStoreFile(ACCOUNTS_FILE, stored);

    return { status: "updated", account: toPublicAccount(updated) };
  });
}

export type RequestResetResult =
  | { status: "sent"; resetUrl: string; expiresAt: string }
  | { status: "unknown_email" };

/**
 * Issues a reset link. Unknown addresses take the same success path from the
 * caller's point of view so the endpoint cannot be used to enumerate accounts.
 */
export async function requestPasswordReset(
  email: string,
  origin: string,
): Promise<RequestResetResult> {
  const emailKey = normalizeEmail(email);

  return withStoreLock(async () => {
    const accounts = (await readStoreFile<StoredAccount[]>(ACCOUNTS_FILE, [])).map(
      toAccount,
    );
    const account = accounts.find((entry) => entry.emailKey === emailKey);
    if (!account) return { status: "unknown_email" };

    const { token, tokenHash } = createResetToken();
    const now = Date.now();
    const expiresAt = new Date(now + RESET_TOKEN_TTL_MS).toISOString();

    // Drop this account's earlier unused tokens: only the newest link works.
    const resets = (
      await readStoreFile<PasswordReset[]>(RESETS_FILE, [])
    ).filter((reset) => reset.usedAt !== null || reset.accountId !== account.id);
    resets.push({
      id: randomUUID(),
      accountId: account.id,
      tokenHash,
      createdAt: new Date(now).toISOString(),
      expiresAt,
      usedAt: null,
    });
    await writeStoreFile(RESETS_FILE, resets);

    const resetUrl = buildResetUrl(origin, token);
    const outbox = await readStoreFile<MockEmail[]>(OUTBOX_FILE, []);
    outbox.push({
      id: randomUUID(),
      to: account.email,
      subject: "Reset your Brightloop Software password",
      sentAt: new Date(now).toISOString(),
      resetUrl,
    });
    await writeStoreFile(OUTBOX_FILE, outbox);

    return { status: "sent", resetUrl, expiresAt };
  });
}

export type ResetPasswordResult =
  | { status: "reset" }
  | { status: "invalid_token" };

export async function resetPasswordWithToken(
  token: string,
  password: string,
): Promise<ResetPasswordResult> {
  const tokenHash = hashResetToken(token);
  const passwordHash = await hashPassword(password);

  return withStoreLock(async () => {
    const resets = await readStoreFile<PasswordReset[]>(RESETS_FILE, []);
    const reset = resets.find(
      (entry) =>
        entry.tokenHash === tokenHash &&
        entry.usedAt === null &&
        Date.parse(entry.expiresAt) > Date.now(),
    );
    if (!reset) return { status: "invalid_token" };

    const stored = await readStoreFile<StoredAccount[]>(ACCOUNTS_FILE, []);
    const account = stored.find((entry) => entry.id === reset.accountId);
    if (!account) return { status: "invalid_token" };

    account.passwordHash = passwordHash;
    reset.usedAt = new Date().toISOString();

    await writeStoreFile(ACCOUNTS_FILE, stored);
    await writeStoreFile(RESETS_FILE, resets);

    return { status: "reset" };
  });
}
