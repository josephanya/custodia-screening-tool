"use client";

import { useState } from "react";

type PasswordFieldProps = {
  errorMessage: string | null;
  locked: boolean;
};

export function PasswordField({ errorMessage, locked }: PasswordFieldProps) {
  const [showPassword, setShowPassword] = useState(false);
  const errorId = errorMessage ? "nurse-password-error" : undefined;

  return (
    <label className="nursePasswordField">
      <span>Password</span>
      <span className="nursePasswordControl">
        <input
          name="password"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          aria-invalid={Boolean(errorMessage)}
          aria-describedby={errorId}
          disabled={locked}
        />
        <button
          type="button"
          className="passwordToggle"
          onClick={() => setShowPassword((current) => !current)}
          disabled={locked}
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          {showPassword ? "Hide" : "Show"}
        </button>
      </span>
      {errorMessage ? (
        <span id={errorId} className="fieldError" role="alert">
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v6M12 16.5v.5" />
          </svg>
          {errorMessage}
        </span>
      ) : null}
    </label>
  );
}
