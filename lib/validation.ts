/**
 * Shared account validation rules.
 *
 * These run in the browser (live feedback) and on the server (authoritative
 * check in the API route), so the rules live in one dependency-free module.
 */

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Returns an error message, or null when the address looks usable. */
export function validateEmail(email: string): string | null {
  const value = email.trim();
  if (value.length === 0) return "Enter your email address.";
  if (value.length > 254) return "That email address is too long.";
  if (!EMAIL_PATTERN.test(value)) return "Enter a valid email address, like you@company.com.";
  return null;
}

export type PasswordRuleId = "length" | "uppercase" | "lowercase" | "special";

export type PasswordRule = {
  id: PasswordRuleId;
  label: string;
  test: (password: string) => boolean;
};

/**
 * Brightloop policy: strictly more than 8 characters, with at least one
 * uppercase letter, one lowercase letter and one special character.
 */
export const PASSWORD_RULES: readonly PasswordRule[] = [
  {
    id: "length",
    label: "More than 8 characters",
    test: (password) => password.length > 8,
  },
  {
    id: "uppercase",
    label: "At least one uppercase letter (A–Z)",
    test: (password) => /[A-Z]/.test(password),
  },
  {
    id: "lowercase",
    label: "At least one lowercase letter (a–z)",
    test: (password) => /[a-z]/.test(password),
  },
  {
    id: "special",
    label: "At least one special character (! @ # $ …)",
    test: (password) => /[^A-Za-z0-9]/.test(password),
  },
];

export type PasswordValidation = {
  valid: boolean;
  failed: PasswordRuleId[];
};

export function validatePassword(password: string): PasswordValidation {
  const failed = PASSWORD_RULES.filter((rule) => !rule.test(password)).map(
    (rule) => rule.id,
  );
  return { valid: failed.length === 0, failed };
}

export function passwordRuleLabel(id: PasswordRuleId): string {
  return PASSWORD_RULES.find((rule) => rule.id === id)?.label ?? id;
}
