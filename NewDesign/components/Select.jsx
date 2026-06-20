const React = window.React;

/**
 * Select — native dropdown with the system chevron.
 * Pass `options` as strings or { value, label } objects.
 */
export function Select({ label, value, onChange, options = [], id, className = "", ...rest }) {
  const selectId = id || (label ? "sel-" + String(label).toLowerCase().replace(/\s+/g, "-") : undefined);
  const norm = options.map((o) => (typeof o === "object" ? o : { value: o, label: o }));
  const control = (
    <select
      id={selectId}
      className="select"
      value={value}
      onChange={(e) => onChange && onChange(e.target.value)}
      {...rest}
    >
      {norm.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
  if (!label) return control;
  return (
    <div className={"field " + className}>
      <label className="field__label" htmlFor={selectId}>{label}</label>
      {control}
    </div>
  );
}
