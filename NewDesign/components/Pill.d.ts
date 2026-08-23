import * as React from "react";

export interface PillProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Optional leading icon node. */
  icon?: React.ReactNode;
}

/** Accent-tinted rounded label (e.g. the "AI Research" topbar pill). */
export function Pill(props: PillProps): JSX.Element;
