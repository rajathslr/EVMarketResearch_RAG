import * as React from "react";

export interface StatCardProps {
  /** Uppercase metric label. */
  label: string;
  /** Primary value (string or number). */
  value: React.ReactNode;
  /** Optional change indicator text, e.g. "12% vs last week". */
  delta?: string;
  /** Direction of the delta. @default "up" */
  deltaDir?: "up" | "down";
  className?: string;
}

/** Metric tile for admin dashboards. */
export function StatCard(props: StatCardProps): JSX.Element;
