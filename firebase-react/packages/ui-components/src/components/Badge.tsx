import React from "react";

export interface BadgeProps {
  children: React.ReactNode;
  variant?: "success" | "warning" | "error" | "info" | "neutral";
  className?: string;
  style?: React.CSSProperties;
}

const variantStyles: Record<NonNullable<BadgeProps["variant"]>, string> = {
  success: "bg-[var(--ar-success-soft)] text-[var(--ar-success)]",
  warning: "bg-[var(--ar-warning-soft)] text-[var(--ar-warning)]",
  error: "bg-[var(--ar-danger-soft)] text-[var(--ar-danger)]",
  info: "bg-[var(--ar-info-soft)] text-[var(--ar-info)]",
  neutral: "bg-[var(--ar-surface-muted)] text-[var(--ar-slate)]",
};

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = "neutral",
  className = "",
  style,
}) => {
  const classes = [
    "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide",
    variantStyles[variant],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes} style={style}>
      {children}
    </span>
  );
};
