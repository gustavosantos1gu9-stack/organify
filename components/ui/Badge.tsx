"use client";

import { ReactNode, CSSProperties } from "react";

export type BadgeVariant =
  | "default"
  | "success"
  | "alert"
  | "warning"
  | "caution"
  | "phase3"
  | "phase4"
  | "oscillating"
  | "neutral"
  | "brand";

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
  style?: CSSProperties;
}

const VARIANT_CLASS: Record<BadgeVariant, string> = {
  default:    "badge badge-neutral",
  success:    "badge badge-green",
  alert:      "badge badge-alert",
  warning:    "badge badge-warning",
  caution:    "badge badge-caution",
  phase3:     "badge badge-phase3",
  phase4:     "badge badge-phase4",
  oscillating:"badge badge-oscillating",
  neutral:    "badge badge-neutral",
  brand:      "badge badge-brand",
};

export function Badge({ children, variant = "default", className = "", style }: BadgeProps) {
  const classes = [VARIANT_CLASS[variant], className].filter(Boolean).join(" ");
  return (
    <span className={classes} style={style}>
      {children}
    </span>
  );
}

/**
 * StatusPill — same as Badge but semantically named for phase/status display.
 * Accepts the same props.
 */
export function StatusPill(props: BadgeProps) {
  return <Badge {...props} />;
}

export default Badge;
