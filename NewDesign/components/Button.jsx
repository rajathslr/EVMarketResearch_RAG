const React = window.React;

/**
 * Button — primary action control.
 * Variants: primary (accent fill), ghost (bordered), subtle (grey fill),
 * danger, ghost-danger. Sizes: sm | md | lg. Use `block` for full width.
 */
export function Button({
  children,
  variant = "primary",
  size = "md",
  block = false,
  icon = null,
  iconRight = null,
  disabled = false,
  type = "button",
  onClick,
  className = "",
  ...rest
}) {
  const cls = [
    "btn",
    `btn--${variant}`,
    size !== "md" ? `btn--${size}` : "",
    block ? "btn--block" : "",
    className,
  ].filter(Boolean).join(" ");

  return (
    <button type={type} className={cls} disabled={disabled} onClick={onClick} {...rest}>
      {icon ? <span className="btn__icon" aria-hidden="true">{icon}</span> : null}
      {children}
      {iconRight ? <span className="btn__icon" aria-hidden="true">{iconRight}</span> : null}
    </button>
  );
}
