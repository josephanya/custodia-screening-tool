"use client";

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
  size?: "public" | "nurse";
  variant?: "primary" | "secondary";
};

export function Button({
  children,
  className = "",
  disabled,
  loading = false,
  size = "public",
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`${variant === "primary" ? "primaryButton" : "secondaryButton"} ${size === "nurse" ? "buttonNurse" : "buttonPublic"} ${className}`.trim()}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <span className="buttonSpinner" aria-hidden="true" /> : null}
      {loading ? "Scoring…" : children}
    </button>
  );
}

type OptionTileProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  helper?: string;
  label: ReactNode;
  selected?: boolean;
};

export function OptionTile({ className = "", helper, label, selected = false, ...props }: OptionTileProps) {
  return (
    <button
      className={`optionTile ${selected ? "selected" : ""} ${className}`.trim()}
      role="radio"
      aria-checked={selected}
      type="button"
      {...props}
    >
      <span className="optionIndicator" aria-hidden="true" />
      <span className="optionText">
        <span>{label}</span>
        {helper ? <small>{helper}</small> : null}
      </span>
    </button>
  );
}

export function YesNoTile(props: OptionTileProps) {
  return <OptionTile {...props} className={`yesNoTile ${props.className ?? ""}`.trim()} />;
}

type NumberFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "prefix"> & {
  error?: string;
  helperText?: string;
  label?: string;
  unit: string;
};

export function NumberField({
  className = "",
  error,
  helperText,
  id,
  label,
  unit,
  ...props
}: NumberFieldProps) {
  const inputId = id ?? props.name;
  const helperId = inputId ? `${inputId}-helper` : undefined;
  const errorId = inputId ? `${inputId}-error` : undefined;

  return (
    <label className={`numberField ${error ? "numberFieldError" : ""} ${className}`.trim()}>
      {label ? <span className="numberFieldLabel">{label}</span> : null}
      <span className="numberFieldControl">
        <input
          aria-describedby={[helperText ? helperId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined}
          aria-invalid={error ? true : undefined}
          id={inputId}
          inputMode="decimal"
          type="text"
          {...props}
        />
        <span className="numberFieldUnit">{unit}</span>
      </span>
      {helperText ? (
        <span className="numberFieldHelper" id={helperId}>
          {helperText}
        </span>
      ) : null}
      {error ? (
        <span className="numberFieldErrorText" id={errorId} role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
}

export function ProgressBar({ label, value }: { label: string; value: number }) {
  const boundedValue = Math.min(100, Math.max(0, value));

  return (
    <div
      className="progressTrack"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(boundedValue)}
    >
      <div className="progressFill" style={{ width: `${boundedValue}%` }} />
    </div>
  );
}

type BadgeKind = "flag" | "urgent" | "emergency" | "routine" | "lower" | "higher";

export function Badge({ children, kind }: { children: ReactNode; kind: BadgeKind }) {
  return <span className={`screeningBadge screeningBadge-${kind}`}>{children}</span>;
}

type AlertKind = "info" | "error" | "urgent" | "emergency";

export function AlertBox({ children, kind }: { children: ReactNode; kind: AlertKind }) {
  return (
    <div className={`alertBox alertBox-${kind}`} role={kind === "info" ? "note" : "alert"}>
      <span className="alertIcon" aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

export function Toast({ children }: { children: ReactNode }) {
  return (
    <div className="toast" role="status">
      {children}
    </div>
  );
}
