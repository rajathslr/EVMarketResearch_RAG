const React = window.React;

/**
 * Badge — small uppercase status / role pill.
 * Use `role` for the three app roles, or `tone` for generic semantics.
 */
export function Badge({ children, tone = "neutral", role, dot = false, className = "", ...rest }) {
  const toneClass = role
    ? ({ superadmin: "indigo", superuser: "green", user: "grey" }[role] || "grey")
    : tone;
  return (
    <span className={`badge badge--${toneClass} ${className}`} {...rest}>
      {dot ? <span className="badge__dot" aria-hidden="true">●</span> : null}
      {children || (role ? role : null)}
    </span>
  );
}
