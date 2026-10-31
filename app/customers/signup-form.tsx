"use client";

import Link from "next/link";
import { useState } from "react";
import type { FormEvent } from "react";
import {
  normalizeEmail,
  passwordRuleLabel,
  validateEmail,
  validatePassword,
  type PasswordRuleId,
} from "@/lib/validation";
import PasswordRules from "./password-rules";

type SignupState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "created"; email: string }
  | {
      kind: "error";
      message: string;
      emailError?: string;
      passwordErrors?: PasswordRuleId[];
    };

type ResetState =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent"; message: string; mockResetUrl?: string }
  | { kind: "error"; message: string };

export default function SignupForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<SignupState>({ kind: "idle" });

  const [resetEmail, setResetEmail] = useState("");
  const [resetState, setResetState] = useState<ResetState>({ kind: "idle" });

  const passwordCheck = validatePassword(password);
  const submitting = state.kind === "submitting";
  const sendingReset = resetState.kind === "sending";

  async function handleSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const emailError = validateEmail(email);
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
      const response = await fetch("/customers/api/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: normalizeEmail(email), password }),
      });
      const data = await response.json().catch(() => ({}));

      if (response.status === 201) {
        setState({ kind: "created", email: normalizeEmail(email) });
        return;
      }

      if (response.status === 409) {
        setState({
          kind: "error",
          message:
            "An account with this email already exists. Use “Forgot your password?” below if you need access to it.",
          emailError: "This email is already registered.",
        });
        return;
      }

      setState({
        kind: "error",
        message:
          data?.message ?? "We could not create your account. Please try again.",
        emailError: data?.fieldErrors?.email,
        passwordErrors: data?.fieldErrors?.password,
      });
    } catch {
      setState({
        kind: "error",
        message: "Network error — check your connection and try again.",
      });
    }
  }

  async function handleResetRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = normalizeEmail(resetEmail || email);
    const emailError = validateEmail(target);
    if (emailError) {
      setResetState({ kind: "error", message: emailError });
      return;
    }

    setResetState({ kind: "sending" });
    try {
      const response = await fetch("/customers/api/password-reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: target }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setResetState({
          kind: "error",
          message: data?.message ?? "We could not send a reset link. Try again.",
        });
        return;
      }

      setResetState({
        kind: "sent",
        message: data?.message ?? "If that account exists, a reset link is on its way.",
        mockResetUrl: data?.mockResetUrl,
      });
    } catch {
      setResetState({
        kind: "error",
        message: "Network error — check your connection and try again.",
      });
    }
  }

  if (state.kind === "created") {
    return (
      <div className="form-stack">
        <div className="form-heading">
          <p className="eyebrow" style={{ color: "var(--accent)" }}>
            Welcome aboard
          </p>
          <h2>Your account is ready</h2>
        </div>
        <div className="done">
          <h2>Account created</h2>
          <p>
            Brightloop account for <strong>{state.email}</strong> is set up. One
            account per email means you can use it everywhere Brightloop runs.
          </p>
        </div>
        <Link className="button" href="/customers/account">
          Go to my account
        </Link>
        <p className="hint">
          Forgot the password you just chose? Request a reset link from the
          signup page.
        </p>
      </div>
    );
  }

  return (
    <div className="form-stack">
      <div className="form-heading">
        <h2>Create your account</h2>
        <p>Use a work email you check regularly.</p>
      </div>

      <form className="stack" onSubmit={handleSignup} noValidate>
        <div className="field">
          <label htmlFor="signup-email">Email address</label>
          <input
            id="signup-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={submitting}
            aria-invalid={state.kind === "error" && Boolean(state.emailError)}
            aria-describedby={state.kind === "error" && state.emailError ? "signup-email-error" : undefined}
          />
          {state.kind === "error" && state.emailError ? (
            <p className="field-error" id="signup-email-error">
              {state.emailError}
            </p>
          ) : null}
        </div>

        <div className="field">
          <label htmlFor="signup-password">Password</label>
          <input
            id="signup-password"
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
            aria-describedby="signup-password-rules"
          />
          <div id="signup-password-rules">
            <PasswordRules password={password} />
          </div>
          {state.kind === "error" && state.passwordErrors?.length ? (
            <p className="field-error">
              Missing:{" "}
              {state.passwordErrors.map(passwordRuleLabel).join(", ")}.
            </p>
          ) : null}
        </div>

        {state.kind === "error" ? (
          <p className="alert" data-tone="error" role="alert">
            {state.message}
          </p>
        ) : null}

        <button className="button" type="submit" disabled={submitting}>
          {submitting ? "Creating account…" : "Create account"}
        </button>

        <p className="hint">
          By creating an account you agree to the Brightloop Software terms of
          service.
        </p>
      </form>

      <div className="divider">Password help</div>

      <form className="reset-block" onSubmit={handleResetRequest} noValidate>
        <h3>Forgot your password?</h3>
        <p className="hint">
          Enter your account email and we will email you a reset link. Each link
          works once and expires after an hour.
        </p>
        <div className="field">
          <label htmlFor="reset-email">Account email</label>
          <input
            id="reset-email"
            name="resetEmail"
            type="email"
            autoComplete="email"
            placeholder={email || "you@company.com"}
            value={resetEmail}
            onChange={(event) => setResetEmail(event.target.value)}
            disabled={sendingReset}
          />
        </div>
        <button className="button secondary" type="submit" disabled={sendingReset}>
          {sendingReset ? "Sending link…" : "Email me a reset link"}
        </button>

        <div aria-live="polite">
          {resetState.kind === "sent" ? (
            <div className="alert" data-tone="success">
              {resetState.message}
              {resetState.mockResetUrl ? (
                <p className="mock-link">
                  Development mock mailbox:{" "}
                  <a href={resetState.mockResetUrl}>open your reset link</a>
                  <br />
                  Copy it from the server log or <code>data/outbox.json</code> in
                  production-like runs.
                </p>
              ) : null}
            </div>
          ) : null}
          {resetState.kind === "error" ? (
            <p className="alert" data-tone="error">
              {resetState.message}
            </p>
          ) : null}
        </div>
      </form>
    </div>
  );
}
