import * as React from "react";

export type SelectOption = string | { value: string; label: string };

export interface SelectProps {
  /** Optional label rendered above the control. */
  label?: string;
  value: string;
  onChange?: (next: string) => void;
  /** Options as plain strings or { value, label } objects. */
  options: SelectOption[];
  id?: string;
  className?: string;
}

/** Native select styled with the design-system chevron + focus ring. */
export function Select(props: SelectProps): JSX.Element;
