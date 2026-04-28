import React from "react";

export interface CardProps {
  children: React.ReactNode;
  variant?: "default" | "accent" | "danger";
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}

const variantStyles: Record<NonNullable<CardProps["variant"]>, string> = {
  default:
    "bg-[var(--ar-canvas)] border border-[var(--ar-hairline)] rounded-[var(--ar-r3,20px)]",
  accent:
    "bg-[var(--ar-accent-soft)] border border-[var(--ar-accent)] rounded-[var(--ar-r3,20px)]",
  danger:
    "bg-[var(--ar-danger-soft)] border border-[var(--ar-danger)] rounded-[var(--ar-r3,20px)]",
};

export const Card: React.FC<CardProps> & {
  Title: React.FC<{ children: React.ReactNode; className?: string }>;
  Meta: React.FC<{ children: React.ReactNode; className?: string }>;
  Actions: React.FC<{ children: React.ReactNode; className?: string }>;
} = ({ children, variant = "default", className = "", style, onClick }) => {
  const classes = [
    variantStyles[variant],
    "p-5",
    onClick ? "cursor-pointer" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} style={style} onClick={onClick}>
      {children}
    </div>
  );
};

Card.Title = ({ children, className = "" }) => (
  <h3 className={`text-base font-semibold text-[var(--ar-ink)] ${className}`}>
    {children}
  </h3>
);

Card.Meta = ({ children, className = "" }) => (
  <p className={`text-sm text-[var(--ar-slate)] ${className}`}>{children}</p>
);

Card.Actions = ({ children, className = "" }) => (
  <div
    className={`flex items-center gap-2 mt-4 ${className}`}
  >
    {children}
  </div>
);
