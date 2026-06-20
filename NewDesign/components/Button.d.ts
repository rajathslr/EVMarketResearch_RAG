import * as React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style. @default "primary" */
  variant?: "primary" | "ghost" | "subtle" | "danger" | "ghost-danger";
  /** Control height. @default "md" */
  size?: "sm" | "md" | "lg";
  /** Stretch to full container width. @default false */
  block?: boolean;
  /** Leading icon node (e.g. an emoji or SVG). */
  icon?: React.ReactNode;
  /** Trailing icon node. */
  iconRight?: React.ReactNode;
}

/** Primary action control with accent / ghost / danger variants. */
export function Button(props: ButtonProps): JSX.Element;
