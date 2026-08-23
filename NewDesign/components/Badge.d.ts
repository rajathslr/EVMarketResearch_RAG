import * as React from "react";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Generic semantic tone. @default "neutral" */
  tone?: "neutral" | "indigo" | "green" | "grey" | "success" | "danger" | "warning";
  /** App role — sets color + default label automatically. Overrides `tone`. */
  role?: "superadmin" | "superuser" | "user";
  /** Show a leading dot. @default false */
  dot?: boolean;
}

/** Small uppercase status / role badge. */
export function Badge(props: BadgeProps): JSX.Element;
