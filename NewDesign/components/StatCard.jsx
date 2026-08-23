const React = window.React;

/** StatCard — a labelled metric tile for the admin overview. */
export function StatCard({ label, value, delta, deltaDir, className = "" }) {
  return (
    <div className={"stat " + className}>
      <div className="stat__label">{label}</div>
      <div className="stat__value">{value}</div>
      {delta ? (
        <div className={"stat__delta " + (deltaDir === "down" ? "stat__delta--down" : "stat__delta--up")}>
          {deltaDir === "down" ? "▼" : "▲"} {delta}
        </div>
      ) : null}
    </div>
  );
}
