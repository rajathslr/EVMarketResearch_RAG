"use client";

/** Card — surface container. `surface` for grey fill, `shadow` for elevation. */
export function Card({ children, surface = false, shadow = false, padLg = false, className = "", ...rest }) {
  const cls = [
    "card",
    surface ? "card--surface" : "",
    shadow ? "card--shadow" : "",
    padLg ? "card--pad-lg" : "",
    className,
  ].filter(Boolean).join(" ");
  return <div className={cls} {...rest}>{children}</div>;
}
