"use client";

import { CSSProperties, ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Adds hover-lift effect and pointer cursor */
  clickable?: boolean;
  /** Override default 24px padding — "sm" = 20px, "none" = 0 */
  padding?: "sm" | "md" | "none";
  onClick?: () => void;
}

export function Card({
  children,
  className = "",
  style,
  clickable = false,
  padding = "md",
  onClick,
}: CardProps) {
  const paddingStyle: CSSProperties =
    padding === "none" ? { padding: 0 } :
    padding === "sm"   ? { padding: "20px" } :
    { padding: "24px" };

  const classes = [
    "card",
    clickable ? "card-clickable" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={classes}
      style={{ ...paddingStyle, ...style }}
      onClick={onClick}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={
        clickable && onClick
          ? (e) => { if (e.key === "Enter" || e.key === " ") onClick(); }
          : undefined
      }
    >
      {children}
    </div>
  );
}

export default Card;
