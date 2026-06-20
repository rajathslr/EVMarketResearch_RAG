import * as React from "react";

export interface Column<Row = any> {
  /** Object key on each row. */
  key: string;
  /** Header label. */
  label: string;
  /** Cell alignment. @default "left" */
  align?: "left" | "right";
  /** Custom cell renderer — overrides the raw value. */
  render?: (row: Row) => React.ReactNode;
}

export interface DataTableProps<Row = any> {
  columns: Column<Row>[];
  rows: Row[];
  /** Message when there are no rows. @default "No data" */
  empty?: React.ReactNode;
  className?: string;
}

/** Bordered data table with optional per-column renderers. */
export function DataTable(props: DataTableProps): JSX.Element;
