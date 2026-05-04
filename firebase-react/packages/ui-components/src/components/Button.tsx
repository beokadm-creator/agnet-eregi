import React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = "primary",
  size = "md",
  isLoading = false,
  className = "",
  disabled,
  ...props
}) => {
  const baseStyles =
    "inline-flex items-center justify-center font-medium tracking-wide transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--ar-paper)] rounded-lg";
  
  const variants = {
    primary: "bg-[var(--ar-accent)] text-[var(--ar-canvas)] hover:bg-[var(--ar-accent-hover)] focus:ring-[var(--ar-accent)]",
    secondary:
      "bg-transparent text-[var(--ar-ink)] border border-[var(--ar-hairline-strong)] hover:bg-[var(--ar-canvas)] focus:ring-[var(--ar-accent)]",
    danger: "bg-[var(--ar-danger)] text-[var(--ar-canvas)] hover:opacity-90 focus:ring-[var(--ar-danger)]"
  };

  const sizes = {
    sm: "px-3 py-2 text-xs",
    md: "px-4 py-2.5 text-sm",
    lg: "px-6 py-3 text-base"
  };

  const classes = [
    baseStyles,
    variants[variant],
    sizes[size],
    (disabled || isLoading) ? "opacity-50 cursor-not-allowed" : "",
    className
  ].filter(Boolean).join(" ");

  return (
    <button className={classes} disabled={disabled || isLoading} {...props}>
      {isLoading && (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      )}
      {children}
    </button>
  );
};
