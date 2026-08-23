"use client";

/**
 * Tabs — horizontal tab strip. Controlled via `value` + `onChange`.
 * `items`: array of strings or { value, label }.
 */
export function Tabs({ items = [], value, onChange, className = "" }) {
  const norm = items.map((t) => (typeof t === "object" ? t : { value: t, label: t }));
  return (
    <div className={"tabs " + className} role="tablist">
      {norm.map((t) => (
        <button
          key={t.value}
          type="button"
          role="tab"
          aria-selected={value === t.value}
          className={"tab" + (value === t.value ? " tab--active" : "")}
          onClick={() => onChange && onChange(t.value)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
