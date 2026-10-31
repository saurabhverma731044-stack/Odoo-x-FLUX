"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";
import {
  PASSWORD_RULES,
  normalizeEmail,
  validateEmail,
  validatePassword,
} from "@/lib/validation";
import type { PasswordRuleId } from "@/lib/validation";

type State =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "created"; message: string }
  | { kind: "error"; message: string; emailError?: string; passwordErrors?: PasswordRuleId[] };

export default function AddStaffForm({ onClose }: { onClose?: () => void }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });

  const submitting = state.kind === "submitting";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const emailError = validateEmail(email);
    const passwordCheck = validatePassword(password);
    if (emailError || !passwordCheck.valid) {
      setState({
        kind: "error",
        message: "Please fix the highlighted fields.",
        emailError: emailError ?? undefined,
        passwordErrors: passwordCheck.valid ? undefined : passwordCheck.failed,
      });
      return;
    }

    setState({ kind: "submitting" });
    try {
      const response = await fetch("/customers/api/staff", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: normalizeEmail(email), password }),
      });
      const data = await response.json().catch(() => ({}));

      if (response.status !== 201) {
        setState({
          kind: "error",
          message: data?.message ?? "We could not add that staff member.",
          emailError: data?.fieldErrors?.email,
          passwordErrors: data?.fieldErrors?.password,
        });
        return;
      }

      setState({
        kind: "created",
        message:
          data?.message ??
          "Staff member added. Share the temporary password with them.",
      });
      setEmail("");
      setPassword("");
      router.refresh();
    } catch {
      setState({
        kind: "error",
        message: "Network error — check your connection and try again.",
      });
    }
  }

  return (
    <form className="panel stack" onSubmit={handleSubmit} noValidate>
      <div className="panel-head">
        <div>
          <h2>Add a staff member</h2>
          <p className="hint">
            Admin only. New accounts start as Internal staff — they can read the
            customer list but cannot change roles or add people.
          </p>
        </div>
        {onClose ? (
          <button className="button secondary small" type="button" onClick={onClose}>
            Close
          </button>
        ) : null}
      </div>

      <div className="field">
        <label htmlFor="staff-email">Work email</label>
        <input
          id="staff-email"
          name="email"
          type="email"
          autoComplete="off"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={submitting}
          aria-invalid={state.kind === "error" && Boolean(state.emailError)}
        />
        {state.kind === "error" && state.emailError ? (
          <p className="field-error">{state.emailError}</p>
        ) : null}
      </div>

      <div className="field">
        <label htmlFor="staff-password">Temporary password</label>
        <input
          id="staff-password"
          name="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={submitting}
          aria-describedby="staff-password-rules"
        />
        <ul className="rules" id="staff-password-rules" aria-label="Password requirements">
          {PASSWORD_RULES.map((rule) => (
            <li key={rule.id} data-met={rule.test(password)}>
              <span className="rule-dot" aria-hidden="true">
                ✓
              </span>
              <span>{rule.label}</span>
            </li>
          ))}
        </ul>
        {state.kind === "error" && state.passwordErrors?.length ? (
          <p className="field-error">
            Missing password requirements: {state.passwordErrors.length}.
          </p>
        ) : null}
      </div>

      {state.kind === "created" ? (
        <p className="alert" data-tone="success" role="status">
          {state.message}
        </p>
      ) : null}
      {state.kind === "error" ? (
        <p className="alert" data-tone="error" role="alert">
          {state.message}
        </p>
      ) : null}

      <div className="panel-actions">
        <button className="button" type="submit" disabled={submitting}>
          {submitting ? "Adding staff…" : "Add staff member"}
        </button>
      </div>
    </form>
  );
}
