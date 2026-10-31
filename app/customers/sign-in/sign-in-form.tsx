"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";
import { normalizeEmail, validateEmail } from "@/lib/validation";

type State =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "error"; message: string; emailError?: string };

export default function SignInForm({ next }: { next: string | null }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });

  const submitting = state.kind === "submitting";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const emailError = validateEmail(email);
    if (emailError || password.length === 0) {
      setState({
        kind: "error",
        message: emailError ?? "Enter your password.",
        emailError: emailError ?? undefined,
      });
      return;
    }

    setState({ kind: "submitting" });
    try {
      const response = await fetch("/customers/api/sign-in", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: normalizeEmail(email), password }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setState({
          kind: "error",
          message:
            data?.message ?? "We could not sign you in. Please try again.",
          emailError: data?.fieldErrors?.email,
        });
        return;
      }

      router.push(next ?? data?.redirectTo ?? "/customers/account");
      router.refresh();
    } catch {
      setState({
        kind: "error",
        message: "Network error — check your connection and try again.",
      });
    }
  }

  return (
    <form className="stack" onSubmit={handleSubmit} noValidate>
      <div className="field">
        <label htmlFor="signin-email">Email address</label>
        <input
          id="signin-email"
          name="email"
          type="email"
          autoComplete="email"
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
        <label htmlFor="signin-password">Password</label>
        <input
          id="signin-password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={submitting}
        />
      </div>

      {state.kind === "error" ? (
        <p className="alert" data-tone="error" role="alert">
          {state.message}
        </p>
      ) : null}

      <button className="button" type="submit" disabled={submitting}>
        {submitting ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
