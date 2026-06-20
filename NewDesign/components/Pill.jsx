const React = window.React;

/** Pill — accent-tinted label, e.g. the "AI Research" badge in the topbar. */
export function Pill({ children, icon = null, className = "", ...rest }) {
  return (
    <span className={"pill " + className} {...rest}>
      {icon ? <span aria-hidden="true">{icon}</span> : null}
      {children}
    </span>
  );
}
