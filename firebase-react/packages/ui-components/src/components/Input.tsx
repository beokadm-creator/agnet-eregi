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
            className="block text-[0.75rem] font-medium tracking-[0.12em] uppercase text-[var(--ar-graphite)] mb-2"
          >
            {label}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          className={[
            "block w-full px-3 py-3 border rounded-lg text-sm bg-[var(--ar-canvas)] text-[var(--ar-ink)] h-12",
            "placeholder:text-[var(--ar-slate)]",
            "focus:outline-none focus:ring-2 focus:ring-[var(--ar-accent)] focus:border-[var(--ar-accent)]",
            error ? "border-[var(--ar-danger)]" : "border-[var(--ar-hairline)]",
            props.disabled ? "opacity-60 bg-[var(--ar-paper-alt)] cursor-not-allowed" : ""
          ].filter(Boolean).join(" ")}
          {...props}
        />
        {error && <p className="mt-2 text-sm text-[var(--ar-danger)]">{error}</p>}
        {helperText && !error && <p className="mt-2 text-sm text-[var(--ar-slate)]">{helperText}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";
