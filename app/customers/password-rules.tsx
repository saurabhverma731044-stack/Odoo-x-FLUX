"use client";

import { PASSWORD_RULES } from "@/lib/validation";

/** Live checklist showing which password requirements are met. */
export default function PasswordRules({ password }: { password: string }) {
  return (
    <ul className="rules" aria-label="Password requirements">
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(password);
        return (
          <li key={rule.id} data-met={met}>
            <span className="rule-dot" aria-hidden="true">
              ✓
            </span>
            <span>
              {rule.label}
              <span className="sr-only">{met ? " — met" : " — not met yet"}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
