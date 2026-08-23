"use client";

/** Toggle — on/off switch with optional inline label. Controlled via `checked`. */
export function Toggle({ checked = false, onChange, label = "", disabled = false, className = "", ...rest }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange && onChange(!checked)}
      className={"toggle " + (checked ? "toggle--on " : "") + className}
      style={{ background: "none", border: "none", opacity: disabled ? 0.55 : 1 }}
      {...rest}
    >
      <span className="toggle__track"><span className="toggle__thumb" /></span>
      {label ? <span className="toggle__label">{label}</span> : null}
    </button>
  );
}
