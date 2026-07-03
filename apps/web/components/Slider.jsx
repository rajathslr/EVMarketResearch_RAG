"use client";

/**
 * Slider — labelled range input with live value read-out.
 * `format` lets you append units or render a custom value string.
 */
export function Slider({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  format,
  className = "",
  ...rest
}) {
  const shown = format ? format(value) : value;
  return (
    <div className={"slider " + className}>
      {(label || shown !== undefined) && (
        <div className="slider__head">
          {label ? <span className="slider__label">{label}</span> : <span />}
          <span className="slider__value">{shown}</span>
        </div>
      )}
      <input
        type="range"
        className="slider__input"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange && onChange(Number(e.target.value))}
        {...rest}
      />
    </div>
  );
}
