import * as React from "react";

export interface NavItemProps {
  /** Chat title (typically the truncated first user message). */
  title: string;
  /** Highlight as the active session. @default false */
  active?: boolean;
  onClick?: () => void;
  /** Show a delete (×) button on hover; called when clicked. */
  onDelete?: () => void;
  className?: string;
}

/** Recent-chat row for the dark sidebar (use inside an `on-dark` container). */
export function NavItem(props: NavItemProps): JSX.Element;
