"use client";

import Link from "next/link";
import { useState } from "react";
import type { FormEvent } from "react";
import {
  passwordRuleLabel,
  validatePassword,
  type PasswordRuleId,
} from "@/lib/validation";
import PasswordRules from "../password-rules";

type ResetFormState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "done"; message: string }
  | { kind: "error"; message: string; passwordErrors?: PasswordRuleId[] };

export default function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [state, setState] = useState<ResetFormState>({ kind: "idle" });

  const passwordCheck = validatePassword(password);
  const submitting = state.kind === "submitting";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!passwordCheck.valid) {
      setState({
        kind: "error",
        message: "Please fix the highlighted fields.",
        passwordErrors: passwordCheck.failed,
      });
      return;
    }

    setState({ kind: "submitting" });
    try {
      const response = await fetch("/customers/api/password-reset/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setState({
          kind: "error",
          message:
            data?.message ??
            "We could not reset your password. Request a new link and try again.",
          passwordErrors: data?.fieldErrors?.password,
        });
        return;
      }

      setState({
        kind: "done",
        message: data?.message ?? "Your password has been reset.",
      });
    } catch {
      setState({
        kind: "error",
        message: "Network error — check your connection and try again.",
      });
    }
  }

  if (state.kind === "done") {
    return (
      <div className="form-stack">
        <div className="done">
          <h2>Password updated</h2>
          <p>{state.message}</p>
        </div>
        <Link className="button" href="/customers/sign-in">
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <form className="stack" onSubmit={handleSubmit} noValidate>
      <div className="field">
        <label htmlFor="reset-password">New password</label>
        <input
          id="reset-password"
          name="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={submitting}
          aria-invalid={
            (state.kind === "error" && Boolean(state.passwordErrors?.length)) ||
            (password.length > 0 && !passwordCheck.valid)
          }
          aria-describedby="reset-password-rules"
        />
        <div id="reset-password-rules">
          <PasswordRules password={password} />
        </div>
        {state.kind === "error" && state.passwordErrors?.length ? (
          <p className="field-error">
            Missing: {state.passwordErrors.map(passwordRuleLabel).join(", ")}.
          </p>
        ) : null}
      </div>

      {state.kind === "error" ? (
        <p className="alert" data-tone="error" role="alert">
          {state.message}
        </p>
      ) : null}

      <button className="button" type="submit" disabled={submitting}>
        {submitting ? "Saving…" : "Set new password"}
      </button>
    </form>
  );
}
