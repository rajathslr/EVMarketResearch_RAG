"use client";

/**
 * Avatar — initials chip. Pass `name` to auto-derive initials, or `initials`.
 * `kind`: user (accent) | assistant (dark) | muted.
 */
export function Avatar({ name = "", initials, kind = "user", size = "md", className = "", ...rest }) {
  const text = initials || name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("") || "?";
  const cls = [
    "avatar",
    size !== "md" ? `avatar--${size}` : "",
    kind === "assistant" ? "avatar--assistant" : "",
    kind === "muted" ? "avatar--muted" : "",
    className,
  ].filter(Boolean).join(" ");
  return <span className={cls} {...rest}>{text}</span>;
}
