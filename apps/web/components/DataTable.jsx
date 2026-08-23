"use client";

/**
 * DataTable — simple bordered table.
 * `columns`: [{ key, label, align?, render? }]. `rows`: array of objects.
 * A column's `render(row)` overrides the raw cell value.
 */
export function DataTable({ columns = [], rows = [], className = "", empty = "No data" }) {
  return (
    <div className={"table-wrap " + className}>
      <table className="table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={c.align === "right" ? "table__num" : ""}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={columns.length} className="table__muted" style={{ textAlign: "center", padding: "24px" }}>{empty}</td></tr>
          ) : rows.map((row, ri) => (
            <tr key={row.id != null ? row.id : ri}>
              {columns.map((c) => (
                <td key={c.key} className={c.align === "right" ? "table__num" : ""}>
                  {c.render ? c.render(row) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
