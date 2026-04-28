import React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className = "", id, ...props }, ref) => {
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
    
    return (
      <div className={`w-full ${className}`}>
        {label && (
          <label
            htmlFor={inputId}
            className="block text-[0.75rem] font-medium tracking-[0.12em] uppercase text-[var(--text-tertiary)] mb-2"
          >
            {label}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          className={[
            "block w-full px-3 py-2.5 border rounded-[2px] text-sm bg-[var(--surface)] text-[var(--text-primary)]",
            "placeholder:text-[var(--text-tertiary)]",
            "focus:outline-none focus:ring-2 focus:ring-[var(--brand)] focus:border-[var(--brand)]",
            error ? "border-[var(--error)]" : "border-[var(--border)]",
            props.disabled ? "opacity-60 bg-[var(--surface-alt)] cursor-not-allowed" : ""
          ].filter(Boolean).join(" ")}
          {...props}
        />
        {error && <p className="mt-2 text-sm text-[var(--error)]">{error}</p>}
        {helperText && !error && <p className="mt-2 text-sm text-[var(--text-tertiary)]">{helperText}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";
