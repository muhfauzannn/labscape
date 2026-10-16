import type { ReactNode } from "react";
/** Input must share this id and reference the description via aria-describedby. */
export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {(error || hint) && (
        <p
          id={`${id}-description`}
          className={error ? "field-error" : "field-hint"}
        >
          {error || hint}
        </p>
      )}
    </div>
  );
}
