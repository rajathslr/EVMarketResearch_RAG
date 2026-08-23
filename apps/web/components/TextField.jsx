"use client";

/**
 * TextField — labelled text input with optional error / hint.
 * Pass `error` to show the inline error state + message.
 */
export function TextField({
  label,
  value,
  onChange,
  type = "text",
  placeholder = "",
  error = "",
  hint = "",
  id,
  disabled = false,
  className = "",
  ...rest
}) {
  const inputId = id || (label ? "tf-" + String(label).toLowerCase().replace(/\s+/g, "-") : undefined);
  return (
    <div className={"field " + className}>
      {label ? <label className="field__label" htmlFor={inputId}>{label}</label> : null}
      <input
        id={inputId}
        type={type}
        className={"input" + (error ? " input--error" : "")}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        {...rest}
      />
      {error ? <span className="field__error">⚠ {error}</span>
        : hint ? <span className="field__hint">{hint}</span> : null}
    </div>
  );
}
