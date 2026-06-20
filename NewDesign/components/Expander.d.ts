import * as React from "react";

export interface ExpanderProps {
  /** Header content (e.g. "View 5 source chunks"). */
  title: React.ReactNode;
  children?: React.ReactNode;
  /** Initial open state when uncontrolled. @default false */
  defaultOpen?: boolean;
  /** Controlled open state. */
  open?: boolean;
  /** Called with the next open state (controlled mode). */
  onToggle?: (next: boolean) => void;
  className?: string;
}

/** Collapsible disclosure with rotating chevron. */
export function Expander(props: ExpanderProps): JSX.Element;
