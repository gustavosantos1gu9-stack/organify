"use client";

import { CSSProperties, ReactNode, ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "tertiary" | "ghost" | "danger";
type Size    = "sm" | "md";

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "style"> {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  className?: string;
  style?: CSSProperties;
}

const VARIANT_CLASS: Record<Variant, string> = {
  primary:   "btn-primary",
  secondary: "btn-secondary",
  tertiary:  "btn-tertiary",
  ghost:     "btn-ghost",
  danger:    "btn-danger",
};

/** Height + padding per size */
const SIZE_STYLE: Record<Size, CSSProperties> = {
  md: { height: "44px", padding: "0 20px", fontSize: "13px" },
  sm: { height: "36px", padding: "0 16px", fontSize: "12px" },
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  className = "",
  style,
  disabled,
  type = "button",
  onClick,
  ...rest
}: ButtonProps) {
  const classes = [
    VARIANT_CLASS[variant],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type={type}
      className={classes}
      style={{ ...SIZE_STYLE[size], ...style }}
      disabled={disabled}
      onClick={onClick}
      {...rest}
    >
      {children}
    </button>
  );
}

export default Button;
